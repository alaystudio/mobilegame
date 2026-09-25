/* Bloom Blast — drag blocks onto an 8×8 board, clear rows and columns, earn seeds, grow a garden.
 * Adventure: procedurally generated levels (seeded by level number, so every player
 * sees the same board) with three goal types: bloom flowers (clear blocks of given colors),
 * reach a score, clear lines. Classic: endless, beat your best score.
 * Every clear earns seeds; seeds build the garden. Combos make the garden strip above the board bloom.
 */
(() => {
  'use strict';

  // ---------------------------------------------------------------- helpers
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  function mulberry32(a) {
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const shade = (h, amt) => { const c = hexRgb(h).map((v) => clamp(Math.round(v + 255 * amt), 0, 255)); return `rgb(${c.join(',')})`; };
  const alpha = (a) => clamp(a, 0, 1).toFixed(3);
  const Garden = window.Garden;
  const Ads = window.BloomAds;
  const GARDENS = Garden.GARDENS;

  // Tunables in one place, so they can be A/B tested later
  const TUNING = {
    startBoosters: { hammer: 2, bomb: 2, shuffle: 2 },
    winSeedsFirst: [8, 4], // base + per star, first clear of a level
    winSeedsReplay: [2, 1],
    continueRows: 3, // rows cleared by the "watch ad to continue" rescue
  };
  const BOOSTERS = ['hammer', 'bomb', 'shuffle'];
  const BOOSTER_ICONS = { hammer: '🔨', bomb: '💣', shuffle: '🔄' };

  // ---------------------------------------------------------------- save + language
  const SAVE_KEY = 'bb.save.v1';
  const deviceLang = (navigator.language || 'en').toLowerCase().startsWith('tr') ? 'tr' : 'en';
  const emptyGardens = () => Object.fromEntries(GARDENS.map((gd) => [gd.id, gd.tasks.map(() => -1)]));
  const DEFAULTS = { level: 1, stars: {}, best: 0, seeds: 0, gardens: emptyGardens(), view: 0, boosters: { ...TUNING.startBoosters }, settings: { sound: true, vibe: true, lang: deviceLang } };
  const save = (() => {
    const fresh = () => JSON.parse(JSON.stringify(DEFAULTS));
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
      const out = { ...fresh(), ...s, settings: { ...DEFAULTS.settings, ...(s.settings || {}) }, boosters: { ...DEFAULTS.boosters, ...(s.boosters || {}) } };
      const gs = emptyGardens();
      if (Array.isArray(s.garden)) s.garden.forEach((v, i) => { if (i < gs.cottage.length) gs.cottage[i] = v; }); // first release kept one garden
      for (const gd of GARDENS) {
        const have = s.gardens && s.gardens[gd.id];
        if (Array.isArray(have)) have.forEach((v, i) => { if (i < gs[gd.id].length) gs[gd.id][i] = v; });
      }
      out.gardens = gs;
      delete out.garden;
      return out;
    } catch (e) { return fresh(); }
  })();
  // the garden being built is the first one with an unbuilt step
  const currentGarden = () => { const i = GARDENS.findIndex((gd) => save.gardens[gd.id].some((v) => v < 0)); return i < 0 ? GARDENS.length - 1 : i; };
  const builtOf = (gi) => save.gardens[GARDENS[gi].id];
  const viewGarden = () => clamp(save.view | 0, 0, currentGarden());
  const gardenName = (gi) => t('garden_' + GARDENS[gi].id);
  const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* private mode */ } };
  const I18N = window.BB_I18N;
  const dict = () => I18N[save.settings.lang] || I18N.en;
  const t = (k, p = {}) => String(dict()[k] ?? I18N.en[k] ?? k).replace(/\{(\w+)\}/g, (_, x) => p[x]);
  const tl = (k, i) => (dict()[k] || I18N.en[k] || [])[i] || '';
  function applyI18n() {
    document.documentElement.lang = save.settings.lang;
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
    document.title = t('appName');
  }
  function toast(text) {
    const el = document.createElement('div');
    el.className = 'toast'; el.textContent = text;
    const box = $('toasts');
    box.appendChild(el);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => el.remove(), 2800);
  }

  // ---------------------------------------------------------------- pieces
  const COLORS = Garden.FLOWER_COLORS; // each block color is a flower
  const NC = COLORS.length;

  const norm = (cells) => {
    const mr = Math.min(...cells.map((c) => c[0])), mc = Math.min(...cells.map((c) => c[1]));
    return cells.map(([r, c]) => [r - mr, c - mc]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  };
  const rot = (cells) => norm(cells.map(([r, c]) => [c, -r]));
  const mirror = (cells) => norm(cells.map(([r, c]) => [r, -c]));
  const keyOf = (cells) => cells.map((c) => c.join(',')).join(';');

  // [cells, weight when easy, weight when hard, include mirror images]
  const BASE = [
    [[[0, 0]], 3, 0.8],
    [[[0, 0], [0, 1]], 3, 1.2],
    [[[0, 0], [0, 1], [0, 2]], 3, 2],
    [[[0, 0], [0, 1], [0, 2], [0, 3]], 1.4, 2],
    [[[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]], 0.5, 1.6],
    [[[0, 0], [0, 1], [1, 0], [1, 1]], 2.6, 2],
    [[[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]], 0.4, 1.4],
    [[[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]], 0.7, 1.5],
    [[[0, 0], [1, 0], [1, 1]], 3, 2],
    [[[0, 0], [1, 0], [2, 0], [2, 1]], 1.4, 2, true],
    [[[0, 0], [0, 1], [0, 2], [1, 1]], 1.2, 2],
    [[[0, 1], [0, 2], [1, 0], [1, 1]], 0.7, 1.8, true],
    [[[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]], 0.5, 1.5],
  ];
  const SHAPES = [];
  for (const [cells, we, wh, mir] of BASE) {
    const seen = new Map();
    const add = (cs) => { const k = keyOf(cs); if (!seen.has(k)) seen.set(k, cs); };
    let cs = norm(cells);
    for (let i = 0; i < 4; i++) { add(cs); if (mir) add(mirror(cs)); cs = rot(cs); }
    for (const v of seen.values()) SHAPES.push({ cells: v, we: we / seen.size, wh: wh / seen.size });
  }

  // ---------------------------------------------------------------- levels
  const N = 8;
  const PATTERNS = ['scatter', 'mirror', 'rows', 'frame', 'diamond', 'blocks'];
  function levelConfig(n) {
    const rng = mulberry32(n * 7919 + 13);
    const hard = n % 10 === 0;
    const d = clamp((n - 1) / 300, 0, 1); // difficulty climbs slowly over the first 300 levels, then holds
    const type = n <= 2 ? 'flowers' : n === 3 ? 'lines' : ['flowers', 'score', 'lines'][(rng() * 3) | 0];
    const density = n <= 3 ? 0.08 : clamp(0.07 + d * 0.2 + (hard ? 0.07 : 0) + (rng() - 0.5) * 0.06, 0.05, 0.36);
    const pattern = n <= 3 ? 'scatter' : PATTERNS[(rng() * PATTERNS.length) | 0];
    const boost = hard ? 1.15 : 1;
    let goal, par;
    if (type === 'flowers') {
      const kinds = n < 8 ? 1 : n < 30 ? (rng() < 0.5 ? 1 : 2) : rng() < 0.35 ? 3 : 2;
      const keys = [...Array(NC).keys()].sort(() => rng() - 0.5).slice(0, kinds);
      goal = {};
      for (const k of keys) goal[k] = n <= 5 ? 4 + n : Math.max(5, Math.round((7 + d * 14 + rng() * 3) * boost / Math.sqrt(kinds)));
      par = Math.round(Object.values(goal).reduce((a, b) => a + b, 0) * 0.9 + 6);
    } else if (type === 'score') {
      goal = { score: Math.round(((250 + Math.min(n, 300) * 3 + Math.max(0, n - 300)) * boost) / 50) * 50 };
      par = Math.round(goal.score / 13);
    } else {
      goal = { lines: Math.round((4 + d * 14) * boost) };
      par = Math.round(goal.lines * 2.1 + 3);
    }
    return { n, hard, d, type, density, pattern, goal, par, seed: n * 104729 + 7 };
  }
  const goalColors = (cfg) => (cfg && cfg.type === 'flowers' ? Object.keys(cfg.goal).map(Number) : []);

  function buildBoard(cfg) {
    const rng = mulberry32(cfg.seed);
    const g = Array.from({ length: N }, () => Array(N).fill(null));
    const gc = goalColors(cfg);
    // flower levels lean toward the goal colors so the goal is visible from the start
    const col = () => (gc.length && rng() < 0.4 ? gc[(rng() * gc.length) | 0] : (rng() * NC) | 0);
    const set = (r, c, ci) => { if (r >= 0 && r < N && c >= 0 && c < N) g[r][c] = { ci }; };
    const p = cfg.density;
    switch (cfg.pattern) {
      case 'mirror': for (let r = 0; r < N; r++) for (let c = 0; c < N / 2; c++) if (rng() < p) { const k = col(); set(r, c, k); set(r, N - 1 - c, k); } break;
      case 'rows': { const k = col(); for (let r = N - 1; r >= 0; r--) if (rng() < p * 1.6) for (let c = 0; c < N; c++) if (rng() < 0.8) set(r, c, k); break; }
      case 'frame': { const k = col(); for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { const ring = Math.min(r, c, N - 1 - r, N - 1 - c); if (rng() < p * (ring === 0 ? 2.2 : ring === 1 ? 0.8 : 0.3)) set(r, c, ring === 0 ? k : col()); } break; }
      case 'diamond': { const a = col(), b = col(); for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { const dd = Math.abs(r - 3.5) + Math.abs(c - 3.5); if (dd < 1 + p * 8 && rng() < 0.85) set(r, c, dd < 2 ? a : b); } break; }
      case 'blocks': { let tries = 0; while (count(g) < p * N * N && tries++ < 60) { const r = (rng() * (N - 1)) | 0, c = (rng() * (N - 1)) | 0, k = col(); set(r, c, k); set(r + 1, c, k); set(r, c + 1, k); set(r + 1, c + 1, k); } break; }
      default: for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (rng() < p) set(r, c, col());
    }
    // never start with a line already full
    for (let i = 0; i < N; i++) {
      if (g[i].every(Boolean)) g[i][(rng() * N) | 0] = null;
      if (g.every((row) => row[i])) g[(rng() * N) | 0][i] = null;
    }
    return g;
  }
  function count(g) { let n = 0; for (const row of g) for (const x of row) if (x) n++; return n; }

  // ---------------------------------------------------------------- audio
  const Sound = {
    ctx: null,
    init() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.out = this.ctx.createGain();
      this.out.gain.value = 0.5;
      this.out.connect(this.ctx.destination);
    },
    tone(f, dur, type = 'sine', vol = 0.3, delay = 0, to = null) {
      if (!save.settings.sound || !this.ctx) return;
      const t0 = this.ctx.currentTime + delay, o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t0);
      if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(this.out); o.start(t0); o.stop(t0 + dur + 0.02);
    },
    pick() { this.tone(900, 0.04, 'sine', 0.12); },
    place() { this.tone(210, 0.1, 'sine', 0.4, 0, 120); this.tone(1400, 0.02, 'square', 0.03); },
    clear(lines, streak) {
      const scale = [0, 2, 4, 7, 9, 12, 14, 16];
      const base = 523 * Math.pow(2, Math.min(streak, 8) / 12);
      for (let i = 0; i < Math.min(lines + 2, 7); i++) this.tone(base * Math.pow(2, scale[i] / 12), 0.22, 'triangle', 0.18, i * 0.05);
    },
    bloom() { [1047, 1319, 1568, 2093].forEach((f, i) => this.tone(f, 0.25, 'sine', 0.1, 0.12 + i * 0.06)); },
    seed() { this.tone(1568, 0.08, 'sine', 0.06); },
    build() { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.16, i * 0.07)); },
    win() { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.2, i * 0.09)); },
    fail() { [392, 330, 262].forEach((f, i) => this.tone(f, 0.35, 'sine', 0.2, i * 0.14)); },
  };
  const vibrate = (ms) => { if (save.settings.vibe && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* none */ } } };

  // ---------------------------------------------------------------- state
  const newRun = () => ({ flowers: [], trees: [], flies: [], rainbow: null, burst: null });
  const S = {
    mode: 'home', // home | map | play | over
    kind: 'adventure', // adventure | classic
    cfg: null, grid: null, tray: [null, null, null],
    score: 0, streak: 0, miss: 0, pieces: 0, collected: {}, lines: 0, runSeeds: 0,
    drag: null, fx: [], parts: [], pops: [], t: 0, trayAnim: 0, busy: false,
    run: newRun(), appear: null, seedPulse: -9,
  };

  // ---------------------------------------------------------------- canvas + layout
  const cv = $('cv');
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, DPR = 1, cs = 40, bx = 0, by = 0, slots = [], stripY = 70, stripH = 90;
  function hudBottom() {
    const b = document.querySelector('#hud .bar');
    const r = b && b.getBoundingClientRect();
    return r && r.bottom > 0 ? r.bottom : 70;
  }
  function layout() {
    DPR = Math.min(window.devicePixelRatio || 1, 2.5);
    W = innerWidth; H = innerHeight;
    cv.width = Math.floor(W * DPR); cv.height = Math.floor(H * DPR);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    stripY = hudBottom() + 8;
    stripH = Math.round(clamp(H * 0.13, 56, 120));
    const bar = document.querySelector('#hud .boosters');
    const barR = bar && bar.getBoundingClientRect();
    const top = stripY + stripH + 12, bottom = barR && barR.height > 0 ? H - barR.top + 6 : 84;
    const avail = Math.max(100, H - top - bottom);
    cs = Math.floor(Math.min((W - 28) / N, avail / 11.6, 64));
    const total = cs * N + cs * 0.6 + cs * 3.2;
    bx = Math.round((W - cs * N) / 2);
    by = Math.round(top + Math.max(0, (avail - total) * 0.35));
    const ty = by + cs * N + cs * 0.6, sw = Math.min(W, cs * N + 40) / 3, sx0 = (W - sw * 3) / 2;
    slots = [0, 1, 2].map((i) => ({ x: sx0 + sw * i, y: ty, w: sw, h: cs * 3.2 }));
  }
  // the home garden is framed in the space above the bottom panel
  let panelTop = 0;
  function measurePanel() {
    const r = document.querySelector('#home .home-bottom').getBoundingClientRect();
    panelTop = r.top > 0 ? r.top : H * 0.65;
  }
  const homeView = () => {
    const pt = panelTop || H * 0.65;
    return { x: 0, y: 0, w: W, h: H, cx: W / 2, groundY: pt * 0.52, depth: pt * 0.4, s: Math.min(W / 2.15, pt * 0.42), garden: viewGarden(), built: builtOf(viewGarden()), t: S.t, appear: viewGarden() === currentGarden() ? appearState() : null };
  };
  const stripView = () => {
    const x = 10, w = W - 20;
    return { x, y: stripY, w, h: stripH, cx: W / 2, groundY: stripY + stripH * 0.6, depth: stripH * 0.4, s: Math.min(w / 2.1, stripH * 0.85), garden: currentGarden(), built: builtOf(currentGarden()), t: S.t, run: S.run };
  };
  function appearState() {
    if (!S.appear) return null;
    const k = (S.t - S.appear.start) / 0.9;
    if (k > 1.3) { S.appear = null; return null; }
    return { task: S.appear.task, k: clamp(k, 0, 1) };
  }

  // ---------------------------------------------------------------- drawing
  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  // emblem: a white flower silhouette on blocks whose color is part of the level goal
  function drawBlock(x, y, s, color, a = 1, emblemCi = -1) {
    ctx.globalAlpha = a;
    const r = s * 0.16, p = s * 0.04;
    rr(x + p, y + p, s - p * 2, s - p * 2, r);
    ctx.fillStyle = shade(color, -0.16); ctx.fill();
    rr(x + p, y + p, s - p * 2, s - p * 2 - s * 0.1, r);
    ctx.fillStyle = color; ctx.fill();
    rr(x + s * 0.18, y + s * 0.14, s * 0.64, s * 0.5, r * 0.7);
    ctx.fillStyle = shade(color, 0.08); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    rr(x + s * 0.16, y + s * 0.12, s * 0.28, s * 0.1, s * 0.05); ctx.fill();
    if (emblemCi >= 0) { ctx.globalAlpha = a * 0.8; Garden.drawHead(ctx, x + s / 2, y + s * 0.46, s * 0.24, emblemCi, 'rgba(255,255,255,0.9)'); }
    ctx.globalAlpha = 1;
  }
  const pieceSize = (p) => { let h = 0, w = 0; for (const [r, c] of p.cells) { h = Math.max(h, r + 1); w = Math.max(w, c + 1); } return [w, h]; };
  const isGoalColor = (ci) => S.kind === 'adventure' && S.cfg.type === 'flowers' && S.cfg.goal[ci] != null && (S.collected[ci] || 0) < S.cfg.goal[ci];
  const emblem = (ci) => (isGoalColor(ci) ? ci : -1);

  // where the dragged piece would land (top-left cell), or null
  function dropTarget() {
    const d = S.drag;
    if (!d) return null;
    const p = S.tray[d.slot], [w, h] = pieceSize(p);
    const x = d.x - (w * cs) / 2, y = d.y - cs * 1.3 - h * cs;
    const c = Math.round((x - bx) / cs), r = Math.round((y - by) / cs);
    return fits(p, r, c) ? [r, c] : null;
  }
  function fits(p, r, c) {
    for (const [dr, dc] of p.cells) {
      const rr2 = r + dr, cc = c + dc;
      if (rr2 < 0 || rr2 >= N || cc < 0 || cc >= N || S.grid[rr2][cc]) return false;
    }
    return true;
  }
  function fitsAnywhere(p) {
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (fits(p, r, c)) return true;
    return false;
  }
  // rows/cols that would clear if piece p were placed at (r,c)
  function wouldClear(p, r, c) {
    const filled = (rr2, cc) => S.grid[rr2][cc] || p.cells.some(([dr, dc]) => r + dr === rr2 && c + dc === cc);
    const rows = [], cols = [];
    for (let i = 0; i < N; i++) {
      let fr = true, fc = true;
      for (let j = 0; j < N; j++) { if (!filled(i, j)) fr = false; if (!filled(j, i)) fc = false; }
      if (fr) rows.push(i);
      if (fc) cols.push(i);
    }
    return { rows, cols };
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    if (S.mode === 'home') { Garden.drawScene(ctx, homeView()); drawParticles(); return; }
    if (S.mode !== 'play' && S.mode !== 'over') return;
    drawStrip();
    const shake = S.shake != null && S.t - S.shake < 0.3 ? (1 - (S.t - S.shake) / 0.3) * cs * 0.12 : 0;
    ctx.save();
    if (shake) ctx.translate(rand(-shake, shake), rand(-shake, shake));
    // board: a wooden planter with dark soil cells
    rr(bx - 9, by - 9, cs * N + 18, cs * N + 18, 18);
    ctx.fillStyle = '#6b4a2e'; ctx.fill();
    rr(bx - 5, by - 5, cs * N + 10, cs * N + 10, 14);
    ctx.fillStyle = '#3a2a1e'; ctx.fill();
    const target = dropTarget();
    const hl = target ? wouldClear(S.tray[S.drag.slot], target[0], target[1]) : { rows: [], cols: [] };
    const hlColor = S.drag ? COLORS[S.tray[S.drag.slot].ci] : null;
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const x = bx + c * cs, y = by + r * cs, cell = S.grid[r][c];
        const inHl = hl.rows.includes(r) || hl.cols.includes(c);
        if (cell) drawBlock(x, y, cs, inHl ? hlColor : COLORS[cell.ci], 1, emblem(cell.ci));
        else {
          rr(x + cs * 0.05, y + cs * 0.05, cs * 0.9, cs * 0.9, cs * 0.14);
          ctx.fillStyle = inHl ? 'rgba(255,255,255,0.12)' : '#4a3526'; ctx.fill();
        }
      }
    }
    // ghost of the piece where it would land
    if (target) {
      const p = S.tray[S.drag.slot];
      for (const [dr, dc] of p.cells) drawBlock(bx + (target[1] + dc) * cs, by + (target[0] + dr) * cs, cs, COLORS[p.ci], 0.45);
    }
    // clearing cells
    for (const f of S.fx) {
      const k = clamp(f.t / 0.35, 0, 1), s = cs * (1 - easeOut(k) * 0.6);
      drawBlock(f.x + (cs - s) / 2, f.y + (cs - s) / 2, s, COLORS[f.ci], 1 - k);
      if (k < 0.3) { ctx.fillStyle = `rgba(255,255,255,${alpha(0.6 * (1 - k / 0.3))})`; rr(f.x, f.y, cs, cs, cs * 0.15); ctx.fill(); }
    }
    ctx.restore();
    if (S.aim) {
      const pulse = 0.5 + 0.5 * Math.sin(S.t * 6);
      rr(bx - 9, by - 9, cs * N + 18, cs * N + 18, 18);
      ctx.strokeStyle = `rgba(255,209,102,${alpha(0.5 + pulse * 0.5)})`; ctx.lineWidth = 4; ctx.stroke();
      ctx.font = '800 15px Nunito, ui-rounded, system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const msg = `${BOOSTER_ICONS[S.aim.kind]} ${t(S.aim.kind === 'bomb' ? 'aimBomb' : 'aimHammer')}`;
      const tw = ctx.measureText(msg).width + 24;
      rr(W / 2 - tw / 2, by - 44, tw, 28, 14); ctx.fillStyle = 'rgba(20,50,36,0.9)'; ctx.fill();
      ctx.fillStyle = '#ffe07a'; ctx.fillText(msg, W / 2, by - 30);
    }
    // tray
    for (let i = 0; i < 3; i++) {
      const p = S.tray[i];
      if (!p || (S.drag && S.drag.slot === i)) continue;
      const sl = slots[i], [w, h] = pieceSize(p), s = cs * 0.55;
      const pop = easeOut(clamp((S.t - S.trayAnim) / 0.3 - i * 0.15, 0, 1));
      const ss = s * pop;
      const ox = sl.x + (sl.w - w * ss) / 2, oy = sl.y + (sl.h - h * ss) / 2;
      const ok = fitsAnywhere(p);
      for (const [dr, dc] of p.cells) drawBlock(ox + dc * ss, oy + dr * ss, ss, ok ? COLORS[p.ci] : '#6a6f60', ok ? 1 : 0.55, ok ? emblem(p.ci) : -1);
    }
    // dragged piece, lifted above the finger
    if (S.drag) {
      const p = S.tray[S.drag.slot], [w, h] = pieceSize(p);
      const x = S.drag.x - (w * cs) / 2, y = S.drag.y - cs * 1.3 - h * cs;
      for (const [dr, dc] of p.cells) drawBlock(x + dc * cs, y + dr * cs, cs, COLORS[p.ci], 0.95, emblem(p.ci));
    }
    drawParticles();
    // popups
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const p of S.pops) {
      const k = 1 - p.life / p.max;
      const sc = k < 0.15 ? easeOut(k / 0.15) * 1.15 : 1.15 - Math.min(0.15, k - 0.15);
      ctx.globalAlpha = clamp(p.life / (p.max * 0.35), 0, 1);
      ctx.font = `900 ${p.size * sc}px Nunito, ui-rounded, system-ui, sans-serif`;
      ctx.lineWidth = p.size * 0.16; ctx.strokeStyle = 'rgba(10,30,20,0.75)';
      ctx.strokeText(p.text, p.x, p.y); ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
  }
  function drawParticles() {
    for (const q of S.parts) {
      ctx.globalAlpha = clamp(q.life / q.max, 0, 1);
      ctx.fillStyle = q.color;
      if (q.petal) { ctx.beginPath(); ctx.ellipse(q.x, q.y, q.s, q.s * 0.55, q.life * 6, 0, Math.PI * 2); ctx.fill(); }
      else ctx.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s);
    }
    ctx.globalAlpha = 1;
  }
  // the live garden above the board
  function drawStrip() {
    const v = stripView();
    ctx.save();
    rr(v.x, v.y, v.w, v.h, 16); ctx.clip();
    Garden.drawScene(ctx, v);
    ctx.restore();
    rr(v.x, v.y, v.w, v.h, 16);
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1.5; ctx.stroke();
    // seed counter
    const pulse = 1 + 0.25 * Math.max(0, 1 - (S.t - S.seedPulse) / 0.3);
    ctx.font = `900 ${Math.round(15 * pulse)}px Nunito, ui-rounded, system-ui, sans-serif`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const label = `🌱 ${save.seeds}`, tw = ctx.measureText(label).width;
    rr(v.x + 8, v.y + 8, tw + 18, 26, 13); ctx.fillStyle = 'rgba(20,50,36,0.72)'; ctx.fill();
    ctx.fillStyle = '#eaffdf'; ctx.fillText(label, v.x + 17, v.y + 21.5);
    // combo with the moves left to keep it alive
    if (S.streak >= 2) {
      ctx.font = '900 16px Nunito, ui-rounded, system-ui, sans-serif';
      const txt = `×${S.streak}`, w2 = ctx.measureText(txt).width + 44;
      const x0 = v.x + v.w - 8 - w2;
      rr(x0, v.y + 8, w2, 26, 13); ctx.fillStyle = 'rgba(20,50,36,0.72)'; ctx.fill();
      ctx.fillStyle = '#ffe07a'; ctx.fillText(txt, x0 + 10, v.y + 21.5);
      for (let i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.arc(x0 + w2 - 30 + i * 9, v.y + 21, 3, 0, Math.PI * 2);
        ctx.fillStyle = i < 3 - S.miss ? '#ffe07a' : 'rgba(255,255,255,0.25)'; ctx.fill();
      }
    }
  }

  // ---------------------------------------------------------------- game flow
  function newPiece(d) {
    let total = 0;
    const ws = SHAPES.map((s) => {
      const big = s.cells.length >= 5 ? lerp(0.25, 1, clamp(d * 5, 0, 1)) : 1; // few big pieces in the first levels
      const w = lerp(s.we, s.wh, d) * big;
      total += w;
      return w;
    });
    let r = Math.random() * total, i = 0;
    while ((r -= ws[i]) > 0) i++;
    let ci = (Math.random() * NC) | 0;
    // in flower levels, lean toward the colors still needed so the goal can always be finished
    if (S.kind === 'adventure' && S.cfg.type === 'flowers' && Math.random() < 0.3) {
      const need = goalColors(S.cfg).filter(isGoalColor);
      if (need.length) ci = need[(Math.random() * need.length) | 0];
    }
    return { cells: SHAPES[i].cells, ci };
  }
  const difficulty = () => (S.kind === 'classic' ? clamp(S.score / 5000, 0, 1) : S.cfg.d);

  // how many of the pieces can be placed one after another (clearing lines as they fill), best order
  function placeableInSequence(pieces) {
    const orders = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
    let best = 0;
    for (const ord of orders) {
      const g = S.grid.map((row) => row.map(Boolean));
      let placed = 0;
      for (const i of ord) {
        const pc = pieces[i];
        let spot = null, spotLines = -1;
        for (let r = 0; r < N && spotLines < 2; r++) for (let c = 0; c < N; c++) {
          if (!pc.cells.every(([dr, dc]) => r + dr < N && c + dc < N && !g[r + dr][c + dc])) continue;
          pc.cells.forEach(([dr, dc]) => { g[r + dr][c + dc] = true; });
          let lines = 0;
          for (let k = 0; k < N; k++) { if (g[k].every(Boolean)) lines++; if (g.every((row) => row[k])) lines++; }
          pc.cells.forEach(([dr, dc]) => { g[r + dr][c + dc] = false; });
          if (lines > spotLines) { spotLines = lines; spot = [r, c]; }
        }
        if (!spot) break;
        pc.cells.forEach(([dr, dc]) => { g[spot[0] + dr][spot[1] + dc] = true; });
        const fr = [], fc = [];
        for (let k = 0; k < N; k++) { if (g[k].every(Boolean)) fr.push(k); if (g.every((row) => row[k])) fc.push(k); }
        fr.forEach((r) => g[r].fill(false));
        fc.forEach((c) => g.forEach((row) => { row[c] = false; }));
        placed++;
      }
      best = Math.max(best, placed);
      if (best === 3) break;
    }
    return best;
  }

  function refillTray() {
    const d = difficulty();
    // fair trays: all three pieces must fit one after another (difficulty comes from board, goals and piece mix)
    let bestTray = null, bestScore = -1;
    for (let tries = 0; tries < 30; tries++) {
      const tray = [newPiece(d), newPiece(d), newPiece(d)];
      const ok = placeableInSequence(tray);
      if (ok > bestScore) { bestScore = ok; bestTray = tray; }
      if (ok >= 3) break;
    }
    S.tray = bestTray;
    S.trayAnim = S.t;
  }

  function enterPlay() {
    S.mode = 'play';
    updateBoosters();
    $('toasts').innerHTML = '';
    showOnly('hud');
    layout();
    updateHud();
  }
  function startLevel(n) {
    S.kind = 'adventure';
    S.cfg = levelConfig(n);
    S.grid = buildBoard(S.cfg);
    resetRun();
    showIntro();
  }
  function startClassic() {
    S.kind = 'classic';
    S.cfg = { d: 0, type: 'classic', goal: {} };
    S.grid = Array.from({ length: N }, () => Array(N).fill(null));
    resetRun();
    enterPlay();
  }
  function resetRun() {
    Object.assign(S, { score: 0, streak: 0, miss: 0, pieces: 0, collected: {}, lines: 0, runSeeds: 0, drag: null, busy: false, aim: null, adContinued: false, run: newRun() });
    S.fx.length = 0; S.parts.length = 0; S.pops.length = 0;
    refillTray();
  }

  function addSeeds(n) {
    if (n <= 0) return;
    save.seeds += n;
    S.runSeeds += n;
    S.seedPulse = S.t;
  }

  // the garden strip reacts to clears and combos
  function bloom(colors, streak, lines) {
    const run = S.run, v = stripView();
    const add = (ci) => {
      run.flowers.push({ u: rand(0.03, 0.97), z: rand(0.08, 0.95), ci, born: S.t + rand(0, 0.25), die: 0 });
      const alive = run.flowers.filter((f) => !f.die);
      if (alive.length > 70) alive[0].die = S.t;
    };
    colors.forEach(add);
    let msg = null;
    if (streak >= 3) { for (let i = 0; i < Math.min(streak * 2, 16); i++) add(colors[i % colors.length]); if (streak === 3) msg = t('bloomWave'); }
    if (streak >= 5 && streak % 5 === 0 && run.trees.length < 4) {
      run.trees.push({ u: rand(0.08, 0.92), z: rand(0.1, 0.5), st: (Math.random() * 3) | 0, born: S.t });
      run.trees.sort((a, b) => a.z - b.z);
      msg = t('treeGrows');
    }
    if (streak >= 8 && (streak === 8 || streak % 4 === 0)) {
      run.rainbow = S.t;
      for (let i = 0; i < 3 && run.flies.length < 8; i++) run.flies.push({ ph: rand(0, 6.28), born: S.t });
      msg = t('rainbow');
    }
    if (lines >= 3) run.burst = S.t;
    run.flowers.sort((a, b) => a.z - b.z);
    run.flowers = run.flowers.filter((f) => !f.die || S.t - f.die < 0.7);
    // petals drift down from the strip
    if (streak >= 3 || lines >= 2) {
      for (let i = 0; i < 10 + streak * 2; i++) S.parts.push({ x: rand(v.x, v.x + v.w), y: v.y + v.h * rand(0.2, 0.8), vx: rand(-60, 60), vy: rand(-120, 10), s: rand(3, 6), color: COLORS[colors[i % colors.length]], life: 1.2, max: 1.2, petal: true });
    }
    if (msg) { pop(msg, W / 2, v.y + v.h * 0.45, '#ffffff', 22); Sound.bloom(); }
  }

  function place(slot, r, c) {
    const p = S.tray[slot];
    for (const [dr, dc] of p.cells) S.grid[r + dr][c + dc] = { ci: p.ci };
    S.tray[slot] = null;
    S.pieces++;
    S.score += p.cells.length;
    Sound.place();
    vibrate(8);

    const rows = [], cols = [];
    for (let i = 0; i < N; i++) {
      if (S.grid[i].every(Boolean)) rows.push(i);
      if (S.grid.every((row) => row[i])) cols.push(i);
    }
    const lines = rows.length + cols.length;
    if (lines) {
      S.streak++;
      S.miss = 0;
      const cleared = new Set();
      rows.forEach((rr2) => { for (let j = 0; j < N; j++) cleared.add(rr2 * N + j); });
      cols.forEach((cc) => { for (let j = 0; j < N; j++) cleared.add(j * N + cc); });
      const colors = [];
      let i = 0;
      for (const k of cleared) {
        const rr2 = (k / N) | 0, cc = k % N, cell = S.grid[rr2][cc];
        const x = bx + cc * cs, y = by + rr2 * cs;
        S.fx.push({ x, y, ci: cell.ci, t: 0 });
        for (let j = 0; j < 3; j++) S.parts.push({ x: x + cs / 2, y: y + cs / 2, vx: rand(-160, 160), vy: rand(-260, -40), s: rand(3, 7), color: COLORS[cell.ci], life: 0.7, max: 0.7 });
        S.collected[cell.ci] = (S.collected[cell.ci] || 0) + 1;
        if (i++ % 4 === 0) colors.push(cell.ci);
        S.grid[rr2][cc] = null;
      }
      S.lines += lines;
      const gain = Math.round(10 * lines * (lines + 1) * (1 + (S.streak - 1) * 0.3));
      S.score += gain;
      const seeds = lines + Math.min(S.streak - 1, 6);
      addSeeds(seeds);
      Sound.clear(lines, S.streak);
      setTimeout(() => Sound.seed(), 160);
      vibrate(lines > 1 ? [20, 30, 20] : 15);
      const cy = by + (rows.length ? (rows[0] + 0.5) * cs : cs * N * 0.5);
      const word = lines >= 5 ? 'amazing' : lines === 4 ? 'excellent' : lines === 3 ? 'great' : lines === 2 ? 'nice' : null;
      if (word) pop(t(word), W / 2, cy - 24, '#ffe07a', 34);
      pop(`+${gain}`, W / 2, cy + 12, '#ffffff', 24);
      pop(`+${seeds} 🌱`, 60, stripY + stripH + 4, '#c8ffb8', 18);
      if (S.streak >= 2) pop(t('combo', { n: S.streak }), W / 2, by - 4, '#ffe07a', 22);
      bloom(colors, S.streak, lines);
    } else if (S.streak) {
      // a combo survives two placements without a clear; the third breaks it
      S.miss++;
      if (S.miss >= 3) { S.streak = 0; S.miss = 0; }
    }
    if (S.tray.every((x) => !x)) refillTray();
    updateHud();
    persist();

    if (S.kind === 'adventure' && goalMet()) return finish(true);
    if (!S.tray.some((x) => x && fitsAnywhere(x))) return outOfSpace();
    return undefined;
  }

  function pop(text, x, y, color, size) { S.pops.push({ text, x, y, color, size, life: 1.2, max: 1.2 }); }

  function goalMet() {
    const g = S.cfg.goal;
    if (S.cfg.type === 'flowers') return Object.entries(g).every(([k, n]) => (S.collected[k] || 0) >= n);
    if (S.cfg.type === 'score') return S.score >= g.score;
    return S.lines >= g.lines;
  }
  function starsFor() { const par = S.cfg.par; return S.pieces <= par ? 3 : S.pieces <= par * 1.35 ? 2 : 1; }

  const tasksOf = (gi) => GARDENS[gi].tasks;
  const nextStep = () => builtOf(currentGarden()).findIndex((v) => v < 0);
  const nextTask = () => { const st = nextStep(); return st < 0 ? null : tasksOf(currentGarden())[st]; };
  const canBuild = () => { const task = nextTask(); return !!task && save.seeds >= task.cost; };
  const adReady = () => Ads.rewardedLeft() > 0;

  // ---------------------------------------------------------------- rescue when out of space
  function outOfSpace() {
    S.busy = true;
    S.drag = null;
    S.aim = null;
    const b = save.boosters;
    const opts = [];
    if (b.shuffle > 0) opts.push(['useShuffle', b.shuffle, () => { closeRescue(); useShuffle(); }]);
    if (b.bomb > 0) opts.push(['useBomb', b.bomb, () => { closeRescue(); startAim('bomb', true); }]);
    if (!S.adContinued && adReady()) opts.push(['rescueAd', null, adContinue]);
    if (!opts.length) return finish(false);
    const box = $('rescueOpts');
    box.innerHTML = '';
    opts.forEach(([key, n, fn], i) => {
      const btn = document.createElement('button');
      btn.className = 'btn ' + (key === 'rescueAd' ? 'build wide' : i === 0 ? 'primary' : 'secondary');
      btn.textContent = (key === 'rescueAd' ? '▶ ' : '') + t(key, { n });
      btn.addEventListener('click', fn);
      box.appendChild(btn);
    });
    Sound.fail();
    $('rescue').classList.remove('hidden');
    return undefined;
  }
  function closeRescue() { $('rescue').classList.add('hidden'); S.busy = false; }
  async function adContinue() {
    const ok = await Ads.showRewarded('continue');
    if (!ok) { toast(adReady() ? t('adFailed') : t('noAdsLeft')); return; }
    S.adContinued = true;
    closeRescue();
    // clear the fullest rows so there is room again
    const rows = [...Array(N).keys()].sort((a, b) => S.grid[b].filter(Boolean).length - S.grid[a].filter(Boolean).length).slice(0, TUNING.continueRows);
    const cells = [];
    rows.forEach((r) => { for (let c = 0; c < N; c++) if (S.grid[r][c]) cells.push([r, c]); });
    blast(cells, false);
    refillTray();
    Sound.build();
    afterBoard();
  }
  // after a power-up or rescue changed the board: win, keep going, or rescue again
  function afterBoard() {
    updateHud();
    persist();
    if (S.kind === 'adventure' && goalMet()) return finish(true);
    if (!S.tray.some((x) => x && fitsAnywhere(x))) return outOfSpace();
    return undefined;
  }

  // ---------------------------------------------------------------- power-ups
  // remove cells from the board with the clear effect; they count toward flower goals
  function blast(cells, count = true) {
    for (const [r, c] of cells) {
      const cell = S.grid[r][c];
      if (!cell) continue;
      const x = bx + c * cs, y = by + r * cs;
      S.fx.push({ x, y, ci: cell.ci, t: 0 });
      for (let j = 0; j < 4; j++) S.parts.push({ x: x + cs / 2, y: y + cs / 2, vx: rand(-200, 200), vy: rand(-300, -60), s: rand(3, 7), color: COLORS[cell.ci], life: 0.7, max: 0.7 });
      if (count) S.collected[cell.ci] = (S.collected[cell.ci] || 0) + 1;
      S.grid[r][c] = null;
    }
  }
  function startAim(kind, rescue = false) {
    S.aim = { kind, rescue };
    S.drag = null;
    updateBoosters();
  }
  function cancelAim() {
    const rescue = S.aim && S.aim.rescue;
    S.aim = null;
    updateBoosters();
    if (rescue) outOfSpace();
  }
  function useAimAt(r, c) {
    const kind = S.aim.kind;
    let cells = [];
    if (kind === 'hammer') { if (!S.grid[r][c]) return; cells = [[r, c]]; }
    else for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const rr2 = r + dr, cc = c + dc; if (rr2 >= 0 && rr2 < N && cc >= 0 && cc < N && S.grid[rr2][cc]) cells.push([rr2, cc]); }
    if (!cells.length) return;
    save.boosters[kind]--;
    S.aim = null;
    blast(cells);
    if (kind === 'bomb') { Sound.tone(90, 0.4, 'sawtooth', 0.25, 0, 40); vibrate([30, 40, 30]); S.shake = S.t; }
    else { Sound.tone(300, 0.12, 'square', 0.12, 0, 120); vibrate(25); }
    updateBoosters();
    afterBoard();
  }
  function useShuffle() {
    if (save.boosters.shuffle <= 0) return;
    save.boosters.shuffle--;
    refillTray();
    Sound.pick(); Sound.bloom();
    updateBoosters();
    afterBoard();
  }
  async function tapBooster(kind) {
    if (S.mode !== 'play' || S.busy) return;
    Sound.init();
    if (S.aim && S.aim.kind === kind) return cancelAim();
    if (save.boosters[kind] <= 0) {
      if (!adReady()) { toast(t('noAdsLeft')); return undefined; }
      S.busy = true;
      const ok = await Ads.showRewarded('booster');
      S.busy = false;
      if (!ok) return undefined;
      save.boosters[kind]++;
      persist();
      toast(t('boosterGot', { name: t(kind) }));
      updateBoosters();
      return undefined;
    }
    if (kind === 'shuffle') return useShuffle();
    return startAim(kind);
  }
  function giveBoosters(kinds) {
    kinds.forEach((k) => { save.boosters[k] = (save.boosters[k] || 0) + 1; });
    persist();
  }
  function updateBoosters() {
    for (const k of BOOSTERS) {
      const el = $('bst-' + k);
      if (!el) continue;
      const n = save.boosters[k] || 0;
      el.querySelector('.cnt').textContent = n > 0 ? n : '▶+1';
      el.classList.toggle('empty', n <= 0);
      el.classList.toggle('active', !!(S.aim && S.aim.kind === k));
    }
  }

  function finish(won) {
    S.mode = 'over';
    S.busy = true;
    S.drag = null;
    S.aim = null;
    $('rescue').classList.add('hidden');
    const n = S.cfg.n;
    let stars = 0, best = false;
    if (S.kind === 'adventure' && won) {
      stars = starsFor();
      const first = !save.stars[n];
      const [base, per] = first ? TUNING.winSeedsFirst : TUNING.winSeedsReplay;
      addSeeds(base + per * stars);
      save.stars[n] = Math.max(save.stars[n] || 0, stars);
      if (save.level === n) save.level = n + 1;
      // every hard level gives a set of power-ups the first time
      if (first && S.cfg.hard) { giveBoosters(BOOSTERS); setTimeout(() => toast(t('allBoosters')), 900); }
    }
    if (S.kind === 'classic' && S.score > save.best) { save.best = S.score; best = true; }
    persist();
    setTimeout(() => {
      if (won) Sound.win(); else Sound.fail();
      $('resStars').innerHTML = S.kind === 'adventure' && won ? [1, 2, 3].map((i) => `<span class="${i <= stars ? '' : 'off'}">★</span>`).join('') : '';
      $('resScore').textContent = S.score;
      $('resSeeds').textContent = S.runSeeds ? t('seedsEarned', { n: S.runSeeds }) : '';
      const dbl = $('resDouble');
      dbl.classList.toggle('hidden', !(S.runSeeds > 0 && adReady()));
      dbl.disabled = false;
      dbl.textContent = '▶ ' + t('doubleSeeds');
      refreshResBuild();
      if (S.kind === 'adventure') {
        $('resTitle').textContent = won ? t('levelComplete') : t('outOfSpace');
        $('resSub').textContent = won ? '' : t('outOfSpaceSub');
        $('resPrimary').textContent = won ? t('next') : t('retry');
        $('resPrimary').onclick = () => afterAd(() => (won ? startLevel(n + 1) : startLevel(n)));
      } else {
        $('resTitle').textContent = best ? t('newBest') : t('gameOver');
        $('resSub').textContent = t('best', { n: save.best });
        $('resPrimary').textContent = t('retry');
        $('resPrimary').onclick = () => afterAd(startClassic);
      }
      $('resSub').classList.toggle('hidden', !$('resSub').textContent);
      $('resSecondary').textContent = t('garden');
      $('resSecondary').onclick = openHome;
      $('result').classList.remove('hidden');
    }, won ? 700 : 900);
  }
  function refreshResBuild() {
    const task = nextTask();
    $('resBuild').classList.toggle('hidden', !canBuild());
    if (task) $('resBuild').textContent = t('buildNow', { task: t('task_' + task.id) });
  }
  async function doubleSeeds() {
    const btn = $('resDouble');
    btn.disabled = true;
    const bonus = S.runSeeds;
    const ok = await Ads.showRewarded('double');
    if (!ok) { btn.disabled = false; toast(adReady() ? t('adFailed') : t('noAdsLeft')); return; }
    addSeeds(bonus);
    persist();
    btn.classList.add('hidden');
    $('resSeeds').textContent = t('doubled', { n: S.runSeeds });
    Sound.bloom();
    refreshResBuild();
  }
  // a rare interstitial between levels, never in the first minutes of play
  let playSeconds = 0;
  async function afterAd(next) {
    $('result').classList.add('hidden');
    await Ads.maybeInterstitial({ playSeconds });
    next();
  }

  // ---------------------------------------------------------------- HUD
  const iconCache = {};
  function flowerIcon(ci) {
    if (!iconCache[ci]) {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      Garden.drawHead(c.getContext('2d'), 32, 32, 24, ci);
      iconCache[ci] = c.toDataURL();
    }
    return iconCache[ci];
  }
  function goalChips(big) {
    const g = S.cfg.goal;
    if (S.cfg.type === 'flowers') {
      return Object.entries(g).map(([k, n]) => {
        const left = Math.max(0, n - (big ? 0 : S.collected[k] || 0));
        return `<div class="goal${left ? '' : ' done'}"><img src="${flowerIcon(+k)}" alt="${tl('flowers', +k)}"><span>${left || '✓'}</span></div>`;
      }).join('');
    }
    if (S.cfg.type === 'score') return `<div class="goal${S.score >= g.score && !big ? ' done' : ''}"><span>${big ? g.score : `${Math.min(S.score, g.score)}/${g.score}`}</span></div>`;
    return `<div class="goal${S.lines >= g.lines && !big ? ' done' : ''}"><span class="lbl">▤</span><span>${big ? g.lines : `${Math.min(S.lines, g.lines)}/${g.lines}`}</span></div>`;
  }
  function updateHud() {
    $('hudLabel').textContent = S.kind === 'adventure' ? t('levelN', { n: S.cfg.n }) : t('best', { n: Math.max(save.best, S.score) });
    $('hudScore').textContent = S.score;
    $('goals').innerHTML = S.kind === 'adventure' ? goalChips(false) : '';
  }
  function showIntro() {
    enterPlay();
    S.busy = true;
    const c = S.cfg;
    $('introLevel').textContent = t('levelN', { n: c.n });
    $('introGoal').textContent = c.type === 'flowers' ? t('goalFlowers') : c.type === 'score' ? t('goalScore', { n: c.goal.score }) : t('goalLines', { n: c.goal.lines });
    $('introGoals').innerHTML = goalChips(true);
    $('introSub').textContent = c.type === 'flowers' ? t('goalFlowersSub') : '';
    $('introSub').classList.toggle('hidden', c.type !== 'flowers');
    $('introHard').classList.toggle('hidden', !c.hard);
    $('intro').classList.remove('hidden');
  }

  // ---------------------------------------------------------------- screens
  const LAYERS = ['home', 'map', 'hud', 'intro', 'result', 'settings', 'build', 'rescue'];
  function showOnly(id) { LAYERS.forEach((l) => $(l).classList.toggle('hidden', l !== id)); }
  function openHome() {
    S.mode = 'home';
    S.parts.length = 0;
    showOnly('home');
    refreshHome();
  }
  function refreshHome() {
    $('homeSeeds').textContent = save.seeds;
    $('playLbl').textContent = t('levelN', { n: save.level });
    $('classicSub').textContent = t('best', { n: save.best });
    $('levelsSub').textContent = `★ ${Object.values(save.stars).reduce((a, b) => a + b, 0)}`;
    const cur = currentGarden(), vg = viewGarden();
    // switch between gardens once a second one is unlocked
    $('gnav').classList.toggle('hidden', cur === 0);
    $('gName').textContent = gardenName(vg);
    $('gPrev').disabled = vg <= 0;
    $('gNext').disabled = vg >= cur;
    const built = builtOf(vg), total = built.length, done = built.filter((v) => v >= 0).length;
    $('chapterLbl').textContent = cur === 0 ? t('chapter', { name: gardenName(vg), a: done, b: total }) : `${done}/${total}`;
    $('welcome').classList.toggle('hidden', done > 0 || save.level > 2 || vg > 0);
    const btn = $('buildBtn');
    const task = vg === cur ? nextTask() : null;
    if (!task) {
      $('taskName').textContent = t('gardenDone', { name: gardenName(vg) });
      $('taskFill').style.width = '100%';
      btn.classList.add('hidden');
      if (vg === GARDENS.length - 1) $('chapterLbl').textContent = t('comingSoon');
      measurePanel();
      return;
    }
    const cost = task.cost;
    $('taskName').textContent = t('task_' + task.id);
    $('taskFill').style.width = `${Math.min(100, (save.seeds / cost) * 100)}%`;
    btn.classList.remove('hidden');
    btn.textContent = save.seeds >= cost ? t('build') : `${Math.min(save.seeds, cost)}/${cost} 🌱`;
    btn.classList.toggle('ready', save.seeds >= cost);
    measurePanel();
  }

  let buildSel = 0;
  function openBuild() {
    const gi = currentGarden(), step = nextStep(), task = nextTask();
    if (!task) return;
    save.view = gi;
    buildSel = 0;
    $('buildChapter').textContent = t('chapter', { name: gardenName(gi), a: step, b: tasksOf(gi).length });
    $('buildTitle').textContent = t('task_' + task.id);
    const box = $('buildOpts');
    box.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const b = document.createElement('button');
      b.className = 'opt' + (i === buildSel ? ' sel' : '');
      const c = document.createElement('canvas');
      const cw = 100, ch = 75, dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.width = cw * dpr; c.height = ch * dpr;
      const g = c.getContext('2d');
      g.scale(dpr, dpr);
      Garden.preview(g, cw, ch, gi, step, i, 1.2);
      b.appendChild(c);
      const lbl = document.createElement('span');
      lbl.textContent = tl('style_' + task.id, i);
      b.appendChild(lbl);
      b.addEventListener('click', () => {
        buildSel = i;
        box.querySelectorAll('.opt').forEach((o, j) => o.classList.toggle('sel', j === i));
      });
      box.appendChild(b);
    }
    const ok = save.seeds >= task.cost;
    $('buildGo').textContent = t('buildFor', { n: task.cost });
    $('buildGo').disabled = !ok;
    $('buildNeed').textContent = ok ? '' : t('needMore', { n: task.cost - save.seeds });
    $('buildNeed').classList.toggle('hidden', ok);
    $('build').classList.remove('hidden');
  }
  function doBuild() {
    const gi = currentGarden(), step = nextStep(), task = nextTask();
    if (!task || save.seeds < task.cost) return;
    save.seeds -= task.cost;
    builtOf(gi)[step] = buildSel;
    save.view = gi;
    // every build step also hands out a power-up
    const gift = BOOSTERS[step % BOOSTERS.length];
    giveBoosters([gift]);
    persist();
    $('build').classList.add('hidden');
    S.appear = { task: step, start: S.t + 0.15 };
    Sound.init();
    Sound.build();
    vibrate([15, 40, 25]);
    // sparkles where the new piece appears
    const a = Garden.anchor(homeView(), gi, step);
    for (let i = 0; i < 36; i++) {
      const ang = rand(0, Math.PI * 2), sp = rand(60, 260);
      S.parts.push({ x: a.x, y: a.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 120, s: rand(3, 7), color: i % 3 ? COLORS[i % NC] : '#ffffff', life: 1.3, max: 1.3, petal: true });
    }
    toast(`${t('built', { task: t('task_' + task.id) })} · ${BOOSTER_ICONS[gift]} +1`);
    if (builtOf(gi).every((v) => v >= 0)) {
      setTimeout(() => toast(t('gardenDone', { name: gardenName(gi) })), 1200);
      if (gi + 1 < GARDENS.length) {
        // move on to the next garden after the celebration
        setTimeout(() => { save.view = gi + 1; persist(); if (S.mode === 'home') { toast(t('newGarden', { name: gardenName(gi + 1) })); refreshHome(); } }, 3200);
      }
    }
    refreshHome();
  }
  function switchGarden(d) {
    save.view = clamp(viewGarden() + d, 0, currentGarden());
    S.appear = null;
    persist();
    refreshHome();
  }

  function openMap() {
    S.mode = 'map';
    showOnly('map');
    const total = Object.values(save.stars).reduce((a, b) => a + b, 0);
    $('mapStars').textContent = total;
    const path = $('path');
    path.innerHTML = '';
    const last = Math.min(save.level + 40, 5000);
    const frag = document.createDocumentFragment();
    for (let n = last; n >= 1; n--) {
      const li = document.createElement('li');
      const st = save.stars[n] || 0, locked = n > save.level;
      li.className = 'node' + (n % 10 === 0 ? ' hard' : '') + (st ? ' done' : '') + (n === save.level ? ' current' : '') + (locked ? ' locked' : '');
      li.style.transform = `translateX(${Math.sin(n * 0.8) * 90}px)`;
      const b = document.createElement('button');
      b.textContent = locked ? '🔒' : n;
      b.setAttribute('aria-label', locked ? `${t('levelN', { n })}, ${t('locked')}` : t('levelN', { n }));
      if (!locked) b.addEventListener('click', () => startLevel(n));
      li.appendChild(b);
      const s = document.createElement('div');
      s.className = 'stars';
      if (st) s.innerHTML = [1, 2, 3].map((i) => `<span class="${i <= st ? '' : 'off'}">★</span>`).join('');
      li.appendChild(s);
      frag.appendChild(li);
    }
    path.appendChild(frag);
    requestAnimationFrame(() => {
      const cur = path.querySelector('.current');
      if (cur) cur.scrollIntoView({ block: 'center' });
    });
  }

  // ---------------------------------------------------------------- input
  cv.addEventListener('pointerdown', (e) => {
    if (S.mode !== 'play' || S.busy || S.drag) return;
    Sound.init();
    if (S.aim) {
      const c = Math.floor((e.clientX - bx) / cs), r = Math.floor((e.clientY - by) / cs);
      if (r >= 0 && r < N && c >= 0 && c < N) useAimAt(r, c); else cancelAim();
      e.preventDefault();
      return;
    }
    for (let i = 0; i < 3; i++) {
      const sl = slots[i];
      if (S.tray[i] && e.clientX >= sl.x && e.clientX <= sl.x + sl.w && e.clientY >= sl.y - cs * 0.5 && e.clientY <= sl.y + sl.h) {
        S.drag = { slot: i, x: e.clientX, y: e.clientY, id: e.pointerId };
        try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        Sound.pick();
        e.preventDefault();
        return;
      }
    }
  }, { passive: false });
  cv.addEventListener('pointermove', (e) => {
    if (!S.drag || e.pointerId !== S.drag.id) return;
    S.drag.x = e.clientX; S.drag.y = e.clientY;
  });
  const endDrag = (e) => {
    if (!S.drag || e.pointerId !== S.drag.id) return;
    const target = dropTarget(), slot = S.drag.slot;
    S.drag = null;
    if (target) place(slot, target[0], target[1]);
  };
  cv.addEventListener('pointerup', endDrag);
  cv.addEventListener('pointercancel', (e) => { if (S.drag && e.pointerId === S.drag.id) S.drag = null; });

  $('playBtn').addEventListener('click', () => { Sound.init(); startLevel(save.level); });
  $('classicBtn').addEventListener('click', () => { Sound.init(); startClassic(); });
  $('levelsBtn').addEventListener('click', () => { Sound.init(); openMap(); });
  $('buildBtn').addEventListener('click', () => { Sound.init(); openBuild(); });
  $('buildGo').addEventListener('click', doBuild);
  $('buildClose').addEventListener('click', () => $('build').classList.add('hidden'));
  $('resBuild').addEventListener('click', () => { openHome(); openBuild(); });
  $('mapBack').addEventListener('click', openHome);
  BOOSTERS.forEach((k) => $('bst-' + k).addEventListener('click', () => tapBooster(k)));
  $('gPrev').addEventListener('click', () => switchGarden(-1));
  $('gNext').addEventListener('click', () => switchGarden(1));
  $('resDouble').addEventListener('click', doubleSeeds);
  $('rescueGiveUp').addEventListener('click', () => finish(false));
  $('setNoAds').addEventListener('click', async () => {
    if (Ads.noAds()) return;
    if (await Ads.purchaseRemoveAds()) { toast(t('adsRemoved')); $('setNoAds').disabled = true; }
  });
  $('hudBack').addEventListener('click', openHome);
  $('introStart').addEventListener('click', () => { $('intro').classList.add('hidden'); S.busy = false; Sound.init(); });
  $('settingsBtn').addEventListener('click', () => {
    $('setSound').checked = save.settings.sound;
    $('setVibe').checked = save.settings.vibe;
    $('setLang').value = save.settings.lang;
    $('setNoAds').disabled = Ads.noAds();
    $('settings').classList.remove('hidden');
  });
  $('setClose').addEventListener('click', () => $('settings').classList.add('hidden'));
  $('setSound').addEventListener('change', (e) => { save.settings.sound = e.target.checked; persist(); });
  $('setVibe').addEventListener('change', (e) => { save.settings.vibe = e.target.checked; persist(); vibrate(20); });
  $('setLang').addEventListener('change', (e) => { save.settings.lang = e.target.value; persist(); applyI18n(); openHome(); $('settings').classList.remove('hidden'); });

  // ---------------------------------------------------------------- loop
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(1 / 30, Math.max(0, (now - last) / 1000));
    last = now;
    if (innerWidth !== W || innerHeight !== H) { layout(); if (S.mode === 'home') measurePanel(); }
    if (!W || !H) return;
    S.t += dt;
    if (S.mode === 'play' && !S.busy) playSeconds += dt;
    for (let i = S.fx.length - 1; i >= 0; i--) { S.fx[i].t += dt; if (S.fx[i].t > 0.35) S.fx.splice(i, 1); }
    for (let i = S.parts.length - 1; i >= 0; i--) {
      const q = S.parts[i];
      q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += (q.petal ? 180 : 700) * dt;
      if (q.petal) q.vx *= 0.98;
      if (q.life <= 0) S.parts.splice(i, 1);
    }
    for (let i = S.pops.length - 1; i >= 0; i--) { const p = S.pops[i]; p.life -= dt; p.y -= 30 * dt; if (p.life <= 0) S.pops.splice(i, 1); }
    try { render(); } catch (err) { console.error(err); }
  }

  applyI18n();
  layout();
  openHome();
  Ads.init();
  requestAnimationFrame(frame);
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
  window.__bb = { S, save, outOfSpace, tapBooster, useAimAt, switchGarden, startLevel, startClassic, place, fits, levelConfig, buildBoard, fitsAnywhere, geom: () => ({ cs, bx, by, slots }), pieceSize, openHome, openBuild, doBuild, persist };
})();
