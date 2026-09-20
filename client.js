/* ═════════════════════════════════════════════════════════
   Elementaria Online — client.js
   Flujo: Crear personaje (pixel art) -> Tutorial (tienda + ensamblar
   protón) -> Mundo compartido (ves a otros jugadores en tiempo real)
   -> Batallas locales contra átomos salvajes.
   El servidor es autoritativo para las posiciones en el mundo.
   ═══════════════════════════════════════════════════════════ */

const G = document.getElementById('game');
function show(html){ G.innerHTML = html; }

/* ---------- Estado local del jugador ---------- */
const state = {
  Q: 2,
  quarks: { up: 1, down: 0 },
  protons: 0,
  neutrons: 0,
  electrons: 0,
  atoms: { hydrogen: 0 },
  slots: [null, null, null],
  avatar: null,
  name: '',
  accountId: null,
  accountSlot: null,
  equipped: 'proton',
  exp: 0, steps: 0, wins: 0
};

/* ---------- Combatientes equipables ---------- */
const COMBATANTS = {
  proton:   { key:'proton',   label:'Protón',   icon:'🔴', hp:10, atk:2, dodge:0,    ability:{name:'Repulsión', icon:'🧲', dmg:5, every:2} },
  neutron:  { key:'neutron',  label:'Neutrón',  icon:'⚪', hp:13, atk:2, dodge:0.1,  ability:{name:'Impacto',   icon:'💥', dmg:4, every:2} },
  electron: { key:'electron', label:'Electrón', icon:'🔵', hp:6,  atk:3, dodge:0.35, ability:{name:'Chispa',    icon:'⚡', dmg:4, every:2} },
  hydrogen: { key:'hydrogen', label:'Hidrógeno',icon:'🧩', hp:15, atk:2, dodge:0.5,  ability:{name:'Fusión',    icon:'☀️', dmg:5, every:2} }
};
/* ---------- Enemigos salvajes del campo ---------- */
const WILD_FOES = {
  hydrogen: {hp:15, atk:1, dodge:0.5, label:'Hidrógeno', icon:'🧩', letter:'H',
    gradient:'radial-gradient(circle at 35% 30%,#eaf3ff,#9fc0ff)', textColor:'#123',
    reward:{Q:1, exp:5}, bonusChance:0.2, bonus:{up:2, down:1, e:1}},
  helium: {hp:25, atk:2, dodge:0.5, label:'Helio', icon:'🎈', letter:'He',
    gradient:'radial-gradient(circle at 35% 30%,#fff3d6,#ffd76a)', textColor:'#3a2a00',
    reward:{Q:2, exp:10}, bonusChance:0.1, bonus:{up:4, down:4, e:2}},
};
function ownedCount(key){
  if (key === 'proton') return state.protons;
  if (key === 'neutron') return state.neutrons;
  if (key === 'electron') return state.electrons;
  if (state.atoms && key in state.atoms) return state.atoms[key];
  return 0;
}
function equipCombatant(key){
  if (!COMBATANTS[key]) return;
  if (ownedCount(key) < 1){ return; }
  state.equipped = key;
  socket.emit('equip', { key });
  openInventory();
}

/* ---------- Red (Socket.IO) ---------- */
const socket = io();
let myId = null;
let WORLD = { W: 15, H: 10, TILE: 40 };
let others = {};            // id -> { tx, ty, avatar, name, canvas }
let me = { tx: 7, ty: 5 };  // mi posición local (confirmada por el servidor)
let inWorld = false;
let leaderboardData = [];  // tabla de clasificación recibida del servidor

socket.on('init', (d) => { myId = d.id; WORLD = d.world; });
socket.on('existing-players', (list) => {
  list.forEach(p => { others[p.id] = { tx: p.tx, ty: p.ty, avatar: p.avatar, name: p.name, canvas: avatarCanvas(p.avatar) }; });
});
socket.on('player-joined', (p) => {
  if (p.id === myId) { me.tx = p.tx; me.ty = p.ty; }
  else { others[p.id] = { tx: p.tx, ty: p.ty, avatar: p.avatar, name: p.name, canvas: avatarCanvas(p.avatar) }; }
});
socket.on('player-moved', (d) => {
  if (d.id === myId) { me.tx = d.tx; me.ty = d.ty; }
  else if (others[d.id]) { others[d.id].tx = d.tx; others[d.id].ty = d.ty; }
});
socket.on('player-left', (d) => { delete others[d.id]; if (d.id === tradeSelectedId) tradeSelectedId = null; });
socket.on('player-emote', (d) => {
  if (others[d.id]) { others[d.id].emote = d.text; others[d.id].emoteT = Date.now(); }
});
socket.on('chat-message', (d) => { addChatLine(d); });
socket.on('leaderboard', (list) => { leaderboardData = Array.isArray(list) ? list : []; renderLeaderboard(); });
function sendStats(){
  socket.emit('stats', { electrons: state.electrons, Q: state.Q, wins: state.wins });
}

/* ---------- PVP (1 vs 1 entre jugadores conectados) ---------- */
let pvpCooldownUntil = 0;   // timestamp: no puedo enviar solicitudes hasta aquí
let pvpInviteFrom = null;   // { fromId, fromName, fromKey } de una invitación recibida
let pvpInviteTimer = null;  // auto-rechazo
let pvp = null;             // estado de la batalla PVP en curso
socket.on('pvp-invited', (d) => { showPvpInvitePrompt(d); });
socket.on('pvp-declined', (d) => {
  pvpCooldownUntil = Date.now() + 30000;
  toast(`❌ ${d && d.byName ? d.byName : 'El jugador'} rechazó tu reto. Espera 30s para volver a invitar.`);
  if (document.getElementById('modal')) openPvpList();
});
socket.on('pvp-error', (d) => { toast('⚠️ ' + ((d && d.msg) || 'No se pudo enviar la solicitud.')); if (document.getElementById('modal')) openPvpList(); });
socket.on('pvp-start', (d) => { startPvpBattle(d); });
socket.on('pvp-action', (d) => { applyPvpAction(d); });
socket.on('pvp-opponent-left', () => {
  if (!pvp || pvp.over) return;
  pvp.over = true; pvp.win = true; pvplog('🏁 Tu oponente abandonó la batalla. ¡Ganas por retirada!');
  renderPvpBattle();
});

/* ---------- Intercambio (trueque de objetos entre jugadores) ---------- */
let tradeSelectedId = null;   // jugador seleccionado en el mapa (clic)
let tradeCooldownUntil = 0;   // espera tras un rechazo
let tradeInviteFrom = null;   // invitación de intercambio recibida
let tradeInviteTimer = null;  // auto-rechazo
let trade = null;             // estado del intercambio en curso
const TRADE_ITEMS = [
  { key:'up',       icon:'🟠', label:'Quark Up',   get:() => state.quarks.up },
  { key:'down',     icon:'🔵', label:'Quark Down', get:() => state.quarks.down },
  { key:'proton',   icon:'🔴', label:'Protón',     get:() => state.protons },
  { key:'neutron',  icon:'⚪', label:'Neutrón',    get:() => state.neutrons },
  { key:'electron', icon:'⚛️', label:'Electrón',   get:() => state.electrons },
  { key:'hydrogen', icon:'🧩', label:'Hidrógeno',  get:() => state.atoms.hydrogen }
];
function emptyOffer(){ return { up:0, down:0, proton:0, neutron:0, electron:0, hydrogen:0 }; }
function normalizeOffer(o){
  const out = emptyOffer();
  if (o && typeof o === 'object'){
    for (const it of TRADE_ITEMS){ let v = parseInt(o[it.key], 10); if (!Number.isFinite(v) || v < 0) v = 0; out[it.key] = v; }
  }
  return out;
}
function offerTotal(o){ return TRADE_ITEMS.reduce((s, it) => s + (o[it.key] || 0), 0); }

socket.on('trade-invited',  (d) => showTradeInvitePrompt(d));
socket.on('trade-declined', (d) => { tradeCooldownUntil = Date.now() + 15000; toast(`❌ ${d && d.byName ? d.byName : 'El jugador'} rechazó el intercambio.`); });
socket.on('trade-error',    (d) => { toast('⚠️ ' + ((d && d.msg) || 'No se pudo iniciar el intercambio.')); });
socket.on('trade-start',    (d) => startTrade(d));
socket.on('trade-state',    (d) => applyTradeState(d));
socket.on('trade-complete', (d) => applyTradeComplete(d));
socket.on('trade-cancelled', () => { toast('❌ El intercambio fue cancelado.'); endTrade(); });
socket.on('trade-partner-left', () => { toast('👋 El otro jugador se fue. Intercambio cancelado.'); endTrade(); });

function sendTradeInvite(id){
  if (!inWorld || battleActive || trade) return;
  if (Date.now() < tradeCooldownUntil){ toast('⏳ Espera un momento antes de proponer otro intercambio.'); return; }
  if (!others[id]){ toast('Ese jugador ya no está aquí.'); return; }
  socket.emit('trade-invite', { targetId: id });
  toast('✉️ Propuesta de intercambio enviada. Esperando respuesta…');
}
function showTradeInvitePrompt(d){
  tradeInviteFrom = d;
  openModal(`
    <h2 style="text-align:center;">🔄 ${escapeHtml(d.fromName || 'Un jugador')} quiere intercambiar contigo</h2>
    <p class="muted" style="text-align:center; margin-top:8px;">Cada uno podrá ofrecer hasta 5 objetos. El intercambio solo se realiza si ambos aceptan.</p>
    <p style="text-align:center; margin-top:6px;" id="tinvtimer" class="gold">Responde en 30s…</p>
    <div class="row" style="justify-content:center; margin-top:14px; gap:12px;">
      <button class="btn" onclick="acceptTrade()">✅ Aceptar</button>
      <button class="btn ghost" onclick="declineTrade()">❌ Rechazar</button>
    </div>`);
  let left = 30;
  if (tradeInviteTimer) clearInterval(tradeInviteTimer);
  tradeInviteTimer = setInterval(() => {
    left--;
    const t = document.getElementById('tinvtimer'); if (t) t.textContent = 'Responde en ' + left + 's…';
    if (left <= 0) declineTrade();
  }, 1000);
}
function clearTradeInvite(){ if (tradeInviteTimer){ clearInterval(tradeInviteTimer); tradeInviteTimer = null; } tradeInviteFrom = null; }
function acceptTrade(){ if (!tradeInviteFrom) return; socket.emit('trade-accept'); clearTradeInvite(); }
function declineTrade(){ if (!tradeInviteFrom){ closeModal(); return; } socket.emit('trade-decline'); clearTradeInvite(); closeModal(); toast('Rechazaste el intercambio.'); }

function startTrade(d){
  clearTradeInvite();
  tradeSelectedId = null;
  trade = {
    partnerId: d.partnerId,
    partnerName: d.partnerName || 'Jugador',
    partnerAvatar: d.partnerAvatar || null,
    myOffer: emptyOffer(),
    theirOffer: emptyOffer(),
    iConfirmed: false,
    theyConfirmed: false
  };
  battleActive = true; // bloquea movimiento y encuentros mientras dura
  renderTrade();
}
function endTrade(){ trade = null; battleActive = false; clearTradeInvite(); closeModal(); tradeSelectedId = null; refreshHUD(); }
function tradeAdd(key){
  const t = trade; if (!t) return;
  const it = TRADE_ITEMS.find(i => i.key === key); if (!it) return;
  if (offerTotal(t.myOffer) >= 5) return;
  if (it.get() - (t.myOffer[key] || 0) <= 0) return;
  t.myOffer[key] = (t.myOffer[key] || 0) + 1;
  sendMyOffer();
}
function tradeRemove(key){
  const t = trade; if (!t) return;
  if ((t.myOffer[key] || 0) <= 0) return;
  t.myOffer[key]--;
  sendMyOffer();
}
function sendMyOffer(){
  const t = trade; if (!t) return;
  t.iConfirmed = false; t.theyConfirmed = false; // cambiar la oferta reinicia las aceptaciones
  socket.emit('trade-offer', { offer: t.myOffer });
  renderTrade();
}
function confirmTrade(){
  const t = trade; if (!t || t.iConfirmed) return;
  t.iConfirmed = true;
  socket.emit('trade-confirm');
  renderTrade();
}
function cancelTrade(){
  socket.emit('trade-cancel');
  toast('Cancelaste el intercambio.');
  endTrade();
}
function applyTradeState(d){
  if (!trade || !d) return;
  const pid = trade.partnerId;
  if (d.offers){
    if (d.offers[myId]) trade.myOffer = normalizeOffer(d.offers[myId]);
    if (d.offers[pid])  trade.theirOffer = normalizeOffer(d.offers[pid]);
  }
  if (d.confirmed){
    trade.iConfirmed = !!d.confirmed[myId];
    trade.theyConfirmed = !!d.confirmed[pid];
  }
  renderTrade();
}
function applyTradeComplete(d){
  if (!trade) return;
  const gave = normalizeOffer(d && d.youGave);
  const got  = normalizeOffer(d && d.youGet);
  state.quarks.up      = Math.max(0, state.quarks.up      - gave.up)       + got.up;
  state.quarks.down    = Math.max(0, state.quarks.down    - gave.down)     + got.down;
  state.protons        = Math.max(0, state.protons        - gave.proton)   + got.proton;
  state.neutrons       = Math.max(0, state.neutrons       - gave.neutron)  + got.neutron;
  state.electrons      = Math.max(0, state.electrons      - gave.electron) + got.electron;
  state.atoms.hydrogen = Math.max(0, state.atoms.hydrogen - gave.hydrogen) + got.hydrogen;
  if (ownedCount(state.equipped) < 1){
    const k = ['proton','neutron','electron','hydrogen'].find(x => ownedCount(x) >= 1);
    if (k){ state.equipped = k; socket.emit('equip', { key: k }); }
  }
  sendStats();
  const partnerName = trade.partnerName;
  endTrade();
  toast(`✅ Intercambio con ${partnerName} completado.`);
}
function renderTrade(){
  const t = trade; if (!t) return;
  const myTotal = offerTotal(t.myOffer);
  const myOfferHtml = TRADE_ITEMS.filter(it => t.myOffer[it.key] > 0)
    .map(it => `<span class="badge">${it.icon} ${it.label} ×${t.myOffer[it.key]}</span>`).join(' ') || '<span class="muted">Nada aún</span>';
  const theirOfferHtml = TRADE_ITEMS.filter(it => t.theirOffer[it.key] > 0)
    .map(it => `<span class="badge">${it.icon} ${it.label} ×${t.theirOffer[it.key]}</span>`).join(' ') || '<span class="muted">Nada aún</span>';
  const invRows = TRADE_ITEMS.map(it => {
    const owned = it.get();
    const inOffer = t.myOffer[it.key] || 0;
    const avail = owned - inOffer;
    return `<div class="row" style="justify-content:space-between; align-items:center; margin-top:6px; background:#0a0e28; padding:6px 10px; border-radius:8px;">
      <span>${it.icon} <b>${it.label}</b> <span class="muted">(tienes ${owned})</span></span>
      <span class="row" style="gap:6px;">
        <button class="btn ghost" style="padding:2px 10px;" ${inOffer <= 0 ? 'disabled' : ''} onclick="tradeRemove('${it.key}')">−</button>
        <b style="min-width:18px; text-align:center;">${inOffer}</b>
        <button class="btn ghost" style="padding:2px 10px;" ${(avail <= 0 || myTotal >= 5) ? 'disabled' : ''} onclick="tradeAdd('${it.key}')">＋</button>
      </span>
    </div>`;
  }).join('');
  const myStatus    = t.iConfirmed   ? '<span class="gold">✅ Aceptaste</span>' : '<span class="muted">Sin aceptar</span>';
  const theirStatus = t.theyConfirmed ? '<span class="gold">✅ Aceptó</span>'   : '<span class="muted">Sin aceptar</span>';
  openModal(`
    <div class="row" style="justify-content:space-between;"><h2 style="margin:0;">🔄 Intercambio con ${escapeHtml(t.partnerName)}</h2></div>
    <p class="muted" style="margin-top:4px;">Ofrece hasta <b>5 objetos</b>. Si cambias tu oferta se reinician las aceptaciones. El trato se realiza solo cuando ambos aceptan.</p>
    <div class="row" style="margin-top:12px; gap:12px; align-items:stretch; flex-wrap:wrap;">
      <div class="card" style="flex:1; min-width:250px;">
        <p style="color:var(--accent); margin:0;"><b>🫡 Tu oferta</b> <span class="muted">(${myTotal}/5)</span> — ${myStatus}</p>
        <p style="margin-top:6px;">${myOfferHtml}</p>
        <hr style="border:none; border-top:1px solid var(--panel2); margin:10px 0;">
        <p style="color:var(--accent); margin:0;"><b>🎒 Tu inventario</b> <span class="muted">(solo tú lo ves)</span></p>
        ${invRows}
      </div>
      <div class="card" style="flex:1; min-width:220px;">
        <div class="row" style="gap:10px; align-items:center;">
          ${t.partnerAvatar ? `<img src="${avatarDataURL(t.partnerAvatar,2)}" style="width:44px;height:44px;background:#060a18;border-radius:8px;">` : ''}
          <p style="color:var(--accent); margin:0;"><b>${escapeHtml(t.partnerName)}</b></p>
        </div>
        <p style="margin-top:10px; color:var(--accent);"><b>🎁 Su oferta</b> — ${theirStatus}</p>
        <p style="margin-top:6px;">${theirOfferHtml}</p>
      </div>
    </div>
    <div class="row" style="justify-content:center; margin-top:16px; gap:12px;">
      <button class="btn" ${t.iConfirmed ? 'disabled' : ''} onclick="confirmTrade()">✅ Aceptar</button>
      <button class="btn ghost" onclick="cancelTrade()">❌ Rechazar</button>
    </div>`);
}
function onWorldClick(e){
  if (!inWorld || battleActive || document.getElementById('modal')) return;
  const cv = e.currentTarget;
  const rect = cv.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (cv.width / rect.width);
  const y = (e.clientY - rect.top)  * (cv.height / rect.height);
  const tx = Math.floor(x / WORLD.TILE), ty = Math.floor(y / WORLD.TILE);
  let hit = null;
  for (const id in others){ if (others[id].tx === tx && others[id].ty === ty){ hit = id; break; } }
  if (hit){
    tradeSelectedId = hit;
    const nm = others[hit].name || hit.slice(0, 4);
    toast(`👉 Seleccionaste a ${nm}. Pulsa I para intercambiar (o P para retarlo).`);
  } else {
    tradeSelectedId = null;
  }
}
function startTradeSelected(){
  if (tradeSelectedId && others[tradeSelectedId]) sendTradeInvite(tradeSelectedId);
  else toast('Haz clic en un jugador del mapa para seleccionarlo y pulsa I.');
}

/* ---------- Avatar (pixel art 25x25) ---------- */
const PALETTE = ['#000000','#ffffff','#ff3b57','#ff7b54','#ffd54f','#5be08a','#4fd1ff','#3a7bff','#b06bff','#ff6bd6','#8a5a2b','#c9b18a','#7a8199','transparent'];
let paintColor = '#ff3b57';
let painting = false;
document.addEventListener('pointerup', () => painting = false);

function avatarIsEmpty(arr){ arr = arr || state.avatar; return !arr || arr.every(v => !v); }
function avatarCanvas(arr){
  const c = document.createElement('canvas'); c.width = 25; c.height = 25;
  const x = c.getContext('2d');
  if (arr) for (let i = 0; i < 625; i++){ const col = arr[i]; if (col){ x.fillStyle = col; x.fillRect(i % 25, Math.floor(i / 25), 1, 1); } }
  return c;
}
function avatarDataURL(arr, px){ px = px || 5; const src = avatarCanvas(arr); const c = document.createElement('canvas'); c.width = 25 * px; c.height = 25 * px; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(src, 0, 0, 25 * px, 25 * px); return c.toDataURL(); }

/* =================================================
   PANTALLA — CREAR PERSONAJE
================================================= */
function sceneCreator(){
  if (!state.avatar) state.avatar = new Array(625).fill(null);
  const pal = PALETTE.map(col => {
    const sel = col === paintColor ? 'outline:3px solid var(--gold);' : '';
    const bg = col === 'transparent' ? 'background:repeating-conic-gradient(#555 0% 25%,#333 0% 50%) 0/12px 12px;' : `background:${col};`;
    return `<div class="swatch" data-col="${col}" style="width:28px;height:28px;border-radius:6px;cursor:pointer;border:1px solid #000;${bg}${sel}"></div>`;
  }).join('');
  let cells = '';
  for (let i = 0; i < 625; i++){ const col = state.avatar[i]; cells += `<div class="px" data-i="${i}" style="width:100%;height:100%;${col ? `background:${col};` : ''}"></div>`; }
  show(`
  <div class="scene active">
    <h2>🎨 Crea tu personaje</h2>
    <p class="muted">Pinta tu héroe (25×25). Tu diseño se verá en el mundo compartido. “Transparente” borra.</p>
    <div class="row" style="margin-top:12px; align-items:flex-start; gap:18px; flex:1;">
      <div id="pxgrid" style="display:grid; grid-template-columns:repeat(25,1fr); grid-auto-rows:1fr; width:380px; height:380px; border:2px solid var(--panel2); background:#0a0e28; touch-action:none;">${cells}</div>
      <div style="flex:1;">
        <p class="muted">Paleta</p>
        <div class="row" style="gap:7px; margin-top:8px; max-width:230px;">${pal}</div>
        <div class="row" style="margin-top:16px; gap:10px;">
          <button class="btn ghost" onclick="clearAvatar()">🧹 Limpiar</button>
          <button class="btn ghost" onclick="randomAvatar()">🎲 Aleatorio</button>
        </div>
        <div class="card" style="margin-top:18px; text-align:center;">
          <p class="muted">Vista previa</p>
          <img id="prev" src="${avatarDataURL(state.avatar,5)}" style="width:100px;height:100px;margin-top:8px;background:#0a0e28;border-radius:8px;">
        </div>
        <div class="card" style="margin-top:14px;">
          <p class="muted">Tu nombre (visible para los demás en vez de tu ID)</p>
          <input id="charName" type="text" maxlength="12" placeholder="Escribe tu nombre" value="${(state.name||'').replace(/"/g,'&quot;')}" style="margin-top:8px; width:100%; box-sizing:border-box; padding:10px 12px; border-radius:8px; border:1px solid var(--panel2); background:#0a0e28; color:#fff; font-size:1rem;">
        </div>
      </div>
    </div>
    <div class="row" style="justify-content:flex-end; margin-top:10px;">
      <button class="btn alt" id="createBtn" ${avatarIsEmpty() ? 'disabled' : ''} onclick="finishCreator()">✅ Crear personaje → tutorial</button>
    </div>
  </div>`);
  G.querySelectorAll('.swatch').forEach(s => s.addEventListener('click', () => { paintColor = s.dataset.col; sceneCreator(); }));
  G.querySelectorAll('.px').forEach(cell => {
    cell.addEventListener('pointerdown', e => { e.preventDefault(); painting = true; paintCell(cell); });
    cell.addEventListener('pointerenter', () => { if (painting) paintCell(cell); });
  });
}
function paintCell(cell){
  const i = +cell.dataset.i;
  const c = paintColor === 'transparent' ? null : paintColor;
  state.avatar[i] = c;
  cell.style.background = c ? c : 'transparent';
  const prev = document.getElementById('prev'); if (prev) prev.src = avatarDataURL(state.avatar, 5);
  const btn = document.getElementById('createBtn'); if (btn) btn.disabled = avatarIsEmpty();
}
function clearAvatar(){ state.avatar = new Array(625).fill(null); sceneCreator(); }function randomAvatar(){
  state.avatar = new Array(625).fill(null);
  const cols = PALETTE.filter(c => c !== 'transparent');
  const base = cols[Math.floor(Math.random() * cols.length)];
  for (let y = 5; y < 20; y++) for (let x = 5; x <= 12; x++) if (Math.random() < 0.5){ const c = Math.random() < 0.25 ? cols[Math.floor(Math.random() * cols.length)] : base; state.avatar[y*25+x] = c; state.avatar[y*25+(24-x)] = c; }
  sceneCreator();
}
function finishCreator(){
  const inp = document.getElementById('charName');
  let nm = inp ? inp.value.trim().slice(0, 12) : '';
  if (!nm) nm = 'Héroe' + Math.floor(Math.random() * 900 + 100);
  state.name = nm;
  sceneShop();
}
/*__PART2__*/
/* =================================================
   TUTORIAL — TIENDA
================================================= */
function quarkEl(t){ return `<div class="quark q-${t}">${t === 'up' ? 'U' : 'D'}</div>`; }
function buyQuark(t){ if (state.Q < 1) return; state.Q -= 1; state.quarks[t] += 1; sceneShop(); }
function sceneShop(){
  show(`
  <div class="scene active">
    <h2>🛒 Tienda de partículas — Tutorial</h2>
    <div class="row" style="justify-content:space-between;">
      <span class="badge gold">Monedas: ${state.Q} Q</span>
      <span class="badge">Tus quarks: U×${state.quarks.up} D×${state.quarks.down}</span>
    </div>
    <div class="row" style="margin-top:18px; gap:20px;">
      <div class="card" style="flex:1; text-align:center;">${quarkEl('up')}<p style="margin-top:8px;"><b>Quark Up</b></p><p class="muted">Precio: 1 Q</p><button class="btn" style="margin-top:10px;" ${state.Q < 1 ? 'disabled' : ''} onclick="buyQuark('up')">Comprar</button></div>
      <div class="card" style="flex:1; text-align:center;">${quarkEl('down')}<p style="margin-top:8px;"><b>Quark Down</b></p><p class="muted">Precio: 1 Q</p><button class="btn" style="margin-top:10px;" ${state.Q < 1 ? 'disabled' : ''} onclick="buyQuark('down')">Comprar</button></div>
    </div>
    <div class="row" style="margin-top:auto; justify-content:flex-end;">
      <button class="btn alt" ${(state.quarks.up < 2 || state.quarks.down < 1) ? 'disabled' : ''} onclick="sceneAssemble()">Ir al inventario ➡</button>
    </div>
  </div>`);
}

/* =================================================
   TUTORIAL — ENSAMBLAR PROTÓN
================================================= */
let available = null;
function sceneAssemble(){
  if (available === null){ available = { up: state.quarks.up, down: state.quarks.down }; state.slots = [null, null, null]; }
  const slotHtml = state.slots.map((s, i) => `<div onclick="removeSlot(${i})" style="width:80px;height:80px;border:2px dashed var(--panel2);border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;background:#0a0e28;">${s ? quarkEl(s) : '<span class="muted">vacío</span>'}</div>`).join('');
  const isProton = (state.slots.filter(x => x === 'up').length === 2 && state.slots.filter(x => x === 'down').length === 1);
  show(`
  <div class="scene active">
    <h2>🧪 Inventario — Ensambla tu protón</h2>
    <div class="card" style="margin-top:14px; text-align:center;">
      <p class="muted">Disponibles</p>
      <div class="row" style="justify-content:center; margin-top:10px; min-height:50px;">
        ${available.up > 0 ? `<div onclick="placeSlot('up')" style="cursor:pointer;text-align:center;">${quarkEl('up')}<div class="muted">x${available.up}</div></div>` : ''}
        ${available.down > 0 ? `<div onclick="placeSlot('down')" style="cursor:pointer;text-align:center;">${quarkEl('down')}<div class="muted">x${available.down}</div></div>` : ''}
        ${(available.up === 0 && available.down === 0) ? '<span class="muted">(todos colocados)</span>' : ''}
      </div>
    </div>
    <div class="row" style="justify-content:center; gap:24px; margin-top:22px;">${slotHtml}</div>
    <div style="text-align:center; margin-top:18px;">${isProton ? '<p class="gold" style="font-size:1.2rem;">🔴 ¡PROTÓN listo!</p>' : ''}</div>
    <div class="row" style="margin-top:auto; justify-content:flex-end;">
      <button class="btn" ${isProton ? '' : 'disabled'} onclick="makeProton()">🎉 Crear Protón</button>
    </div>
  </div>`);
}
function placeSlot(t){ const i = state.slots.indexOf(null); if (i === -1 || available[t] <= 0) return; state.slots[i] = t; available[t]--; sceneAssemble(); }
function removeSlot(i){ if (!state.slots[i]) return; available[state.slots[i]]++; state.slots[i] = null; sceneAssemble(); }
function makeProton(){
  state.quarks.up -= 2; state.quarks.down -= 1; state.protons += 1; available = null;
  show(`
  <div class="scene active"><div class="center">
    <h1 style="font-size:2rem;">🎉 ¡Tu primer Protón!</h1>
    <img src="${avatarDataURL(state.avatar,4)}" style="width:110px;height:110px;background:#0a0e28;border-radius:10px;">
    <p><b>🔴 Protón</b></p>
    <button class="btn" onclick="enterWorld()">🌎 Entrar al mundo online</button>
  </div></div>`);
}

/* =================================================
   ENTRAR AL MUNDO COMPARTIDO
================================================= */
function enterWorld(){
  // Enviamos nuestro avatar al servidor: aparecemos para todos
  socket.emit('join', { avatar: state.avatar, name: state.name, equipped: state.equipped, stats: { electrons: state.electrons, Q: state.Q, wins: state.wins } });
  inWorld = true;
  startWorldLoop();
}
/*__PART3__*/
/* =================================================
   MUNDO COMPARTIDO (canvas + sincronización)
================================================= */
let worldStarted = false;
let battleActive = false;
let rafId = null;

function startWorldLoop(){
  const cw = WORLD.W * WORLD.TILE, ch = WORLD.H * WORLD.TILE;
  show(`
  <div class="scene active">
    <div class="row" style="justify-content:space-between;">
      <h2 style="margin:0;">🌎 Mundo compartido</h2>
      <div class="row">
        <span class="badge">👤 ${state.name || 'Sin nombre'}${state.accountId ? ' · '+state.accountId : ''}</span>
        <span class="badge">👥 <span id="pcount">1</span></span>
        <span class="badge gold" id="coins">${state.Q} Q</span>
        <span class="badge" id="exp">EXP ${state.exp}</span>
      </div>
    </div>
    <div style="display:flex; gap:14px; margin-top:12px; align-items:flex-start; justify-content:center; flex-wrap:wrap;">
      <canvas id="world" width="${cw}" height="${ch}" style="background:#0a1f12; border:2px solid var(--panel2); border-radius:12px; max-width:100%;"></canvas>
      <div id="leaderboard" style="width:300px; max-width:100%; flex:0 0 auto; overflow:auto;"></div>
    </div>
    <div class="row" style="justify-content:center; margin-top:6px;">
      <button class="btn ghost" onclick="tryMove(0,-1)">↑</button>
      <button class="btn ghost" onclick="tryMove(0,1)">↓</button>
      <button class="btn ghost" onclick="tryMove(-1,0)">←</button>
      <button class="btn ghost" onclick="tryMove(1,0)">→</button>
      <button class="btn" onclick="openInventory()">🎒 Inventario (E)</button>
      <button class="btn alt" onclick="openPvpList()">⚔️ 1vs1 (P)</button>
      <button class="btn alt" onclick="startTradeSelected()">🔄 Intercambio (I)</button>
      <button class="btn alt" onclick="openSaveMenu()">💾 Guardar (G)</button>
      <button class="btn ghost" onclick="toggleChat()">💬 Chat (T)</button>
    </div>
    <div id="chatpanel" style="display:none; position:fixed; left:12px; bottom:12px; width:300px; max-width:70%; background:rgba(6,10,24,.92); border:2px solid var(--panel2); border-radius:12px; padding:10px; z-index:40;">
      <div class="row" style="justify-content:space-between; align-items:center;">
        <b style="font-size:.9rem;">💬 Chat global</b>
        <button class="btn ghost" style="padding:2px 8px;" onclick="toggleChat()">✕</button>
      </div>
      <div id="chatlog" style="height:150px; overflow-y:auto; margin-top:8px; font-size:.85rem; line-height:1.5; background:#0a0e28; border-radius:8px; padding:8px;"></div>
      <div class="row" style="margin-top:8px; gap:6px;">
        <input id="chatinput" type="text" maxlength="120" placeholder="Escribe y Enter…" style="flex:1; padding:8px 10px; border-radius:8px; border:1px solid var(--panel2); background:#0a0e28; color:#fff;">
        <button class="btn" style="padding:6px 12px;" onclick="sendChat()">Enviar</button>
      </div>
    </div>
  </div>`);
  if (!worldStarted){
    worldStarted = true;
    document.addEventListener('keydown', (e) => {
      if (!inWorld) return;
      const chatting = document.activeElement && document.activeElement.id === 'chatinput';
      if (chatting){
        if (e.key === 'Enter'){ e.preventDefault(); sendChat(); }
        else if (e.key === 'Escape'){ e.preventDefault(); toggleChat(); }
        return; // no mover mientras escribes
      }
      if (e.key === 't' || e.key === 'T'){ e.preventDefault(); toggleChat(); return; }
      if (battleActive){ return; }
      if (e.key === 'Escape'){ closeModal(); return; }
      if (document.getElementById('modal')){ if (e.key==='e'||e.key==='E'||e.key==='g'||e.key==='G') closeModal(); return; }
      if (e.key === 'e' || e.key === 'E'){ openInventory(); return; }
      if (e.key === 'p' || e.key === 'P'){ openPvpList(); return; }
      if (e.key === 'i' || e.key === 'I'){ startTradeSelected(); return; }
      if (e.key === 'g' || e.key === 'G'){ openSaveMenu(); return; }
      const map = { ArrowUp:[0,-1], ArrowDown:[0,1], ArrowLeft:[-1,0], ArrowRight:[1,0], w:[0,-1], s:[0,1], a:[-1,0], d:[1,0], W:[0,-1], S:[0,1], A:[-1,0], D:[1,0] };
      if (map[e.key]){ e.preventDefault(); tryMove(...map[e.key]); }
    });
  }
  cancelAnimationFrame(rafId);
  drawWorld();
  renderLeaderboard();
  const cvEl = document.getElementById('world');
  if (cvEl) cvEl.addEventListener('click', onWorldClick);
}

/* ---------- Tabla de clasificación ---------- */
function renderLeaderboard(){
  const cont = document.getElementById('leaderboard');
  if (!cont) return;
  const board = leaderboardData || [];
  const medals = ['🥇', '🥈', '🥉'];
  const rows = board.length ? board.map((p, i) => {
    const mine = p.id === myId;
    const rank = medals[i] || `#${i + 1}`;
    return `<tr style="${mine ? 'background:rgba(255,208,102,.12);' : ''}">
      <td style="padding:6px 10px; text-align:center;">${rank}</td>
      <td style="padding:6px 10px;">${escapeHtml(p.name)}${mine ? ' <span class="muted">(tú)</span>' : ''}</td>
      <td style="padding:6px 10px; text-align:center;">e- ${p.electrons}</td>
      <td style="padding:6px 10px; text-align:center;" class="gold">${p.Q} Q</td>
      <td style="padding:6px 10px; text-align:center;">🏆 ${p.wins}</td>
    </tr>`;
  }).join('') : `<tr><td colspan="5" class="muted" style="padding:12px; text-align:center;">Aún no hay jugadores en la tabla.</td></tr>`;
  cont.innerHTML = `
    <div class="card">
      <h3 style="margin:0 0 8px;">🏅 Tabla de clasificación</h3>
      <div style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:.9rem;">
          <thead><tr style="border-bottom:1px solid var(--panel2);">
            <th style="padding:6px 10px;">#</th>
            <th style="padding:6px 10px; text-align:left;">Jugador</th>
            <th style="padding:6px 10px;">Electrones</th>
            <th style="padding:6px 10px;">Q</th>
            <th style="padding:6px 10px;">Victorias</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

function tryMove(dx, dy){
  if (!inWorld || battleActive || document.getElementById('modal')) return;
  const nx = Math.max(0, Math.min(WORLD.W - 1, me.tx + dx));
  const ny = Math.max(0, Math.min(WORLD.H - 1, me.ty + dy));
  if (nx === me.tx && ny === me.ty) return;
  me.tx = nx; me.ty = ny;              // movimiento optimista
  socket.emit('move', { tx: nx, ty: ny }); // el servidor confirma y difunde
  state.steps++;
  if (Math.random() < 0.01) startBattle('helium');
  else if (Math.random() < 0.05) startBattle('hydrogen');
}

function drawWorld(){
  const cv = document.getElementById('world');
  if (!cv){ rafId = requestAnimationFrame(drawWorld); return; }
  const ctx = cv.getContext('2d');
  const T = WORLD.TILE;
  ctx.clearRect(0, 0, cv.width, cv.height);
  drawGrass(ctx, cv.width, cv.height, T);
  ctx.imageSmoothingEnabled = false;
  // otros jugadores
  for (const id in others){
    const p = others[id];
    if (!p.canvas) p.canvas = avatarCanvas(p.avatar);
    drawActor(ctx, p.canvas, p.tx, p.ty, T, false, p.name || id.slice(0,4), p);
    if (id === tradeSelectedId){
      ctx.strokeStyle = '#ffd54f'; ctx.lineWidth = 3;
      ctx.strokeRect(p.tx * T + 1, p.ty * T + 1, T - 2, T - 2);
    }
  }
  // yo
  if (!me.canvas) me.canvas = avatarCanvas(state.avatar);
  drawActor(ctx, me.canvas, me.tx, me.ty, T, true, state.name || 'TÚ', me);
  const pc = document.getElementById('pcount'); if (pc) pc.textContent = 1 + Object.keys(others).length;
  rafId = requestAnimationFrame(drawWorld);
}
function drawActor(ctx, img, tx, ty, T, isMe, label, p){
  const px = tx * T, py = ty * T;
  if (isMe){ ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(px+2, py+2, T-4, T-4); }
  ctx.drawImage(img, px+4, py+4, T-8, T-8);
  ctx.fillStyle = '#fff'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(label, px + T/2, py + 10);
  if (p && p.emote && Date.now() - (p.emoteT||0) < 2500){
    ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(px - 6, py - 16, T + 12, 14);
    ctx.fillStyle = '#ffd54f'; ctx.fillText(p.emote, px + T/2, py - 5);
  }
}

/* ---------- Césped procedural (sin cuadrícula) ---------- */
function drawGrass(ctx, w, h, T){
  // Base con degradado verde
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#1c5a30'); g.addColorStop(1, '#123f22');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // Manchas suaves para dar textura orgánica
  const rand = mulberry32(1337);
  ctx.globalAlpha = 0.12;
  for (let i = 0; i < Math.floor((w*h)/1400); i++){
    const x = rand() * w, y = rand() * h, r = 14 + rand() * 34;
    ctx.fillStyle = rand() > 0.5 ? '#268a45' : '#0e3a1e';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Briznas de césped
  const rb = mulberry32(90210);
  for (let i = 0; i < Math.floor((w*h)/70); i++){
    const x = rb() * w, y = rb() * h;
    const hgt = 3 + rb() * 4, lean = (rb() - 0.5) * 3;
    ctx.strokeStyle = rb() > 0.5 ? 'rgba(120,220,140,.35)' : 'rgba(40,140,70,.4)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + lean, y - hgt); ctx.stroke();
  }
}
// PRNG determinista para que el césped no parpadee entre frames
function mulberry32(a){
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* ---------- Chat global (tecla T) ---------- */
function toggleChat(){
  const panel = document.getElementById('chatpanel');
  if (!panel) return;
  const open = panel.style.display !== 'none';
  panel.style.display = open ? 'none' : 'block';
  if (!open){ const inp = document.getElementById('chatinput'); if (inp) inp.focus(); }
  else { const inp = document.getElementById('chatinput'); if (inp) inp.blur(); }
}
function sendChat(){
  const inp = document.getElementById('chatinput');
  if (!inp) return;
  const text = inp.value.trim().slice(0, 120);
  if (!text) return;
  socket.emit('chat', { name: state.name, text });
  inp.value = '';
}
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function addChatLine(d){
  const log = document.getElementById('chatlog');
  if (!log) return;
  const nm = escapeHtml((d && d.name) ? d.name : (d && d.id ? d.id.slice(0,4) : '???'));
  const tx = escapeHtml((d && d.text) ? d.text : '');
  const mine = d && d.id && d.id === myId;
  const line = document.createElement('div');
  line.innerHTML = `<b style="color:${mine ? 'var(--gold)' : 'var(--accent)'};">${nm}:</b> ${tx}`;
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
}

/* =================================================
   BATALLA LOCAL (contra Hidrógeno salvaje)
================================================= */
let battle = null;
function openModal(html){
  closeModal();
  const d = document.createElement('div'); d.id = 'modal';
  d.innerHTML = `<div style="background:var(--panel);border:2px solid var(--panel2);border-radius:16px;padding:22px;max-width:760px;width:100%;max-height:92%;overflow:auto;">${html}</div>`;
  G.appendChild(d);
}
function closeModal(){ const m = document.getElementById('modal'); if (m) m.remove(); }

function startBattle(foeType){
  battleActive = true;
  socket.emit('emote', '⚔️ ¡en batalla!');
  foeType = WILD_FOES[foeType] ? foeType : 'hydrogen';
  // Combatiente equipado (si por alguna razón no tienes ninguno, usa Protón)
  let key = state.equipped;
  if (!COMBATANTS[key] || ownedCount(key) < 1){
    key = ['proton','neutron','electron','hydrogen'].find(k => ownedCount(k) >= 1) || 'proton';
    state.equipped = key;
  }
  const c = COMBATANTS[key];
  const f = WILD_FOES[foeType];
  battle = {
    meKey: key,
    foeType: foeType,
    foeInfo: f,
    me:  { hp:c.hp, max:c.hp, atk:c.atk, dodge:c.dodge, ability:c.ability, icon:c.icon, label:c.label },
    foe: { hp:f.hp, max:f.hp, atk:f.atk, dodge:f.dodge, label:f.label, icon:f.icon },
    turn:1, ready:false, pturns:0, over:false, win:false,
    log:[`⚠️ ¡Un ${f.label} salvaje apareció! Luchas con tu ${c.label} ${c.icon}.`]
  };
  renderBattle();
}
function blog(m){ battle.log.push(m); if (battle.log.length > 20) battle.log.shift(); }
function renderBattle(){
  const b = battle;
  const pPct = Math.max(0, b.me.hp / b.me.max * 100);
  const hPct = Math.max(0, b.foe.hp / b.foe.max * 100);
  const canAbility = b.ready && !b.over;
  const meVisual = b.meKey === 'proton'
    ? `<img src="${avatarDataURL(state.avatar,3)}" style="width:70px;height:70px;background:#0a0e28;border-radius:8px;margin:8px 0;">`
    : `<div style="width:70px;height:70px;border-radius:12px;margin:8px auto;background:#0a0e28;display:flex;align-items:center;justify-content:center;font-size:2rem;">${b.me.icon}</div>`;
  openModal(`
    <h2 style="text-align:center;">⚔️ Batalla — Turno ${b.turn}</h2>
    <div class="row" style="justify-content:space-between; align-items:flex-start;">
      <div class="card" style="flex:1; text-align:center;">
        <p><b>${b.me.icon} ${b.me.label.toUpperCase()}</b></p>
        ${meVisual}
        <div style="background:#300;border-radius:8px;overflow:hidden;height:14px;"><div style="height:100%;width:${pPct}%;background:linear-gradient(90deg,#5be08a,#2fa55e);"></div></div>
        <p class="muted">❤️ ${Math.max(0,b.me.hp)}/${b.me.max}</p>
      </div>
      <div style="align-self:center; font-size:1.4rem;">VS</div>
      <div class="card" style="flex:1; text-align:center;">
        <p><b>${b.foe.icon} ${b.foe.label.toUpperCase()}</b></p>
        <div style="width:70px;height:70px;border-radius:50%;margin:8px auto;background:${b.foeInfo.gradient};display:flex;align-items:center;justify-content:center;font-weight:800;color:${b.foeInfo.textColor};">${b.foeInfo.letter}</div>
        <div style="background:#003;border-radius:8px;overflow:hidden;height:14px;"><div style="height:100%;width:${hPct}%;background:linear-gradient(90deg,#5be08a,#2fa55e);"></div></div>
        <p class="muted">❤️ ${Math.max(0,b.foe.hp)}/${b.foe.max}</p>
      </div>
    </div>
    <div id="log" style="margin-top:14px;">${b.log.map(l => `<div>${l}</div>`).join('')}</div>
    <div class="row" style="justify-content:center; margin-top:14px;">
      ${b.over ? `<button class="btn" onclick="endBattle()">Continuar ➡</button>` : `
        <button class="btn" onclick="pAct('attack')">💥 Ataque</button>
        <button class="btn alt" ${canAbility ? '' : 'disabled'} onclick="pAct('ability')">${b.me.ability.icon} ${b.me.ability.name} ${canAbility ? '' : '⏳'}</button>`}
    </div>`);
  const lg = document.getElementById('log'); if (lg) lg.scrollTop = lg.scrollHeight;
}
function pAct(kind){
  const b = battle; if (b.over) return;
  if (kind === 'ability' && !b.ready) return;
  const dmg = kind === 'ability' ? b.me.ability.dmg : b.me.atk;
  const nm = kind === 'ability' ? `${b.me.ability.name} ${b.me.ability.icon}` : 'Ataque 💥';
  if (Math.random() < b.foe.dodge){ blog(`${b.me.label} usa ${nm}… 🌫️ ¡el ${b.foe.label} esquivó! (0)`); }
  else { b.foe.hp -= dmg; blog(`${b.me.label} usa ${nm} → ${dmg} de daño.`); }
  if (kind === 'ability') b.ready = false;
  b.pturns++;
  if (b.foe.hp <= 0){ b.foe.hp = 0; b.over = true; b.win = true; blog(`🏆 ¡${b.foe.label} derrotado!`); renderBattle(); return; }
  setTimeout(enemyTurn, 400);
  renderBattle();
}
function enemyTurn(){
  const b = battle; if (b.over) return;
  if (Math.random() < b.me.dodge){ blog(`${b.foe.label} ataca… 💨 ¡tu ${b.me.label} esquivó! (0)`); }
  else { b.me.hp -= b.foe.atk; blog(`${b.foe.label} ataca → ${b.foe.atk} de daño.`); }
  if (b.me.hp <= 0){ b.me.hp = 0; b.over = true; b.win = false; blog(`💀 Tu ${b.me.label} cayó…`); renderBattle(); return; }
  b.turn++;
  b.ready = (b.pturns % b.me.ability.every === (b.me.ability.every - 1));
  renderBattle();
}
function endBattle(){
  if (battle.win){
    state.wins++;
    const f = battle.foeInfo;
    // Recompensa garantizada (100%)
    state.Q += f.reward.Q; state.exp += f.reward.exp;
    blog(`💰 +${f.reward.Q} Q · ⭐ +${f.reward.exp} EXP`);
    // Recompensa con probabilidad según el enemigo
    if (Math.random() < f.bonusChance){
      state.quarks.up += f.bonus.up; state.quarks.down += f.bonus.down; state.electrons += f.bonus.e;
      blog(`🎁 ¡Botín raro! +${f.bonus.up} Quark Up · +${f.bonus.down} Quark Down · +${f.bonus.e} e-`);
    }
  }
  battleActive = false;
  closeModal();
  socket.emit('emote', battle.win ? '🏆 ¡gané!' : '💀');
  sendStats();
  const c = document.getElementById('coins'); if (c) c.textContent = state.Q + ' Q';
  const ex = document.getElementById('exp'); if (ex) ex.textContent = 'EXP ' + state.exp;
}

/* =================================================
   INVENTARIO (E) — estadísticas + fabricación
================================================= */
function openInventory(){
  const canProton  = state.quarks.up >= 2 && state.quarks.down >= 1;
  const canNeutron = state.quarks.down >= 2 && state.quarks.up >= 1;
  const canHydro   = state.protons >= 1 && state.electrons >= 1;
  // Tarjetas equipables (protones, neutrones, electrones y átomos que tengas)
  const equipCards = ['proton','neutron','electron','hydrogen'].filter(key => ownedCount(key) >= 1).map(key => {
    const c = COMBATANTS[key];
    const n = ownedCount(key);
    const isEq = state.equipped === key;
    const border = isEq ? 'border-color:var(--gold);' : '';
    return `<div class="card" style="flex:1; min-width:130px; text-align:center; background:#0a0e28; ${border}cursor:pointer;" onclick="equipCombatant('${key}')">
      <div style="font-size:1.8rem;">${c.icon}</div>
      <p><b>${c.label}</b> ×${n}</p>
      <p style="font-size:.8rem; margin-top:4px; color:${isEq?'var(--gold)':'var(--muted)'};">${isEq?'✅ Equipado':'Click para equipar'}</p>
    </div>`;
  }).join('') || '<p class="muted">Aún no posees combatientes.</p>';
  openModal(`
    <div class="row" style="justify-content:space-between;"><h2 style="margin:0;">🎒 Inventario</h2><button class="btn ghost" onclick="closeModal()">✕</button></div>
    <div class="row" style="margin-top:12px; gap:14px; align-items:center;">
      <img src="${avatarDataURL(state.avatar,3)}" style="width:70px;height:70px;background:#0a0e28;border-radius:10px;">
      <div><p><b>Tu héroe</b></p><p class="muted">Pasos: ${state.steps} · Victorias: ${state.wins} · Equipado: <b>${COMBATANTS[state.equipped]?COMBATANTS[state.equipped].icon+' '+COMBATANTS[state.equipped].label:'—'}</b></p></div>
    </div>

    <div class="card" style="margin-top:12px;">
      <p style="color:var(--accent);"><b>⚔️ Equipar para batalla</b></p>
      <div class="row" style="margin-top:10px; gap:10px; align-items:stretch; flex-wrap:wrap;">${equipCards}</div>
    </div>

    <div class="row" style="margin-top:12px; gap:12px; align-items:stretch;">

      <div class="card" style="flex:1; min-width:170px; line-height:1.8;">
        <p style="color:var(--accent);"><b>📊 Estadísticas</b></p>
        <p>💰 <b class="gold">${state.Q} Q</b> · ⭐ EXP <b>${state.exp}</b></p>
        ${state.quarks.up>0?`<p>🟠 Quark Up: <b>${state.quarks.up}</b></p>`:''}
        ${state.quarks.down>0?`<p>🔵 Quark Down: <b>${state.quarks.down}</b></p>`:''}
        ${state.protons>0?`<p>🔴 Protones: <b>${state.protons}</b></p>`:''}
        ${state.neutrons>0?`<p>⚪ Neutrones: <b>${state.neutrons}</b></p>`:''}
        ${state.electrons>0?`<p>⚛️ Electrones: <b>${state.electrons}</b></p>`:''}
        ${state.atoms.hydrogen>0?`<p>🧩 Hidrógeno: <b>${state.atoms.hydrogen}</b></p>`:''}
      </div>

      <div class="card" style="flex:1; min-width:180px;">
        <p style="color:var(--accent);"><b>🔧 Fabricación de partículas</b></p>
        <div class="card" style="margin-top:10px; background:#0a0e28;">
          <p><b>🔴 Protón</b></p>
          <button class="btn" style="margin-top:8px;" onclick="makeParticle('proton')">Fabricar</button>
        </div>
        <div class="card" style="margin-top:10px; background:#0a0e28;">
          <p><b>⚪ Neutrón</b></p>
          <button class="btn" style="margin-top:8px;" onclick="makeParticle('neutron')">Fabricar</button>
        </div>
      </div>

      <div class="card" style="flex:1; min-width:180px;">
        <p style="color:var(--accent);"><b>🧩 Fabricación de átomos</b></p>
        <div class="card" style="margin-top:10px; background:#0a0e28;">
          <p><b>🧩 Hidrógeno</b></p>
          <button class="btn alt" style="margin-top:8px;" onclick="makeAtom('hydrogen')">Crear átomo</button>
        </div>
      </div>

    </div>
  `);
}
function refreshHUD(){
  const c = document.getElementById('coins'); if (c) c.textContent = state.Q + ' Q';
  const ex = document.getElementById('exp'); if (ex) ex.textContent = 'EXP ' + state.exp;
  if (inWorld) sendStats();
}
function makeParticle(kind){
  if (kind === 'proton'){
    if (state.quarks.up < 2 || state.quarks.down < 1) return;
    state.quarks.up -= 2; state.quarks.down -= 1; state.protons += 1;
  } else if (kind === 'neutron'){
    if (state.quarks.down < 2 || state.quarks.up < 1) return;
    state.quarks.down -= 2; state.quarks.up -= 1; state.neutrons += 1;
  }
  openInventory();
}
function makeAtom(kind){
  if (kind === 'hydrogen'){
    if (state.protons < 1 || state.electrons < 1) return;
    state.protons -= 1; state.electrons -= 1; state.atoms.hydrogen += 1;
  }
  if (inWorld) sendStats();
  openInventory();
}

/* =================================================
   CUENTAS (3 ranuras con ID persistente)
================================================= */
function getAccountSlot(n){
  try{ const s = localStorage.getItem('elementaria_online_account'+n); return s ? JSON.parse(s) : null; }catch(e){ return null; }
}
function generateAccountId(){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random()*chars.length)];
  return id;
}
function gatherAccount(n){
  const aid = state.accountId || generateAccountId();
  return { game:'Elementaria', mode:'online', slot:n, v:3, ts:Date.now(),
    accountId: aid, name: state.name, avatar: state.avatar,
    Q:state.Q, quarks:{...state.quarks}, equipped: state.equipped,
    protons:state.protons, neutrons:state.neutrons, electrons:state.electrons,
    atoms:{...state.atoms}, exp:state.exp, steps:state.steps, wins:state.wins };
}
function saveToSlot(n){
  const data = gatherAccount(n);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type:'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `elementaria_cuenta${n}.txt`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(a.href);
  state.accountId = data.accountId;
  state.accountSlot = n;
  try{ localStorage.setItem('elementaria_online_account'+n, JSON.stringify({ accountId:data.accountId, name:data.name, ts:data.ts })); }catch(e){}
  openSaveMenu();
}
function loadFromFile(n){
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.txt,.json,text/plain,application/json';
  inp.onchange = ev => {
    const f = ev.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { try{ applyAccount(JSON.parse(r.result), n); }catch(err){ alert('El archivo no es un guardado válido de Elementaria.'); } };
    r.readAsText(f);
  };
  inp.click();
}
function applyAccount(d, n){
  if (!d || d.game !== 'Elementaria'){ alert('Ese archivo no es un guardado de Elementaria.'); return; }
  // Cargar la cuenta completa en el estado local
  state.accountId = d.accountId || generateAccountId();
  state.accountSlot = n || null;
  state.name = d.name || state.name || '';
  state.avatar = d.avatar || null;
  state.Q = d.Q || 0;
  state.quarks = d.quarks || { up:0, down:0 };
  state.protons = d.protons || 0;
  state.neutrons = d.neutrons || 0;
  state.electrons = d.electrons || (d.rewards ? (d.rewards.electrons || 0) : 0);
  state.atoms = d.atoms || { hydrogen:0 };
  state.equipped = d.equipped && COMBATANTS[d.equipped] ? d.equipped : 'proton';
  state.exp = (typeof d.exp === 'number') ? d.exp : (d.rewards ? (d.rewards.exp || 0) : 0);
  state.steps = d.steps || 0;
  state.wins = d.wins || 0;
  // Reconectar con la cuenta original: unirse al mundo con tu avatar y nombre
  if (state.avatar && myId){
    me.canvas = avatarCanvas(state.avatar);
    socket.emit('join', { avatar: state.avatar, name: state.name, equipped: state.equipped });
  }
  try{ localStorage.setItem('elementaria_online_account'+(n||1), JSON.stringify({ accountId:state.accountId, name:state.name, ts:Date.now() })); }catch(e){}
  closeModal();
  if (inWorld) startWorldLoop(); else sceneCreator();
}
function deleteSlot(n){
  if (!confirm('¿Borrar la Cuenta ' + n + '? (No elimina el archivo .txt ya descargado)')) return;
  try{ localStorage.removeItem('elementaria_online_account'+n); }catch(e){}
  // Si era la cuenta activa, limpiar
  if (state.accountSlot === n){ state.accountId = null; state.accountSlot = null; }
  openSaveMenu();
}
function openSaveMenu(){
  let slots = '';
  for (let n = 1; n <= 3; n++){
    const meta = getAccountSlot(n);
  const isActive = state.accountSlot === n;
  let info = 'Vacía';
  if (meta){
    const idDisp = meta.accountId ? ('ID: ' + meta.accountId) : '';
    const nameDisp = meta.name ? (' · ' + meta.name) : '';
    info = idDisp + nameDisp + '<br>🕒 ' + new Date(meta.ts).toLocaleString();
  }
  slots += `<div class="card" style="margin-top:10px;${isActive ? ' border-color:var(--gold);' : ''}"><div class="row" style="justify-content:space-between; align-items:center; gap:10px;">
    <div><b>${isActive ? '⭐ ' : ''}Cuenta ${n}</b>${isActive ? ' (activa)' : ''}<br><span class="muted" style="font-size:.85rem;">${info}</span></div>
    <div class="row"><button class="btn" onclick="saveToSlot(${n})">💾 Guardar</button><button class="btn ghost" onclick="loadFromFile(${n})">📂 Cargar</button><button class="btn alt" ${meta ? '' : 'disabled'} onclick="deleteSlot(${n})">🗑️ Borrar</button></div>
  </div></div>`;
  }
  const activeInfo = state.accountId ? `Cuenta activa: ID <b>${state.accountId}</b>${state.name ? ' · '+state.name : ''}` : 'Ninguna cuenta activa';
  openModal(`
    <div class="row" style="justify-content:space-between;"><h2 style="margin:0;">👤 Cuentas</h2><button class="btn ghost" onclick="closeModal()">✕</button></div>
    <p class="muted" style="margin-top:6px;">${activeInfo}</p>
    <p class="muted" style="margin-top:4px;">Puedes tener hasta <b>3 cuentas</b>. Cada una tiene un <b>ID único</b>. Al <b>Guardar</b> se descarga un archivo .txt con todos tus datos e ID. Al <b>Cargar</b> un archivo, regresas a esa cuenta original.</p>
    ${slots}
  `);
}

/* =================================================
   PVP 1 vs 1 (retos entre jugadores conectados)
================================================= */
let pvpListTimer = null;
let toastTimer = null;
function toast(msg){
  let t = document.getElementById('toast');
  if (!t){
    t = document.createElement('div'); t.id = 'toast';
    t.style.cssText = 'position:fixed;top:14px;left:50%;transform:translateX(-50%);background:rgba(6,10,24,.96);border:2px solid var(--panel2);color:#fff;padding:10px 16px;border-radius:10px;z-index:60;font-size:.9rem;max-width:80%;text-align:center;';
    document.body.appendChild(t);
  }
  t.textContent = msg; t.style.display = 'block';
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { if (t) t.style.display = 'none'; }, 4000);
}

function openPvpList(){
  if (!inWorld || battleActive) return;
  const now = Date.now();
  const cd = Math.max(0, Math.ceil((pvpCooldownUntil - now) / 1000));
  const ids = Object.keys(others);
  let rows;
  if (ids.length === 0){
    rows = '<p class="muted" style="margin-top:12px;">No hay otros jugadores conectados ahora mismo. Cuando alguien entre a tu WiFi aparecerá aquí.</p>';
  } else {
    rows = ids.map(id => {
      const p = others[id];
      const nm = escapeHtml(p.name || id.slice(0, 4));
      const dis = cd > 0 ? 'disabled' : '';
      return `<div class="card" style="margin-top:10px; background:#0a0e28;"><div class="row" style="justify-content:space-between; align-items:center;">
        <div class="row" style="gap:10px; align-items:center;"><img src="${avatarDataURL(p.avatar,2)}" style="width:44px;height:44px;background:#060a18;border-radius:8px;"><b>${nm}</b></div>
        <button class="btn alt" ${dis} onclick="sendPvpInvite('${id}')">⚔️ Retar</button>
      </div></div>`;
    }).join('');
  }
  const cdNote = cd > 0 ? `<p class="gold" style="margin-top:8px;">⏳ Espera ${cd}s para enviar otra solicitud (tu último reto fue rechazado).</p>` : '';
  openModal(`
    <div class="row" style="justify-content:space-between;"><h2 style="margin:0;">⚔️ 1 vs 1 — Jugadores conectados</h2><button class="btn ghost" onclick="closeModal()">✕</button></div>
    <p class="muted" style="margin-top:6px;">Reta a otro jugador. Si acepta, pelean con el combatiente que cada uno tenga equipado. Si rechaza, esperarás 30 segundos antes de poder enviar otra solicitud.</p>
    ${cdNote}
    ${rows}
    <p class="muted" style="margin-top:10px;">Pulsa <b>P</b> o ✕ para cerrar.</p>
  `);
  if (cd > 0){ if (pvpListTimer) clearTimeout(pvpListTimer); pvpListTimer = setTimeout(() => { if (document.getElementById('modal')) openPvpList(); }, 1000); }
}

function sendPvpInvite(id){
  if (Date.now() < pvpCooldownUntil){ toast('⏳ Aún estás en tiempo de espera.'); return; }
  socket.emit('pvp-invite', { targetId: id });
  toast('✉️ Solicitud enviada. Esperando respuesta…');
  closeModal();
}

function showPvpInvitePrompt(d){
  pvpInviteFrom = d;
  const foeC = COMBATANTS[d.fromKey] || COMBATANTS.proton;
  openModal(`
    <h2 style="text-align:center;">⚔️ ¡Reto de ${escapeHtml(d.fromName || 'Jugador')}!</h2>
    <p class="muted" style="text-align:center; margin-top:8px;">Te desafía a un 1 vs 1. Su combatiente equipado es ${foeC.icon} <b>${foeC.label}</b>.</p>
    <p style="text-align:center; margin-top:6px;" id="invtimer" class="gold">Responde en 30s…</p>
    <div class="row" style="justify-content:center; margin-top:14px; gap:12px;">
      <button class="btn" onclick="acceptPvp()">✅ Aceptar</button>
      <button class="btn ghost" onclick="declinePvp()">❌ Rechazar</button>
    </div>`);
  let left = 30;
  if (pvpInviteTimer) clearInterval(pvpInviteTimer);
  pvpInviteTimer = setInterval(() => {
    left--;
    const t = document.getElementById('invtimer'); if (t) t.textContent = 'Responde en ' + left + 's…';
    if (left <= 0) declinePvp();
  }, 1000);
}
function clearInvitePrompt(){ if (pvpInviteTimer){ clearInterval(pvpInviteTimer); pvpInviteTimer = null; } pvpInviteFrom = null; }
function acceptPvp(){ if (!pvpInviteFrom) return; socket.emit('pvp-accept'); clearInvitePrompt(); }
function declinePvp(){ if (!pvpInviteFrom){ closeModal(); return; } socket.emit('pvp-decline'); clearInvitePrompt(); closeModal(); toast('Rechazaste el reto.'); }

function startPvpBattle(d){
  clearInvitePrompt();
  // Aseguro que tengo un combatiente válido equipado
  let key = state.equipped;
  if (!COMBATANTS[key] || ownedCount(key) < 1){
    key = ['proton','neutron','electron','hydrogen'].find(k => ownedCount(k) >= 1) || 'proton';
    state.equipped = key;
  }
  const meC = COMBATANTS[key];
  const foeC = COMBATANTS[d.oppKey] || COMBATANTS.proton;
  pvp = {
    oppId: d.oppId, oppName: d.oppName || 'Rival', oppAvatar: d.oppAvatar || null,
    meKey: meC.key, foeKey: foeC.key,
    me:  { hp:meC.hp, max:meC.hp, atk:meC.atk, dodge:meC.dodge, ability:meC.ability, icon:meC.icon, label:meC.label },
    foe: { hp:foeC.hp, max:foeC.hp, atk:foeC.atk, dodge:foeC.dodge, ability:foeC.ability, icon:foeC.icon, label:foeC.label },
    myTurn: !!d.youFirst, pturns:0, ready:false, over:false, win:false, ended:false,
    log:[`⚔️ ¡Batalla PVP contra ${d.oppName || 'Rival'}! Tu ${meC.label} ${meC.icon} vs ${foeC.label} ${foeC.icon}.`, d.youFirst ? '▶️ Empiezas tú.' : '⏳ Empieza tu rival.']
  };
  battleActive = true;
  renderPvpBattle();
}
function pvplog(m){ if (!pvp) return; pvp.log.push(m); if (pvp.log.length > 20) pvp.log.shift(); }
function finishPvp(){
  if (!pvp || pvp.ended) return; pvp.ended = true;
  socket.emit('pvp-end');
  if (pvp.win){ state.wins++; state.Q += 2; state.exp += 10; pvplog('💰 Recompensa PVP: +2 Q · ⭐ +10 EXP'); }
  sendStats();
}
function endPvpBattle(){ battleActive = false; pvp = null; closeModal(); if (inWorld) startWorldLoop(); refreshHUD(); }
function pvpRematch(){
  const oid = pvp ? pvp.oppId : null;
  endPvpBattle();
  if (oid){ sendPvpInvite(oid); toast('🔄 Solicitud de revancha enviada…'); }
}

function pvpAct(kind){
  if (!pvp || pvp.over || !pvp.myTurn) return;
  if (kind === 'ability' && !pvp.ready) return;
  const dodged = Math.random() < pvp.foe.dodge;
  const dmg = dodged ? 0 : (kind === 'ability' ? pvp.me.ability.dmg : pvp.me.atk);
  const nm = kind === 'ability' ? `${pvp.me.ability.name} ${pvp.me.ability.icon}` : 'Ataque 💥';
  if (dodged) pvplog(`Usas ${nm}… 🌫️ ¡${pvp.oppName} esquivó! (0)`);
  else { pvp.foe.hp -= dmg; pvplog(`Usas ${nm} → ${dmg} de daño a ${pvp.oppName}.`); }
  socket.emit('pvp-action', { kind, dmg, dodged });
  pvp.pturns++;
  pvp.myTurn = false;
  if (pvp.foe.hp <= 0){ pvp.foe.hp = 0; pvp.over = true; pvp.win = true; pvplog(`🏆 ¡Derrotaste a ${pvp.oppName}!`); finishPvp(); renderPvpBattle(); return; }
  pvp.ready = (pvp.pturns % pvp.me.ability.every === (pvp.me.ability.every - 1));
  renderPvpBattle();
}
function applyPvpAction(d){
  if (!pvp || pvp.over) return;
  const nm = (d && d.kind === 'ability') ? 'una habilidad' : 'un ataque';
  if (d && d.dodged){ pvplog(`${pvp.oppName} usa ${nm}… 💨 ¡tu ${pvp.me.label} esquivó! (0)`); }
  else { pvp.me.hp -= (d ? d.dmg : 0); pvplog(`${pvp.oppName} usa ${nm} → ${d ? d.dmg : 0} de daño.`); }
  if (pvp.me.hp <= 0){ pvp.me.hp = 0; pvp.over = true; pvp.win = false; pvplog(`💀 Tu ${pvp.me.label} cayó… ${pvp.oppName} gana.`); finishPvp(); renderPvpBattle(); return; }
  pvp.myTurn = true;
  renderPvpBattle();
}
function renderPvpBattle(){
  const b = pvp; if (!b) return;
  const pPct = Math.max(0, b.me.hp / b.me.max * 100);
  const oPct = Math.max(0, b.foe.hp / b.foe.max * 100);
  const canAttack  = b.myTurn && !b.over;
  const canAbility = b.myTurn && b.ready && !b.over;
  const meVisual = b.meKey === 'proton'
    ? `<img src="${avatarDataURL(state.avatar,3)}" style="width:70px;height:70px;background:#0a0e28;border-radius:8px;margin:8px auto;">`
    : `<div style="width:70px;height:70px;border-radius:12px;margin:8px auto;background:#0a0e28;display:flex;align-items:center;justify-content:center;font-size:2rem;">${b.me.icon}</div>`;
  const oppVisual = b.oppAvatar
    ? `<img src="${avatarDataURL(b.oppAvatar,3)}" style="width:70px;height:70px;background:#0a0e28;border-radius:8px;margin:8px auto;">`
    : `<div style="width:70px;height:70px;border-radius:12px;margin:8px auto;background:#0a0e28;display:flex;align-items:center;justify-content:center;font-size:2rem;">${b.foe.icon}</div>`;
  const banner = b.over ? '' : (b.myTurn ? '<p class="gold" style="text-align:center;margin-top:6px;">🟢 ¡Tu turno!</p>' : `<p class="muted" style="text-align:center;margin-top:6px;">⏳ Turno de ${escapeHtml(b.oppName)}…</p>`);
  openModal(`
    <h2 style="text-align:center;">⚔️ Batalla PVP vs ${escapeHtml(b.oppName)}</h2>
    <div class="row" style="justify-content:space-between; align-items:flex-start;">
      <div class="card" style="flex:1; text-align:center;">
        <p><b>${b.me.icon} ${b.me.label.toUpperCase()} (TÚ)</b></p>
        ${meVisual}
        <div style="background:#300;border-radius:8px;overflow:hidden;height:14px;"><div style="height:100%;width:${pPct}%;background:linear-gradient(90deg,#5be08a,#2fa55e);"></div></div>
        <p class="muted">❤️ ${Math.max(0,b.me.hp)}/${b.me.max}</p>
      </div>
      <div style="align-self:center; font-size:1.4rem;">VS</div>
      <div class="card" style="flex:1; text-align:center;">
        <p><b>${b.foe.icon} ${escapeHtml(b.oppName)}</b></p>
        ${oppVisual}
        <div style="background:#003;border-radius:8px;overflow:hidden;height:14px;"><div style="height:100%;width:${oPct}%;background:linear-gradient(90deg,#5be08a,#2fa55e);"></div></div>
        <p class="muted">❤️ ${Math.max(0,b.foe.hp)}/${b.foe.max}</p>
      </div>
    </div>
    ${banner}
    <div id="log" style="margin-top:12px;">${b.log.map(l => `<div>${l}</div>`).join('')}</div>
    <div class="row" style="justify-content:center; margin-top:14px;">
      ${b.over ? `<button class="btn alt" onclick="pvpRematch()">🔄 Revancha</button> <button class="btn" onclick="endPvpBattle()">🌎 Volver al mundo</button>` : `
        <button class="btn" ${canAttack ? '' : 'disabled'} onclick="pvpAct('attack')">💥 Ataque</button>
        <button class="btn alt" ${canAbility ? '' : 'disabled'} onclick="pvpAct('ability')">${b.me.ability.icon} ${b.me.ability.name} ${canAbility ? '' : '⏳'}</button>`}
    </div>`);
  const lg = document.getElementById('log'); if (lg) lg.scrollTop = lg.scrollHeight;
}

/* ---------- INICIO ---------- */
sceneCreator();
