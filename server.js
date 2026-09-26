/* ═════════════════════════════════════════════════════════
   Elementaria Online — server.js (servidor autoritativo)

   • Sirve la interfaz (index.html, style.css, client.js).
   • Asigna ID único a cada jugador.
   • Mantiene en memoria el mundo compartido: posición (tile) + avatar
     (pixel-art 25x25) de cada jugador.
   • Sincroniza en tiempo real movimientos y entradas/salidas.
   • Sin base de datos.

   El mundo es una rejilla de tiles WORLD.W x WORLD.H. El servidor valida
   que las coordenadas estén dentro de los límites antes de difundirlas.
   ═════════════════════════════════════════════════════════ */

const express  = require('express');
const http     = require('http');
const { Server } = require('socket.io');
const path     = require('path');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { maxHttpBufferSize: 1e6 }); // avatar ~ hasta 1MB

app.use(express.static(path.join(__dirname)));

// Mundo compartido (rejilla de tiles)
const WORLD = { W: 48, H: 13, TILE: 16 };

// Terreno por tiles (debe coincidir con el cliente): 'W' muro infranqueable.
const GREEN_PIXELS = new Set(['24,1','25,1','25,3','26,2','26,3','26,4','27,3','27,4','27,8','28,7','28,8','28,10','29,6','29,8','29,9','30,3','30,7','30,9']);
function serverTileAt(x, y) {
  if (x >= WORLD.W - 1) return 'W';                 // borde negro (col 47)
  if (x === 0) return (y >= 4 && y <= 8) ? 'S' : 'G';
  if (GREEN_PIXELS.has(x + ',' + y)) return 'G';
  if (x >= 24) return 'D';
  return 'G';
}
const SPAWN = { tx: 12, ty: 6 };

// players: id -> { id, tx, ty, avatar, name, equipped, stats }
const players = new Map();

// Monedas Q soltadas en el campo: id -> { id, tx, ty, amount }
const coins = new Map();
let coinSeq = 0;

// Construye y difunde la tabla de clasificación (electrones, Q, victorias)
function broadcastLeaderboard() {
  const board = [];
  players.forEach((p) => {
    const s = p.stats || {};
    board.push({
      id: p.id,
      name: p.name || p.id.slice(0, 4),
      electrons: Math.max(0, parseInt(s.electrons, 10) || 0),
      Q: Math.max(0, parseInt(s.Q, 10) || 0),
      wins: Math.max(0, parseInt(s.wins, 10) || 0)
    });
  });
  // Orden: más victorias, luego más Q, luego más electrones
  board.sort((a, b) => b.wins - a.wins || b.Q - a.Q || b.electrons - a.electrons);
  io.emit('leaderboard', board);
}

// Invitaciones PVP pendientes: destinatarioId -> invitadorId
const pendingInvite = new Map();
// Batallas PVP activas: socketId -> oponenteId (bidireccional)
const inBattle = new Map();

// ── Intercambios (trueque) ──
// Invitaciones de intercambio pendientes: destinatarioId -> invitadorId
const pendingTradeInvite = new Map();
// Intercambios activos: socketId -> parejaId (bidireccional)
const inTrade = new Map();
// Datos de cada participante: socketId -> { offer:{...}, confirmed:bool }
const tradeData = new Map();

// ── Grupos (co-op) ──
const groups = new Map();            // groupId -> Set(socketId)
const playerGroup = new Map();       // socketId -> groupId
const pendingGroupInvite = new Map();// destinatarioId -> invitadorId
const inGroupBattle = new Map();     // socketId -> hostId
let groupSeq = 1;
function groupMembers(gid){
  const s = groups.get(gid); if (!s) return [];
  return Array.from(s).filter(id => players.has(id));
}
function groupInfo(gid){
  return groupMembers(gid).map(id => { const p = players.get(id); return { id, name: (p && p.name) || id.slice(0, 4) }; });
}
function broadcastGroup(gid){
  const info = groupInfo(gid);
  groupMembers(gid).forEach(id => io.to(id).emit('group-update', { members: info }));
}
function leaveGroup(id){
  const gid = playerGroup.get(id);
  if (!gid){ return; }
  playerGroup.delete(id);
  const s = groups.get(gid);
  if (!s) return;
  s.delete(id);
  const rest = groupMembers(gid);
  if (rest.length <= 1){
    rest.forEach(m => { playerGroup.delete(m); io.to(m).emit('group-update', { members: [] }); });
    groups.delete(gid);
  } else {
    broadcastGroup(gid);
  }
}

const TRADE_KEYS = ['up', 'down', 'proton', 'neutron', 'electron', 'hydrogen'];
function emptyOffer() { return { up: 0, down: 0, proton: 0, neutron: 0, electron: 0, hydrogen: 0 }; }
// Limpia una oferta: enteros >= 0 y como máximo 5 objetos en total
function sanitizeOffer(o) {
  const out = emptyOffer();
  let total = 0;
  if (o && typeof o === 'object') {
    for (const k of TRADE_KEYS) {
      let v = parseInt(o[k], 10);
      if (!Number.isFinite(v) || v < 0) v = 0;
      out[k] = v; total += v;
    }
  }
  if (total > 5) {
    for (const k of TRADE_KEYS) {
      while (total > 5 && out[k] > 0) { out[k]--; total--; }
    }
  }
  return out;
}
function broadcastTradeState(aId, bId) {
  const a = tradeData.get(aId), b = tradeData.get(bId);
  if (!a || !b) return;
  const payload = {
    offers:    { [aId]: a.offer,     [bId]: b.offer },
    confirmed: { [aId]: a.confirmed, [bId]: b.confirmed }
  };
  io.to(aId).emit('trade-state', payload);
  io.to(bId).emit('trade-state', payload);
}
function cleanupTrade(id) {
  const partner = inTrade.get(id);
  inTrade.delete(id); tradeData.delete(id);
  if (partner) { inTrade.delete(partner); tradeData.delete(partner); }
  return partner;
}

function spawnTile() {
  return { tx: SPAWN.tx, ty: SPAWN.ty };
}

io.on('connection', (socket) => {
  console.log(`[+] Conexión: ${socket.id}`);

  // Enviar ID y datos del mundo. El jugador aún NO aparece hasta que
  // envíe su avatar con 'join' (tras crear su personaje).
  socket.emit('init', { id: socket.id, world: WORLD });

  // El cliente entra al mundo con su personaje ya dibujado
  socket.on('join', (data) => {
    const spawn  = spawnTile();
    const player = {
      id: socket.id,
      tx: spawn.tx,
      ty: spawn.ty,
      avatar: Array.isArray(data && data.avatar) ? data.avatar : null,
      name: (data && typeof data.name === 'string') ? data.name.slice(0, 12) : '',
      equipped: (data && typeof data.equipped === 'string') ? data.equipped.slice(0, 16) : 'proton',
      partyKeys: ['proton'],
      stats: {
        electrons: (data && data.stats) ? (parseInt(data.stats.electrons, 10) || 0) : 0,
        Q:         (data && data.stats) ? (parseInt(data.stats.Q, 10) || 0) : 0,
        wins:      (data && data.stats) ? (parseInt(data.stats.wins, 10) || 0) : 0
      }
    };
    players.set(socket.id, player);

    // A mí: lista de los que ya estaban
    const existing = [];
    players.forEach((p, pid) => { if (pid !== socket.id) existing.push(p); });
    socket.emit('existing-players', existing);

    // A mí: monedas Q que ya están tiradas en el campo
    socket.emit('coins-existing', Array.from(coins.values()));

    // A todos: entré yo
    io.emit('player-joined', player);
    broadcastLeaderboard();
    console.log(`[→] ${socket.id} entró al mundo (${players.size} jugadores)`);
  });

  // Movimiento por tiles — el servidor valida los límites y difunde
  socket.on('move', (data) => {
    const p = players.get(socket.id);
    if (!p) return;
    const tx = Math.max(0, Math.min(WORLD.W - 1, parseInt(data.tx, 10)));
    const ty = Math.max(0, Math.min(WORLD.H - 1, parseInt(data.ty, 10)));
    if (Number.isNaN(tx) || Number.isNaN(ty)) return;
    if (serverTileAt(tx, ty) === 'W') return;  // el muro es infranqueable
    p.tx = tx; p.ty = ty;
    io.emit('player-moved', { id: socket.id, tx, ty });
  });

  // Soltar monedas Q en el campo
  socket.on('drop-coin', (data) => {
    const p = players.get(socket.id);
    if (!p) return;
    const amount = parseInt(data && data.amount, 10);
    if (Number.isNaN(amount) || amount <= 0) return;
    let tx = parseInt(data && data.tx, 10);
    let ty = parseInt(data && data.ty, 10);
    if (Number.isNaN(tx) || Number.isNaN(ty)) { tx = p.tx; ty = p.ty; }
    tx = Math.max(0, Math.min(WORLD.W - 1, tx));
    ty = Math.max(0, Math.min(WORLD.H - 1, ty));
    const coin = { id: 'c' + (++coinSeq), tx, ty, amount };
    coins.set(coin.id, coin);
    io.emit('coin-dropped', coin);
  });

  // Recoger monedas Q del campo
  socket.on('pickup-coin', (data) => {
    const p = players.get(socket.id);
    if (!p) return;
    const id = data && data.id;
    const coin = coins.get(id);
    if (!coin) return;
    coins.delete(id);
    io.emit('coin-picked', { id, byId: socket.id, amount: coin.amount });
  });

  // Mensaje/emote opcional (p. ej. "¡atacado por un Hidrógeno!")
  socket.on('emote', (text) => {
    const p = players.get(socket.id);
    if (!p) return;
    io.emit('player-emote', { id: socket.id, text: String(text).slice(0, 40) });
  });

  // Chat global — se difunde a todos con el nombre del jugador
  socket.on('chat', (data) => {
    const p = players.get(socket.id);
    const text = String(data && data.text ? data.text : '').slice(0, 120);
    if (!text) return;
    const name = (p && p.name) ? p.name
      : ((data && typeof data.name === 'string' && data.name) ? data.name.slice(0, 12) : socket.id.slice(0, 4));
    io.emit('chat-message', { id: socket.id, name, text });
  });

  // El jugador cambió de combatiente equipado
  socket.on('equip', (data) => {
    const p = players.get(socket.id);
    if (!p) return;
    const k = String(data && data.key ? data.key : '').slice(0, 16);
    if (k) p.equipped = k;
  });

  // El jugador envía su equipo de batalla (para batallas de grupo)
  socket.on('loadout', (data) => {
    const p = players.get(socket.id);
    if (!p) return;
    let keys = (data && Array.isArray(data.keys)) ? data.keys : [];
    keys = keys.filter(k => typeof k === 'string').map(k => k.slice(0, 16)).slice(0, 3);
    if (keys.length === 0) keys = ['proton'];
    p.partyKeys = keys;
  });

  // El jugador actualiza sus estadísticas (electrones, Q, victorias)
  socket.on('stats', (data) => {
    const p = players.get(socket.id);
    if (!p || !data) return;
    p.stats = {
      electrons: Math.max(0, parseInt(data.electrons, 10) || 0),
      Q:         Math.max(0, parseInt(data.Q, 10) || 0),
      wins:      Math.max(0, parseInt(data.wins, 10) || 0)
    };
    broadcastLeaderboard();
  });

  // ── PVP: envío de solicitud ──
  socket.on('pvp-invite', (data) => {
    const from = players.get(socket.id);
    if (!from) return;
    const targetId = String(data && data.targetId ? data.targetId : '');
    const target = players.get(targetId);
    if (!target) { socket.emit('pvp-error', { msg: 'Ese jugador ya no está disponible.' }); return; }
    if (targetId === socket.id) { socket.emit('pvp-error', { msg: 'No puedes retarte a ti mismo.' }); return; }
    if (inBattle.has(socket.id) || inBattle.has(targetId) || pendingInvite.has(targetId)) {
      socket.emit('pvp-error', { msg: 'Ese jugador está ocupado ahora mismo.' }); return;
    }
    pendingInvite.set(targetId, socket.id); // destinatario -> invitador
    io.to(targetId).emit('pvp-invited', {
      fromId: socket.id,
      fromName: from.name || socket.id.slice(0, 4),
      fromKey: from.equipped || 'proton'
    });
  });

  // ── PVP: rechazo ──
  socket.on('pvp-decline', () => {
    const inviterId = pendingInvite.get(socket.id);
    pendingInvite.delete(socket.id);
    if (inviterId) {
      const me = players.get(socket.id);
      io.to(inviterId).emit('pvp-declined', { byId: socket.id, byName: (me && me.name) ? me.name : 'Jugador' });
    }
  });

  // ── PVP: aceptación → arranca la batalla ──
  socket.on('pvp-accept', () => {
    const inviterId = pendingInvite.get(socket.id);
    pendingInvite.delete(socket.id);
    if (!inviterId) { socket.emit('pvp-error', { msg: 'La invitación ya no es válida.' }); return; }
    const inviter = players.get(inviterId);
    const me = players.get(socket.id);
    if (!inviter || !me) { socket.emit('pvp-error', { msg: 'El oponente ya no está disponible.' }); return; }
    if (inBattle.has(inviterId) || inBattle.has(socket.id)) { socket.emit('pvp-error', { msg: 'El oponente ya está en batalla.' }); return; }
    inBattle.set(inviterId, socket.id);
    inBattle.set(socket.id, inviterId);
    // El invitador ataca primero
    io.to(inviterId).emit('pvp-start', {
      youFirst: true, oppId: socket.id, oppName: me.name || socket.id.slice(0, 4),
      oppKey: me.equipped || 'proton', oppAvatar: me.avatar
    });
    io.to(socket.id).emit('pvp-start', {
      youFirst: false, oppId: inviterId, oppName: inviter.name || inviterId.slice(0, 4),
      oppKey: inviter.equipped || 'proton', oppAvatar: inviter.avatar
    });
  });

  // ── PVP: relevo de acciones (el atacante calcula el resultado) ──
  socket.on('pvp-action', (data) => {
    const oppId = inBattle.get(socket.id);
    if (!oppId) return;
    io.to(oppId).emit('pvp-action', {
      kind: (data && data.kind === 'ability') ? 'ability' : 'attack',
      dmg: Math.max(0, Math.min(99, parseInt(data && data.dmg, 10) || 0)),
      dodged: !!(data && data.dodged),
      meHp: Math.max(0, Math.min(999, parseInt(data && data.meHp, 10) || 0)),
      meMax: Math.max(1, Math.min(999, parseInt(data && data.meMax, 10) || 1)),
      transformKey: (data && typeof data.transformKey === 'string') ? data.transformKey : null,
      negate: !!(data && data.negate)
    });
  });

  // ── PVP: fin de batalla (limpieza) ──
  socket.on('pvp-end', () => {
    const oppId = inBattle.get(socket.id);
    inBattle.delete(socket.id);
    if (oppId) inBattle.delete(oppId);
  });

  // ══ GRUPO (co-op) ══
  socket.on('group-invite', (data) => {
    const from = players.get(socket.id);
    if (!from) return;
    const targetId = String(data && data.targetId ? data.targetId : '');
    const target = players.get(targetId);
    if (!target) { socket.emit('group-error', { msg: 'Ese jugador ya no está disponible.' }); return; }
    if (targetId === socket.id) { socket.emit('group-error', { msg: 'No puedes invitarte a ti mismo.' }); return; }
    if (inBattle.has(socket.id) || inBattle.has(targetId) || inTrade.has(socket.id) || inTrade.has(targetId) ||
        inGroupBattle.has(socket.id) || inGroupBattle.has(targetId)) {
      socket.emit('group-error', { msg: 'Ese jugador está ocupado ahora mismo.' }); return;
    }
    if (playerGroup.has(targetId)) { socket.emit('group-error', { msg: 'Ese jugador ya está en un grupo.' }); return; }
    if (pendingGroupInvite.has(targetId)) { socket.emit('group-error', { msg: 'Ese jugador ya tiene una invitación pendiente.' }); return; }
    const gid = playerGroup.get(socket.id);
    const size = gid ? groupMembers(gid).length : 1;
    if (size >= 3) { socket.emit('group-error', { msg: 'Tu grupo ya está lleno (máx 3).' }); return; }
    pendingGroupInvite.set(targetId, socket.id);
    io.to(targetId).emit('group-invited', { fromId: socket.id, fromName: from.name || socket.id.slice(0, 4) });
  });

  socket.on('group-decline', () => {
    const inviterId = pendingGroupInvite.get(socket.id);
    pendingGroupInvite.delete(socket.id);
    if (inviterId) {
      const me = players.get(socket.id);
      io.to(inviterId).emit('group-declined', { byName: (me && me.name) ? me.name : 'Jugador' });
    }
  });

  socket.on('group-accept', () => {
    const inviterId = pendingGroupInvite.get(socket.id);
    pendingGroupInvite.delete(socket.id);
    if (!inviterId) { socket.emit('group-error', { msg: 'La invitación ya no es válida.' }); return; }
    const inviter = players.get(inviterId);
    const me = players.get(socket.id);
    if (!inviter || !me) { socket.emit('group-error', { msg: 'El jugador ya no está disponible.' }); return; }
    if (playerGroup.has(socket.id)) { socket.emit('group-error', { msg: 'Ya estás en un grupo.' }); return; }
    let gid = playerGroup.get(inviterId);
    if (!gid) { gid = 'g' + (groupSeq++); groups.set(gid, new Set([inviterId])); playerGroup.set(inviterId, gid); }
    const s = groups.get(gid);
    if (!s) { socket.emit('group-error', { msg: 'El grupo ya no existe.' }); return; }
    if (groupMembers(gid).length >= 3) { socket.emit('group-error', { msg: 'El grupo está lleno (máx 3).' }); return; }
    s.add(socket.id); playerGroup.set(socket.id, gid);
    broadcastGroup(gid);
  });

  socket.on('group-leave', () => { leaveGroup(socket.id); });

  // ── Batalla de grupo (host autoritativo) ──
  socket.on('group-battle-start', (data) => {
    const gid = playerGroup.get(socket.id);
    if (!gid) return;
    const gm = groupMembers(gid);
    if (gm.length < 2) return;
    if (gm.some(id => inGroupBattle.has(id) || inBattle.has(id) || inTrade.has(id))) return;
    gm.forEach(id => inGroupBattle.set(id, socket.id));
    const members = gm.map(id => {
      const p = players.get(id);
      return { id, name: (p && p.name) || id.slice(0, 4), keys: (p && Array.isArray(p.partyKeys)) ? p.partyKeys : ['proton'], avatar: p ? p.avatar : null };
    });
    const foeType = String(data && data.foeType ? data.foeType : 'hydrogen').slice(0, 16);
    gm.forEach(id => io.to(id).emit('group-battle-start', { hostId: socket.id, foeType, size: gm.length, members }));
  });

  socket.on('group-battle-sync', (data) => {
    const gid = playerGroup.get(socket.id);
    if (!gid) return;
    if (inGroupBattle.get(socket.id) !== socket.id) return; // solo el host difunde
    groupMembers(gid).forEach(id => { if (id !== socket.id) io.to(id).emit('group-battle-sync', data); });
  });

  // Un miembro (no anfitrión) envía su acción; se reenvía al anfitrión que simula
  socket.on('group-battle-act', (data) => {
    const hostId = inGroupBattle.get(socket.id);
    if (!hostId || hostId === socket.id) return;
    io.to(hostId).emit('group-battle-act', { from: socket.id, action: (data && data.action) || data });
  });

  socket.on('group-battle-end', (data) => {
    const hostId = socket.id;
    const affected = [];
    inGroupBattle.forEach((h, id) => { if (h === hostId) affected.push(id); });
    affected.forEach(id => inGroupBattle.delete(id));
    affected.forEach(id => { if (id !== hostId) io.to(id).emit('group-battle-end', data || {}); });
  });

  // ══ INTERCAMBIO (trueque de objetos) ══
  // ── Envío de solicitud ──
  socket.on('trade-invite', (data) => {
    const from = players.get(socket.id);
    if (!from) return;
    const targetId = String(data && data.targetId ? data.targetId : '');
    const target = players.get(targetId);
    if (!target) { socket.emit('trade-error', { msg: 'Ese jugador ya no está disponible.' }); return; }
    if (targetId === socket.id) { socket.emit('trade-error', { msg: 'No puedes intercambiar contigo mismo.' }); return; }
    if (inBattle.has(socket.id) || inBattle.has(targetId) || inTrade.has(socket.id) || inTrade.has(targetId) ||
        pendingInvite.has(targetId) || pendingTradeInvite.has(targetId)) {
      socket.emit('trade-error', { msg: 'Ese jugador está ocupado ahora mismo.' }); return;
    }
    pendingTradeInvite.set(targetId, socket.id);
    io.to(targetId).emit('trade-invited', {
      fromId: socket.id,
      fromName: from.name || socket.id.slice(0, 4)
    });
  });

  // ── Rechazo de la invitación ──
  socket.on('trade-decline', () => {
    const inviterId = pendingTradeInvite.get(socket.id);
    pendingTradeInvite.delete(socket.id);
    if (inviterId) {
      const me = players.get(socket.id);
      io.to(inviterId).emit('trade-declined', { byName: (me && me.name) ? me.name : 'Jugador' });
    }
  });

  // ── Aceptación → se abre la ventana de intercambio ──
  socket.on('trade-accept', () => {
    const inviterId = pendingTradeInvite.get(socket.id);
    pendingTradeInvite.delete(socket.id);
    if (!inviterId) { socket.emit('trade-error', { msg: 'La invitación ya no es válida.' }); return; }
    const inviter = players.get(inviterId);
    const me = players.get(socket.id);
    if (!inviter || !me) { socket.emit('trade-error', { msg: 'El otro jugador ya no está disponible.' }); return; }
    if (inBattle.has(inviterId) || inBattle.has(socket.id) || inTrade.has(inviterId) || inTrade.has(socket.id)) {
      socket.emit('trade-error', { msg: 'El otro jugador está ocupado.' }); return;
    }
    inTrade.set(inviterId, socket.id);
    inTrade.set(socket.id, inviterId);
    tradeData.set(inviterId, { offer: emptyOffer(), confirmed: false });
    tradeData.set(socket.id,  { offer: emptyOffer(), confirmed: false });
    io.to(inviterId).emit('trade-start', { partnerId: socket.id, partnerName: me.name || socket.id.slice(0, 4), partnerAvatar: me.avatar });
    io.to(socket.id).emit('trade-start',  { partnerId: inviterId, partnerName: inviter.name || inviterId.slice(0, 4), partnerAvatar: inviter.avatar });
    broadcastTradeState(inviterId, socket.id);
  });

  // ── Actualización de la oferta (cambiarla invalida ambas aceptaciones) ──
  socket.on('trade-offer', (data) => {
    const partnerId = inTrade.get(socket.id);
    const mine = tradeData.get(socket.id);
    if (!partnerId || !mine) return;
    mine.offer = sanitizeOffer(data && data.offer);
    mine.confirmed = false;
    const other = tradeData.get(partnerId);
    if (other) other.confirmed = false;
    broadcastTradeState(socket.id, partnerId);
  });

  // ── Aceptación del trato: si ambos aceptan, se realiza el intercambio ──
  socket.on('trade-confirm', () => {
    const partnerId = inTrade.get(socket.id);
    const mine = tradeData.get(socket.id);
    if (!partnerId || !mine) return;
    mine.confirmed = true;
    const other = tradeData.get(partnerId);
    if (other && other.confirmed) {
      io.to(socket.id).emit('trade-complete',  { youGet: other.offer, youGave: mine.offer });
      io.to(partnerId).emit('trade-complete',  { youGet: mine.offer,  youGave: other.offer });
      cleanupTrade(socket.id);
    } else {
      broadcastTradeState(socket.id, partnerId);
    }
  });

  // ── Cancelación: nadie recibe nada, ambos vuelven al campo ──
  socket.on('trade-cancel', () => {
    const partnerId = cleanupTrade(socket.id);
    if (partnerId) io.to(partnerId).emit('trade-cancelled', {});
  });

  socket.on('disconnect', () => {
    // Limpiar invitaciones pendientes donde participe este socket
    pendingInvite.forEach((inviterId, targetId) => {
      if (inviterId === socket.id || targetId === socket.id) pendingInvite.delete(targetId);
    });
    // Si estaba en una batalla PVP, avisar al oponente
    const oppId = inBattle.get(socket.id);
    if (oppId) {
      inBattle.delete(socket.id);
      inBattle.delete(oppId);
      io.to(oppId).emit('pvp-opponent-left');
    }
    // Limpiar invitaciones/intercambios donde participe este socket
    pendingTradeInvite.forEach((inviterId, targetId) => {
      if (inviterId === socket.id || targetId === socket.id) pendingTradeInvite.delete(targetId);
    });
    const tradePartner = inTrade.get(socket.id);
    if (tradePartner) {
      cleanupTrade(socket.id);
      io.to(tradePartner).emit('trade-partner-left', {});
    }
    // Limpiar invitaciones de grupo pendientes
    pendingGroupInvite.forEach((inviterId, targetId) => {
      if (inviterId === socket.id || targetId === socket.id) pendingGroupInvite.delete(targetId);
    });
    // Si estaba en una batalla de grupo
    const myHost = inGroupBattle.get(socket.id);
    if (myHost) {
      if (myHost === socket.id) {
        // El host se fue: terminar la batalla para todos (derrota)
        const affected = [];
        inGroupBattle.forEach((h, id) => { if (h === socket.id) affected.push(id); });
        affected.forEach(id => inGroupBattle.delete(id));
        affected.forEach(id => { if (id !== socket.id) io.to(id).emit('group-battle-end', { win: false }); });
      } else {
        inGroupBattle.delete(socket.id);
      }
    }
    // Salir del grupo
    leaveGroup(socket.id);
    players.delete(socket.id);
    io.emit('player-left', { id: socket.id });
    broadcastLeaderboard();
    console.log(`[-] Desconexión: ${socket.id} (${players.size} jugadores)`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log('\n  Elementaria Online — servidor iniciado');
  console.log('   Local:  http://localhost:' + PORT);
  const nets = require('os').networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        console.log('   WiFi:   http://' + net.address + ':' + PORT + '   (esta URL la abre tu amigo)');
      }
    }
  }
  console.log('');
});
