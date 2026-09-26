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
  atoms: { hydrogen: 0, helium: 0, lithium: 0, beryllium: 0 },
  slots: [null, null, null],
  avatar: null,
  name: '',
  accountId: null,
  accountSlot: null,
  equipped: 'proton',
  party: ['proton'],
  exp: 0, steps: 0, wins: 0,
  luckPotions: 0,     // pociones de suerte x2 en el inventario
  luckUntil: 0        // timestamp (ms) hasta el que dura el 2x de suerte
};

/* ---------- Combatientes equipables ---------- */
const COMBATANTS = {
  proton:   { key:'proton',   label:'Protón',   icon:'', hp:10, atk:2, dodge:0,    ability:{name:'Repulsión', icon:'', dmg:5, every:2} },
  neutron:  { key:'neutron',  label:'Neutrón',  icon:'', hp:10, atk:1, dodge:0.1,  ability:{name:'Neutralizar', icon:'', every:2, immune:true, immuneTurns:3} },
  electron: { key:'electron', label:'Electrón', icon:'', hp:5,  atk:2, dodge:0.35, ability:{name:'Chispa',    icon:'', dmg:20, every:2, selfDmg:1} },
  hydrogen: { key:'hydrogen', label:'Hidrógeno',icon:'Ⓑ', hp:20, atk:4, dodge:0.20, ability:{name:'Fusión',    icon:'', dmg:20, every:5, transform:'proton', transformHp:5} },
  helium:   { key:'helium',   label:'Helio',    icon:'', hp:30, atk:5, dodge:0.15, ability:{name:'Radiación α', icon:'', dmg:14, every:3} },
  lithium:  { key:'lithium',  label:'Litio',    icon:'', hp:30, atk:5, dodge:0.05, ability:{name:'Metabolismo', icon:'', every:3, healAll:10} },
  beryllium:{ key:'beryllium',label:'Berilio',  icon:'', hp:40, atk:20, dodge:0.05, ability:{name:'Fisión', icon:'', every:5, fission:true, dmg:80, allyDmg:10, splitInto:'helium', splitCount:2} }
};
/* ---------- Aspecto visual de las unidades (bola con letra) ---------- */
function unitBall(key, size){
  size = size || 70;
  if (key === 'proton') return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#ffb0b0,#ff3b57);box-shadow:0 0 ${Math.round(size/3)}px rgba(255,80,110,.5);display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;font-size:${Math.round(size*0.3)}px;">p+</div>`;
  if (key === 'hydrogen') return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#eaf3ff,#9fc0ff);box-shadow:0 0 ${Math.round(size/3)}px rgba(160,190,255,.5);display:flex;align-items:center;justify-content:center;font-weight:800;color:#123;font-size:${Math.round(size*0.34)}px;">H</div>`;
  if (key === 'helium') return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff3d6,#ffd76a);box-shadow:0 0 ${Math.round(size/3)}px rgba(255,215,106,.5);display:flex;align-items:center;justify-content:center;font-weight:800;color:#3a2a00;font-size:${Math.round(size*0.3)}px;">He</div>`;
  if (key === 'lithium') return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#d9ffdc,#7ad67f);box-shadow:0 0 ${Math.round(size/3)}px rgba(122,214,127,.5);display:flex;align-items:center;justify-content:center;font-weight:800;color:#0a2a0c;font-size:${Math.round(size*0.34)}px;">Li</div>`;
  if (key === 'beryllium') return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#eef1f4,#9aa6b2);box-shadow:0 0 ${Math.round(size/3)}px rgba(154,166,178,.6);display:flex;align-items:center;justify-content:center;font-weight:800;color:#1a2028;font-size:${Math.round(size*0.34)}px;">Be</div>`;
  return null;
}
/* ---------- Enemigos salvajes del campo ---------- */
const WILD_FOES = {
  hydrogen: {hp:15, atk:1, dodge:0.5, label:'Hidrógeno', icon:'', letter:'H', spawnChance:0.05,
    gradient:'radial-gradient(circle at 35% 30%,#eaf3ff,#9fc0ff)', textColor:'#123',
    reward:{Q:1, exp:5}, bonusChance:0.2, bonus:{up:2, down:1, e:1}},
  helium: {hp:25, atk:2, dodge:0.5, label:'Helio', icon:'', letter:'He', spawnChance:0.01,
    gradient:'radial-gradient(circle at 35% 30%,#fff3d6,#ffd76a)', textColor:'#3a2a00',
    reward:{Q:2, exp:10}, bonusChance:0.1, bonus:{up:4, down:4, e:2}},
  lithium: {hp:30, atk:4, dodge:0.10, label:'Litio', icon:'', letter:'Li', spawnChance:0.001, spawnDesert:0.03, terrain:'G',
    gradient:'radial-gradient(circle at 35% 30%,#d9ffdc,#7ad67f)', textColor:'#0a2a0c',
    foeAbility:{type:'steal', name:'Ionización', icon:'', chance:0.5},
    reward:{Q:3, exp:15, up:1, down:1}, bonusChance:0.1, bonus:{exp:20, e:2, Q:5}},
  beryllium: {hp:60, atk:6, dodge:0.05, label:'Berilio', icon:'', letter:'Be', spawnChance:0, spawnDesert:0.005, terrain:'D',
    gradient:'radial-gradient(circle at 35% 30%,#eef1f4,#9aa6b2)', textColor:'#1a2028',
    foeAbility:{type:'aoe', name:'Explosión pequeña', icon:'', chance:0.2, dmg:1, sound:'boom'},
    deathBlast:10,
    reward:{exp:30, up:2, down:2}, bonusChance:0.1, bonus:{exp:30, e:4, Q:10}},
  boron: {hp:100, atk:10, dodge:0.05, label:'Boro', icon:'', letter:'B', spawnChance:0, spawnDesert:0.001, terrain:'D',
    gradient:'radial-gradient(circle at 35% 30%,#ffe0c2,#e07a3b)', textColor:'#2a1400',
    companion:true,
    reward:{exp:60, up:3, down:3, Q:10}, bonusChance:0.15, bonus:{exp:60, e:6, Q:25}},
};
function ownedCount(key){
  if (key === 'proton') return state.protons;
  if (key === 'neutron') return state.neutrons;
  if (key === 'electron') return state.electrons;
  if (state.atoms && key in state.atoms) return state.atoms[key];
  return 0;
}
function expForLevel(lvl){
  if (lvl <= 1) return 0;
  if (lvl === 2) return 100;   // Nivel 1 -> 2 : 100 EXP
  if (lvl === 3) return 200;   // Nivel 2 -> 3 : total 200 EXP
  if (lvl === 4) return 300;   // Nivel 3 -> 4 : total 300 EXP
  if (lvl === 5) return 400;   // Nivel 4 -> 5 : total 400 EXP
  if (lvl === 6) return 750;   // Nivel 5 -> 6 : +350 (total 750)
  if (lvl === 7) return 1250;  // Nivel 6 -> 7 : +500 (total 1250)
  if (lvl === 8) return 1950;  // Nivel 7 -> 8 : +700 (total 1950)
  if (lvl === 9) return 2850;  // Nivel 8 -> 9 : +900 (total 2850)
  if (lvl === 10) return 3850; // Nivel 9 -> 10 : +1000 (total 3850)
  return 3850 + (lvl - 10) * 1000; // niveles superiores: +1000 cada uno
}
function getLevel(){
  let lvl = 1;
  while ((state.exp||0) >= expForLevel(lvl + 1)) lvl++;
  return lvl;
}
function maxParty(){ const l = getLevel(); return l >= 3 ? 3 : (l >= 2 ? 2 : 1); }
function luckActive(){ return Date.now() < (state.luckUntil||0); }
function luckMul(){ return luckActive() ? 2 : 1; }
function luckRemainMs(){ return Math.max(0, (state.luckUntil||0) - Date.now()); }
function luckRemainStr(){ const s=Math.ceil(luckRemainMs()/1000); const m=Math.floor(s/60); const ss=(s%60).toString().padStart(2,'0'); return `${m}:${ss}`; }
function useLuckPotion(){
  if((state.luckPotions||0) < 1) return;
  if(luckActive()){ state.luckUntil += 5*60*1000; }
  else { state.luckUntil = Date.now() + 5*60*1000; }
  state.luckPotions -= 1;
  try{ sfxBonus&&sfxBonus(); }catch(e){}
  const lb=document.getElementById('luckBadge'); if(lb){ lb.style.display=''; lb.textContent='Suerte x2 '+luckRemainStr(); }
  if(typeof openInventory==='function') openInventory();
}
try{ setInterval(()=>{ const lb=document.getElementById('luckBadge'); if(!lb) return; if(luckActive()){ lb.style.display=''; lb.textContent='Suerte x2 '+luckRemainStr(); } else { lb.style.display='none'; } }, 1000); }catch(e){}
function normalizeParty(){
  if (!Array.isArray(state.party)) state.party = [];
  state.party = state.party.filter(k => COMBATANTS[k] && ownedCount(k) >= 1);
  const cap = maxParty();
  if (state.party.length > cap) state.party = state.party.slice(0, cap);
  if (state.party.length === 0){
    const k = ['proton','neutron','electron','hydrogen'].find(k => ownedCount(k) >= 1);
    if (k) state.party = [k];
  }
  state.equipped = state.party[0] || state.equipped;
}
function toggleParty(key){
  if (!COMBATANTS[key]) return;
  if (ownedCount(key) < 1){ return; }
  if (!Array.isArray(state.party)) state.party = [];
  const cap = maxParty();
  const i = state.party.indexOf(key);
  if (i >= 0){
    state.party.splice(i, 1);
  } else {
    if (state.party.length >= cap){
      if (cap === 1){ state.party = [key]; }
      else { return; }
    } else {
      state.party.push(key);
    }
  }
  state.equipped = state.party[0] || 'proton';
  socket.emit('equip', { key: state.equipped });
  sendLoadout();
  openInventory();
}
function equipCombatant(key){ toggleParty(key); }

/* ---------- Red (Socket.IO) ---------- */
const socket = io();
let myId = null;
let WORLD = { W: 15, H: 10, TILE: 40 };
let others = {};            // id -> { tx, ty, avatar, name, canvas }
let me = { tx: 12, ty: 6 };  // mi posición local (confirmada por el servidor)

/* =================================================
   TERRENO POR TILES (compartido con el standalone)
   marrón=tienda(S), verde=césped(G), amarillo=desierto(D, solo Nivel 3),
   negro=muro(W). El desierto no se ve hasta el Nivel 3.
================================================= */
const MAP_W = 48, MAP_H = 13;
/* Cámara: solo se ve una ventana del mapa, centrada en tu personaje (así se ve grande) */
const VIEW_W = 16, VIEW_H = 13, TS = 34;
function camOffset(){
  const camX = Math.max(0, Math.min(MAP_W - VIEW_W, me.tx - (VIEW_W >> 1)));
  const camY = Math.max(0, Math.min(MAP_H - VIEW_H, me.ty - (VIEW_H >> 1)));
  return { camX, camY };
}
/* Píxeles de césped que sobresalen dentro del desierto (borde natural) */
const GREEN_PIXELS = new Set(['24,1','25,1','25,3','26,2','26,3','26,4','27,3','27,4','27,8','28,7','28,8','28,10','29,6','29,8','29,9','30,3','30,7','30,9']);
function tileAt(x, y){
  if (x >= MAP_W-1) return 'W';                   // borde negro (col 47)
  if (x === 0) return (y>=4 && y<=8) ? 'S' : 'G'; // tienda marrón (col 0, filas 4-8)
  if (GREEN_PIXELS.has(x+','+y)) return 'G';
  if (x >= 24) return 'D';                        // desierto amarillo
  return 'G';                                     // césped
}
function desertVisible(){ return getLevel() >= 3; }
function tileColor(t, x, y){
  if (t === 'S') return '#7a4a1e';
  if (t === 'W') return '#05070f';
  if (t === 'D'){
    if (!desertVisible()) return '#0e1524';        // niebla: no se ve el desierto
    return ((x+y)%2===0) ? '#e0bd57' : '#e9c96a';
  }
  return ((x+y)%2===0) ? '#2b8f4a' : '#2f9e52';    // césped (tablero suave)
}
let inWorld = false;
let battleEnabled = true;      // modo Batalla SÍ/NO (NO = solo caminar, sin encuentros salvajes)
let showGuideOnEnter = false;  // mostrar la guía de botones al terminar el tutorial 1ª vez
let myGroup = [];              // grupo co-op: [{id,name}]
let groupInviteFrom = null;    // invitación de grupo recibida
let groupInviteTimer = null;   // auto-rechazo
let groupBattle = null;        // { host:bool, hostId, size }
let leaderboardData = [];  // tabla de clasificación recibida del servidor

function inGroupParty(){ return Array.isArray(myGroup) && myGroup.length >= 2; }
function toggleBattleMode(){ battleEnabled = !battleEnabled; startWorldLoop(); }
function showButtonGuide(){
  openModal(`
    <h2 style="text-align:center;"> ¡Listo! Estos son tus botones</h2>
    <p class="muted" style="text-align:center;">Ya estás en el mundo online. Esto hace cada botón:</p>
    <div style="display:flex; flex-direction:column; gap:8px; margin-top:12px;">
      <div class="card" style="background:#0a0e28;"> <b>Mover</b> — camina por el mapa (o flechas / WASD).</div>
      <div class="card" style="background:#0a0e28;"> <b>Inventario (E)</b> — tus partículas, fabricar átomos y armar tu equipo de batalla.</div>
      <div class="card" style="background:#0a0e28;"> <b>1vs1 (P)</b> — reta a otro jugador conectado a un duelo.</div>
      <div class="card" style="background:#0a0e28;"> <b>Intercambio (I)</b> — intercambia objetos con el jugador seleccionado.</div>
      <div class="card" style="background:#0a0e28;"> <b>Grupo (J)</b> — selecciona a un jugador (clic en el mapa) y pulsa J para invitarlo a tu grupo (máx 3). En grupo peleais juntos: si uno entra en batalla, entran todos, y el enemigo es más fuerte.</div>
      <div class="card" style="background:#0a0e28;"> <b>Batalla: SÍ/NO</b> — con <b>NO</b> caminas sin peleas; con <b>SÍ</b> pueden aparecer enemigos salvajes.</div>
      <div class="card" style="background:#0a0e28;"> <b>Guardar (G)</b> — guarda tu progreso.</div>
      <div class="card" style="background:#0a0e28;"> <b>Soltar Q (Q)</b> — deja monedas Q en el suelo.</div>
      <div class="card" style="background:#0a0e28;"> <b>Bestiario (B)</b> — consulta los enemigos.</div>
      <div class="card" style="background:#0a0e28;"> <b>Chat (T)</b> — chatea con los demás jugadores.</div>
      <div class="card" style="background:#0a0e28;"> <b>Tiendas (marrón)</b> — camina hasta un tile marrón para comprar con tus Q.</div>
    </div>
    <div class="row" style="justify-content:center; margin-top:16px;">
      <button class="btn" onclick="closeModal()">¡Entendido! </button>
    </div>`);
}

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

/* ---------- Monedas Q soltadas en el campo ---------- */
let worldCoins = {};   // id -> { id, tx, ty, amount }
socket.on('coins-existing', (list) => {
  worldCoins = {};
  (Array.isArray(list) ? list : []).forEach(c => { worldCoins[c.id] = c; });
});
socket.on('coin-dropped', (c) => { if (c && c.id) worldCoins[c.id] = c; });
socket.on('coin-picked', (d) => {
  if (!d || !d.id) return;
  delete worldCoins[d.id];
  if (d.byId === myId){
    state.Q += (parseInt(d.amount, 10) || 0);
    sendStats();
    refreshHUD();
    sfxCoin();
    toast('Recogiste ' + d.amount + ' Q.');
  }
});
function sendStats(){
  socket.emit('stats', { electrons: state.electrons, Q: state.Q, wins: state.wins });
}

/* =================================================
   SONIDOS (generados con Web Audio, sin archivos)
   + efecto de temblor visual
================================================= */
let _actx = null;
function audioCtx(){
  try{
    if(!_actx) _actx = new (window.AudioContext || window.webkitAudioContext)();
    if(_actx.state === 'suspended') _actx.resume();
  }catch(e){ return null; }
  return _actx;
}
// Sonido de "corte" (slash): ráfaga de ruido con barrido descendente
function sfxSlash(){
  const ac = audioCtx(); if(!ac) return;
  const t = ac.currentTime;
  const dur = 0.22;
  const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate);
  const data = buf.getChannelData(0);
  for(let i=0;i<data.length;i++){ data[i] = (Math.random()*2-1) * Math.pow(1 - i/data.length, 2); }
  const src = ac.createBufferSource(); src.buffer = buf;
  const bp = ac.createBiquadFilter(); bp.type = 'bandpass';
  bp.frequency.setValueAtTime(2600, t); bp.frequency.exponentialRampToValueAtTime(500, t+dur);
  bp.Q.value = 0.8;
  const g = ac.createGain(); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t+dur);
  src.connect(bp); bp.connect(g); g.connect(ac.destination);
  src.start(t); src.stop(t+dur);
}
// Sonido de moneda: dos notas rápidas ascendentes
function sfxCoin(){
  const ac = audioCtx(); if(!ac) return;
  const t = ac.currentTime;
  [[988, t, 0.08],[1319, t+0.07, 0.18]].forEach(([f, st, d])=>{
    const o = ac.createOscillator(); o.type = 'square'; o.frequency.value = f;
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, st);
    g.gain.exponentialRampToValueAtTime(0.3, st+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, st+d);
    o.connect(g); g.connect(ac.destination); o.start(st); o.stop(st+d);
  });
}
// Música de victoria (~2 s): arpegio ascendente + acorde final
function sfxVictory(){
  const ac = audioCtx(); if(!ac) return;
  const t0 = ac.currentTime;
  const seq = [ [523,0.0,0.18],[659,0.18,0.18],[784,0.36,0.18],[1047,0.54,0.28],
                [784,0.86,0.16],[1047,1.05,0.55],[1319,1.05,0.9] ];
  seq.forEach(([f, off, d])=>{
    const st = t0 + off;
    const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, st);
    g.gain.exponentialRampToValueAtTime(0.28, st+0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, st+d);
    o.connect(g); g.connect(ac.destination); o.start(st); o.stop(st+d);
  });
}
// Temblor visual: sacude un elemento (o el modal de batalla) ~0.35 s
function shakeEl(el, mag, dur){
  el = el || document.getElementById('modal') || document.getElementById('app');
  if(!el) return;
  mag = mag || 8; dur = dur || 350;
  const start = performance.now(); const base = el.style.transform || '';
  (function step(now){
    const p = (now - start) / dur;
    if(p >= 1){ el.style.transform = base; return; }
    const m = mag * (1 - p);
    const dx = (Math.random()*2-1) * m, dy = (Math.random()*2-1) * m;
    el.style.transform = base + ` translate(${dx}px,${dy}px)`;
    requestAnimationFrame(step);
  })(start);
}
// Sonido de golpe recibido (enemigo nos ataca): impacto grave y sordo
function sfxHit(){
  const ac = audioCtx(); if(!ac) return;
  const t = ac.currentTime; const dur = 0.28;
  // componente de ruido corto (golpe)
  const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate);
  const data = buf.getChannelData(0);
  for(let i=0;i<data.length;i++){ data[i] = (Math.random()*2-1) * Math.pow(1 - i/data.length, 3); }
  const src = ac.createBufferSource(); src.buffer = buf;
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
  const gn = ac.createGain(); gn.gain.setValueAtTime(0.6, t); gn.gain.exponentialRampToValueAtTime(0.001, t+dur);
  src.connect(lp); lp.connect(gn); gn.connect(ac.destination); src.start(t); src.stop(t+dur);
  // componente tonal grave descendente (thud)
  const o = ac.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(60, t+dur);
  const g2 = ac.createGain(); g2.gain.setValueAtTime(0.5, t); g2.gain.exponentialRampToValueAtTime(0.001, t+dur);
  o.connect(g2); g2.connect(ac.destination); o.start(t); o.stop(t+dur);
}
// Música de trompetas al subir de nivel (~3 s)
function sfxLevelUp(){
  const ac = audioCtx(); if(!ac) return;
  const t0 = ac.currentTime;
  // Fanfarria tipo trompeta: notas con armónicos (diente de sierra) + acorde final sostenido
  const seq = [ [392,0.0,0.25],[523,0.25,0.25],[659,0.5,0.25],[784,0.75,0.4],
                [659,1.2,0.22],[784,1.42,0.22],[1047,1.64,0.9],
                [784,2.1,1.0],[1047,2.1,1.0],[1319,2.1,1.0] ];
  seq.forEach(([f, off, d])=>{
    const st = t0 + off;
    const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3500;
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, st);
    g.gain.exponentialRampToValueAtTime(0.22, st+0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, st+d);
    o.connect(lp); lp.connect(g); g.connect(ac.destination); o.start(st); o.stop(st+d);
  });
}
// Explosión: pequeña (big=false) o grande al morir (big=true)
function sfxBoom(big){
  const ac = audioCtx(); if(!ac) return;
  const t = ac.currentTime; const dur = big?0.75:0.32;
  const buf = ac.createBuffer(1, Math.floor(ac.sampleRate*dur), ac.sampleRate);
  const data = buf.getChannelData(0);
  for(let i=0;i<data.length;i++){ data[i] = (Math.random()*2-1) * Math.pow(1 - i/data.length, big?1.4:2.4); }
  const src = ac.createBufferSource(); src.buffer = buf;
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass';
  lp.frequency.setValueAtTime(big?1400:900, t); lp.frequency.exponentialRampToValueAtTime(big?110:220, t+dur);
  const g = ac.createGain(); g.gain.setValueAtTime(big?1.0:0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t+dur);
  src.connect(lp); lp.connect(g); g.connect(ac.destination); src.start(t); src.stop(t+dur);
  const o = ac.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(big?150:110, t); o.frequency.exponentialRampToValueAtTime(big?28:48, t+dur);
  const g2 = ac.createGain(); g2.gain.setValueAtTime(big?0.9:0.45, t); g2.gain.exponentialRampToValueAtTime(0.001, t+dur);
  o.connect(g2); g2.connect(ac.destination); o.start(t); o.stop(t+dur);
}
function sfxBoomSmall(){ sfxBoom(false); }
function sfxBoomBig(){ sfxBoom(true); }
// Sonido extra al conseguir el botín raro (bonus)
function sfxBonus(){
  const ac = audioCtx(); if(!ac) return;
  const t0 = ac.currentTime;
  [[784,0,0.12],[1047,0.1,0.12],[1319,0.2,0.12],[1568,0.32,0.34]].forEach(([f,off,d])=>{
    const st = t0+off;
    const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, st);
    g.gain.exponentialRampToValueAtTime(0.26, st+0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, st+d);
    o.connect(g); g.connect(ac.destination); o.start(st); o.stop(st+d);
  });
}

/* ---------- PVP (1 vs 1 entre jugadores conectados) ---------- */
let pvpCooldownUntil = 0;   // timestamp: no puedo enviar solicitudes hasta aquí
let pvpInviteFrom = null;   // { fromId, fromName, fromKey } de una invitación recibida
let pvpInviteTimer = null;  // auto-rechazo
let pvp = null;             // estado de la batalla PVP en curso
socket.on('pvp-invited', (d) => { showPvpInvitePrompt(d); });
socket.on('pvp-declined', (d) => {
  pvpCooldownUntil = Date.now() + 30000;
  toast(` ${d && d.byName ? d.byName : 'El jugador'} rechazó tu reto. Espera 30s para volver a invitar.`);
  if (document.getElementById('modal')) openPvpList();
});
socket.on('pvp-error', (d) => { toast(' ' + ((d && d.msg) || 'No se pudo enviar la solicitud.')); if (document.getElementById('modal')) openPvpList(); });
socket.on('pvp-start', (d) => { startPvpBattle(d); });
socket.on('pvp-action', (d) => { applyPvpAction(d); });
socket.on('pvp-opponent-left', () => {
  if (!pvp || pvp.over) return;
  pvp.over = true; pvp.win = true; pvplog(' Tu oponente abandonó la batalla. ¡Ganas por retirada!');
  sfxVictory();
  renderPvpBattle();
});

/* ---------- Intercambio (trueque de objetos entre jugadores) ---------- */
let tradeSelectedId = null;   // jugador seleccionado en el mapa (clic)
let tradeCooldownUntil = 0;   // espera tras un rechazo
let tradeInviteFrom = null;   // invitación de intercambio recibida
let tradeInviteTimer = null;  // auto-rechazo
let trade = null;             // estado del intercambio en curso
const TRADE_ITEMS = [
  { key:'up',       icon:'', label:'Quark Up',   get:() => state.quarks.up },
  { key:'down',     icon:'', label:'Quark Down', get:() => state.quarks.down },
  { key:'proton',   icon:'', label:'Protón',     get:() => state.protons },
  { key:'neutron',  icon:'', label:'Neutrón',    get:() => state.neutrons },
  { key:'electron', icon:'', label:'Electrón',   get:() => state.electrons },
  { key:'hydrogen', icon:'', label:'Hidrógeno',  get:() => state.atoms.hydrogen }
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
socket.on('trade-declined', (d) => { tradeCooldownUntil = Date.now() + 15000; toast(` ${d && d.byName ? d.byName : 'El jugador'} rechazó el intercambio.`); });
socket.on('trade-error',    (d) => { toast(' ' + ((d && d.msg) || 'No se pudo iniciar el intercambio.')); });
socket.on('trade-start',    (d) => startTrade(d));
socket.on('trade-state',    (d) => applyTradeState(d));
socket.on('trade-complete', (d) => applyTradeComplete(d));
socket.on('trade-cancelled', () => { toast(' El intercambio fue cancelado.'); endTrade(); });
socket.on('trade-partner-left', () => { toast(' El otro jugador se fue. Intercambio cancelado.'); endTrade(); });

/* ---------- GRUPO (co-op) — invitaciones + batalla en equipo ---------- */
socket.on('group-invited',  (d) => showGroupInvitePrompt(d));
socket.on('group-declined', (d) => { toast(` ${d && d.byName ? d.byName : 'El jugador'} rechazó la invitación de grupo.`); });
socket.on('group-error',    (d) => { toast(' ' + ((d && d.msg) || 'No se pudo formar el grupo.')); });
socket.on('group-update',   (d) => {
  myGroup = (d && Array.isArray(d.members)) ? d.members : [];
  if (myGroup.length >= 2) toast(' Grupo: ' + myGroup.map(m => m.name).join(', '));
  else toast(' Ya no estás en un grupo.');
});
socket.on('group-battle-start', (d) => startGroupBattle(d));
socket.on('group-battle-sync',  (d) => applyGroupBattleSync(d));
socket.on('group-battle-act',   (d) => { if (d) applyGroupAction(d.from, d.action); });
socket.on('group-battle-end',   (d) => endGroupBattleRemote(d));

function sendTradeInvite(id){
  if (!inWorld || battleActive || trade) return;
  if (Date.now() < tradeCooldownUntil){ toast(' Espera un momento antes de proponer otro intercambio.'); return; }
  if (!others[id]){ toast('Ese jugador ya no está aquí.'); return; }
  socket.emit('trade-invite', { targetId: id });
  toast(' Propuesta de intercambio enviada. Esperando respuesta…');
}
function showTradeInvitePrompt(d){
  tradeInviteFrom = d;
  openModal(`
    <h2 style="text-align:center;"> ${escapeHtml(d.fromName || 'Un jugador')} quiere intercambiar contigo</h2>
    <p class="muted" style="text-align:center; margin-top:8px;">Cada uno podrá ofrecer hasta 5 objetos. El intercambio solo se realiza si ambos aceptan.</p>
    <p style="text-align:center; margin-top:6px;" id="tinvtimer" class="gold">Responde en 30s…</p>
    <div class="row" style="justify-content:center; margin-top:14px; gap:12px;">
      <button class="btn" onclick="acceptTrade()"> Aceptar</button>
      <button class="btn ghost" onclick="declineTrade()"> Rechazar</button>
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
  toast(` Intercambio con ${partnerName} completado.`);
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
  const myStatus    = t.iConfirmed   ? '<span class="gold"> Aceptaste</span>' : '<span class="muted">Sin aceptar</span>';
  const theirStatus = t.theyConfirmed ? '<span class="gold"> Aceptó</span>'   : '<span class="muted">Sin aceptar</span>';
  openModal(`
    <div class="row" style="justify-content:space-between;"><h2 style="margin:0;"> Intercambio con ${escapeHtml(t.partnerName)}</h2></div>
    <p class="muted" style="margin-top:4px;">Ofrece hasta <b>5 objetos</b>. Si cambias tu oferta se reinician las aceptaciones. El trato se realiza solo cuando ambos aceptan.</p>
    <div class="row" style="margin-top:12px; gap:12px; align-items:stretch; flex-wrap:wrap;">
      <div class="card" style="flex:1; min-width:250px;">
        <p style="color:var(--accent); margin:0;"><b> Tu oferta</b> <span class="muted">(${myTotal}/5)</span> — ${myStatus}</p>
        <p style="margin-top:6px;">${myOfferHtml}</p>
        <hr style="border:none; border-top:1px solid var(--panel2); margin:10px 0;">
        <p style="color:var(--accent); margin:0;"><b> Tu inventario</b> <span class="muted">(solo tú lo ves)</span></p>
        ${invRows}
      </div>
      <div class="card" style="flex:1; min-width:220px;">
        <div class="row" style="gap:10px; align-items:center;">
          ${t.partnerAvatar ? `<img src="${avatarDataURL(t.partnerAvatar,2)}" style="width:44px;height:44px;background:#060a18;border-radius:8px;">` : ''}
          <p style="color:var(--accent); margin:0;"><b>${escapeHtml(t.partnerName)}</b></p>
        </div>
        <p style="margin-top:10px; color:var(--accent);"><b> Su oferta</b> — ${theirStatus}</p>
        <p style="margin-top:6px;">${theirOfferHtml}</p>
      </div>
    </div>
    <div class="row" style="justify-content:center; margin-top:16px; gap:12px;">
      <button class="btn" ${t.iConfirmed ? 'disabled' : ''} onclick="confirmTrade()"> Aceptar</button>
      <button class="btn ghost" onclick="cancelTrade()"> Rechazar</button>
    </div>`);
}
function onWorldClick(e){
  if (!inWorld || battleActive || document.getElementById('modal')) return;
  const cv = e.currentTarget;
  const rect = cv.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (cv.width / rect.width);
  const y = (e.clientY - rect.top)  * (cv.height / rect.height);
  const { camX, camY } = camOffset();
  const tx = camX + Math.floor(x / TS), ty = camY + Math.floor(y / TS);
  let hit = null;
  for (const id in others){ if (others[id].tx === tx && others[id].ty === ty){ hit = id; break; } }
  if (hit){
    tradeSelectedId = hit;
    const nm = others[hit].name || hit.slice(0, 4);
    toast(` Seleccionaste a ${nm}. Pulsa I para intercambiar (o P para retarlo).`);
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
  <div class="scene active" style="overflow-y:auto; overflow-x:hidden;">
    <h2> Crea tu personaje</h2>
    <p class="muted">Pinta tu héroe (25×25). Tu diseño se verá en el mundo compartido. “Transparente” borra.</p>
    <div class="row" style="margin-top:12px; align-items:flex-start; gap:18px; flex-wrap:wrap;">
      <div id="pxgrid" style="display:grid; grid-template-columns:repeat(25,1fr); grid-auto-rows:1fr; width:min(380px,86vw); height:auto; aspect-ratio:1; border:2px solid var(--panel2); background:#0a0e28; touch-action:none;">${cells}</div>
      <div style="flex:1; min-width:230px;">
        <p class="muted">Paleta</p>
        <div class="row" style="gap:7px; margin-top:8px; max-width:230px;">${pal}</div>
        <div class="row" style="margin-top:16px; gap:10px;">
          <button class="btn ghost" onclick="clearAvatar()"> Limpiar</button>
          <button class="btn ghost" onclick="randomAvatar()"> Aleatorio</button>
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
      <button class="btn alt" id="createBtn" ${avatarIsEmpty() ? 'disabled' : ''} onclick="finishCreator()"> Crear personaje → continuar</button>
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
  sceneAskPlayed();
}
/* ¿Primera vez o ya jugaste? */
function sceneAskPlayed(){
  show(`
  <div class="scene active"><div class="center">
    <h2>¿Ya jugaste antes?</h2>
    <div class="card" style="max-width:520px; text-align:center;">
      <p class="muted">Si ya sabes cómo se juega, entra directo al mundo con un <b>protón</b> listo. Si es tu primera vez, haz el tutorial para fabricar tu propio protón con quarks.</p>
    </div>
    <div class="row" style="gap:12px; margin-top:8px; flex-wrap:wrap; justify-content:center;">
      <button class="btn" onclick="skipTutorial()"> Sí, ya jugué — entrar al mundo </button>
      <button class="btn alt" onclick="sceneShop()"> No, ver el tutorial</button>
    </div>
  </div></div>`);
}
function skipTutorial(){
  state.protons += 1;              // te damos un protón listo
  state.equipped = 'proton';
  if (!Array.isArray(state.party) || state.party.length === 0) state.party = ['proton'];
  enterWorld();
}
/*__PART2__*/
/* =================================================
   TUTORIAL — TIENDA
================================================= */
function quarkEl(t){ return `<div class="quark q-${t}">${t === 'up' ? 'U' : 'D'}</div>`; }
function buyQuark(t){ if (state.Q < 1) return; state.Q -= 1; state.quarks[t] += 1; sceneShop(); }
/* Tienda dentro del mundo: compras con tus Q sin salir del mapa */
function openWorldShop(){
  openModal(`
    <h2 style="margin:0 0 4px;"> Tienda</h2>
    <p class="muted" style="margin:0 0 12px;">Compra partículas con tus monedas Q.</p>
    <div class="row" style="justify-content:space-between; flex-wrap:wrap; gap:8px;">
      <span class="badge gold"> ${state.Q} Q</span>
      <span class="badge">Tus quarks: U×${state.quarks.up} D×${state.quarks.down}</span>
    </div>
    <div class="row" style="margin-top:16px; gap:16px; flex-wrap:wrap;">
      <div class="card" style="flex:1; min-width:180px; text-align:center;">${quarkEl('up')}<p style="margin-top:8px;"><b>Quark Up</b></p><p class="muted">Precio: 5 Q</p><button class="btn" style="margin-top:10px;" ${state.Q < 5 ? 'disabled' : ''} onclick="buyQuarkWorld('up')">Comprar</button></div>
      <div class="card" style="flex:1; min-width:180px; text-align:center;">${quarkEl('down')}<p style="margin-top:8px;"><b>Quark Down</b></p><p class="muted">Precio: 5 Q</p><button class="btn" style="margin-top:10px;" ${state.Q < 5 ? 'disabled' : ''} onclick="buyQuarkWorld('down')">Comprar</button></div>
    </div>
    <div class="row" style="margin-top:16px; gap:16px; flex-wrap:wrap;">
      <div class="card" style="flex:1; min-width:220px; text-align:center;">
        <div style="margin:0 auto; width:56px;height:56px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#d9ffdc,#7ad67f);box-shadow:0 0 18px rgba(122,214,127,.6);display:flex;align-items:center;justify-content:center;font-weight:800;color:#0a2a0c;">x2</div>
        <p style="margin-top:8px;"><b>Poción de suerte x2</b></p>
        <p class="muted" style="font-size:.75rem;">5:00 min de doble probabilidad de encontrar átomos y de bonus.</p>
        <p class="muted">Precio: 100 Q</p>
        <button class="btn" style="margin-top:10px;" ${state.Q < 100 ? 'disabled' : ''} onclick="buyLuckPotion()">Comprar</button>
        ${(state.luckPotions||0)>0?`<p class="muted" style="font-size:.72rem;margin-top:6px;">Tienes ${state.luckPotions} en el inventario.</p>`:''}
      </div>
    </div>
    <div class="row" style="margin-top:18px; justify-content:flex-end;">
      <button class="btn ghost" onclick="closeModal()">Cerrar</button>
    </div>
  `);
}
function buyQuarkWorld(t){
  if (state.Q < 5){ toast('Necesitas 5 Q para comprar.'); return; }
  state.Q -= 5; state.quarks[t] += 1;
  socket.emit('stats', { electrons: state.electrons, Q: state.Q, wins: state.wins });
  const c = document.getElementById('coins'); if (c) c.textContent = state.Q + ' Q';
  openWorldShop();
}
function buyLuckPotion(){
  if (state.Q < 100){ toast('Necesitas 100 Q para comprar.'); return; }
  state.Q -= 100; state.luckPotions = (state.luckPotions||0) + 1;
  socket.emit('stats', { electrons: state.electrons, Q: state.Q, wins: state.wins });
  const c = document.getElementById('coins'); if (c) c.textContent = state.Q + ' Q';
  openWorldShop();
}

/* =================================================
   BESTIARIO (tecla B) — enemigos y su probabilidad
================================================= */
function foeBall(f, size){
  size = size || 54;
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${f.gradient};display:flex;align-items:center;justify-content:center;font-weight:800;color:${f.textColor};font-size:${Math.round(size*0.34)}px;">${f.letter}</div>`;
}
/* Formateo/aplicación genérica de recompensas (soporta Q, exp, up, down, e) */
function pctFmt(v){ const p=(v||0)*100; return (p>0 && p<1) ? p.toFixed(1) : p.toFixed(0); }
function rewardParts(r){
  const p=[];
  if(r.exp) p.push(` +${r.exp} EXP`);
  if(r.Q) p.push(` +${r.Q} Q`);
  if(r.up) p.push(`+${r.up} Quark Up`);
  if(r.down) p.push(`+${r.down} Quark Down`);
  if(r.e) p.push(`+${r.e} e-`);
  return p.join(' · ');
}
function applyReward(r){
  if(r.exp) state.exp += r.exp;
  if(r.Q) state.Q += r.Q;
  if(r.up) state.quarks.up += r.up;
  if(r.down) state.quarks.down += r.down;
  if(r.e) state.electrons += r.e;
}
function openBestiary(){
  const cards = Object.keys(WILD_FOES).map(key => {
    const f = WILD_FOES[key];
    const pct = pctFmt(f.spawnChance || f.spawnDesert);
    return `<div class="card" style="flex:1; min-width:150px; text-align:center; background:#0a0e28; cursor:pointer;" onclick="bestiaryDetail('${key}')">
      <div style="display:flex; justify-content:center; margin-bottom:6px;">${foeBall(f,54)}</div>
      <p><b>${f.label}</b></p>
      <p class="muted" style="font-size:.78rem;">Aparición: <b class="gold">${pct}%</b> por paso</p>
      <p class="muted" style="font-size:.72rem; margin-top:4px;">Click para ver estadísticas</p>
    </div>`;
  }).join('');
  openModal(`
    <div class="row" style="justify-content:space-between;"><h2 style="margin:0;"> Bestiario</h2><button class="btn ghost" onclick="closeModal()"></button></div>
    <p class="muted" style="margin:8px 0 12px;">Enemigos que puedes encontrar al explorar el campo. Haz click en uno para ver sus estadísticas.</p>
    <div class="row" style="gap:12px; flex-wrap:wrap; align-items:stretch;">${cards}</div>
  `);
}
function bestiaryDetail(key){
  const f = WILD_FOES[key]; if (!f) return;
  const pct = pctFmt(f.spawnChance);
  const bonusPct = ((f.bonusChance||0) * 100).toFixed(0);
  let abilityTxt = '';
  if(f.foeAbility){
    const fa = f.foeAbility;
    const extra = fa.type==='steal' ? ', te roba el turno' : (fa.type==='aoe' ? `, ${fa.dmg} de daño a todo tu equipo` : '');
    abilityTxt += `<p>${fa.icon} Habilidad: <b>${fa.name}</b> (${Math.round(fa.chance*100)}% por turno${extra})</p>`;
  }
  if(f.deathBlast){ abilityTxt += `<p> Al morir: explosión de <b>${f.deathBlast}</b> a todo tu equipo</p>`; }
  openModal(`
    <div class="row" style="justify-content:space-between;"><h2 style="margin:0;">${f.label}</h2><button class="btn ghost" onclick="openBestiary()">← Volver</button></div>
    <div class="row" style="margin-top:12px; gap:16px; align-items:center;">
      <div>${foeBall(f,80)}</div>
      <div style="line-height:1.9;">
        <p> Vida: <b>${f.hp}</b></p>
        <p> Ataque: <b>${f.atk}</b></p>
        <p> Evasión: <b>${Math.round(f.dodge*100)}%</b></p>
        ${abilityTxt}
      </div>
    </div>
    <div class="card" style="margin-top:12px; background:#0a0e28; line-height:1.8;">
      <p style="color:var(--accent);"><b> Probabilidades</b></p>
      ${f.spawnChance?`<p> Aparición en césped: <b class="gold">${pctFmt(f.spawnChance)}%</b> por paso</p>`:''}
      ${f.spawnDesert?`<p> En el desierto: <b class="gold">${pctFmt(f.spawnDesert)}%</b> por paso</p>`:''}
      <p> Botín raro al vencer: <b>${bonusPct}%</b></p>
    </div>
    <div class="card" style="margin-top:12px; background:#0a0e28; line-height:1.8;">
      <p style="color:var(--accent);"><b> Recompensa por victoria</b></p>
      <p>${rewardParts(f.reward)}</p>
      <p class="muted" style="font-size:.8rem;">Botín raro (${bonusPct}%): ${rewardParts(f.bonus)}</p>
    </div>
  `);
}
/* Soltar monedas Q en el campo (tecla Q) */
function openDropCoin(){
  if (state.Q < 1){ toast('No tienes monedas Q para soltar.'); return; }
  openModal(`
    <h2 style="margin:0 0 4px;"> Soltar monedas Q</h2>
    <p class="muted" style="margin:0 0 12px;">Deja monedas en el suelo. Otro jugador (o tú) puede recogerlas pisándolas.</p>
    <div class="row" style="justify-content:space-between; flex-wrap:wrap; gap:8px;">
      <span class="badge gold">Tienes: ${state.Q} Q</span>
    </div>
    <div class="row" style="margin-top:16px; gap:10px; align-items:center;">
      <label style="font-size:.9rem;">Cantidad:</label>
      <input id="dropAmt" type="number" min="1" max="${state.Q}" value="${Math.min(5, state.Q)}" style="width:100px; padding:8px 10px; border-radius:8px; border:1px solid var(--panel2); background:#0a0e28; color:#fff;">
    </div>
    <div class="row" style="margin-top:18px; justify-content:flex-end; gap:8px;">
      <button class="btn ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn" onclick="confirmDropCoin()">Aceptar</button>
    </div>
  `);
}
function confirmDropCoin(){
  const inp = document.getElementById('dropAmt');
  let amt = parseInt(inp && inp.value, 10);
  if (Number.isNaN(amt) || amt < 1){ toast('Cantidad no válida.'); return; }
  if (amt > state.Q){ toast('No tienes suficientes Q.'); return; }
  state.Q -= amt;
  socket.emit('drop-coin', { amount: amt, tx: me.tx, ty: me.ty });
  sendStats();
  refreshHUD();
  closeModal();
  toast('Soltaste ' + amt + ' Q en el suelo.');
}
/* ================= EVENTOS DE CAMPO ABIERTO (código 84642 / Roaming) ================= */
let gameEvent = null;   // {type, endsAt, qTimer, endTimer, uiTimer}
const EVENT_NAMES = {1:'Lluvia de átomos', 2:'Lluvia de Q', 3:'Átomos agresivos'};
function eventActive(type){ if(!gameEvent) return false; if(Date.now() >= gameEvent.endsAt) return false; return type ? gameEvent.type===type : true; }
function eventEncounterMul(){ return eventActive(1) ? 5 : 1; }
function eventBonusMul(){ return eventActive(1) ? 5 : 1; }
function eventFoeStatMul(){ return eventActive(3) ? 2 : 1; }
function eventRewardMul(){ return eventActive(3) ? 3 : 1; }
function scaleReward(r, mul){ if(!r || !mul || mul===1) return r; const o={}; for(const k in r){ o[k]=r[k]*mul; } return o; }
let secretBuf='';
function feedSecret(ch){ secretBuf=(secretBuf+ch).slice(-5); if(secretBuf==='84642'){ secretBuf=''; openEventPassword(); } }
function openEventPassword(){
  openModal(`
    <h2 style="margin:0 0 6px;"> Interfaz de eventos</h2>
    <p class="muted" style="margin:0 0 12px;">Introduce la contraseña para verificar tu identidad.</p>
    <input id="evtPass" type="password" placeholder="Contraseña" style="width:100%; padding:10px 12px; border-radius:8px; border:1px solid var(--panel2); background:#0a0e28; color:#fff;">
    <p id="evtPassErr" style="color:var(--accent2); font-size:.82rem; margin:8px 0 0; display:none;">Contraseña incorrecta.</p>
    <div class="row" style="margin-top:16px; justify-content:flex-end; gap:8px;">
      <button class="btn ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn" onclick="checkEventPassword()">Verificar</button>
    </div>`);
  setTimeout(()=>{ const i=document.getElementById('evtPass'); if(i){ i.focus(); i.addEventListener('keydown',ev=>{ if(ev.key==='Enter'){ ev.preventDefault(); checkEventPassword(); } }); } }, 60);
}
function checkEventPassword(){
  const i=document.getElementById('evtPass');
  if(i && i.value==='Roaming'){ openEventChooser(); }
  else { const e=document.getElementById('evtPassErr'); if(e) e.style.display='block'; }
}
function openEventChooser(){
  openModal(`
    <h2 style="text-align:center;margin:0 0 4px;"> Elige un evento</h2>
    <p class="muted" style="text-align:center;margin:0 0 14px;">Identidad verificada. Selecciona uno de los 3 eventos.</p>
    <div style="display:flex; flex-direction:column; gap:10px;">
      <div class="card" style="background:#0a0e28; cursor:pointer;" onclick="startEvent(1)">
        <p><b> Lluvia de átomos (1:00)</b></p>
        <p class="muted" style="font-size:.82rem;">Probabilidad de encontrar átomos y de botín bonus x5. ¡Con confeti y temporizador!</p>
      </div>
      <div class="card" style="background:#0a0e28; cursor:pointer;" onclick="startEvent(2)">
        <p><b> Lluvia de Q (0:30)</b></p>
        <p class="muted" style="font-size:.82rem;">Cada segundo cae entre 1 y 10 Q en un punto aleatorio del mapa (visible para todos).</p>
      </div>
      <div class="card" style="background:#0a0e28; cursor:pointer;" onclick="startEvent(3)">
        <p><b> Átomos agresivos (1:00)</b></p>
        <p class="muted" style="font-size:.82rem;">Los átomos tienen x2 vida y x2 daño, pero dan x3 recompensa (también el botín bonus).</p>
      </div>
    </div>
    <div class="row" style="justify-content:center; margin-top:14px;">
      <button class="btn ghost" onclick="closeModal()">Cancelar</button>
    </div>`);
}
function startEvent(type){
  closeModal();
  clearEvent();
  const dur = type===2 ? 30000 : 60000;
  gameEvent = { type, endsAt: Date.now()+dur };
  showEventTimer();
  if(type===1){ startConfetti(); }
  if(type===2){ gameEvent.qTimer = setInterval(rainQ, 1000); }
  gameEvent.endTimer = setTimeout(endEvent, dur);
  toast('Evento activado: ' + EVENT_NAMES[type] + '.');
}
function endEvent(){
  const t = gameEvent ? gameEvent.type : 0;
  clearEvent();
  if(t){ toast('El evento "' + EVENT_NAMES[t] + '" ha terminado.'); }
}
function clearEvent(){
  if(gameEvent){
    if(gameEvent.qTimer) clearInterval(gameEvent.qTimer);
    if(gameEvent.endTimer) clearTimeout(gameEvent.endTimer);
    if(gameEvent.uiTimer) clearInterval(gameEvent.uiTimer);
  }
  gameEvent=null;
  removeEventTimer();
  stopConfetti();
}
function rainQ(){
  if(!eventActive(2)) return;
  const amt = 1 + Math.floor(Math.random()*10);   // 1..10 Q
  let x, y, tries=0;
  do { x=Math.floor(Math.random()*(MAP_W-1)); y=Math.floor(Math.random()*MAP_H); tries++; } while(tileAt(x,y)==='W' && tries<30);
  socket.emit('drop-coin', { amount: amt, tx: x, ty: y });   // el servidor difunde la moneda a todos
}
function removeEventTimer(){ const d=document.getElementById('eventTimer'); if(d) d.remove(); }
function showEventTimer(){
  removeEventTimer();
  const d=document.createElement('div');
  d.id='eventTimer';
  d.style.cssText='position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:80;background:rgba(6,10,24,.94);border:2px solid var(--gold);border-radius:14px;padding:8px 22px;text-align:center;box-shadow:0 6px 24px rgba(0,0,0,.55);pointer-events:none;';
  document.body.appendChild(d);
  updateEventTimer();
  gameEvent.uiTimer=setInterval(updateEventTimer, 250);
}
function updateEventTimer(){
  const d=document.getElementById('eventTimer'); if(!d||!gameEvent){ return; }
  const ms=Math.max(0, gameEvent.endsAt-Date.now());
  const s=Math.ceil(ms/1000); const mm=Math.floor(s/60); const ss=s%60;
  d.innerHTML='<div style="font-size:.72rem;letter-spacing:1px;color:var(--gold);">'+EVENT_NAMES[gameEvent.type].toUpperCase()+'</div><div style="font-size:2.4rem;font-weight:800;color:#fff;line-height:1.05;">'+mm+':'+String(ss).padStart(2,'0')+'</div>';
}
let confettiRAF=null, confettiCanvas=null;
function startConfetti(){
  stopConfetti();
  const c=document.createElement('canvas');
  c.id='confetti'; c.style.cssText='position:fixed;inset:0;z-index:70;pointer-events:none;';
  c.width=window.innerWidth; c.height=window.innerHeight;
  document.body.appendChild(c); confettiCanvas=c;
  const ctx=c.getContext('2d');
  const cols=['#ffd76a','#ff5a76','#4fd1ff','#7ad67f','#c79cff','#ff9d3b'];
  const parts=[];
  for(let i=0;i<140;i++){ parts.push({x:Math.random()*c.width, y:Math.random()*-c.height, r:4+Math.random()*6, vy:1.5+Math.random()*3, vx:-1+Math.random()*2, col:cols[Math.floor(Math.random()*cols.length)], rot:Math.random()*6.28, vr:-.2+Math.random()*.4}); }
  function frame(){
    if(!confettiCanvas) return;
    ctx.clearRect(0,0,c.width,c.height);
    parts.forEach(p=>{ p.y+=p.vy; p.x+=p.vx; p.rot+=p.vr; if(p.y>c.height+10){ p.y=-10; p.x=Math.random()*c.width; }
      ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot); ctx.fillStyle=p.col; ctx.fillRect(-p.r/2,-p.r/2,p.r,p.r*.6); ctx.restore(); });
    confettiRAF=requestAnimationFrame(frame);
  }
  frame();
}
function stopConfetti(){ if(confettiRAF){ cancelAnimationFrame(confettiRAF); confettiRAF=null; } if(confettiCanvas){ confettiCanvas.remove(); confettiCanvas=null; } }
function sceneShop(){
  show(`
  <div class="scene active">
    <h2> Tienda de partículas — Tutorial</h2>
    <div class="row" style="justify-content:space-between;">
      <span class="badge gold">Monedas: ${state.Q} Q</span>
      <span class="badge">Tus quarks: U×${state.quarks.up} D×${state.quarks.down}</span>
    </div>
    <div class="row" style="margin-top:18px; gap:20px;">
      <div class="card" style="flex:1; text-align:center;">${quarkEl('up')}<p style="margin-top:8px;"><b>Quark Up</b></p><p class="muted">Precio: 1 Q</p><button class="btn" style="margin-top:10px;" ${state.Q < 1 ? 'disabled' : ''} onclick="buyQuark('up')">Comprar</button></div>
      <div class="card" style="flex:1; text-align:center;">${quarkEl('down')}<p style="margin-top:8px;"><b>Quark Down</b></p><p class="muted">Precio: 1 Q</p><button class="btn" style="margin-top:10px;" ${state.Q < 1 ? 'disabled' : ''} onclick="buyQuark('down')">Comprar</button></div>
    </div>
    <div class="row" style="margin-top:auto; justify-content:flex-end;">
      <button class="btn alt" ${(state.quarks.up < 2 || state.quarks.down < 1) ? 'disabled' : ''} onclick="sceneAssemble()">Ir al inventario </button>
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
    <h2> Inventario — Ensambla tu protón</h2>
    <div class="card" style="margin-top:14px; text-align:center;">
      <p class="muted">Disponibles</p>
      <div class="row" style="justify-content:center; margin-top:10px; min-height:50px;">
        ${available.up > 0 ? `<div onclick="placeSlot('up')" style="cursor:pointer;text-align:center;">${quarkEl('up')}<div class="muted">x${available.up}</div></div>` : ''}
        ${available.down > 0 ? `<div onclick="placeSlot('down')" style="cursor:pointer;text-align:center;">${quarkEl('down')}<div class="muted">x${available.down}</div></div>` : ''}
        ${(available.up === 0 && available.down === 0) ? '<span class="muted">(todos colocados)</span>' : ''}
      </div>
    </div>
    <div class="row" style="justify-content:center; gap:24px; margin-top:22px;">${slotHtml}</div>
    <div style="text-align:center; margin-top:18px;">${isProton ? '<p class="gold" style="font-size:1.2rem;"> ¡PROTÓN listo!</p>' : ''}</div>
    <div class="row" style="margin-top:auto; justify-content:flex-end;">
      <button class="btn" ${isProton ? '' : 'disabled'} onclick="makeProton()"> Crear Protón</button>
    </div>
  </div>`);
}
function placeSlot(t){ const i = state.slots.indexOf(null); if (i === -1 || available[t] <= 0) return; state.slots[i] = t; available[t]--; sceneAssemble(); }
function removeSlot(i){ if (!state.slots[i]) return; available[state.slots[i]]++; state.slots[i] = null; sceneAssemble(); }
function makeProton(){
  state.quarks.up -= 2; state.quarks.down -= 1; state.protons += 1; available = null;
  showGuideOnEnter = true;   // 1ª vez que terminas el tutorial: mostrar la guía de botones
  show(`
  <div class="scene active"><div class="center">
    <h1 style="font-size:2rem;"> ¡Tu primer Protón!</h1>
    <img src="${avatarDataURL(state.avatar,4)}" style="width:110px;height:110px;background:#0a0e28;border-radius:10px;">
    <p><b> Protón</b></p>
    <button class="btn" onclick="enterWorld()"> Entrar al mundo online</button>
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
  sendLoadout();
  if (showGuideOnEnter){ showGuideOnEnter = false; showButtonGuide(); }
}
/*__PART3__*/
/* =================================================
   MUNDO COMPARTIDO (canvas + sincronización)
================================================= */
let worldStarted = false;
let battleActive = false;
let rafId = null;

function startWorldLoop(){
  const cw = VIEW_W * TS, ch = VIEW_H * TS;
  show(`
  <div class="scene active" style="overflow-y:auto; overflow-x:hidden; -webkit-overflow-scrolling:touch;">
    <div class="row" style="justify-content:space-between;">
      <h2 style="margin:0;"> Mundo compartido</h2>
      <div class="row">
        <span class="badge"> ${state.name || 'Sin nombre'}${state.accountId ? ' · '+state.accountId : ''}</span>
        <span class="badge"> <span id="pcount">1</span></span>
        <span class="badge gold" id="coins">${state.Q} Q</span>
        <span class="badge" id="exp">EXP ${state.exp}</span>
        <span class="badge gold" id="luckBadge" style="background:rgba(122,214,127,.25);border-color:#7ad67f;color:#d9ffdc;${luckActive()?'':'display:none;'}">Suerte x2 ${luckActive()?luckRemainStr():''}</span>
      </div>
    </div>
    <div style="display:flex; gap:14px; margin-top:12px; align-items:flex-start; justify-content:center; flex-wrap:wrap;">
      <div style="display:flex; flex-direction:column; gap:8px;">
        <canvas id="world" width="${cw}" height="${ch}" style="background:#0a1f12; border:2px solid var(--panel2); border-radius:12px; max-width:100%;"></canvas>
        <div class="row" style="gap:12px; font-size:.78rem; color:var(--muted); flex-wrap:wrap;">
          <span><span style="display:inline-block;width:11px;height:11px;background:#2f9e52;border-radius:2px;vertical-align:middle;"></span> Césped</span>
          <span><span style="display:inline-block;width:11px;height:11px;background:#7a4a1e;border-radius:2px;vertical-align:middle;"></span> Tienda</span>
          <span><span style="display:inline-block;width:11px;height:11px;background:${desertVisible()?'#e9c96a':'#0e1524'};border-radius:2px;vertical-align:middle;"></span> Desierto ${desertVisible()?'(Nivel 3)':' Nivel 3'}</span>
        </div>
      </div>
      <div id="leaderboard" style="width:300px; max-width:100%; flex:0 0 auto; overflow:auto;"></div>
    </div>
    <div class="row" style="justify-content:center; margin-top:6px;">
      <button class="btn ghost" onclick="tryMove(0,-1)">↑</button>
      <button class="btn ghost" onclick="tryMove(0,1)">↓</button>
      <button class="btn ghost" onclick="tryMove(-1,0)">←</button>
      <button class="btn ghost" onclick="tryMove(1,0)">→</button>
      <button class="btn" onclick="openInventory()"> Inventario (E)</button>
      <button class="btn alt" onclick="openPvpList()"> 1vs1 (P)</button>
      <button class="btn alt" onclick="startTradeSelected()"> Intercambio (I)</button>
      <button class="btn alt" onclick="handleGroupKey()"> Grupo (J)</button>
      <button class="btn ${battleEnabled?'':'ghost'}" onclick="toggleBattleMode()"> Batalla: ${battleEnabled?'SÍ':'NO'}</button>
      <button class="btn alt" onclick="openSaveMenu()"> Guardar (G)</button>
      <button class="btn alt" onclick="openDropCoin()"> Soltar Q (Q)</button>
      <button class="btn ghost" onclick="openBestiary()"> Bestiario (B)</button>
      <button class="btn ghost" onclick="toggleChat()"> Chat (T)</button>
    </div>
    <div id="chatpanel" style="display:none; position:fixed; left:12px; bottom:12px; width:300px; max-width:70%; background:rgba(6,10,24,.92); border:2px solid var(--panel2); border-radius:12px; padding:10px; z-index:40;">
      <div class="row" style="justify-content:space-between; align-items:center;">
        <b style="font-size:.9rem;"> Chat global</b>
        <button class="btn ghost" style="padding:2px 8px;" onclick="toggleChat()"></button>
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
      const typingField = document.activeElement && (document.activeElement.tagName==='INPUT' || document.activeElement.tagName==='TEXTAREA');
      if (typingField){ return; } // escribiendo en un campo (p. ej. contraseña del evento)
      if (e.key === 't' || e.key === 'T'){ e.preventDefault(); toggleChat(); return; }
      if (typeof pvp !== 'undefined' && pvp && !pvp.over){
        if (e.key === '1'){ e.preventDefault(); pvpAct('attack'); return; }
        if (e.key === '2'){ e.preventDefault(); pvpAct('ability'); return; }
      }
      if (battleActive){
        if (e.key === '1'){ e.preventDefault(); pAct('attack'); return; }
        if (e.key === '2'){ e.preventDefault(); pAct('ability'); return; }
        return;
      }
      if (e.key === 'Escape'){ closeModal(); return; }
      if (document.getElementById('modal')){ if (e.key==='e'||e.key==='E'||e.key==='g'||e.key==='G') closeModal(); return; }
      if (e.key>='0' && e.key<='9'){ feedSecret(e.key); return; }   // secuencia secreta de eventos
      if (e.key === 'e' || e.key === 'E'){ openInventory(); return; }
      if (e.key === 'p' || e.key === 'P'){ openPvpList(); return; }
      if (e.key === 'i' || e.key === 'I'){ startTradeSelected(); return; }
      if (e.key === 'g' || e.key === 'G'){ openSaveMenu(); return; }
      if (e.key === 'q' || e.key === 'Q'){ openDropCoin(); return; }
      if (e.key === 'b' || e.key === 'B'){ openBestiary(); return; }
      if (e.key === 'j' || e.key === 'J'){ handleGroupKey(); return; }
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
  const medals = ['', '', ''];
  const rows = board.length ? board.map((p, i) => {
    const mine = p.id === myId;
    const rank = medals[i] || `#${i + 1}`;
    return `<tr style="${mine ? 'background:rgba(255,208,102,.12);' : ''}">
      <td style="padding:6px 10px; text-align:center;">${rank}</td>
      <td style="padding:6px 10px;">${escapeHtml(p.name)}${mine ? ' <span class="muted">(tú)</span>' : ''}</td>
      <td style="padding:6px 10px; text-align:center;">e- ${p.electrons}</td>
      <td style="padding:6px 10px; text-align:center;" class="gold">${p.Q} Q</td>
      <td style="padding:6px 10px; text-align:center;"> ${p.wins}</td>
    </tr>`;
  }).join('') : `<tr><td colspan="5" class="muted" style="padding:12px; text-align:center;">Aún no hay jugadores en la tabla.</td></tr>`;
  cont.innerHTML = `
    <div class="card">
      <h3 style="margin:0 0 8px;"> Tabla de clasificación</h3>
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
  const t = tileAt(nx, ny);
  if (t === 'W'){ toast(' Un muro bloquea el paso.'); return; }
  if (t === 'D' && getLevel() < 3){ toast(' El desierto solo se abre al alcanzar el Nivel 3.'); return; }
  me.tx = nx; me.ty = ny;              // movimiento optimista
  socket.emit('move', { tx: nx, ty: ny }); // el servidor confirma y difunde
  state.steps++;
  // ¿hay monedas Q en este tile? recogerlas
  for (const cid in worldCoins){
    const c = worldCoins[cid];
    if (c.tx === nx && c.ty === ny){ socket.emit('pickup-coin', { id: cid }); }
  }
  if (t === 'S'){ openWorldShop(); return; }   // entrar a la tienda (comprar con Q)
  if (!battleEnabled) return;   // modo sin peleas: solo caminar
  const LM = luckMul() * eventEncounterMul();   // 2x poción de suerte, x5 durante el evento Lluvia de átomos
  if (t === 'D' && Math.random() < 0.001*LM) triggerEncounter('boron');   // Boro salvaje: 0,1% en el desierto
  else if (t === 'G' && Math.random() < 0.001*LM) triggerEncounter('lithium');   // Litio salvaje: 0,1% en césped
  else if (t === 'D' && Math.random() < 0.005*LM) triggerEncounter('beryllium');   // Berilio salvaje: 0,5% en el desierto
  else if (t === 'D' && Math.random() < 0.03*LM) triggerEncounter('lithium');   // Litio salvaje: 3% en el desierto
  else if (Math.random() < 0.01*LM) triggerEncounter('helium');
  else if (Math.random() < 0.05*LM) triggerEncounter('hydrogen');
}

function drawWorld(){
  const cv = document.getElementById('world');
  if (!cv){ rafId = requestAnimationFrame(drawWorld); return; }
  const ctx = cv.getContext('2d');
  const T = TS;
  const { camX, camY } = camOffset();
  ctx.clearRect(0, 0, cv.width, cv.height);
  drawTerrain(ctx, T, camX, camY);
  ctx.imageSmoothingEnabled = false;
  // monedas Q soltadas en el campo
  for (const cid in worldCoins){
    const c = worldCoins[cid];
    drawCoin(ctx, c, T, camX, camY);
  }
  // otros jugadores
  for (const id in others){
    const p = others[id];
    if (!p.canvas) p.canvas = avatarCanvas(p.avatar);
    drawActor(ctx, p.canvas, p.tx, p.ty, T, camX, camY, false, p.name || id.slice(0,4), p);
    if (id === tradeSelectedId){
      const sx = (p.tx - camX) * T, sy = (p.ty - camY) * T;
      if (sx >= 0 && sy >= 0 && sx < cv.width && sy < cv.height){
        ctx.strokeStyle = '#ffd54f'; ctx.lineWidth = 3;
        ctx.strokeRect(sx + 1, sy + 1, T - 2, T - 2);
      }
    }
  }
  // yo
  if (!me.canvas) me.canvas = avatarCanvas(state.avatar);
  drawActor(ctx, me.canvas, me.tx, me.ty, T, camX, camY, true, state.name || 'TÚ', me);
  const pc = document.getElementById('pcount'); if (pc) pc.textContent = 1 + Object.keys(others).length;
  rafId = requestAnimationFrame(drawWorld);
}
function drawActor(ctx, img, tx, ty, T, camX, camY, isMe, label, p){
  const px = (tx - camX) * T, py = (ty - camY) * T;
  if (px < -T || py < -T || px > ctx.canvas.width || py > ctx.canvas.height) return;
  if (isMe){ ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(px+2, py+2, T-4, T-4); }
  ctx.drawImage(img, px+3, py+3, T-6, T-6);
  ctx.fillStyle = '#fff'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(label, px + T/2, py + 11);
  if (p && p.emote && Date.now() - (p.emoteT||0) < 2500){
    ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(px - 6, py - 16, T + 12, 14);
    ctx.fillStyle = '#ffd54f'; ctx.fillText(p.emote, px + T/2, py - 5);
  }
}

/* ---------- Dibujar una moneda Q en el campo ---------- */
function drawCoin(ctx, c, T, camX, camY){
  const px = (c.tx - camX) * T, py = (c.ty - camY) * T;
  if (px < -T || py < -T || px > ctx.canvas.width || py > ctx.canvas.height) return;
  const cx = px + T/2, cy = py + T/2, r = T*0.30;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2);
  ctx.fillStyle = '#ffd54f'; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = '#b8860b'; ctx.stroke();
  ctx.fillStyle = '#7a5200'; ctx.font = 'bold ' + Math.round(T*0.32) + 'px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('Q', cx, cy + 1);
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#fff'; ctx.font = '10px sans-serif';
  ctx.fillText(c.amount + '', cx, py - 2);
}

/* ---------- Terreno por tiles (tienda marrón / césped / desierto / muro) ---------- */
function drawTerrain(ctx, T, camX, camY){
  ctx.imageSmoothingEnabled = false;
  const vw = Math.ceil(ctx.canvas.width / T), vh = Math.ceil(ctx.canvas.height / T);
  for (let sy = 0; sy < vh; sy++){
    for (let sx = 0; sx < vw; sx++){
      const x = camX + sx, y = camY + sy;
      if (x >= MAP_W || y >= MAP_H) continue;
      const t = tileAt(x, y);
      ctx.fillStyle = tileColor(t, x, y);
      ctx.fillRect(sx * T, sy * T, T, T);
    }
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
  socket.emit('emote', ' ¡en batalla!');
  foeType = WILD_FOES[foeType] ? foeType : 'hydrogen';
  normalizeParty();
  let party = (state.party||[]).filter(k => COMBATANTS[k] && ownedCount(k) >= 1).slice(0, maxParty());
  if (party.length === 0){
    const k = ['proton','neutron','electron','hydrogen'].find(k => ownedCount(k) >= 1) || 'proton';
    party = [k];
  }
  const f = WILD_FOES[foeType];
  const sm = eventFoeStatMul();   // x2 vida y daño durante el evento Átomos agresivos
  const units = party.map(key => {
    const c = COMBATANTS[key];
    return {key:key, label:c.label, icon:c.icon, hp:c.hp, max:c.hp, atk:c.atk, dodge:c.dodge,
            ability:c.ability, actCount:0, abilityReady:false, alive:true, negateNext:false, immuneTurns:0};
  });
  const u0 = units[0];
  battle = {
    foeType: foeType,
    foeInfo: f,
    units: units,
    active: 0,
    foe: { hp:f.hp*sm, max:f.hp*sm, atk:f.atk*sm, dodge:f.dodge, label:f.label, icon:f.icon },
    turn:1, over:false, win:false,
    log:[` ¡Un ${f.label} salvaje apareció! Envías a ${u0.label} ${u0.icon}${units.length>1?` (equipo de ${units.length})`:''}.`]
  };
  if (f.companion){
    const pool = ['hydrogen','helium','lithium'];
    const ck = pool[Math.floor(Math.random()*pool.length)];
    const cf = WILD_FOES[ck];
    battle.companion = { hp:cf.hp*sm, max:cf.hp*sm, atk:cf.atk*sm, dodge:cf.dodge, label:cf.label,
      letter:cf.letter, gradient:cf.gradient, textColor:cf.textColor, icon:cf.icon, alive:true };
    battle.target = 'foe';
    blog(` El ${f.label} viene acompañado de un ${cf.label} ${cf.letter}. ¡Dos enemigos!`);
  }
  renderBattle();
}
function blog(m){ battle.log.push(m); if (battle.log.length > 20) battle.log.shift(); }
// Fisión del Berilio: la unidad se divide en 2 Helios a media vida
function berylliumSplit(u){
  const b = battle; const t = COMBATANTS.helium;
  const halfHp = Math.max(1, Math.round(t.hp/2)); // 15
  // preservar referencias de unidad activa por dueño (batalla de grupo)
  let activeRefs = null;
  if (b.group && b.activeByOwner){ activeRefs = {}; Object.keys(b.activeByOwner).forEach(o=>{ activeRefs[o] = b.units[b.activeByOwner[o]]; }); }
  const idx = b.units.indexOf(u);
  const owner = u.ownerId, oname = u.ownerName;
  const pref = oname ? oname+': ' : '';
  blog(` ¡El ${u.label} se divide por fisión en 2 ${t.label} (${halfHp} HP cada uno)!`);
  // convertir la unidad actual en Helio
  u.key=t.key; u.label=pref+t.label; u.icon=t.icon; u.atk=t.atk; u.dodge=t.dodge; u.ability=t.ability;
  u.max=t.hp; u.hp=halfHp; u.actCount=0; u.abilityReady=false;
  // segundo Helio
  const he2 = { key:t.key, label:pref+t.label, icon:t.icon, hp:halfHp, max:t.hp, atk:t.atk, dodge:t.dodge,
    ability:t.ability, actCount:0, abilityReady:false, alive:true, negateNext:false, immuneTurns:0,
    ownerId:owner, ownerName:oname, avatar:null };
  b.units.splice(idx+1, 0, he2);
  // remapear índices activos por dueño tras el splice
  if (activeRefs){ Object.keys(activeRefs).forEach(o=>{ const ni = b.units.indexOf(activeRefs[o]); if (ni>=0) b.activeByOwner[o] = ni; }); }
}
function autoSwitch(){
  const b=battle;
  const idx=b.units.findIndex(u=>u.alive);
  if(idx<0) return false;
  b.active=idx;
  blog(` Entra ${b.units[idx].label} ${b.units[idx].icon}.`);
  return true;
}
function switchUnit(idx){
  const b=battle; if(b.over) return;
  if (b.group){
    const u=b.units[idx]; if(!u || u.ownerId!==myId || !u.alive) return;
    if (!isMyGroupTurn()) { toast('No es tu turno.'); return; }
    groupCmd({type:'switch', idx});
    return;
  }
  if(b.spectator) return;
  if(idx===b.active) return;
  const u=b.units[idx]; if(!u || !u.alive) return;
  blog(` Cambias a ${u.label} ${u.icon}. (pierdes el turno)`);
  b.active=idx;
  setTimeout(enemyTurn, 400);
  renderBattle();
}
function setTarget(t){ if(!battle||battle.over) return; const b=battle;
  if (b.group){ if(!isMyGroupTurn()) return; groupCmd({type:'target', t}); return; }
  if (b.spectator) return; b.target=t; renderBattle();
}
function foeBox(o, info, opts){
  const dead = (o.alive===false) || o.hp<=0;
  const pct = Math.min(100, Math.max(0, o.hp/o.max*100));
  const sel = opts.selected ? 'border:2px solid var(--gold);' : 'border:1px solid var(--panel2);';
  const dim = dead ? 'opacity:.35;filter:grayscale(1);' : '';
  const canSel = !dead && !opts.over && !opts.spectator;
  const btn = canSel
    ? `<button class="btn ghost" style="margin-top:6px;font-size:.68rem;padding:4px 8px;" ${opts.selected?'disabled':''} onclick="setTarget('${opts.tkey}')">${opts.selected?'Objetivo':'Atacar'}</button>`
    : (dead ? `<p class="muted" style="font-size:.68rem;margin-top:6px;">Derrotado</p>` : '');
  return `<div class="card" style="${sel}${dim}flex:1; min-width:110px; text-align:center; padding:8px;">
    <p style="font-size:.82rem;"><b>${o.label.toUpperCase()}</b></p>
    <div style="width:52px;height:52px;border-radius:50%;margin:6px auto;background:${o.gradient||info.gradient};display:flex;align-items:center;justify-content:center;font-weight:800;color:${o.textColor||info.textColor};">${o.letter||info.letter}</div>
    <div style="background:#003;border-radius:8px;overflow:hidden;height:12px;"><div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#5be08a,#2fa55e);"></div></div>
    <p class="muted" style="font-size:.74rem;">${Math.max(0,o.hp)}/${o.max}</p>
    ${btn}
  </div>`;
}
function renderBattle(){
  const b = battle;
  if (b && b.group) return renderGroupBattle();
  const u = b.units[b.active];
  const pPct = Math.min(100, Math.max(0, u.hp / u.max * 100));
  const hPct = Math.max(0, b.foe.hp / b.foe.max * 100);
  const canAbility = u.abilityReady && !b.over;
  const cd = u.ability.every - (u.actCount % u.ability.every);
  const abilityLabel = canAbility ? `${u.ability.icon} ${u.ability.name}` : `${u.ability.icon} ${u.ability.name} ${cd}`;
  const meVisual = u.key === 'proton'
    ? `<img src="${avatarDataURL(u.avatar||state.avatar,3)}" style="width:70px;height:70px;background:#0a0e28;border-radius:8px;margin:8px 0;">`
    : (unitBall(u.key,70)
        ? `<div style="display:flex;justify-content:center;margin:8px 0;">${unitBall(u.key,70)}</div>`
        : `<div style="width:70px;height:70px;border-radius:12px;margin:8px auto;background:#0a0e28;display:flex;align-items:center;justify-content:center;font-size:2rem;">${u.icon}</div>`);
  const spectator = !!b.spectator;
  const switchBtns = b.units.map((x,i)=> i===b.active ? '' :
    `<button class="btn ghost" ${(!x.alive||b.over||spectator)?'disabled':''} onclick="switchUnit(${i})"> ${x.icon} ${x.label} ${x.alive?`${Math.max(0,x.hp)}`:''}</button>`
  ).join('');
  let actionRow;
  if (spectator){
    actionRow = b.over
      ? `<p class="muted"> Esperando el resultado del grupo…</p>`
      : `<p class="muted"> Tu grupo controla el combate…</p>`;
  } else if (b.over){
    const cont = (b.group && groupBattle && groupBattle.host) ? 'endGroupBattleHost()' : 'endBattle()';
    actionRow = `<button class="btn" onclick="${cont}">Continuar </button>`;
  } else {
    actionRow = `
        <button class="btn" onclick="pAct('attack')"> Ataque [1]</button>
        <button class="btn alt" ${canAbility ? '' : 'disabled'} onclick="pAct('ability')">${abilityLabel} [2]</button>`;
  }
  openModal(`
    <h2 style="text-align:center;"> Batalla — Turno ${b.turn}</h2>
    <div class="row" style="justify-content:space-between; align-items:flex-start;">
      <div class="card" style="flex:1; text-align:center;">
        <p><b>${u.icon} ${u.label.toUpperCase()}</b></p>
        ${meVisual}
        <div style="background:#300;border-radius:8px;overflow:hidden;height:14px;"><div style="height:100%;width:${pPct}%;background:linear-gradient(90deg,#5be08a,#2fa55e);"></div></div>
        <p class="muted"> ${Math.max(0,u.hp)}/${u.max}</p>
      </div>
      <div style="align-self:center; font-size:1.4rem;">VS</div>
      <div class="card" style="flex:1; text-align:center;">
        ${b.companion ? `
        <div class="row" style="gap:8px; align-items:stretch; justify-content:center;">
          ${foeBox(b.foe, b.foeInfo, {selected:(b.target!=='comp'), tkey:'foe', over:b.over, spectator:spectator})}
          ${foeBox(b.companion, b.foeInfo, {selected:(b.target==='comp'), tkey:'comp', over:b.over, spectator:spectator})}
        </div>` : `
        <p><b>${b.foe.icon} ${b.foe.label.toUpperCase()}</b></p>
        <div style="width:70px;height:70px;border-radius:50%;margin:8px auto;background:${b.foeInfo.gradient};display:flex;align-items:center;justify-content:center;font-weight:800;color:${b.foeInfo.textColor};">${b.foeInfo.letter}</div>
        <div style="background:#003;border-radius:8px;overflow:hidden;height:14px;"><div style="height:100%;width:${hPct}%;background:linear-gradient(90deg,#5be08a,#2fa55e);"></div></div>
        <p class="muted"> ${Math.max(0,b.foe.hp)}/${b.foe.max}</p>`}
        ${switchBtns? `<div style="margin-top:8px; display:flex; flex-direction:column; gap:6px;"><p class="muted" style="font-size:.7rem;">Cambiar (cuesta el turno):</p>${switchBtns}</div>` : ''}
      </div>
    </div>
    <div id="log" style="margin-top:14px;">${b.log.map(l => `<div>${l}</div>`).join('')}</div>
    <div class="row" style="justify-content:center; margin-top:14px;">
      ${actionRow}
    </div>`);
  const lg = document.getElementById('log'); if (lg) lg.scrollTop = lg.scrollHeight;
  broadcastBattle();
}
function pAct(kind){
  const b = battle; if (b.over) return;
  if (b.group){
    if (!isMyGroupTurn()){ toast('No es tu turno.'); return; }
    const u = myActiveUnit(); if (!u || !u.alive) return;
    if (kind === 'ability' && !u.abilityReady) return;
    groupCmd({type:'act', kind});
    return;
  }
  if (b.spectator) return;
  const u = b.units[b.active];
  if (kind === 'ability' && !u.abilityReady) return;
  if (kind === 'ability' && u.ability.immune){
    // habilidad defensiva: se vuelve inmune durante los próximos turnos
    u.immuneTurns = u.ability.immuneTurns || 3;
    u.abilityReady = false;
    blog(` ${u.label} usa ${u.ability.name} — inmune a los próximos ${u.immuneTurns} turnos.`);
    u.actCount++;
    u.abilityReady = (u.actCount % u.ability.every === (u.ability.every - 1));
    setTimeout(enemyTurn, 400);
    renderBattle();
    return;
  }
  if (kind === 'ability' && u.ability.healAll){
    // habilidad de apoyo: sana a TODO el equipo
    const amt = u.ability.healAll;
    u.abilityReady = false;
    b.units.forEach(x=>{ if(x.alive){ const old = Math.max(0,x.hp); x.hp += amt; blog(` ${x.label}: ${old}HP+${amt}HP`); } });
    blog(` ${u.label} usa ${u.ability.name} — sana +${amt} a TODO el equipo.`);
    sfxBonus();
    u.actCount++;
    u.abilityReady = (u.actCount % u.ability.every === (u.ability.every - 1));
    setTimeout(enemyTurn, 400);
    renderBattle();
    return;
  }
  if (kind === 'ability' && u.ability.fission){
    // Fisión: daño masivo a enemigos + daño a todo tu equipo, luego se divide en 2 Helios
    u.abilityReady = false;
    const eDmg = u.ability.dmg;
    sfxBoomBig(); shakeEl(null, 20, 600);
    blog(` ${u.label} usa ${u.ability.name} ${u.ability.icon} — ¡FISIÓN! ${eDmg} de daño a los enemigos.`);
    b.foe.hp -= eDmg;
    if (b.companion && b.companion.alive) b.companion.hp -= eDmg;
    const aDmg = u.ability.allyDmg || 0;
    if (aDmg){
      blog(` La reacción golpea a TODO tu equipo: ${aDmg} de daño a cada unidad.`);
      b.units.forEach(x=>{ if(x.alive){ x.hp -= aDmg; if(x.hp<=0){ x.hp=0; x.alive=false; blog(` Tu ${x.label} cayó por la fisión.`); } } });
    }
    u.actCount++;
    // muerte del acompañante / victoria
    if (b.companion && b.companion.alive && b.companion.hp <= 0){ b.companion.hp=0; b.companion.alive=false; blog(` ¡El acompañante ${b.companion.label} fue derrotado!`); if (b.target==='comp') b.target='foe'; }
    if (b.foe.hp < 0) b.foe.hp = 0;
    if (b.foe.hp <= 0 && b.companion && b.companion.alive){ b.target='comp'; }
    const foeDown = b.foe.hp<=0; const compDown = !b.companion || !b.companion.alive;
    if (foeDown && compDown){ b.foe.hp=0; b.over=true; b.win=true; blog(` ¡${b.foe.label} derrotado!`);
      const db=b.foeInfo.deathBlast; if(db){ blog(` ¡${b.foe.label} explota al morir! ${db} de daño a TODO tu equipo.`); sfxBoomBig(); shakeEl(null,22,650); b.units.forEach(x=>{ if(x.alive){ x.hp-=db; if(x.hp<=0){x.hp=0;x.alive=false;} } }); }
      sfxVictory(); renderBattle(); return; }
    // dividir el Berilio en 2 Helios a media vida
    if (u.alive){ berylliumSplit(u); }
    if (b.units.every(x=>!x.alive)){ b.over=true; b.win=false; blog(` Todas tus unidades cayeron…`); renderBattle(); return; }
    if (!b.units[b.active] || !b.units[b.active].alive){ autoSwitch(); }
    setTimeout(enemyTurn, 400);
    renderBattle();
    return;
  }
  const dmg = kind === 'ability' ? u.ability.dmg : u.atk;
  const nm = kind === 'ability' ? `${u.ability.name} ${u.ability.icon}` : 'Ataque ';
  const tgt = (b.companion && b.companion.alive && b.target==='comp') ? b.companion : b.foe;
  sfxSlash(); shakeEl();
  if (Math.random() < tgt.dodge){ blog(`${u.label} usa ${nm}…  ¡el ${tgt.label} esquivó! (0)`); }
  else { tgt.hp -= dmg; blog(`${u.label} usa ${nm} → ${dmg} de daño a ${tgt.label}.`); }
  if (kind === 'ability'){
    u.abilityReady = false;
    if (u.ability.selfDmg){
      u.hp -= u.ability.selfDmg;
      blog(` ${u.label} pierde ${u.ability.selfDmg} HP por el esfuerzo.`);
    }
    if (u.ability.transform && COMBATANTS[u.ability.transform]){
      const newHp = u.ability.transformHp || 5;
      const t = COMBATANTS[u.ability.transform];
      blog(` ¡${u.label} se fusiona y se convierte en ${t.label} ${t.icon} (${newHp} HP)!`);
      u.key=t.key; u.label=t.label; u.icon=t.icon; u.atk=t.atk; u.dodge=t.dodge; u.ability=t.ability;
      u.max=t.hp; u.hp=Math.min(newHp, t.hp); u.actCount=0;
    }
  }
  u.actCount++;
  u.abilityReady = (u.actCount % u.ability.every === (u.ability.every - 1));
  // muerte del acompañante
  if (b.companion && b.companion.alive && b.companion.hp <= 0){
    b.companion.hp = 0; b.companion.alive = false;
    blog(` ¡El acompañante ${b.companion.label} fue derrotado!`);
    if (b.target === 'comp') b.target = 'foe';
  }
  if (b.foe.hp < 0) b.foe.hp = 0;
  // el Boro cae pero si su acompañante sigue vivo, la batalla continúa
  if (b.foe.hp <= 0 && b.companion && b.companion.alive){ b.target = 'comp'; }
  const foeDown = b.foe.hp <= 0;
  const compDown = !b.companion || !b.companion.alive;
  if (foeDown && compDown){ b.foe.hp = 0; b.over = true; b.win = true; blog(` ¡${b.foe.label} derrotado!`);
    const db = b.foeInfo.deathBlast;
    if(db){
      blog(` ¡${b.foe.label} explota al morir! ${db} de daño a TODO tu equipo.`);
      sfxBoomBig(); shakeEl(null, 22, 650);
      b.units.forEach(x=>{ if(x.alive){ x.hp -= db; if(x.hp<=0){ x.hp=0; x.alive=false; } } });
    }
    sfxVictory(); renderBattle(); return; }
  if (u.hp <= 0){
    u.hp = 0; u.alive = false; blog(` Tu ${u.label} se debilitó por el esfuerzo.`);
    if(!autoSwitch()){ b.over = true; b.win = false; blog(` Todas tus unidades cayeron…`); renderBattle(); return; }
  }
  setTimeout(enemyTurn, 400);
  renderBattle();
}
function foeAoe(dmg){
  const b = battle;
  b.units.forEach(x=>{ if(x.alive){ x.hp -= dmg; if(x.hp<=0){ x.hp=0; x.alive=false; blog(` Tu ${x.label} cayó por la explosión.`); } } });
  if(b.units.every(x=>!x.alive)){ b.over=true; b.win=false; blog(` Todas tus unidades cayeron…`); renderBattle(); return true; }
  if(!b.units[b.active].alive){ autoSwitch(); }
  return false;
}
function enemyTurn(){
  const b = battle; if (b.over) return;
  if (b.companion !== undefined){ return enemyTurnBoro(); }
  const fa = b.foeInfo.foeAbility;
  // habilidad de área: explosión pequeña a TODO el equipo (sustituye al ataque normal)
  if (fa && fa.type==='aoe' && Math.random() < fa.chance){
    blog(`${fa.icon} ¡${b.foe.label} provoca ${fa.name}! ${fa.dmg} de daño a TODO tu equipo.`);
    sfxBoomSmall(); shakeEl();
    if(foeAoe(fa.dmg)) return;
    b.turn++; renderBattle(); return;
  }
  const u = b.units[b.active];
  if (u.immuneTurns > 0){
    u.immuneTurns--;
    blog(` ¡Neutralizado! Tu ${u.label} es inmune al ataque del ${b.foe.label}. (0)` + (u.immuneTurns>0?` (inmunidad: ${u.immuneTurns} turno${u.immuneTurns===1?'':'s'} más)`:''));
  } else if (Math.random() < u.dodge){ blog(`${b.foe.label} ataca…  ¡tu ${u.label} esquivó! (0)`); }
  else { u.hp -= b.foe.atk; blog(`${b.foe.label} ataca → ${b.foe.atk} de daño.`); sfxHit(); shakeEl(); }
  if (u.hp <= 0){
    u.hp = 0; u.alive = false; blog(` Tu ${u.label} cayó…`);
    if(!autoSwitch()){ b.over = true; b.win = false; renderBattle(); return; }
    b.turn++; renderBattle(); return;
  }
  // habilidad especial del enemigo: robar el turno del jugador
  if (fa && fa.type==='steal' && !b.over && Math.random() < fa.chance){
    blog(`${fa.icon} ¡${b.foe.label} usa ${fa.name}! Te roba el turno.`);
    sfxHit(); shakeEl();
    b.turn++;
    renderBattle();
    setTimeout(enemyTurn, 700);
    return;
  }
  b.turn++;
  renderBattle();
}
function enemyTurnBoro(){
  const b = battle; if (b.over) return;
  // El Boro se sana a sí mismo o a su acompañante cuando está a 10 HP o menos
  if (b.foe.hp > 0 && b.foe.hp <= 10){
    const cands = [{label:b.foe.label, o:b.foe}];
    if (b.companion && b.companion.alive) cands.push({label:b.companion.label, o:b.companion});
    const pick = cands[Math.floor(Math.random()*cands.length)];
    pick.o.hp = pick.o.max;
    blog(` ¡El ${b.foe.label} está muy herido y sana a ${pick.label} a vida completa! (${pick.o.max}/${pick.o.max})`);
    sfxBonus();
  }
  // enemigos que pueden atacar este turno (aleatorio: a veces uno, a veces los dos)
  const foes = [];
  if (b.foe.hp > 0) foes.push({label:b.foe.label, atk:b.foe.atk});
  if (b.companion && b.companion.alive) foes.push({label:b.companion.label, atk:b.companion.atk});
  let attackers = foes.filter(()=> Math.random() < 0.7);
  if (attackers.length === 0 && foes.length) attackers = [foes[Math.floor(Math.random()*foes.length)]];
  const u = b.units[b.active];
  const immuneThisTurn = u.immuneTurns > 0;
  if (immuneThisTurn) u.immuneTurns--;
  attackers.forEach(a => {
    if (b.over || !u.alive) return;
    if (immuneThisTurn){ blog(` ¡Neutralizado! ${u.label} es inmune al ataque de ${a.label}. (0)`); return; }
    if (Math.random() < u.dodge){ blog(`${a.label} ataca…  ¡tu ${u.label} esquivó! (0)`); return; }
    u.hp -= a.atk; blog(`${a.label} ataca → ${a.atk} de daño.`); sfxHit(); shakeEl();
  });
  if (immuneThisTurn){ blog(` (Inmunidad de Neutralizar: ${u.immuneTurns} turno${u.immuneTurns===1?'':'s'} restante${u.immuneTurns===1?'':'s'}.)`); }
  if (u.hp <= 0){
    u.hp = 0; u.alive = false; blog(` Tu ${u.label} cayó…`);
    if(!autoSwitch()){ b.over = true; b.win = false; renderBattle(); return; }
  }
  b.turn++;
  renderBattle();
}
function endBattle(){
  if (battle.win){
    state.wins++;
    const f = battle.foeInfo;
    const rm = eventRewardMul();   // x3 recompensa durante el evento Átomos agresivos
    const rew = scaleReward(f.reward, rm);
    const bon = scaleReward(f.bonus, rm);
    const lvlBefore = getLevel();
    // Recompensa garantizada (100%)
    applyReward(rew);
    blog(` ${rewardParts(rew)}`);
    if (getLevel() > lvlBefore){ blog(` ¡Subiste al Nivel ${getLevel()}!${getLevel()>=2?' Ya puedes llevar 2 unidades (Inventario).':''}`); sfxLevelUp(); }
    // Recompensa con probabilidad según el enemigo (x2 con poción de suerte, x5 en Lluvia de átomos)
    if (Math.random() < Math.min(1, f.bonusChance * luckMul() * eventBonusMul())){
      applyReward(bon);
      sfxBonus();
      blog(` ¡Botín raro! ${rewardParts(bon)}`);
    }
  }
  battleActive = false;
  closeModal();
  socket.emit('emote', battle.win ? ' ¡gané!' : '');
  sendStats();
  const c = document.getElementById('coins'); if (c) c.textContent = state.Q + ' Q';
  const ex = document.getElementById('exp'); if (ex) ex.textContent = 'EXP ' + state.exp;
}

/* =================================================
   BATALLA DE GRUPO (co-op, host autoritativo)
================================================= */
function triggerEncounter(foeType){
  if (inGroupParty()){
    // El que pisa el encuentro es el anfitrión: arrastra a todo el grupo
    sendLoadout();
    socket.emit('group-battle-start', { foeType });
  } else {
    startBattle(foeType);
  }
}
function giveWildReward(foeType, win){
  const f = WILD_FOES[foeType]; if (!f || !win) return;
  state.wins++;
  const lvlBefore = getLevel();
  applyReward(f.reward);
  if (getLevel() > lvlBefore) sfxLevelUp();
  if (Math.random() < Math.min(1, f.bonusChance * luckMul())){ applyReward(f.bonus); sfxBonus(); }
  sendStats();
}
function serializeBattle(){
  const b = battle;
  return {
    turn:b.turn, over:b.over, win:b.win, active:b.active, foeType:b.foeType,
    foe:{hp:b.foe.hp, max:b.foe.max, label:b.foe.label, icon:b.foe.icon},
    companion: b.companion ? { hp:b.companion.hp, max:b.companion.max, label:b.companion.label,
      letter:b.companion.letter, gradient:b.companion.gradient, textColor:b.companion.textColor,
      icon:b.companion.icon, alive:b.companion.alive } : null,
    target: b.target || 'foe',
    players: b.players || null,
    turnOwner: b.turnOwner || null,
    phaseIdx: (b.phaseIdx==null? null : b.phaseIdx),
    activeByOwner: b.activeByOwner || null,
    units:b.units.map(u => ({ key:u.key, label:u.label, icon:u.icon, hp:u.hp, max:u.max, alive:u.alive,
      avatar:u.avatar||null, ownerId:u.ownerId||null, ownerName:u.ownerName||null,
      immuneTurns:u.immuneTurns||0, abilityReady:!!u.abilityReady, actCount:u.actCount||0,
      abilityIcon:(u.ability&&u.ability.icon)||'', abilityName:(u.ability&&u.ability.name)||'',
      abilityEvery:(u.ability&&u.ability.every)||1 })),
    log:b.log
  };
}
function broadcastBattle(){
  if (groupBattle && groupBattle.host && battle && battle.group){
    socket.emit('group-battle-sync', { b: serializeBattle() });
  }
}

/* ---- Turnos por jugador (batalla de grupo) ---- */
function myActiveUnit(){
  const b = battle; if (!b) return null;
  if (b.group){ const ai = b.activeByOwner ? b.activeByOwner[myId] : null; return (ai!=null) ? b.units[ai] : null; }
  return b.units[b.active];
}
function isMyGroupTurn(){ return !!(battle && battle.group && !battle.over && battle.turnOwner === myId); }
function ownerName(id){
  if (id === 'enemy') return 'Enemigo';
  const b = battle; const p = b && b.players ? b.players.find(x=>x.id===id) : null;
  if (id === myId) return 'Tú';
  return p ? p.name : 'Jugador';
}
// El host aplica una acción; los invitados envían la acción al host
function groupCmd(action){
  if (groupBattle && groupBattle.host){ applyGroupAction(myId, action); }
  else { socket.emit('group-battle-act', { action }); }
}
function applyGroupAction(ownerId, action){
  const b = battle;
  if (!b || !b.group || !groupBattle || !groupBattle.host || b.over || !action) return;
  if (action.type === 'switch'){
    const idx = action.idx|0; const u = b.units[idx];
    if (u && u.ownerId === ownerId && u.alive){ b.activeByOwner[ownerId] = idx; renderBattle(); }
    return;
  }
  if (action.type === 'target'){
    if (b.turnOwner === ownerId){ b.target = action.t; renderBattle(); }
    return;
  }
  if (action.type === 'act'){
    if (b.turnOwner !== ownerId) return;
    const ai = b.activeByOwner[ownerId]; const u = b.units[ai];
    if (!u || u.ownerId !== ownerId || !u.alive){ advanceGroupTurn(); return; }
    gUnitAction(u, action.kind);
    if (b.over){ renderBattle(); return; }
    advanceGroupTurn();
  }
}
// Efecto de una acción de unidad (solo host). No gestiona el paso de turno.
function gUnitAction(u, kind){
  const b = battle;
  if (kind === 'ability' && !u.abilityReady) kind = 'attack';
  if (kind === 'ability' && u.ability.immune){
    u.immuneTurns = u.ability.immuneTurns || 3; u.abilityReady = false;
    blog(` ${u.label} usa ${u.ability.name} — inmune ${u.immuneTurns} turnos.`);
    u.actCount++; u.abilityReady = (u.actCount % u.ability.every === (u.ability.every - 1)); return;
  }
  if (kind === 'ability' && u.ability.healAll){
    const amt = u.ability.healAll; u.abilityReady = false;
    b.units.forEach(x=>{ if(x.alive){ const old=Math.max(0,x.hp); x.hp += amt; blog(` ${x.label}: ${old}HP+${amt}HP`); } });
    blog(` ${u.label} usa ${u.ability.name} — sana +${amt} a TODO el equipo.`); sfxBonus();
    u.actCount++; u.abilityReady = (u.actCount % u.ability.every === (u.ability.every - 1)); return;
  }
  if (kind === 'ability' && u.ability.fission){
    u.abilityReady = false;
    const eDmg = u.ability.dmg;
    sfxBoomBig(); shakeEl(null, 20, 600);
    blog(` ${u.label} usa ${u.ability.name} ${u.ability.icon} — ¡FISIÓN! ${eDmg} de daño a los enemigos.`);
    b.foe.hp -= eDmg;
    if (b.companion && b.companion.alive) b.companion.hp -= eDmg;
    const aDmg = u.ability.allyDmg || 0;
    if (aDmg){
      blog(` La reacción golpea a TODAS las unidades del grupo: ${aDmg} de daño a cada una.`);
      b.units.forEach(x=>{ if(x.alive){ x.hp -= aDmg; if(x.hp<=0){ x.hp=0; x.alive=false; blog(` ${x.label} cayó por la fisión.`); } } });
    }
    u.actCount++;
    if (b.companion && b.companion.alive && b.companion.hp <= 0){ b.companion.hp=0; b.companion.alive=false; blog(` ¡El acompañante ${b.companion.label} fue derrotado!`); if (b.target==='comp') b.target='foe'; }
    if (b.foe.hp < 0) b.foe.hp = 0;
    if (b.foe.hp <= 0 && b.companion && b.companion.alive){ b.target='comp'; }
    const foeDown = b.foe.hp<=0; const compDown = !b.companion || !b.companion.alive;
    if (foeDown && compDown){ b.foe.hp=0; b.over=true; b.win=true; blog(` ¡${b.foe.label} derrotado!`);
      const db=b.foeInfo.deathBlast; if(db){ blog(` ¡${b.foe.label} explota al morir! ${db} de daño a TODO el equipo.`); sfxBoomBig(); shakeEl(null,22,650); b.units.forEach(x=>{ if(x.alive){ x.hp-=db; if(x.hp<=0){x.hp=0;x.alive=false;} } }); }
      sfxVictory(); return; }
    if (u.alive){ berylliumSplit(u); }
    return;
  }
  const dmg = kind === 'ability' ? u.ability.dmg : u.atk;
  const nm = kind === 'ability' ? `${u.ability.name} ${u.ability.icon}` : 'Ataque ';
  const tgt = (b.companion && b.companion.alive && b.target==='comp') ? b.companion : b.foe;
  sfxSlash(); shakeEl();
  if (Math.random() < tgt.dodge){ blog(`${u.label} usa ${nm}…  ¡el ${tgt.label} esquivó! (0)`); }
  else { tgt.hp -= dmg; blog(`${u.label} usa ${nm} → ${dmg} de daño a ${tgt.label}.`); }
  if (kind === 'ability'){
    u.abilityReady = false;
    if (u.ability.selfDmg){ u.hp -= u.ability.selfDmg; blog(` ${u.label} pierde ${u.ability.selfDmg} HP por el esfuerzo.`); }
    if (u.ability.transform && COMBATANTS[u.ability.transform]){
      const newHp = u.ability.transformHp || 5; const t = COMBATANTS[u.ability.transform];
      blog(` ¡${u.label} se convierte en ${t.label} ${t.icon} (${newHp} HP)!`);
      u.key=t.key; u.label=(u.ownerName?u.ownerName+': ':'')+t.label; u.icon=t.icon; u.atk=t.atk; u.dodge=t.dodge; u.ability=t.ability;
      u.max=t.hp; u.hp=Math.min(newHp, t.hp); u.actCount=0;
    }
  }
  u.actCount++; u.abilityReady = (u.actCount % u.ability.every === (u.ability.every - 1));
  if (b.companion && b.companion.alive && b.companion.hp <= 0){
    b.companion.hp = 0; b.companion.alive = false;
    blog(` ¡El acompañante ${b.companion.label} fue derrotado!`);
    if (b.target === 'comp') b.target = 'foe';
  }
  if (b.foe.hp < 0) b.foe.hp = 0;
  if (b.foe.hp <= 0 && b.companion && b.companion.alive){ b.target = 'comp'; }
  const foeDown = b.foe.hp <= 0; const compDown = !b.companion || !b.companion.alive;
  if (foeDown && compDown){
    b.foe.hp = 0; b.over = true; b.win = true; blog(` ¡${b.foe.label} derrotado!`);
    const db = b.foeInfo.deathBlast;
    if(db){
      blog(` ¡${b.foe.label} explota al morir! ${db} de daño a TODO el equipo.`);
      sfxBoomBig(); shakeEl(null, 22, 650);
      b.units.forEach(x=>{ if(x.alive){ x.hp -= db; if(x.hp<=0){ x.hp=0; x.alive=false; } } });
    }
    sfxVictory();
  }
  if (u.hp <= 0){ u.hp = 0; u.alive = false; blog(` ${u.label} se debilitó.`); }
}
// Avanza al siguiente jugador; tras el último corre el turno del enemigo
function advanceGroupTurn(){
  const b = battle;
  if (b.over){ renderBattle(); return; }
  if (b.units.every(x=>!x.alive)){ b.over=true; b.win=false; blog(` Todas las unidades del grupo cayeron…`); renderBattle(); return; }
  let guard = 0;
  while (guard++ < (b.players.length + 2)){
    b.phaseIdx++;
    if (b.phaseIdx >= b.players.length){
      b.phaseIdx = -1; b.turnOwner = 'enemy';
      renderBattle();
      setTimeout(groupEnemyTurn, 550);
      return;
    }
    const pid = b.players[b.phaseIdx].id;
    if (b.units.some(x=>x.ownerId===pid && x.alive)){
      const ai = b.activeByOwner[pid];
      if (!(b.units[ai] && b.units[ai].ownerId===pid && b.units[ai].alive)){
        b.activeByOwner[pid] = b.units.findIndex(x=>x.ownerId===pid && x.alive);
      }
      b.turnOwner = pid;
      blog(` Turno de ${ (b.players.find(p=>p.id===pid)||{}).name || 'Jugador' }.`);
      renderBattle();
      return;
    }
  }
  b.phaseIdx = -1; b.turnOwner = 'enemy'; renderBattle(); setTimeout(groupEnemyTurn, 550);
}
// Turno del enemigo en batalla de grupo (ataca a unidades al azar del grupo)
function groupEnemyTurn(){
  const b = battle; if (!b || b.over){ if(b) renderBattle(); return; }
  // El Boro se cura si está muy herido
  if (b.companion !== undefined && b.foe.hp > 0 && b.foe.hp <= 10){
    const cands = [{label:b.foe.label, o:b.foe}];
    if (b.companion && b.companion.alive) cands.push({label:b.companion.label, o:b.companion});
    const pick = cands[Math.floor(Math.random()*cands.length)]; pick.o.hp = pick.o.max;
    blog(` ¡El ${b.foe.label} sana a ${pick.label} a vida completa!`); sfxBonus();
  }
  const fa = b.foeInfo.foeAbility;
  if (fa && fa.type==='aoe' && Math.random() < fa.chance){
    blog(`${fa.icon} ¡${b.foe.label} provoca ${fa.name}! ${fa.dmg} a TODO el equipo.`);
    sfxBoomSmall(); shakeEl();
    b.units.forEach(x=>{ if(x.alive){ if(x.immuneTurns>0){ blog(` ${x.label} es inmune. (0)`); } else { x.hp-=fa.dmg; if(x.hp<=0){ x.hp=0; x.alive=false; blog(` ${x.label} cayó por la explosión.`); } } } });
  } else {
    const foes = [];
    if (b.foe.hp > 0) foes.push({label:b.foe.label, atk:b.foe.atk});
    if (b.companion && b.companion.alive) foes.push({label:b.companion.label, atk:b.companion.atk});
    let attackers;
    if (b.companion !== undefined){ attackers = foes.filter(()=>Math.random()<0.7); if(!attackers.length && foes.length) attackers=[foes[Math.floor(Math.random()*foes.length)]]; }
    else attackers = foes;
    attackers.forEach(a => {
      const alive = b.units.filter(x=>x.alive); if(!alive.length) return;
      const tgt = alive[Math.floor(Math.random()*alive.length)];
      if (tgt.immuneTurns>0){ blog(` ¡Neutralizado! ${tgt.label} es inmune al ataque de ${a.label}. (0)`); return; }
      if (Math.random() < tgt.dodge){ blog(`${a.label} ataca a ${tgt.label}…  ¡esquivó! (0)`); return; }
      tgt.hp -= a.atk; blog(`${a.label} ataca → ${a.atk} de daño a ${tgt.label}.`); sfxHit(); shakeEl();
      if (tgt.hp<=0){ tgt.hp=0; tgt.alive=false; blog(` ${tgt.label} cayó…`); }
    });
  }
  b.units.forEach(x=>{ if(x.immuneTurns>0) x.immuneTurns--; });
  if (b.units.every(x=>!x.alive)){ b.over=true; b.win=false; blog(` Todas las unidades del grupo cayeron…`); renderBattle(); return; }
  b.turn++;
  b.phaseIdx = -1;
  advanceGroupTurn();
}
// Vista de la batalla de grupo (por turnos rotando por jugador)
function renderGroupBattle(){
  const b = battle;
  const me = myActiveUnit();
  const canAct = isMyGroupTurn() && me && me.alive;
  const turnTxt = b.over ? '' : (b.turnOwner === myId ? ' — ¡Es TU turno!' : ` — Turno de ${ownerName(b.turnOwner)}`);
  const hPct = Math.max(0, b.foe.hp / b.foe.max * 100);
  // Panel de mi unidad activa
  let mePanel;
  if (me){
    const pPct = Math.min(100, Math.max(0, me.hp / me.max * 100));
    const cab = COMBATANTS[me.key] ? COMBATANTS[me.key].ability : (me.ability||{icon:'',name:'',every:1});
    const meVisual = me.key === 'proton'
      ? `<img src="${avatarDataURL(me.avatar||state.avatar,3)}" style="width:64px;height:64px;background:#0a0e28;border-radius:8px;margin:6px 0;">`
      : (unitBall(me.key,64) ? `<div style="display:flex;justify-content:center;margin:6px 0;">${unitBall(me.key,64)}</div>`
        : `<div style="width:64px;height:64px;border-radius:12px;margin:6px auto;background:#0a0e28;display:flex;align-items:center;justify-content:center;font-size:1.8rem;">${me.icon}</div>`);
    mePanel = `<p><b>${me.icon} ${me.label.toUpperCase()}</b></p>${meVisual}
      <div style="background:#300;border-radius:8px;overflow:hidden;height:14px;"><div style="height:100%;width:${pPct}%;background:linear-gradient(90deg,#5be08a,#2fa55e);"></div></div>
      <p class="muted"> ${Math.max(0,me.hp)}/${me.max}</p>`;
  } else {
    mePanel = `<p class="muted">Todas tus unidades cayeron.</p>`;
  }
  // Botones de cambio (solo tus unidades vivas, solo en tu turno)
  const myIdx = (b.activeByOwner ? b.activeByOwner[myId] : -1);
  const switchBtns = b.units.map((x,i)=> (x.ownerId===myId && i!==myIdx) ?
    `<button class="btn ghost" ${(!x.alive||!canAct)?'disabled':''} onclick="switchUnit(${i})"> ${x.icon} ${x.label} ${x.alive?`${Math.max(0,x.hp)}`:'✕'}</button>` : ''
  ).join('');
  // Lista de todo el equipo (todas las unidades de todos los jugadores)
  const roster = b.units.map(x=>{
    const dead = !x.alive; const mine = x.ownerId===myId;
    const isTurnUnit = (b.activeByOwner && b.activeByOwner[x.ownerId]===b.units.indexOf(x) && b.turnOwner===x.ownerId);
    const bd = isTurnUnit ? 'border:1px solid var(--gold);' : 'border:1px solid var(--panel2);';
    return `<div style="${bd}${dead?'opacity:.4;':''}border-radius:6px;padding:3px 6px;font-size:.7rem;${mine?'background:#0a1030;':''}">${x.icon} ${x.label} ${dead?'✕':Math.max(0,x.hp)+'/'+x.max}</div>`;
  }).join('');
  // Acción
  let actionRow;
  if (b.over){
    if (groupBattle && groupBattle.host){ actionRow = `<button class="btn" onclick="endGroupBattleHost()">Continuar</button>`; }
    else { actionRow = `<p class="muted">Batalla terminada. Esperando al anfitrión…</p>`; }
  } else if (canAct){
    const cab = COMBATANTS[me.key] ? COMBATANTS[me.key].ability : me.ability;
    const ready = me.abilityReady;
    const cd = cab.every - (me.actCount % cab.every);
    const abLabel = ready ? `${cab.icon} ${cab.name}` : `${cab.icon} ${cab.name} ${cd}`;
    actionRow = `<button class="btn" onclick="pAct('attack')"> Ataque [1]</button>
      <button class="btn alt" ${ready?'':'disabled'} onclick="pAct('ability')">${abLabel} [2]</button>`;
  } else {
    actionRow = `<p class="muted"> Turno de ${ownerName(b.turnOwner)}… espera tu turno.</p>`;
  }
  openModal(`
    <h2 style="text-align:center;"> Batalla de grupo — Ronda ${b.turn}${turnTxt}</h2>
    <div class="row" style="justify-content:space-between; align-items:flex-start;">
      <div class="card" style="flex:1; text-align:center;">
        <p class="muted" style="font-size:.66rem;">TU UNIDAD</p>
        ${mePanel}
        ${switchBtns? `<div style="margin-top:8px; display:flex; flex-direction:column; gap:6px;"><p class="muted" style="font-size:.66rem;">Cambiar unidad:</p>${switchBtns}</div>` : ''}
      </div>
      <div style="align-self:center; font-size:1.4rem;">VS</div>
      <div class="card" style="flex:1; text-align:center;">
        ${b.companion ? `
        <div class="row" style="gap:8px; align-items:stretch; justify-content:center;">
          ${foeBox(b.foe, b.foeInfo, {selected:(b.target!=='comp'), tkey:'foe', over:b.over, spectator:!canAct})}
          ${foeBox(b.companion, b.foeInfo, {selected:(b.target==='comp'), tkey:'comp', over:b.over, spectator:!canAct})}
        </div>` : `
        <p><b>${b.foe.icon} ${b.foe.label.toUpperCase()}</b></p>
        <div style="width:70px;height:70px;border-radius:50%;margin:8px auto;background:${b.foeInfo.gradient};display:flex;align-items:center;justify-content:center;font-weight:800;color:${b.foeInfo.textColor};">${b.foeInfo.letter}</div>
        <div style="background:#003;border-radius:8px;overflow:hidden;height:14px;"><div style="height:100%;width:${hPct}%;background:linear-gradient(90deg,#5be08a,#2fa55e);"></div></div>
        <p class="muted"> ${Math.max(0,b.foe.hp)}/${b.foe.max}</p>`}
      </div>
    </div>
    <div style="margin-top:10px; display:flex; flex-wrap:wrap; gap:5px; justify-content:center;">${roster}</div>
    <div id="log" style="margin-top:12px;">${b.log.map(l => `<div>${l}</div>`).join('')}</div>
    <div class="row" style="justify-content:center; margin-top:12px;">
      ${actionRow}
    </div>`);
  const lg = document.getElementById('log'); if (lg) lg.scrollTop = lg.scrollHeight;
  broadcastBattle();
}
function startGroupBattle(d){
  closeModal();
  battleActive = true;
  const amHost = d.hostId === myId;
  const size = d.size || (d.members ? d.members.length : 1);
  groupBattle = { host: amHost, hostId: d.hostId, size };
  socket.emit('emote', ' ¡batalla de grupo!');
  if (amHost){
    const foeType = WILD_FOES[d.foeType] ? d.foeType : 'hydrogen';
    const f = WILD_FOES[foeType];
    let units = [];
    (d.members||[]).forEach(m => {
      const keys = (Array.isArray(m.keys) && m.keys.length) ? m.keys : ['proton'];
      keys.forEach(key => {
        const c = COMBATANTS[key]; if (!c) return;
        units.push({ key, label:(m.name? m.name+': ' : '')+c.label, icon:c.icon, hp:c.hp, max:c.hp,
          atk:c.atk, dodge:c.dodge, ability:c.ability, actCount:0, abilityReady:false, alive:true,
          negateNext:false, immuneTurns:0, ownerId:m.id, ownerName:m.name||'', avatar:(key==='proton'? (m.avatar||null) : null) });
      });
    });
    if (units.length === 0){
      const c = COMBATANTS.proton;
      units = [{ key:'proton', label:c.label, icon:c.icon, hp:c.hp, max:c.hp, atk:c.atk, dodge:c.dodge, ability:c.ability, actCount:0, abilityReady:false, alive:true, negateNext:false, immuneTurns:0, ownerId:d.hostId, ownerName:'', avatar:state.avatar }];
    }
    // Orden de jugadores: el anfitrión primero, luego el resto en orden de llegada
    const players = [];
    const seenP = {};
    const hostName = ((d.members||[]).find(m=>m.id===d.hostId)||{}).name || 'Anfitrión';
    players.push({ id:d.hostId, name:hostName }); seenP[d.hostId]=1;
    (d.members||[]).forEach(m => { if(!seenP[m.id]){ players.push({ id:m.id, name:m.name||'Jugador' }); seenP[m.id]=1; } });
    // índice de la unidad activa por jugador (primera viva de cada dueño)
    const activeByOwner = {};
    players.forEach(p => { const i = units.findIndex(u=>u.ownerId===p.id && u.alive); activeByOwner[p.id] = (i<0?0:i); });
    const fhp = f.hp * size;
    const names = (d.members||[]).map(m => m.name).join(', ');
    battle = {
      foeType, foeInfo:f, units, active:0,
      foe:{ hp:fhp, max:fhp, atk:f.atk, dodge:f.dodge, label:f.label, icon:f.icon },
      turn:1, over:false, win:false, group:true,
      players, phaseIdx:0, turnOwner:players[0].id, activeByOwner, target:'foe',
      log:[` ¡Un ${f.label} salvaje (×${size}) apareció! El grupo (${names}) lo enfrenta juntos.`]
    };
    if (f.companion){
      const pool = ['hydrogen','helium','lithium'];
      const ck = pool[Math.floor(Math.random()*pool.length)];
      const cf = WILD_FOES[ck];
      battle.companion = { hp:cf.hp, max:cf.hp, atk:cf.atk, dodge:cf.dodge, label:cf.label,
        letter:cf.letter, gradient:cf.gradient, textColor:cf.textColor, icon:cf.icon, alive:true };
      blog(` El ${f.label} viene acompañado de un ${cf.label} ${cf.letter}. ¡Dos enemigos!`);
    }
    blog(` Turno de ${players[0].name}.`);
    renderBattle();
    broadcastBattle();
  } else {
    battle = null;
    openModal(`<h2 style="text-align:center;"> Batalla de grupo</h2><p class="muted" style="text-align:center; margin-top:8px;">Tu grupo entró en combate. Espera la sincronización…</p>`);
  }
}
function applyGroupBattleSync(d){
  if (!groupBattle || groupBattle.host || !d || !d.b) return;
  const s = d.b;
  const foeType = WILD_FOES[s.foeType] ? s.foeType : 'hydrogen';
  const f = WILD_FOES[foeType];
  battle = {
    foeType, foeInfo:f, units:s.units, active:s.active,
    foe:{ hp:s.foe.hp, max:s.foe.max, atk:f.atk, dodge:f.dodge, label:s.foe.label, icon:s.foe.icon },
    companion: s.companion ? Object.assign({}, s.companion) : undefined,
    target: s.target || 'foe',
    turn:s.turn, over:s.over, win:s.win, group:true,
    players: s.players || [], turnOwner: s.turnOwner || null,
    phaseIdx: s.phaseIdx, activeByOwner: s.activeByOwner || {},
    log:s.log
  };
  battleActive = true;
  renderBattle();
}
function endGroupBattleHost(){
  if (!battle) return;
  const win = battle.win;
  const foeType = battle.foeType;
  giveWildReward(foeType, win);
  socket.emit('group-battle-end', { win, foeType });
  battleActive = false; groupBattle = null; battle = null; closeModal();
  socket.emit('emote', win ? ' ¡ganamos!' : '');
  sendStats();
  if (inWorld) startWorldLoop();
  refreshHUD();
}
function endGroupBattleRemote(d){
  const win = !!(d && d.win);
  const foeType = d && d.foeType;
  if (foeType) giveWildReward(foeType, win);
  toast(win ? ' ¡El grupo ganó la batalla!' : ' El grupo fue derrotado…');
  battleActive = false; groupBattle = null; battle = null; closeModal();
  if (inWorld) startWorldLoop();
  refreshHUD();
}

/* =================================================
   INVENTARIO (E) — estadísticas + fabricación
================================================= */
function openInventory(){
  const canProton  = state.quarks.up >= 2 && state.quarks.down >= 1;
  const canNeutron = state.quarks.down >= 2 && state.quarks.up >= 1;
  const canHydro   = state.protons >= 1 && state.electrons >= 1;
  const canHelium  = state.protons >= 2 && state.neutrons >= 2 && state.electrons >= 2;
  const lvl4       = getLevel() >= 4;
  const canLithium = lvl4 && state.protons >= 3 && state.neutrons >= 4 && state.electrons >= 3;
  const lvl5       = getLevel() >= 5;
  const canBeryllium = lvl5 && state.protons >= 4 && state.neutrons >= 5 && state.electrons >= 4;
  // Tarjetas equipables (protones, neutrones, electrones y átomos que tengas)
  const equipCards = ['proton','neutron','electron','hydrogen','helium','lithium','beryllium'].filter(key => ownedCount(key) >= 1).map(key => {
    const c = COMBATANTS[key];
    const n = ownedCount(key);
    const inParty = Array.isArray(state.party) && state.party.includes(key);
    const slot = inParty ? (state.party.indexOf(key)+1) : 0;
    const border = inParty ? 'border-color:var(--gold);' : '';
    return `<div class="card" style="flex:1; min-width:130px; text-align:center; background:#0a0e28; ${border}cursor:pointer;" onclick="toggleParty('${key}')">
      <div style="height:40px;display:flex;align-items:center;justify-content:center;">${unitBall(key,36) || `<span style="font-size:1.8rem;">${c.icon}</span>`}</div>
      <p><b>${c.label}</b> ×${n}</p>
      <p style="font-size:.72rem; margin-top:2px; color:var(--muted);">${c.hp} · ${c.atk} · ${c.ability.icon}${(c.ability.immune||c.ability.healAll||c.ability.fission)?`${c.ability.name}/${c.ability.every}t`:`${c.ability.dmg}/${c.ability.every}t`}</p>
      <p style="font-size:.8rem; margin-top:4px; color:${inParty?'var(--gold)':'var(--muted)'};">${inParty?` Equipo #${slot}`:'Click para añadir'}</p>
    </div>`;
  }).join('') || '<p class="muted">Aún no posees combatientes.</p>';
  openModal(`
    <div class="row" style="justify-content:space-between;"><h2 style="margin:0;"> Inventario</h2><button class="btn ghost" onclick="closeModal()"></button></div>
    <div class="row" style="margin-top:12px; gap:14px; align-items:center;">
      <img src="${avatarDataURL(state.avatar,3)}" style="width:70px;height:70px;background:#0a0e28;border-radius:10px;">
      <div><p><b>Tu héroe</b></p><p class="muted">Pasos: ${state.steps} · Victorias: ${state.wins} · Equipado: <b>${COMBATANTS[state.equipped]?COMBATANTS[state.equipped].icon+' '+COMBATANTS[state.equipped].label:'—'}</b></p></div>
    </div>

    <div class="card" style="margin-top:12px;">
      <p style="color:var(--accent);"><b> Equipo de batalla</b> <span class="muted" style="font-size:.85rem;">(Nivel ${getLevel()} · EXP ${state.exp} · llevas ${maxParty()} unidad${maxParty()>1?'es':''})</span></p>
      <p class="muted" style="font-size:.8rem; margin-top:2px;">${getLevel()<2? 'Alcanza <b>100 EXP</b> para llegar al Nivel 2 y llevar 2 unidades.' : 'En batalla luchas con una unidad; puedes <b>Cambiar</b> a otra, pero cuesta el turno.'}</p>
      <div class="row" style="margin-top:10px; gap:10px; align-items:stretch; flex-wrap:wrap;">${equipCards}</div>
    </div>

    <div class="row" style="margin-top:12px; gap:12px; align-items:stretch;">

      <div class="card" style="flex:1; min-width:170px; line-height:1.8;">
        <p style="color:var(--accent);"><b> Estadísticas</b></p>
        <p> <b class="gold">${state.Q} Q</b> ·  EXP <b>${state.exp}</b></p>
        <div style="margin:4px 0 10px;">
          <div style="display:flex; justify-content:space-between; font-size:.78rem; color:var(--muted);">
            <span> Nivel ${getLevel()}</span>
            <span>${(state.exp-expForLevel(getLevel()))}/${(expForLevel(getLevel()+1)-expForLevel(getLevel()))} → Nivel ${getLevel()+1}</span>
          </div>
          <div style="background:#0a0e28; border:1px solid var(--panel2); border-radius:8px; overflow:hidden; height:14px; margin-top:4px;">
            <div style="height:100%; width:${Math.round((state.exp-expForLevel(getLevel()))/(expForLevel(getLevel()+1)-expForLevel(getLevel()))*100)}%; background:linear-gradient(90deg,#ffd76a,#ff9d3b); transition:.3s;"></div>
          </div>
        </div>
        ${state.quarks.up>0?`<p> Quark Up: <b>${state.quarks.up}</b></p>`:''}
        ${state.quarks.down>0?`<p> Quark Down: <b>${state.quarks.down}</b></p>`:''}
        ${state.protons>0?`<p> Protones: <b>${state.protons}</b></p>`:''}
        ${state.neutrons>0?`<p> Neutrones: <b>${state.neutrons}</b></p>`:''}
        ${state.electrons>0?`<p> Electrones: <b>${state.electrons}</b></p>`:''}
        ${state.atoms.hydrogen>0?`<p> Hidrógeno: <b>${state.atoms.hydrogen}</b></p>`:''}
        ${state.atoms.helium>0?`<p> Helio: <b>${state.atoms.helium}</b></p>`:''}
        ${state.atoms.lithium>0?`<p> Litio: <b>${state.atoms.lithium}</b></p>`:''}
        ${state.atoms.beryllium>0?`<p> Berilio: <b>${state.atoms.beryllium}</b></p>`:''}
        ${(state.luckPotions||0)>0?`<p> Poción de suerte x2: <b>${state.luckPotions}</b></p>`:''}
        ${luckActive()?`<p style="color:#7ad67f;"> Suerte x2 activa: <b>${luckRemainStr()}</b></p>`:''}
        ${(state.luckPotions||0)>0?`<button class="btn alt" style="margin-top:8px;" onclick="useLuckPotion()">Usar poción de suerte (+5:00)</button>`:''}
      </div>

      <div class="card" style="flex:1; min-width:180px;">
        <p style="color:var(--accent);"><b> Fabricación de partículas</b></p>
        <div class="card" style="margin-top:10px; background:#0a0e28;">
          <p><b> Protón</b></p>
          <button class="btn" style="margin-top:8px;" onclick="makeParticle('proton')">Fabricar</button>
        </div>
        <div class="card" style="margin-top:10px; background:#0a0e28;">
          <p><b> Neutrón</b></p>
          <button class="btn" style="margin-top:8px;" onclick="makeParticle('neutron')">Fabricar</button>
        </div>
      </div>

      <div class="card" style="flex:1; min-width:180px;">
        <p style="color:var(--accent);"><b> Fabricación de átomos</b></p>
        <div class="card" style="margin-top:10px; background:#0a0e28;">
          <p><b> Hidrógeno</b></p>
          <p class="muted" style="font-size:.72rem;">1 Protón + 1 Electrón</p>
          <button class="btn alt" style="margin-top:8px;" ${canHydro?'':'disabled'} onclick="makeAtom('hydrogen')">Crear átomo</button>
        </div>
        <div class="card" style="margin-top:10px; background:#0a0e28;">
          <p><b> Helio</b></p>
          <p class="muted" style="font-size:.72rem;">2 Protones + 2 Neutrones + 2 Electrones</p>
          <button class="btn alt" style="margin-top:8px;" ${canHelium?'':'disabled'} onclick="makeAtom('helium')">Crear átomo</button>
        </div>
        <div class="card" style="margin-top:10px; background:#0a0e28;">
          <p><b> Litio</b> <span class="muted" style="font-size:.7rem;">(Nivel 4)</span></p>
          <p class="muted" style="font-size:.72rem;">3 Protones + 4 Neutrones + 3 Electrones</p>
          ${lvl4 ? `<button class="btn alt" style="margin-top:8px;" ${canLithium?'':'disabled'} onclick="makeAtom('lithium')">Crear átomo</button>` : `<p class="gold" style="font-size:.72rem; margin-top:6px;">Alcanza el Nivel 4 para fabricar Litio.</p>`}
        </div>
        <div class="card" style="margin-top:10px; background:#0a0e28;">
          <p><b> Berilio</b> <span class="muted" style="font-size:.7rem;">(Nivel 5)</span></p>
          <p class="muted" style="font-size:.72rem;">4 Protones + 5 Neutrones + 4 Electrones</p>
          <p class="muted" style="font-size:.68rem;">40 HP · 20 ataque · Fisión c/5t: 80 a enemigos, 10 a todo el equipo, luego se divide en 2 Helios a media vida</p>
          ${lvl5 ? `<button class="btn alt" style="margin-top:8px;" ${canBeryllium?'':'disabled'} onclick="makeAtom('beryllium')">Crear átomo</button>` : `<p class="gold" style="font-size:.72rem; margin-top:6px;">Alcanza el Nivel 5 (400 EXP) para fabricar Berilio.</p>`}
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
  } else if (kind === 'helium'){
    if (state.protons < 2 || state.neutrons < 2 || state.electrons < 2) return;
    state.protons -= 2; state.neutrons -= 2; state.electrons -= 2; state.atoms.helium += 1;
  } else if (kind === 'lithium'){
    if (getLevel() < 4) return;
    if (state.protons < 3 || state.neutrons < 4 || state.electrons < 3) return;
    state.protons -= 3; state.neutrons -= 4; state.electrons -= 3;
    if (state.atoms.lithium == null) state.atoms.lithium = 0;
    state.atoms.lithium += 1;
  } else if (kind === 'beryllium'){
    if (getLevel() < 5) return;
    if (state.protons < 4 || state.neutrons < 5 || state.electrons < 4) return;
    state.protons -= 4; state.neutrons -= 5; state.electrons -= 4;
    if (state.atoms.beryllium == null) state.atoms.beryllium = 0;
    state.atoms.beryllium += 1;
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
    Q:state.Q, quarks:{...state.quarks}, equipped: state.equipped, party:[...(state.party||[])],
    protons:state.protons, neutrons:state.neutrons, electrons:state.electrons,
    atoms:{...state.atoms}, exp:state.exp, steps:state.steps, wins:state.wins,
    luckPotions:state.luckPotions||0 };
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
  state.atoms = d.atoms || { hydrogen:0, helium:0 };
  if (state.atoms.helium == null) state.atoms.helium = 0;
  if (state.atoms.lithium == null) state.atoms.lithium = 0;
  if (state.atoms.beryllium == null) state.atoms.beryllium = 0;
  state.equipped = d.equipped && COMBATANTS[d.equipped] ? d.equipped : 'proton';
  state.party = Array.isArray(d.party) ? d.party.filter(k=>COMBATANTS[k]) : (d.equipped && COMBATANTS[d.equipped] ? [d.equipped] : ['proton']);
  state.exp = (typeof d.exp === 'number') ? d.exp : (d.rewards ? (d.rewards.exp || 0) : 0);
  state.steps = d.steps || 0;
  state.wins = d.wins || 0;
  state.luckPotions = d.luckPotions || 0;
  state.luckUntil = 0;   // el cronómetro de suerte no se conserva entre sesiones
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
    info = idDisp + nameDisp + '<br> ' + new Date(meta.ts).toLocaleString();
  }
  slots += `<div class="card" style="margin-top:10px;${isActive ? ' border-color:var(--gold);' : ''}"><div class="row" style="justify-content:space-between; align-items:center; gap:10px;">
    <div><b>${isActive ? ' ' : ''}Cuenta ${n}</b>${isActive ? ' (activa)' : ''}<br><span class="muted" style="font-size:.85rem;">${info}</span></div>
    <div class="row"><button class="btn" onclick="saveToSlot(${n})"> Guardar</button><button class="btn ghost" onclick="loadFromFile(${n})"> Cargar</button><button class="btn alt" ${meta ? '' : 'disabled'} onclick="deleteSlot(${n})"> Borrar</button></div>
  </div></div>`;
  }
  const activeInfo = state.accountId ? `Cuenta activa: ID <b>${state.accountId}</b>${state.name ? ' · '+state.name : ''}` : 'Ninguna cuenta activa';
  openModal(`
    <div class="row" style="justify-content:space-between;"><h2 style="margin:0;"> Cuentas</h2><button class="btn ghost" onclick="closeModal()"></button></div>
    <p class="muted" style="margin-top:6px;">${activeInfo}</p>
    <p class="muted" style="margin-top:4px;">Puedes tener hasta <b>3 cuentas</b>. Cada una tiene un <b>ID único</b>. Al <b>Guardar</b> se descarga un archivo .txt con todos tus datos e ID. Al <b>Cargar</b> un archivo, regresas a esa cuenta original.</p>
    ${slots}
  `);
}

/* =================================================
   GRUPO (co-op): invitación con J y batalla en equipo
================================================= */
function myPartyKeys(){
  normalizeParty();
  let party = (state.party||[]).filter(k => COMBATANTS[k] && ownedCount(k) >= 1).slice(0, maxParty());
  if (party.length === 0){
    const k = ['proton','neutron','electron','hydrogen'].find(k => ownedCount(k) >= 1) || 'proton';
    party = [k];
  }
  return party;
}
function sendLoadout(){ if (inWorld) socket.emit('loadout', { keys: myPartyKeys() }); }

function handleGroupKey(){
  if (!inWorld || battleActive || document.getElementById('modal')) return;
  if (tradeSelectedId && others[tradeSelectedId]){ sendGroupInvite(tradeSelectedId); return; }
  showGroupPanel();
}
function sendGroupInvite(id){
  if (!inWorld || battleActive) return;
  if (!others[id]){ toast('Ese jugador ya no está aquí.'); return; }
  if (myGroup.length >= 3){ toast('Tu grupo ya está lleno (máx 3).'); return; }
  socket.emit('group-invite', { targetId: id });
  toast(' Invitación de grupo enviada…');
}
function showGroupInvitePrompt(d){
  groupInviteFrom = d;
  openModal(`
    <h2 style="text-align:center;"> ${escapeHtml(d.fromName || 'Un jugador')} te invita a su grupo</h2>
    <p class="muted" style="text-align:center; margin-top:8px;">En grupo (máx 3) pelean juntos: si un miembro entra en batalla, entran todos. El enemigo será más fuerte, pero las recompensas son para todos.</p>
    <p style="text-align:center; margin-top:6px;" id="ginvtimer" class="gold">Responde en 30s…</p>
    <div class="row" style="justify-content:center; margin-top:14px; gap:12px;">
      <button class="btn" onclick="acceptGroup()"> Aceptar</button>
      <button class="btn ghost" onclick="declineGroup()"> Rechazar</button>
    </div>`);
  let left = 30;
  if (groupInviteTimer) clearInterval(groupInviteTimer);
  groupInviteTimer = setInterval(() => {
    left--;
    const t = document.getElementById('ginvtimer'); if (t) t.textContent = 'Responde en ' + left + 's…';
    if (left <= 0) declineGroup();
  }, 1000);
}
function clearGroupInvite(){ if (groupInviteTimer){ clearInterval(groupInviteTimer); groupInviteTimer = null; } groupInviteFrom = null; }
function acceptGroup(){ if (!groupInviteFrom) return; sendLoadout(); socket.emit('group-accept'); clearGroupInvite(); closeModal(); }
function declineGroup(){ if (!groupInviteFrom){ closeModal(); return; } socket.emit('group-decline'); clearGroupInvite(); closeModal(); toast('Rechazaste la invitación de grupo.'); }
function leaveGroupNow(){ socket.emit('group-leave'); myGroup = []; closeModal(); toast('Saliste del grupo.'); }
function showGroupPanel(){
  const members = myGroup.length ? myGroup.map(m => `<li> ${escapeHtml(m.name)}${m.id===myId?' (tú)':''}</li>`).join('') : '<li class="muted">Estás solo. Selecciona a un jugador en el mapa (clic) y pulsa J para invitarlo.</li>';
  openModal(`
    <div class="row" style="justify-content:space-between;"><h2 style="margin:0;"> Grupo (máx 3)</h2><button class="btn ghost" onclick="closeModal()"></button></div>
    <p class="muted" style="margin-top:6px;">Selecciona a otro jugador con un clic en el mapa y pulsa <b>J</b> para invitarlo. En batalla peleais juntos y el enemigo es más fuerte (vida × número de jugadores).</p>
    <ul style="margin-top:10px; line-height:1.8;">${members}</ul>
    ${myGroup.length >= 2 ? '<div class="row" style="justify-content:center; margin-top:12px;"><button class="btn ghost" onclick="leaveGroupNow()"> Salir del grupo</button></div>' : ''}
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
        <button class="btn alt" ${dis} onclick="sendPvpInvite('${id}')"> Retar</button>
      </div></div>`;
    }).join('');
  }
  const cdNote = cd > 0 ? `<p class="gold" style="margin-top:8px;"> Espera ${cd}s para enviar otra solicitud (tu último reto fue rechazado).</p>` : '';
  openModal(`
    <div class="row" style="justify-content:space-between;"><h2 style="margin:0;"> 1 vs 1 — Jugadores conectados</h2><button class="btn ghost" onclick="closeModal()"></button></div>
    <p class="muted" style="margin-top:6px;">Reta a otro jugador. Si acepta, pelean con el combatiente que cada uno tenga equipado. Si rechaza, esperarás 30 segundos antes de poder enviar otra solicitud.</p>
    ${cdNote}
    ${rows}
    <p class="muted" style="margin-top:10px;">Pulsa <b>P</b> o  para cerrar.</p>
  `);
  if (cd > 0){ if (pvpListTimer) clearTimeout(pvpListTimer); pvpListTimer = setTimeout(() => { if (document.getElementById('modal')) openPvpList(); }, 1000); }
}

function sendPvpInvite(id){
  if (Date.now() < pvpCooldownUntil){ toast(' Aún estás en tiempo de espera.'); return; }
  socket.emit('pvp-invite', { targetId: id });
  toast(' Solicitud enviada. Esperando respuesta…');
  closeModal();
}

function showPvpInvitePrompt(d){
  pvpInviteFrom = d;
  const foeC = COMBATANTS[d.fromKey] || COMBATANTS.proton;
  openModal(`
    <h2 style="text-align:center;"> ¡Reto de ${escapeHtml(d.fromName || 'Jugador')}!</h2>
    <p class="muted" style="text-align:center; margin-top:8px;">Te desafía a un 1 vs 1. Su combatiente equipado es ${foeC.icon} <b>${foeC.label}</b>.</p>
    <p style="text-align:center; margin-top:6px;" id="invtimer" class="gold">Responde en 30s…</p>
    <div class="row" style="justify-content:center; margin-top:14px; gap:12px;">
      <button class="btn" onclick="acceptPvp()"> Aceptar</button>
      <button class="btn ghost" onclick="declinePvp()"> Rechazar</button>
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
  normalizeParty();
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
    me:  { hp:meC.hp, max:meC.hp, atk:meC.atk, dodge:meC.dodge, ability:meC.ability, icon:meC.icon, label:meC.label, negateNext:false, immuneTurns:0 },
    foe: { hp:foeC.hp, max:foeC.hp, atk:foeC.atk, dodge:foeC.dodge, ability:foeC.ability, icon:foeC.icon, label:foeC.label },
    myTurn: !!d.youFirst, pturns:0, ready:false, over:false, win:false, ended:false,
    log:[` ¡Batalla PVP contra ${d.oppName || 'Rival'}! Tu ${meC.label} ${meC.icon} vs ${foeC.label} ${foeC.icon}.`, d.youFirst ? ' Empiezas tú.' : ' Empieza tu rival.']
  };
  battleActive = true;
  renderPvpBattle();
}
function pvplog(m){ if (!pvp) return; pvp.log.push(m); if (pvp.log.length > 20) pvp.log.shift(); }
function finishPvp(){
  if (!pvp || pvp.ended) return; pvp.ended = true;
  socket.emit('pvp-end');
  if (pvp.win){ const lb = getLevel(); state.wins++; state.Q += 2; state.exp += 10; pvplog(' Recompensa PVP: +2 Q ·  +10 EXP'); if (getLevel() > lb){ pvplog(` ¡Subiste al Nivel ${getLevel()}!`); sfxLevelUp(); } }
  sendStats();
}
function endPvpBattle(){ battleActive = false; pvp = null; closeModal(); if (inWorld) startWorldLoop(); refreshHUD(); }
function pvpRematch(){
  const oid = pvp ? pvp.oppId : null;
  endPvpBattle();
  if (oid){ sendPvpInvite(oid); toast(' Solicitud de revancha enviada…'); }
}

function pvpAct(kind){
  if (!pvp || pvp.over || !pvp.myTurn) return;
  if (kind === 'ability' && !pvp.ready) return;
  if (kind === 'ability' && pvp.me.ability.immune){
    // habilidad defensiva: inmune a los próximos ataques del rival
    pvp.me.immuneTurns = pvp.me.ability.immuneTurns || 3;
    pvplog(` Usas ${pvp.me.ability.name} — serás inmune a los próximos ${pvp.me.immuneTurns} ataques de ${pvp.oppName}.`);
    socket.emit('pvp-action', { kind, dmg: 0, dodged: false, meHp: pvp.me.hp, meMax: pvp.me.max, transformKey: null, negate: true });
    pvp.pturns++;
    pvp.myTurn = false;
    pvp.ready = (pvp.pturns % pvp.me.ability.every === (pvp.me.ability.every - 1));
    renderPvpBattle();
    return;
  }
  if (kind === 'ability' && pvp.me.ability.healAll){
    // habilidad de apoyo en PVP: te sanas a ti mismo
    const amt = pvp.me.ability.healAll;
    const old = Math.max(0, pvp.me.hp);
    pvp.me.hp += amt;
    pvplog(` Usas ${pvp.me.ability.name} — te sanas: ${old}HP+${amt}HP.`);
    socket.emit('pvp-action', { kind, dmg: 0, dodged: true, meHp: pvp.me.hp, meMax: pvp.me.max, transformKey: null });
    pvp.pturns++;
    pvp.myTurn = false;
    pvp.ready = (pvp.pturns % pvp.me.ability.every === (pvp.me.ability.every - 1));
    renderPvpBattle();
    return;
  }
  const dodged = Math.random() < pvp.foe.dodge;
  const dmg = dodged ? 0 : (kind === 'ability' ? pvp.me.ability.dmg : pvp.me.atk);
  const nm = kind === 'ability' ? `${pvp.me.ability.name} ${pvp.me.ability.icon}` : 'Ataque ';
  sfxSlash(); shakeEl();
  if (dodged) pvplog(`Usas ${nm}…  ¡${pvp.oppName} esquivó! (0)`);
  else { pvp.foe.hp -= dmg; pvplog(`Usas ${nm} → ${dmg} de daño a ${pvp.oppName}.`); }
  let transformKey = null;
  if (kind === 'ability'){
    if (pvp.me.ability.selfDmg){
      pvp.me.hp -= pvp.me.ability.selfDmg;
      pvplog(` Tu ${pvp.me.label} pierde ${pvp.me.ability.selfDmg} HP por la habilidad.`);
    }
    if (pvp.me.ability.transform && COMBATANTS[pvp.me.ability.transform]){
      const newHp = pvp.me.ability.transformHp || 5;
      const t = COMBATANTS[pvp.me.ability.transform];
      pvplog(` ¡Tu ${pvp.me.label} se convierte en ${t.label} ${t.icon} (${newHp} HP)!`);
      pvp.me.key=t.key; pvp.meKey=t.key; pvp.me.label=t.label; pvp.me.icon=t.icon;
      pvp.me.atk=t.atk; pvp.me.dodge=t.dodge; pvp.me.ability=t.ability;
      pvp.me.max=t.hp; pvp.me.hp=Math.min(newHp, t.hp);
      transformKey = t.key;
    }
  }
  socket.emit('pvp-action', { kind, dmg, dodged, meHp: pvp.me.hp, meMax: pvp.me.max, transformKey });
  pvp.pturns++;
  pvp.myTurn = false;
  if (pvp.foe.hp <= 0){ pvp.foe.hp = 0; pvp.over = true; pvp.win = true; pvplog(` ¡Derrotaste a ${pvp.oppName}!`); sfxVictory(); finishPvp(); renderPvpBattle(); return; }
  if (pvp.me.hp <= 0){ pvp.me.hp = 0; pvp.over = true; pvp.win = false; pvplog(` Tu ${pvp.me.label} cayó por el esfuerzo… ${pvp.oppName} gana.`); finishPvp(); renderPvpBattle(); return; }
  pvp.ready = (pvp.pturns % pvp.me.ability.every === (pvp.me.ability.every - 1));
  renderPvpBattle();
}
function applyPvpAction(d){
  if (!pvp || pvp.over) return;
  const nm = (d && d.kind === 'ability') ? 'una habilidad' : 'un ataque';
  if (pvp.me.immuneTurns > 0 && !(d && d.negate)){
    pvp.me.immuneTurns--;
    pvplog(` ¡Neutralizado! Tu ${pvp.me.label} es inmune a ${nm} de ${pvp.oppName}. (0)`);
  } else if (d && d.dodged){ pvplog(`${pvp.oppName} usa ${nm}…  ¡tu ${pvp.me.label} esquivó! (0)`); }
  else { pvp.me.hp -= (d ? d.dmg : 0); pvplog(`${pvp.oppName} usa ${nm} → ${d ? d.dmg : 0} de daño.`); sfxHit(); shakeEl(); }
  // Reflejar la transformación / auto-daño del rival en su barra
  if (d && d.transformKey && COMBATANTS[d.transformKey]){
    const t = COMBATANTS[d.transformKey];
    pvp.foe.key=t.key; pvp.foeKey=t.key; pvp.foe.label=t.label; pvp.foe.icon=t.icon;
    pvp.foe.atk=t.atk; pvp.foe.dodge=t.dodge; pvp.foe.ability=t.ability;
    pvplog(` ${pvp.oppName} se convierte en ${t.label} ${t.icon}.`);
  }
  if (d && typeof d.meMax === 'number') pvp.foe.max = d.meMax;
  if (d && typeof d.meHp === 'number') pvp.foe.hp = Math.max(0, d.meHp);
  if (pvp.me.hp <= 0){ pvp.me.hp = 0; pvp.over = true; pvp.win = false; pvplog(` Tu ${pvp.me.label} cayó… ${pvp.oppName} gana.`); finishPvp(); renderPvpBattle(); return; }
  if (pvp.foe.hp <= 0){ pvp.foe.hp = 0; pvp.over = true; pvp.win = true; pvplog(` ¡${pvp.oppName} se debilitó! Ganas.`); sfxVictory(); finishPvp(); renderPvpBattle(); return; }
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
    : (unitBall(b.meKey,70)
        ? `<div style="display:flex;justify-content:center;margin:8px 0;">${unitBall(b.meKey,70)}</div>`
        : `<div style="width:70px;height:70px;border-radius:12px;margin:8px auto;background:#0a0e28;display:flex;align-items:center;justify-content:center;font-size:2rem;">${b.me.icon}</div>`);
  const oppVisual = b.oppAvatar
    ? `<img src="${avatarDataURL(b.oppAvatar,3)}" style="width:70px;height:70px;background:#0a0e28;border-radius:8px;margin:8px auto;">`
    : (unitBall(b.foeKey,70)
        ? `<div style="display:flex;justify-content:center;margin:8px 0;">${unitBall(b.foeKey,70)}</div>`
        : `<div style="width:70px;height:70px;border-radius:12px;margin:8px auto;background:#0a0e28;display:flex;align-items:center;justify-content:center;font-size:2rem;">${b.foe.icon}</div>`);
  const banner = b.over ? '' : (b.myTurn ? '<p class="gold" style="text-align:center;margin-top:6px;"> ¡Tu turno!</p>' : `<p class="muted" style="text-align:center;margin-top:6px;"> Turno de ${escapeHtml(b.oppName)}…</p>`);
  openModal(`
    <h2 style="text-align:center;"> Batalla PVP vs ${escapeHtml(b.oppName)}</h2>
    <div class="row" style="justify-content:space-between; align-items:flex-start;">
      <div class="card" style="flex:1; text-align:center;">
        <p><b>${b.me.icon} ${b.me.label.toUpperCase()} (TÚ)</b></p>
        ${meVisual}
        <div style="background:#300;border-radius:8px;overflow:hidden;height:14px;"><div style="height:100%;width:${pPct}%;background:linear-gradient(90deg,#5be08a,#2fa55e);"></div></div>
        <p class="muted"> ${Math.max(0,b.me.hp)}/${b.me.max}</p>
      </div>
      <div style="align-self:center; font-size:1.4rem;">VS</div>
      <div class="card" style="flex:1; text-align:center;">
        <p><b>${b.foe.icon} ${escapeHtml(b.oppName)}</b></p>
        ${oppVisual}
        <div style="background:#003;border-radius:8px;overflow:hidden;height:14px;"><div style="height:100%;width:${oPct}%;background:linear-gradient(90deg,#5be08a,#2fa55e);"></div></div>
        <p class="muted"> ${Math.max(0,b.foe.hp)}/${b.foe.max}</p>
      </div>
    </div>
    ${banner}
    <div id="log" style="margin-top:12px;">${b.log.map(l => `<div>${l}</div>`).join('')}</div>
    <div class="row" style="justify-content:center; margin-top:14px;">
      ${b.over ? `<button class="btn alt" onclick="pvpRematch()"> Revancha</button> <button class="btn" onclick="endPvpBattle()"> Volver al mundo</button>` : `
        <button class="btn" ${canAttack ? '' : 'disabled'} onclick="pvpAct('attack')"> Ataque [1]</button>
        <button class="btn alt" ${canAbility ? '' : 'disabled'} onclick="pvpAct('ability')">${b.me.ability.icon} ${b.me.ability.name} [2] ${canAbility ? '' : ''}</button>`}
    </div>`);
  const lg = document.getElementById('log'); if (lg) lg.scrollTop = lg.scrollHeight;
}

/* ---------- INICIO ---------- */
sceneCreator();
