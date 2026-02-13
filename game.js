/* ===== STATE 2P V3: Territory + Buildings + VFX + Sounds ===== */

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d", { alpha: true });
const $ = (id) => document.getElementById(id);

const ui = {
  btnNew: $("btnNew"),
  btnPause: $("btnPause"),
  btnHelp: $("btnHelp"),
  toast: $("toast"),

  modal: $("modal"),
  modalTitle: $("modalTitle"),
  modalText: $("modalText"),
  btnModalA: $("btnModalA"),
  btnModalB: $("btnModalB"),

  actionMode: $("actionMode"),  // attack|transfer
  ruleMode: $("ruleMode"),      // classic|direct
  matchMode: $("matchMode"),    // friend|bot
  botBox: $("botBox"),
  botSelect: $("botSelect"),

  tapFrac: $("tapFrac"),
  tapFracVal: $("tapFracVal"),

  btnSound: $("btnSound"),
  vol: $("vol"),

  p1Nodes: $("p1Nodes"), p1Troops: $("p1Troops"), p1Sel: $("p1Sel"),
  p2Nodes: $("p2Nodes"), p2Troops: $("p2Troops"), p2Sel: $("p2Sel"),
  p2Label: $("p2Label"),

  p1All: $("p1All"), p1Clr: $("p1Clr"),
  p2All: $("p2All"), p2Clr: $("p2Clr"),

  p1UpType: $("p1UpType"), p2UpType: $("p2UpType"),
  p1Up: $("p1Up"), p2Up: $("p2Up"),
  p1UpCost: $("p1UpCost"), p2UpCost: $("p2UpCost"),
};

const OWNER = { NEU: 0, P1: 1, P2: 2 };

const COLORS = {
  p1: "#4ea3ff",
  p2: "#ff5a6b",
  neu: "#7d8596",
  line: "rgba(255,255,255,.10)",
  text: "rgba(255,255,255,.92)",
  muted: "rgba(255,255,255,.65)",
  ok: "rgba(120,255,170,.82)",
  bad: "rgba(255,110,130,.88)",
};

let DPR = 1, W = 0, H = 0;
function resize() {
  DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  W = Math.floor(canvas.clientWidth * DPR);
  H = Math.floor(canvas.clientHeight * DPR);
  canvas.width = W;
  canvas.height = H;
  buildStars();
}
window.addEventListener("resize", resize);

function cssToCanvas(v) { return v * DPR; }
function canvasToCss(v) { return v / DPR; }
function rand(a, b) { return Math.random() * (b - a) + a; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

function hexToRgb(hex) {
  const h = hex.replace("#", "").trim();
  const v = (h.length === 3) ? h.split("").map(c => c + c).join("") : h;
  const n = parseInt(v, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgba(hex, a) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
function shade(hex, amt) {
  const { r, g, b } = hexToRgb(hex);
  const f = (x) => amt >= 0 ? Math.round(x + (255 - x) * amt) : Math.round(x * (1 + amt));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}
function ownerHex(o) {
  if (o === OWNER.P1) return COLORS.p1;
  if (o === OWNER.P2) return COLORS.p2;
  return COLORS.neu;
}

// deterministic PRNG
function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/* ===== Audio (procedural, richer) ===== */
let audioOn = true, audioCtx = null;
function initAudio() {
  if (!audioOn) return;
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}
function tone(freq, dur, type = "sine", gain = 1.0) {
  if (!audioOn) return;
  initAudio();
  if (!audioCtx) return;
  const vol = parseFloat(ui.vol?.value || "0.35") * gain;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  const f = freq * (1 + rand(-0.010, 0.010)); // subtle variation
  o.type = type;
  o.frequency.value = f;

  g.gain.value = 0.0001;
  o.connect(g);
  g.connect(audioCtx.destination);

  const t0 = audioCtx.currentTime;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  o.start(t0);
  o.stop(t0 + dur + 0.03);
}
function chord(base, dur) {
  tone(base, dur, "sine", 0.9);
  setTimeout(() => tone(base * 1.25, dur * 0.9, "sine", 0.55), 18);
}
const sfx = {
  select() { tone(520, 0.06, "triangle"); },
  multi() { tone(760, 0.07, "triangle"); },
  send() { tone(360, 0.06, "sine"); },
  transfer() { tone(440, 0.06, "sine"); setTimeout(() => tone(660, 0.05, "triangle", 0.65), 40); },
  hit() { tone(210, 0.05, "square"); },
  cap() { chord(520, 0.11); },
  up() { tone(860, 0.07, "triangle"); setTimeout(() => tone(1120, 0.06, "triangle", 0.55), 45); },
  error() { tone(150, 0.09, "square"); },
  modal() { tone(300, 0.06, "triangle"); },
  win() { chord(660, 0.14); setTimeout(() => chord(880, 0.14), 140); },
};

/* ===== Settings ===== */
const SETTINGS = {
  nodeCount: 22,
  minNodeDist: 66,
  neighborK: 3,

  baseCap: 80,
  baseGrowth: 0.55,
  growthJitter: 0.12,

  baseSpeed: 430,
  payloadPerRocket: 6,
  maxRocketsPerBurst: 10,

  minKeep: 1,
  streamInterval: 0.22,
  burstBase: 5,

  longPressMs: 320,
  snapRadius: 54,

  curveAmount: 0.18,
  flowLife: 0.75,

  territoryScale: 1.25,   // blob size multiplier
  territoryPoints: 16,

  shakeDecay: 3.2,
};

const BOT_DIFF = {
  easy: { interval: 1.25, minTroops: 16, sendFrac: 0.48 },
  normal: { interval: 1.00, minTroops: 14, sendFrac: 0.55 },
  hard: { interval: 0.80, minTroops: 12, sendFrac: 0.62 },
};

/* ===== State ===== */
let paused = false;
let matchMode = "friend"; // friend|bot
let botDiff = "normal";
let ruleMode = "classic"; // classic|direct
let actionMode = "attack"; // attack|transfer

let nodes = [], edges = [], adj = [];
let rockets = [], particles = [], waves = [], flows = [];
let drags = new Map();
let winner = 0, toastTimer = 0, tAnim = 0, botAcc = 0;
let mouseActiveOwner = OWNER.P1;

let camShake = 0;

let selSet = { [OWNER.P1]: new Set(), [OWNER.P2]: new Set() };
let selPrimary = { [OWNER.P1]: -1, [OWNER.P2]: -1 };

/* ===== UI helpers ===== */
function showToast(msg) {
  if (!ui.toast) return;
  ui.toast.textContent = msg;
  ui.toast.classList.remove("hidden");
  toastTimer = 1.35;
}
function hideToast() { ui.toast?.classList.add("hidden"); }

function showModal(title, html, aText = "OK", bText = "Close", onA = null, onB = null) {
  if (!ui.modal) return;
  ui.modalTitle.textContent = title;
  ui.modalText.innerHTML = html;
  ui.btnModalA.textContent = aText;
  ui.btnModalB.textContent = bText;
  ui.btnModalA.onclick = () => { hideModal(); onA && onA(); };
  ui.btnModalB.onclick = () => { hideModal(); onB && onB(); };
  ui.modal.classList.remove("hidden");
  sfx.modal();
}
function hideModal() { ui.modal?.classList.add("hidden"); }
function modalOpen() { return ui.modal && !ui.modal.classList.contains("hidden"); }

function clearSelection(owner) { selSet[owner].clear(); selPrimary[owner] = -1; }
function setSingle(owner, id) { selSet[owner].clear(); selSet[owner].add(id); selPrimary[owner] = id; }
function toggleSel(owner, id) {
  if (selSet[owner].has(id)) {
    selSet[owner].delete(id);
    if (selPrimary[owner] === id) selPrimary[owner] = selSet[owner].size ? [...selSet[owner]].slice(-1)[0] : -1;
  } else {
    selSet[owner].add(id);
    selPrimary[owner] = id;
  }
}

/* ===== Graph ===== */
class UnionFind {
  constructor(n) { this.p = Array.from({ length: n }, (_, i) => i); this.r = Array(n).fill(0); }
  find(x) { while (this.p[x] !== x) { this.p[x] = this.p[this.p[x]]; x = this.p[x]; } return x; }
  union(a, b) {
    a = this.find(a); b = this.find(b);
    if (a === b) return false;
    if (this.r[a] < this.r[b]) [a, b] = [b, a];
    this.p[b] = a;
    if (this.r[a] === this.r[b]) this.r[a]++;
    return true;
  }
  components() { return new Set(this.p.map((_, i) => this.find(i))).size; }
}
let star = [];
function buildStars() {
  const n = Math.floor((W * H) / (cssToCanvas(180) * cssToCanvas(180)));
  const rng = mulberry32(1234567);
  star = [];
  for (let i = 0; i < n; i++) {
    star.push({
      x: rng() * W,
      y: rng() * H,
      a: 0.12 + rng() * 0.38,
      r: cssToCanvas(0.7 + rng() * 1.2),
      tw: rng() * 10
    });
  }
}
function addEdge(a, b) {
  if (a === b) return;
  const key = a < b ? `${a}-${b}` : `${b}-${a}`;
  if (edges.some(e => e.key === key)) return;
  edges.push({ key, a, b });
  adj[a].add(b); adj[b].add(a);
}
function ensureConnected() {
  const uf = new UnionFind(nodes.length);
  for (const e of edges) uf.union(e.a, e.b);
  while (uf.components() > 1) {
    let best = null;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        if (uf.find(i) === uf.find(j)) continue;
        const d = dist(nodes[i].x, nodes[i].y, nodes[j].x, nodes[j].y);
        if (!best || d < best.d) best = { i, j, d };
      }
    }
    if (!best) break;
    addEdge(best.i, best.j);
    uf.union(best.i, best.j);
  }
}

/* ===== Spawn ===== */
function genMap() {
  nodes = []; edges = []; rockets = []; particles = []; waves = []; flows = []; drags.clear();
  winner = 0; botAcc = 0; camShake = 0;
  hideModal(); hideToast();
  clearSelection(OWNER.P1); clearSelection(OWNER.P2);

  const topPad = cssToCanvas(90);
  const bottomPad = cssToCanvas(160);
  const margin = cssToCanvas(110);
  const minD = cssToCanvas(SETTINGS.minNodeDist);
  const r = cssToCanvas(20);

  let attempts = 0;
  while (nodes.length < SETTINGS.nodeCount && attempts < 9000) {
    attempts++;
    const x = rand(margin, W - margin);
    const y = rand(margin + topPad, H - margin - bottomPad);
    let ok = true;
    for (const n of nodes) { if (dist(x, y, n.x, n.y) < minD) { ok = false; break; } }
    if (!ok) continue;

    const seed = nodes.length * 97531 + 111;
    nodes.push({
      id: nodes.length,
      x, y, r,
      owner: OWNER.NEU,
      troops: Math.floor(rand(10, 18)),
      up: { cap: 0, grow: 0, spd: 0, shd: 0 },
      growthBase: SETTINGS.baseGrowth + rand(-SETTINGS.growthJitter, SETTINGS.growthJitter),
      shake: 0,
      blobSeed: seed,
    });
  }

  adj = Array.from({ length: nodes.length }, () => new Set());

  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];
    const neigh = [];
    for (let j = 0; j < nodes.length; j++) {
      if (i === j) continue;
      neigh.push({ j, d: dist(a.x, a.y, nodes[j].x, nodes[j].y) });
    }
    neigh.sort((p, q) => p.d - q.d);
    for (let t = 0; t < Math.min(SETTINGS.neighborK, neigh.length); t++) {
      addEdge(i, neigh[t].j);
    }
  }
  ensureConnected();

  // seed farthest pair
  let best = { a: 0, b: 1, d: -1 };
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const d = dist(nodes[i].x, nodes[i].y, nodes[j].x, nodes[j].y);
      if (d > best.d) best = { a: i, b: j, d };
    }
  }
  nodes[best.a].owner = OWNER.P1; nodes[best.b].owner = OWNER.P2;
  nodes[best.a].troops = 26; nodes[best.b].troops = 26;

  setSingle(OWNER.P1, best.a);
  setSingle(OWNER.P2, best.b);
}

/* ===== Rules / Stats ===== */
function cap(n) { return SETTINGS.baseCap + n.up.cap * 14; }
function growth(n) { return n.growthBase + n.up.grow * 0.20; }
function defense(n) { return n.up.shd * 0.08; }
function speedFrom(n) { return SETTINGS.baseSpeed * (1 + n.up.spd * 0.14); }

function findPath(fromId, toId) {
  if (fromId === toId) return [fromId];
  if (ruleMode === "direct") return [fromId, toId];

  const q = [fromId];
  const prev = Array(nodes.length).fill(-1);
  prev[fromId] = fromId;

  for (let qi = 0; qi < q.length; qi++) {
    const u = q[qi];
    for (const v of adj[u]) {
      if (prev[v] !== -1) continue;
      prev[v] = u;
      if (v === toId) {
        const path = [toId];
        let cur = toId;
        while (cur !== fromId) { cur = prev[cur]; path.push(cur); }
        path.reverse();
        return path;
      }
      q.push(v);
    }
  }
  return null;
}
function validatePath(path, owner) {
  if (ruleMode === "direct") return true;
  if (!path || path.length < 2) return false;
  for (let i = 1; i < path.length - 1; i++) {
    if (nodes[path[i]].owner !== owner) return false;
  }
  return true;
}

/* ===== Pick nodes ===== */
function pickNodeAt(x, y) {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i];
    if (dist(x, y, n.x, n.y) <= n.r * SETTINGS.territoryScale) return i;
  }
  return -1;
}
function nearestNodeWithin(x, y, radiusCss) {
  const r = cssToCanvas(radiusCss);
  let best = -1, bestD = 1e18;
  for (let i = 0; i < nodes.length; i++) {
    const d = dist(x, y, nodes[i].x, nodes[i].y);
    if (d < r && d < bestD) { bestD = d; best = i; }
  }
  return best;
}

/* ===== VFX ===== */
function burst(x, y, owner, str) {
  const col = ownerHex(owner);
  const k = Math.min(30, 10 + Math.floor(str / 3));
  for (let i = 0; i < k; i++) {
    const a = rand(0, Math.PI * 2);
    const s = rand(40, 200) * DPR;
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.30, 0.78), col, r: rand(1.2, 2.8) * DPR });
  }
}
function shockwave(x, y, owner) {
  waves.push({ x, y, owner, t: 0, life: 0.55 });
}
function addFlow(path, owner) {
  if (!path || path.length < 2) return;
  flows.push({ path: [...path], owner, t: 0, life: SETTINGS.flowLife });
}
function kickShake(power) {
  camShake = Math.min(1, camShake + power);
}

/* ===== Rockets ===== */
function spawnRockets(fromId, toId, owner, amount, path) {
  if (amount <= 0 || !path || path.length < 2) return;

  let count = Math.ceil(amount / SETTINGS.payloadPerRocket);
  count = Math.max(1, Math.min(SETTINGS.maxRocketsPerBurst, count));

  let remaining = amount;
  const chunks = [];
  for (let i = 0; i < count; i++) {
    const c = Math.floor(remaining / (count - i));
    chunks.push(c); remaining -= c;
  }

  const origin = nodes[fromId];
  const spd = speedFrom(origin);

  for (const troops of chunks) {
    if (troops <= 0) continue;
    rockets.push({ owner, troops, path, seg: 0, t: 0, tt: 0, speed: spd, x: origin.x, y: origin.y, ang: 0 });
  }

  addFlow(path, owner);
}
function startSeg(r) {
  const a = nodes[r.path[r.seg]];
  const b = nodes[r.path[r.seg + 1]];
  const dx = b.x - a.x, dy = b.y - a.y;
  r.ang = Math.atan2(dy, dx);
  const dCss = canvasToCss(Math.hypot(dx, dy));
  r.tt = Math.max(0.10, dCss / r.speed);
  r.t = 0;
}
function resolveAt(nodeId, owner, troopsIn) {
  const t = nodes[nodeId];

  if (t.owner === owner) {
    t.troops = Math.min(cap(t), t.troops + troopsIn);
    burst(t.x, t.y, owner, Math.min(18, troopsIn));
    shockwave(t.x, t.y, owner);
    return;
  }

  const eff = Math.floor(troopsIn * (1 - defense(t)));
  if (eff <= 0) return;

  if (eff < t.troops) {
    t.troops -= eff;
    t.shake = Math.min(1, t.shake + 0.55);
    burst(t.x, t.y, owner, Math.min(18, eff));
    kickShake(0.18);
    sfx.hit();
    return;
  }

  const remain = Math.max(1, eff - Math.floor(t.troops));
  t.owner = owner;
  t.troops = Math.min(cap(t), remain);
  t.up = { cap: 0, grow: 0, spd: 0, shd: 0 }; // capture resets upgrades
  t.growthBase = SETTINGS.baseGrowth + rand(-SETTINGS.growthJitter, SETTINGS.growthJitter);
  t.shake = 1;

  burst(t.x, t.y, owner, Math.min(30, remain));
  shockwave(t.x, t.y, owner);
  kickShake(0.42);
  sfx.cap();
}
function updateRockets(dt) {
  for (let i = rockets.length - 1; i >= 0; i--) {
    const r = rockets[i];
    if (r.tt === 0) startSeg(r);

    r.t += dt;
    const a = nodes[r.path[r.seg]];
    const b = nodes[r.path[r.seg + 1]];
    const u = clamp(r.t / r.tt, 0, 1);

    r.x = a.x + (b.x - a.x) * u;
    r.y = a.y + (b.y - a.y) * u;

    // trail sparks
    if (Math.random() < 0.9) {
      const col = ownerHex(r.owner);
      particles.push({ x: r.x, y: r.y, vx: rand(-60, 60) * DPR, vy: rand(-60, 60) * DPR, life: rand(0.12, 0.22), col, r: rand(0.8, 1.6) * DPR });
    }

    if (u >= 1) {
      const arrived = r.path[r.seg + 1];
      const isFinal = (r.seg + 1) === (r.path.length - 1);

      if (isFinal) {
        resolveAt(arrived, r.owner, r.troops);
        rockets.splice(i, 1);
      } else {
        if (ruleMode === "direct") { r.seg += 1; r.tt = 0; }
        else {
          if (nodes[arrived].owner === r.owner) { r.seg += 1; r.tt = 0; }
          else rockets.splice(i, 1);
        }
      }
    }
  }
}
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    p.vx *= (1 - 2.3 * dt);
    p.vy *= (1 - 2.3 * dt);
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
}
function updateWaves(dt) {
  for (let i = waves.length - 1; i >= 0; i--) {
    const w = waves[i];
    w.t += dt;
    if (w.t >= w.life) { waves.splice(i, 1); continue; }
  }
}
function updateFlows(dt) {
  for (let i = flows.length - 1; i >= 0; i--) {
    const f = flows[i];
    f.t += dt;
    f.life -= dt;
    if (f.life <= 0) flows.splice(i, 1);
  }
}

/* ===== Drawing ===== */
function edgeCP(a, b) {
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const dx = b.x - a.x, dy = b.y - a.y;
  const d = Math.max(1, Math.hypot(dx, dy));
  const nx = -dy / d, ny = dx / d;
  const h = ((a.id * 73856093) ^ (b.id * 19349663)) & 0xffff;
  const sign = (h & 1) ? 1 : -1;
  const mag = Math.min(cssToCanvas(28), d * SETTINGS.curveAmount) * sign;
  return { cx: mx + nx * mag, cy: my + ny * mag };
}

function blobPoints(n) {
  const k = SETTINGS.territoryPoints;
  const rng = mulberry32(n.blobSeed);
  const base = n.r * SETTINGS.territoryScale;
  const pts = [];
  for (let i = 0; i < k; i++) {
    const ang = (Math.PI * 2) * (i / k);
    const wob = (rng() - 0.5) * 0.20 + Math.sin(ang * 3 + rng() * 6) * 0.06;
    const rr = base * (1.02 + wob);
    pts.push({ x: n.x + Math.cos(ang) * rr, y: n.y + Math.sin(ang) * rr });
  }
  return pts;
}
function smoothClosedPath(pts) {
  const k = pts.length;
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const m0 = mid(pts[0], pts[1]);
  ctx.beginPath();
  ctx.moveTo(m0.x, m0.y);
  for (let i = 1; i <= k; i++) {
    const p = pts[i % k];
    const m = mid(p, pts[(i + 1) % k]);
    ctx.quadraticCurveTo(p.x, p.y, m.x, m.y);
  }
  ctx.closePath();
}

function drawBackground() {
  // stars
  ctx.fillStyle = "rgba(0,0,0,0)";
  for (const s of star) {
    const tw = (Math.sin(tAnim * 1.2 + s.tw) + 1) * 0.5;
    ctx.fillStyle = `rgba(255,255,255,${s.a * (0.55 + 0.45 * tw)})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r * (0.9 + 0.25 * tw), 0, Math.PI * 2);
    ctx.fill();
  }

  // vignette
  const v = ctx.createRadialGradient(W * 0.5, H * 0.5, cssToCanvas(120), W * 0.5, H * 0.5, Math.max(W, H));
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.60)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
}

function drawEdges() {
  ctx.lineWidth = cssToCanvas(2);
  for (const e of edges) {
    const a = nodes[e.a], b = nodes[e.b];
    const { cx, cy } = edgeCP(a, b);
    ctx.strokeStyle = COLORS.line;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(cx, cy, b.x, b.y);
    ctx.stroke();
  }
}

function drawFlows() {
  ctx.save();
  for (const f of flows) {
    const col = ownerHex(f.owner);
    const alpha = clamp(f.life / SETTINGS.flowLife, 0, 1);
    ctx.strokeStyle = rgba(col, 0.12 + 0.45 * alpha);
    ctx.lineWidth = cssToCanvas(4);
    ctx.lineCap = "round";
    ctx.setLineDash([cssToCanvas(10), cssToCanvas(10)]);
    ctx.lineDashOffset = -cssToCanvas(120) * (tAnim % 10);

    ctx.beginPath();
    const p0 = nodes[f.path[0]];
    ctx.moveTo(p0.x, p0.y);
    for (let i = 1; i < f.path.length; i++) {
      const p = nodes[f.path[i]];
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawParticles() {
  for (const p of particles) {
    const a = clamp(p.life / 0.78, 0, 1);
    ctx.fillStyle = rgba(p.col, 0.55 * a);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawWaves() {
  for (const w of waves) {
    const a = clamp(1 - (w.t / w.life), 0, 1);
    const col = ownerHex(w.owner);
    const r0 = cssToCanvas(22);
    const r = r0 + cssToCanvas(110) * (w.t / w.life);
    ctx.strokeStyle = rgba(col, 0.10 + 0.30 * a);
    ctx.lineWidth = cssToCanvas(3) * a;
    ctx.beginPath();
    ctx.arc(w.x, w.y, r, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawRocket(r) {
  const col = ownerHex(r.owner);
  const size = cssToCanvas(6.5) + cssToCanvas(Math.min(7, Math.log10(r.troops + 1) * 3.0));
  const nose = size * 1.25, wing = size * 0.70;

  ctx.save();
  ctx.translate(r.x, r.y);
  ctx.rotate(r.ang);

  const grad = ctx.createLinearGradient(-wing - size * 2.2, 0, -wing, 0);
  grad.addColorStop(0, "rgba(255,255,255,0)");
  grad.addColorStop(1, rgba(col, 0.40));
  ctx.strokeStyle = grad;
  ctx.lineWidth = cssToCanvas(3);
  ctx.beginPath();
  ctx.moveTo(-wing - size * 2.2, 0);
  ctx.lineTo(-wing, 0);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(nose, 0);
  ctx.lineTo(-wing, -wing);
  ctx.lineTo(-wing, wing);
  ctx.closePath();
  ctx.fillStyle = col;
  ctx.fill();

  ctx.restore();
}

function drawUpgradeIcons(n, x, y) {
  // four slots: cap/grow/spd/shd
  const col = ownerHex(n.owner);
  const alpha = (n.owner === OWNER.NEU) ? 0.38 : 0.72;

  const slot = cssToCanvas(16);
  const gap = cssToCanvas(6);
  const top = y - cssToCanvas(8);

  const types = ["cap", "grow", "spd", "shd"];
  for (let i = 0; i < 4; i++) {
    const t = types[i];
    const lv = n.up[t] || 0;
    const sx = x + (i - 1.5) * (slot + gap);

    // icon frame
    ctx.fillStyle = "rgba(0,0,0,.28)";
    ctx.beginPath();
    ctx.roundRect?.(sx - slot / 2, top - slot / 2, slot, slot, cssToCanvas(5));
    if (!ctx.roundRect) {
      ctx.rect(sx - slot / 2, top - slot / 2, slot, slot);
    }
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,.14)";
    ctx.lineWidth = cssToCanvas(1.2);
    ctx.stroke();

    // icon drawing
    ctx.strokeStyle = rgba(col, alpha);
    ctx.fillStyle = rgba(col, alpha);
    ctx.lineWidth = cssToCanvas(1.6);

    const s = slot * 0.34;

    if (t === "cap") {
      // warehouse: roof + box
      ctx.beginPath();
      ctx.moveTo(sx - s, top - s * 0.2);
      ctx.lineTo(sx, top - s);
      ctx.lineTo(sx + s, top - s * 0.2);
      ctx.stroke();
      ctx.fillRect(sx - s, top - s * 0.05, s * 2, s * 1.1);
    } else if (t === "grow") {
      // leaf
      ctx.beginPath();
      ctx.arc(sx, top + s * 0.1, s * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(sx, top + s * 0.1);
      ctx.quadraticCurveTo(sx + s, top - s * 0.3, sx + s * 0.2, top + s * 0.7);
      ctx.stroke();
    } else if (t === "spd") {
      // arrow/chevron
      ctx.beginPath();
      ctx.moveTo(sx - s, top);
      ctx.lineTo(sx + s * 0.6, top);
      ctx.lineTo(sx + s * 0.2, top - s * 0.6);
      ctx.moveTo(sx + s * 0.6, top);
      ctx.lineTo(sx + s * 0.2, top + s * 0.6);
      ctx.stroke();
    } else if (t === "shd") {
      // shield dome
      ctx.beginPath();
      ctx.arc(sx, top, s * 0.9, Math.PI, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(sx - s * 0.9, top);
      ctx.lineTo(sx, top + s * 0.9);
      ctx.lineTo(sx + s * 0.9, top);
      ctx.stroke();
    }

    // level pips
    for (let k = 0; k < lv; k++) {
      ctx.fillStyle = rgba(col, 0.85);
      ctx.fillRect(sx - slot / 2 + cssToCanvas(3) + k * cssToCanvas(4), top + slot / 2 - cssToCanvas(5), cssToCanvas(3), cssToCanvas(3));
    }
  }
}

function drawNode(n) {
  const col = ownerHex(n.owner);

  const sh = n.shake;
  const ox = sh ? Math.sin(tAnim * 42 + n.id) * cssToCanvas(2.2) * sh : 0;
  const oy = sh ? Math.cos(tAnim * 37 + n.id) * cssToCanvas(2.2) * sh : 0;

  const x = n.x + ox;
  const y = n.y + oy;

  // territory blob
  const pts = blobPoints({ ...n, x, y });
  smoothClosedPath(pts);

  const fillCol = (n.owner === OWNER.NEU) ? "rgba(130,140,160,.14)" : rgba(col, 0.14);
  ctx.fillStyle = fillCol;
  ctx.fill();

  // territory inner gradient
  const g = ctx.createRadialGradient(x - n.r * 0.3, y - n.r * 0.3, n.r * 0.3, x, y, n.r * 2.2);
  g.addColorStop(0, (n.owner === OWNER.NEU) ? "rgba(255,255,255,.05)" : rgba(col, 0.16));
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fill();

  // outline glow
  ctx.save();
  ctx.shadowColor = rgba(col, n.owner === OWNER.NEU ? 0.08 : 0.24);
  ctx.shadowBlur = cssToCanvas(n.owner === OWNER.NEU ? 10 : 22);
  ctx.strokeStyle = (n.owner === OWNER.NEU) ? "rgba(255,255,255,.10)" : rgba(col, 0.35);
  ctx.lineWidth = cssToCanvas(2.2);
  ctx.stroke();
  ctx.restore();

  // core node
  const coreG = ctx.createRadialGradient(x - n.r * 0.35, y - n.r * 0.35, n.r * 0.25, x, y, n.r * 1.35);
  coreG.addColorStop(0, shade(col, 0.38));
  coreG.addColorStop(0.60, shade(col, 0.10));
  coreG.addColorStop(1, shade(col, -0.38));

  ctx.save();
  ctx.shadowColor = rgba(col, n.owner === OWNER.NEU ? 0.10 : 0.22);
  ctx.shadowBlur = cssToCanvas(n.owner === OWNER.NEU ? 10 : 18);

  ctx.beginPath();
  ctx.arc(x, y, n.r, 0, Math.PI * 2);
  ctx.fillStyle = coreG;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x - n.r * 0.18, y - n.r * 0.22, n.r * 0.58, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,.08)";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, n.r, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(0,0,0,.32)";
  ctx.lineWidth = cssToCanvas(2);
  ctx.stroke();

  // troops ring
  const ratio = clamp(n.troops / cap(n), 0, 1);
  const start = -Math.PI / 2;
  const end = start + Math.PI * 2 * ratio;
  ctx.beginPath();
  ctx.arc(x, y, n.r + cssToCanvas(9), start, end);
  ctx.strokeStyle = (n.owner === OWNER.NEU) ? "rgba(255,255,255,.22)" : rgba(col, 0.70);
  ctx.lineWidth = cssToCanvas(3.8);
  ctx.lineCap = "round";
  ctx.stroke();

  // troops text
  ctx.fillStyle = "rgba(255,255,255,.94)";
  ctx.font = `${Math.floor(cssToCanvas(13))}px system-ui`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(Math.floor(n.troops)), x, y);

  ctx.restore();

  // buildings / upgrades visual
  if (n.owner !== OWNER.NEU) {
    drawUpgradeIcons(n, x, y);
  }

  // selection rings
  const o = n.owner;
  if ((o === OWNER.P1 || o === OWNER.P2) && selSet[o].has(n.id)) {
    const pulse = (Math.sin(tAnim * 3.0 + n.id * 0.4) + 1) * 0.5;
    ctx.beginPath();
    ctx.arc(x, y, n.r + cssToCanvas(18) + cssToCanvas(3) * pulse, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(col, 0.20 + 0.22 * pulse);
    ctx.lineWidth = cssToCanvas(2.6);
    ctx.stroke();
  }
  if ((o === OWNER.P1 || o === OWNER.P2) && selPrimary[o] === n.id) {
    ctx.beginPath();
    ctx.arc(x, y, n.r + cssToCanvas(24), 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,.52)";
    ctx.lineWidth = cssToCanvas(1.8);
    ctx.stroke();
  }
}

/* ===== Multi send / transfer (fixed) ===== */
function multiSend(owner, targetId, frac, isTransfer) {
  const set = selSet[owner];
  if (!set.size) { showToast("اختار ولاياتك الأول"); sfx.error(); return; }

  const sources = [];
  for (const fromId of set) {
    if (fromId === targetId) continue;
    const from = nodes[fromId];
    if (from.owner !== owner) continue;

    if (isTransfer && nodes[targetId].owner !== owner) continue;

    const path = findPath(fromId, targetId);
    if (!path) continue;
    if (!validatePath(path, owner)) continue;

    const avail = Math.floor(from.troops) - SETTINGS.minKeep;
    if (avail > 0) sources.push({ fromId, avail, path });
  }

  if (!sources.length) {
    showToast(isTransfer ? "Transfer: الهدف لازم يكون بتاعك + مسار صالح" : "Attack: مفيش مسار/قوات");
    sfx.error();
    return;
  }

  const totalAvail = sources.reduce((s, x) => s + x.avail, 0);
  const totalAmount = Math.floor(totalAvail * frac);
  if (totalAmount <= 0) { showToast("قوات غير كافية"); sfx.error(); return; }

  let remaining = totalAmount;
  for (let i = 0; i < sources.length; i++) {
    const s = sources[i];
    let amt = (i === sources.length - 1) ? remaining : Math.floor(totalAmount * (s.avail / totalAvail));
    amt = Math.max(0, Math.min(amt, s.avail));
    remaining -= amt;

    if (amt > 0) {
      nodes[s.fromId].troops -= amt;
      spawnRockets(s.fromId, targetId, owner, amt, s.path);
    }
  }

  if (isTransfer) sfx.transfer(); else sfx.send();
  showToast(`${isTransfer ? "Transfer" : "Send"} من ${sources.length} ولاية`);
}

/* ===== Upgrades ===== */
function upCost(n, type) {
  const lv = n.up[type] || 0;
  return 14 + lv * 12 + (type === "shd" ? 6 : 0);
}
function applyUpgrade(owner, type) {
  const id = selPrimary[owner];
  if (id === -1) { showToast("اختار ولاية أولًا"); sfx.error(); return; }
  const n = nodes[id];
  if (n.owner !== owner) { showToast("دي مش بتاعتك"); sfx.error(); return; }

  const lv = n.up[type] || 0;
  if (lv >= 3) { showToast("Max upgrade"); sfx.error(); return; }

  const cost = upCost(n, type);
  if (Math.floor(n.troops) <= cost + SETTINGS.minKeep) { showToast("قواتك مش كفاية للترقية"); sfx.error(); return; }

  n.troops -= cost;
  n.up[type] = lv + 1;

  burst(n.x, n.y, owner, 18);
  shockwave(n.x, n.y, owner);
  kickShake(0.22);
  sfx.up();
  showToast(`Upgrade ${type.toUpperCase()}  ${n.up[type]}`);
}

/* ===== Bot ===== */
function botParams() { return BOT_DIFF[botDiff] || BOT_DIFF.normal; }
function botStep() {
  const p = botParams();
  let best = null;

  for (const n of nodes) {
    if (n.owner !== OWNER.P2) continue;
    if (Math.floor(n.troops) < p.minTroops) continue;
    const border = [...adj[n.id]].some(i => nodes[i].owner !== OWNER.P2);
    const score = (border ? 5000 : 0) + n.troops + (n.up.spd + n.up.grow + n.up.cap + n.up.shd) * 12;
    if (!best || score > best.score) best = { id: n.id, score };
  }
  if (!best) return;

  const fromId = best.id;
  const from = nodes[fromId];
  const targets = [...adj[fromId]].map(i => nodes[i]).filter(t => t.owner !== OWNER.P2);
  if (!targets.length) return;

  const send = Math.floor(from.troops * p.sendFrac);
  if (send <= 0 || Math.floor(from.troops) - send < SETTINGS.minKeep) return;

  // pick weakest neighbor
  let pick = targets[0];
  for (const t of targets) if (t.troops < pick.troops) pick = t;

  from.troops -= send;
  const path = findPath(fromId, pick.id) || [fromId, pick.id];
  spawnRockets(fromId, pick.id, OWNER.P2, send, path);
}

/* ===== Win ===== */
function checkWin() {
  const owners = new Set(nodes.map(n => n.owner).filter(o => o !== OWNER.NEU));
  if (owners.size !== 1) return;
  const only = [...owners][0];
  if (!nodes.every(n => n.owner === only)) return;

  winner = only;
  sfx.win();
  showModal(
    (winner === OWNER.P1) ? "P1 WINS!" : (matchMode === "bot" ? "BOT WINS " : "P2 WINS!"),
    "اضغط New لجولة جديدة",
    "New", "Close",
    () => startNew(),
    () => hideModal()
  );
}

/* ===== HUD ===== */
function selectAll(owner) {
  selSet[owner].clear();
  for (const n of nodes) if (n.owner === owner) selSet[owner].add(n.id);
  selPrimary[owner] = selSet[owner].size ? [...selSet[owner]].slice(-1)[0] : -1;
  sfx.multi();
  showToast(`Select All (${selSet[owner].size})`);
}
function selLabel(owner) {
  const c = selSet[owner].size;
  if (!c) return "-";
  if (c === 1) return `#${selPrimary[owner]}`;
  return `${c} nodes`;
}
function updateHUD() {
  let p1N = 0, p2N = 0, p1T = 0, p2T = 0;
  for (const n of nodes) {
    if (n.owner === OWNER.P1) { p1N++; p1T += Math.floor(n.troops); }
    else if (n.owner === OWNER.P2) { p2N++; p2T += Math.floor(n.troops); }
  }
  ui.p1Nodes.textContent = String(p1N);
  ui.p2Nodes.textContent = String(p2N);
  ui.p1Troops.textContent = String(p1T);
  ui.p2Troops.textContent = String(p2T);
  ui.p1Sel.textContent = selLabel(OWNER.P1);
  ui.p2Sel.textContent = selLabel(OWNER.P2);

  ui.p2Label.textContent = (matchMode === "bot") ? "BOT" : "P2";
  ui.botBox.style.display = (matchMode === "bot") ? "flex" : "none";
  ui.p2Up.disabled = (matchMode === "bot");

  const s1 = selPrimary[OWNER.P1];
  const s2 = selPrimary[OWNER.P2];
  ui.p1UpCost.textContent = (s1 !== -1) ? `Cost: ${upCost(nodes[s1], ui.p1UpType.value)}` : "Cost: -";
  ui.p2UpCost.textContent = (s2 !== -1) ? `Cost: ${upCost(nodes[s2], ui.p2UpType.value)}` : "Cost: -";
}

/* ===== Input mapping ===== */
function ownerFromPointer(e) {
  if (matchMode === "bot") return OWNER.P1;
  if (e.pointerType === "mouse") {
    if (e.button === 2) return OWNER.P2;
    return mouseActiveOwner;
  }
  const rect = canvas.getBoundingClientRect();
  const xCss = e.clientX - rect.left;
  return (xCss < rect.width / 2) ? OWNER.P1 : OWNER.P2;
}
function toCanvasXY(e) {
  const rect = canvas.getBoundingClientRect();
  return { x: (e.clientX - rect.left) * DPR, y: (e.clientY - rect.top) * DPR };
}

/* ===== Drag stream ===== */
function beginDrag(e, fromId, owner, x, y) {
  canvas.setPointerCapture(e.pointerId);
  drags.set(e.pointerId, { owner, fromId, x, y, sx: x, sy: y, moved: false, targetId: -1, path: null, valid: false, acc: 0 });
}
function updateDrag(d, x, y) {
  d.x = x; d.y = y;
  if (!d.moved && dist(d.sx, d.sy, x, y) > cssToCanvas(10)) d.moved = true;

  let hit = nearestNodeWithin(x, y, SETTINGS.snapRadius);
  if (hit === -1) hit = pickNodeAt(x, y);

  d.targetId = -1; d.path = null; d.valid = false;
  if (hit !== -1 && hit !== d.fromId) {
    const path = findPath(d.fromId, hit);
    d.targetId = hit;
    d.path = path;
    d.valid = validatePath(path, d.owner);
  }
}
function streamSend(d, dt) {
  if (!d.moved || d.targetId === -1 || !d.path || !d.valid) return;
  const from = nodes[d.fromId];
  if (from.owner !== d.owner) return;

  d.acc += dt;
  while (d.acc >= SETTINGS.streamInterval) {
    d.acc -= SETTINGS.streamInterval;
    const burstAmt = SETTINGS.burstBase + from.up.spd;
    const avail = Math.floor(from.troops) - SETTINGS.minKeep;
    if (avail <= 0) return;

    const amt = Math.min(burstAmt, avail);
    from.troops -= amt;
    spawnRockets(d.fromId, d.targetId, d.owner, amt, d.path);
  }
}

/* ===== Render ===== */
function draw() {
  // camera shake
  const shake = camShake;
  const sx = (Math.random() - 0.5) * cssToCanvas(12) * shake;
  const sy = (Math.random() - 0.5) * cssToCanvas(12) * shake;

  ctx.save();
  ctx.translate(sx, sy);

  ctx.clearRect(-cssToCanvas(40), -cssToCanvas(40), W + cssToCanvas(80), H + cssToCanvas(80));

  drawBackground();
  drawEdges();
  drawFlows();
  for (const r of rockets) drawRocket(r);
  drawParticles();
  drawWaves();
  for (const n of nodes) drawNode(n);

  // drag preview
  for (const d of drags.values()) {
    const from = nodes[d.fromId];
    ctx.lineWidth = cssToCanvas(3);
    ctx.strokeStyle = d.valid ? COLORS.ok : COLORS.bad;

    if (d.path && d.path.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(nodes[d.path[0]].x, nodes[d.path[0]].y);
      for (let i = 1; i < d.path.length; i++) ctx.lineTo(nodes[d.path[i]].x, nodes[d.path[i]].y);
      ctx.stroke();
    }

    ctx.lineWidth = cssToCanvas(2);
    ctx.strokeStyle = "rgba(255,255,255,.20)";
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(d.x, d.y);
    ctx.stroke();
  }

  ctx.restore();
}

/* ===== Loop ===== */
let lastTs = 0;
function loop(ts) {
  if (!lastTs) lastTs = ts;
  const dt = Math.min(0.05, (ts - lastTs) / 1000);
  lastTs = ts;
  tAnim += dt;

  if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) hideToast(); }

  camShake = Math.max(0, camShake - 2.8 * dt);

  if (!paused && winner === 0) {
    for (const n of nodes) {
      if (n.owner !== OWNER.NEU) n.troops = Math.min(cap(n), n.troops + growth(n) * dt);
      n.shake = Math.max(0, n.shake - SETTINGS.shakeDecay * dt);
    }

    for (const d of drags.values()) streamSend(d, dt);

    if (matchMode === "bot") {
      botAcc += dt;
      const it = botParams().interval;
      if (botAcc >= it) { botAcc = 0; botStep(); }
    }

    updateRockets(dt);
    updateParticles(dt);
    updateWaves(dt);
    updateFlows(dt);
    checkWin();
    updateHUD();
  } else {
    updateParticles(dt);
    updateWaves(dt);
    updateFlows(dt);
  }

  draw();
  requestAnimationFrame(loop);
}

/* ===== Events ===== */
canvas.addEventListener("contextmenu", e => e.preventDefault());

let lpTimer = null, lpInfo = null;
function cancelLP() { if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; lpInfo = null; } }

canvas.addEventListener("pointerdown", (e) => {
  initAudio();
  if (modalOpen()) return;

  const owner = ownerFromPointer(e);
  const { x, y } = toCanvasXY(e);
  const hit = pickNodeAt(x, y);

  if (hit === -1) {
    clearSelection(owner);
    cancelLP();
    return;
  }

  const n = nodes[hit];
  const isMouse = (e.pointerType === "mouse");
  const toggle = isMouse ? !!e.shiftKey : false;

  const frac = parseFloat(ui.tapFrac?.value || "0.55");
  const isTransfer = (actionMode === "transfer");

  // IMPORTANT: Transfer target = click your OWN node to receive troops (from multi)
  if (isTransfer && n.owner === owner && selSet[owner].size) {
    const onlySelf = (selSet[owner].size === 1 && selSet[owner].has(hit));
    if (!onlySelf) {
      multiSend(owner, hit, frac, true);
      e.preventDefault();
      return;
    }
  }

  if (n.owner === owner) {
    if (toggle) {
      toggleSel(owner, hit);
      sfx.multi();
      showToast(`Multi: ${selSet[owner].size}`);
    } else {
      if (!isMouse) {
        lpInfo = { owner, hit, moved: false };
        lpTimer = setTimeout(() => {
          if (!lpInfo) return;
          toggleSel(lpInfo.owner, lpInfo.hit);
          sfx.multi();
          showToast(`Multi: ${selSet[lpInfo.owner].size}`);
          lpTimer = null; lpInfo = null;
        }, SETTINGS.longPressMs);
      }
      setSingle(owner, hit);
      sfx.select();
      beginDrag(e, hit, owner, x, y);
    }
  } else {
    // attack: tap enemy/neutral as target
    multiSend(owner, hit, frac, false);
  }

  e.preventDefault();
});

canvas.addEventListener("pointermove", (e) => {
  const d = drags.get(e.pointerId);
  if (d) {
    const { x, y } = toCanvasXY(e);
    updateDrag(d, x, y);
  }
  if (lpInfo) {
    const { x, y } = toCanvasXY(e);
    if (dist(x, y, nodes[lpInfo.hit].x, nodes[lpInfo.hit].y) > cssToCanvas(12)) {
      lpInfo.moved = true;
      cancelLP();
    }
  }
  e.preventDefault();
});
function endPtr(e) {
  if (drags.get(e.pointerId)) drags.delete(e.pointerId);
  cancelLP();
  e.preventDefault();
}
canvas.addEventListener("pointerup", endPtr);
canvas.addEventListener("pointercancel", endPtr);

window.addEventListener("keydown", (e) => {
  if (e.key === "1") { mouseActiveOwner = OWNER.P1; showToast("Mouse  P1"); }
  if (e.key === "2") { mouseActiveOwner = OWNER.P2; showToast("Mouse  P2"); }

  // quick toggles
  if (e.key.toLowerCase() === "a") { actionMode = "attack"; ui.actionMode.value = "attack"; showToast("Mode: Attack"); }
  if (e.key.toLowerCase() === "t") { actionMode = "transfer"; ui.actionMode.value = "transfer"; showToast("Mode: Transfer"); }
  if (e.key.toLowerCase() === "d") { ruleMode = "direct"; ui.ruleMode.value = "direct"; showToast("Rules: Direct"); }
  if (e.key.toLowerCase() === "c") { ruleMode = "classic"; ui.ruleMode.value = "classic"; showToast("Rules: Classic"); }

  if (e.key === "Escape") hideModal();
});

/* ===== UI wiring ===== */
function startNew() {
  resize();
  genMap();
  updateHUD();
}
ui.btnNew.onclick = () => startNew();
ui.btnPause.onclick = () => {
  paused = !paused;
  ui.btnPause.textContent = paused ? "Resume" : "Pause";
};
ui.btnHelp.onclick = () => {
  showModal(
    "Controls",
    " Click=Single  Shift+Click=Multi<br/> Attack/Transfer من القائمة<br/> Transfer: اضغط على ولاية بتاعتك كـTarget عشان تستقبل<br/> Rules: Classic أو Direct<br/> Upgrades: Cap/Growth/Speed/Shield (3 مستويات)<br/><br/>Keys: A=Attack, T=Transfer, D=Direct, C=Classic",
    "OK", "Close"
  );
};

ui.matchMode.onchange = () => { matchMode = ui.matchMode.value; startNew(); };
ui.botSelect.onchange = () => { botDiff = ui.botSelect.value || "normal"; startNew(); };
ui.ruleMode.onchange = () => { ruleMode = ui.ruleMode.value || "classic"; showToast(`Rules: ${ruleMode}`); };
ui.actionMode.onchange = () => { actionMode = ui.actionMode.value || "attack"; showToast(`Mode: ${actionMode}`); };

ui.tapFrac.oninput = () => { ui.tapFracVal.textContent = `${Math.round(parseFloat(ui.tapFrac.value) * 100)}%`; };

ui.btnSound.onclick = () => {
  audioOn = !audioOn;
  ui.btnSound.textContent = audioOn ? "Sound: ON" : "Sound: OFF";
  if (audioOn) sfx.select();
};

ui.p1All.onclick = () => selectAll(OWNER.P1);
ui.p1Clr.onclick = () => clearSelection(OWNER.P1);
ui.p2All.onclick = () => selectAll(OWNER.P2);
ui.p2Clr.onclick = () => clearSelection(OWNER.P2);

ui.p1Up.onclick = () => applyUpgrade(OWNER.P1, ui.p1UpType.value);
ui.p2Up.onclick = () => applyUpgrade(OWNER.P2, ui.p2UpType.value);

ui.p1UpType.onchange = () => updateHUD();
ui.p2UpType.onchange = () => updateHUD();

/* ===== Boot ===== */
resize();
startNew();
requestAnimationFrame(loop);
