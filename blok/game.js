/* Block Journey — drag blocks onto an 8×8 board, clear rows and columns.
 * Adventure: procedurally generated levels (seeded by level number, so every player
 * sees the same board) with three goal types: collect gems, reach a score, clear lines.
 * Classic: endless, beat your best score.
 */
(() => {
  'use strict';

  // ---------------------------------------------------------------- helpers
  const $ = (id) => document.getElementById(id);
  const TAU = Math.PI * 2;
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

  // ---------------------------------------------------------------- save + language
  const SAVE_KEY = 'bj.save.v1';
  const deviceLang = (navigator.language || 'en').toLowerCase().startsWith('tr') ? 'tr' : 'en';
  const DEFAULTS = { level: 1, stars: {}, best: 0, settings: { sound: true, vibe: true, lang: deviceLang } };
  const save = (() => {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
      return { ...JSON.parse(JSON.stringify(DEFAULTS)), ...s, settings: { ...DEFAULTS.settings, ...(s.settings || {}) } };
    } catch (e) { return JSON.parse(JSON.stringify(DEFAULTS)); }
  })();
  const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* private mode */ } };
  const I18N = window.BJ_I18N;
  const t = (k, p = {}) => String((I18N[save.settings.lang] || I18N.en)[k] ?? I18N.en[k] ?? k).replace(/\{(\w+)\}/g, (_, x) => p[x]);
  function applyI18n() {
    document.documentElement.lang = save.settings.lang;
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
    document.title = t('appName');
  }

  // ---------------------------------------------------------------- pieces
  const COLORS = ['#ff5a5f', '#ffb400', '#3ec76a', '#2fa8ff', '#9b6bff', '#ff7ab8', '#1fc9b8'];
  const GEMS = { ruby: '#ff4d6d', sapphire: '#43a8ff', emerald: '#2fd07a' };
  const GEM_KEYS = Object.keys(GEMS);

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
    const type = n <= 2 ? 'gems' : n === 3 ? 'lines' : ['gems', 'score', 'lines'][(rng() * 3) | 0];
    const density = n <= 3 ? 0.08 : clamp(0.07 + d * 0.2 + (hard ? 0.07 : 0) + (rng() - 0.5) * 0.06, 0.05, 0.36);
    const pattern = n <= 3 ? 'scatter' : PATTERNS[(rng() * PATTERNS.length) | 0];
    const boost = hard ? 1.15 : 1;
    let goal, par;
    if (type === 'gems') {
      const kinds = n < 8 ? 1 : n < 30 ? (rng() < 0.5 ? 1 : 2) : rng() < 0.35 ? 3 : 2;
      const keys = [...GEM_KEYS].sort(() => rng() - 0.5).slice(0, kinds);
      goal = {};
      for (const k of keys) goal[k] = Math.max(3, Math.round((3 + d * 9 + rng() * 2) * boost / Math.sqrt(kinds)));
      par = Math.round(Object.values(goal).reduce((a, b) => a + b, 0) * 1.6 + 9);
    } else if (type === 'score') {
      goal = { score: Math.round(((200 + Math.min(n, 300) * 2.5 + Math.max(0, n - 300)) * boost) / 50) * 50 };
      par = Math.round(goal.score / 9);
    } else {
      goal = { lines: Math.round((4 + d * 14) * boost) };
      par = Math.round(goal.lines * 2.6 + 3);
    }
    return { n, hard, d, type, density, pattern, goal, par, seed: n * 104729 + 7 };
  }

  function buildBoard(cfg) {
    const rng = mulberry32(cfg.seed);
    const g = Array.from({ length: N }, () => Array(N).fill(null));
    const col = () => COLORS[(rng() * COLORS.length) | 0];
    const set = (r, c, color) => { if (r >= 0 && r < N && c >= 0 && c < N) g[r][c] = { color, gem: null }; };
    const p = cfg.density;
    switch (cfg.pattern) {
      case 'mirror': for (let r = 0; r < N; r++) for (let c = 0; c < N / 2; c++) if (rng() < p) { const k = col(); set(r, c, k); set(r, N - 1 - c, k); } break;
      case 'rows': { const k = col(); for (let r = N - 1; r >= 0; r--) if (rng() < p * 1.6) for (let c = 0; c < N; c++) if (rng() < 0.8) set(r, c, k); break; }
      case 'frame': for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { const ring = Math.min(r, c, N - 1 - r, N - 1 - c); if (rng() < p * (ring === 0 ? 2.2 : ring === 1 ? 0.8 : 0.3)) set(r, c, ring === 0 ? COLORS[3] : col()); } break;
      case 'diamond': for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { const dd = Math.abs(r - 3.5) + Math.abs(c - 3.5); if (dd < 1 + p * 8 && rng() < 0.85) set(r, c, dd < 2 ? COLORS[4] : COLORS[5]); } break;
      case 'blocks': { let tries = 0; while (count(g) < p * N * N && tries++ < 60) { const r = (rng() * (N - 1)) | 0, c = (rng() * (N - 1)) | 0, k = col(); set(r, c, k); set(r + 1, c, k); set(r, c + 1, k); set(r + 1, c + 1, k); } break; }
      default: for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (rng() < p) set(r, c, col());
    }
    // never start with a line already full
    for (let i = 0; i < N; i++) {
      if (g[i].every(Boolean)) g[i][(rng() * N) | 0] = null;
      if (g.every((row) => row[i])) g[(rng() * N) | 0][i] = null;
    }
    // gems sit inside some of the starting blocks
    if (cfg.type === 'gems') {
      const filled = [];
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (g[r][c]) filled.push(g[r][c]);
      filled.sort(() => rng() - 0.5);
      for (const [k, need] of Object.entries(cfg.goal)) {
        for (let i = 0; i < Math.ceil(need * 0.5) && filled.length; i++) filled.pop().gem = k;
      }
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
      const base = 523 * Math.pow(2, Math.min(streak, 6) / 12);
      for (let i = 0; i < Math.min(lines + 2, 7); i++) this.tone(base * Math.pow(2, scale[i] / 12), 0.22, 'triangle', 0.18, i * 0.05);
    },
    gem() { this.tone(1760, 0.16, 'sine', 0.14); this.tone(2637, 0.2, 'sine', 0.08, 0.04); },
    win() { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.2, i * 0.09)); },
    fail() { [392, 330, 262].forEach((f, i) => this.tone(f, 0.35, 'sine', 0.2, i * 0.14)); },
  };
  const vibrate = (ms) => { if (save.settings.vibe && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* none */ } } };

  // ---------------------------------------------------------------- state
  const S = {
    mode: 'home', // home | map | play | over
    kind: 'adventure', // adventure | classic
    cfg: null, grid: null, tray: [null, null, null],
    score: 0, streak: 0, pieces: 0, collected: {}, lines: 0,
    drag: null, fx: [], parts: [], pops: [], t: 0, trayAnim: 0, busy: false,
  };

  // ---------------------------------------------------------------- canvas + layout
  const cv = $('cv');
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, DPR = 1, cs = 40, bx = 0, by = 0, slots = [];
  function layout() {
    DPR = Math.min(window.devicePixelRatio || 1, 2.5);
    W = innerWidth; H = innerHeight;
    cv.width = Math.floor(W * DPR); cv.height = Math.floor(H * DPR);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const top = 96, bottom = 24;
    const avail = Math.max(100, H - top - bottom);
    cs = Math.floor(Math.min((W - 28) / N, avail / 11.8, 64));
    const total = cs * N + cs * 0.6 + cs * 3.2;
    bx = Math.round((W - cs * N) / 2);
    by = Math.round(top + Math.max(0, (avail - total) * 0.4));
    const ty = by + cs * N + cs * 0.6, sw = Math.min(W, cs * N + 40) / 3, sx0 = (W - sw * 3) / 2;
    slots = [0, 1, 2].map((i) => ({ x: sx0 + sw * i, y: ty, w: sw, h: cs * 3.2 }));
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
  function drawBlock(x, y, s, color, a = 1, gem = null) {
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
    if (gem) drawGem(x + s / 2, y + s * 0.47, s * 0.34, GEMS[gem]);
    ctx.globalAlpha = 1;
  }
  function drawGem(cx, cy, r, color) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy - r * 0.2); ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r, cy - r * 0.2); ctx.closePath();
    ctx.fillStyle = color; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = Math.max(1, r * 0.14); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - r, cy - r * 0.2); ctx.lineTo(cx + r, cy - r * 0.2); ctx.moveTo(cx, cy - r); ctx.lineTo(cx - r * 0.35, cy - r * 0.2); ctx.lineTo(cx, cy + r); ctx.lineTo(cx + r * 0.35, cy - r * 0.2); ctx.closePath();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = Math.max(0.8, r * 0.08); ctx.stroke();
  }
  const pieceSize = (p) => { let h = 0, w = 0; for (const [r, c] of p.cells) { h = Math.max(h, r + 1); w = Math.max(w, c + 1); } return [w, h]; };

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
    if (S.mode !== 'play' && S.mode !== 'over') return;
    // board
    rr(bx - 8, by - 8, cs * N + 16, cs * N + 16, 16);
    ctx.fillStyle = '#152049'; ctx.fill();
    const target = dropTarget();
    const hl = target ? wouldClear(S.tray[S.drag.slot], target[0], target[1]) : { rows: [], cols: [] };
    const hlColor = S.drag ? S.tray[S.drag.slot].color : null;
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const x = bx + c * cs, y = by + r * cs, cell = S.grid[r][c];
        const inHl = hl.rows.includes(r) || hl.cols.includes(c);
        if (cell) drawBlock(x, y, cs, inHl ? hlColor : cell.color, 1, cell.gem);
        else {
          rr(x + cs * 0.05, y + cs * 0.05, cs * 0.9, cs * 0.9, cs * 0.14);
          ctx.fillStyle = inHl ? 'rgba(255,255,255,0.08)' : '#1f2c5f'; ctx.fill();
        }
      }
    }
    // ghost of the piece where it would land
    if (target) {
      const p = S.tray[S.drag.slot];
      for (const [dr, dc] of p.cells) drawBlock(bx + (target[1] + dc) * cs, by + (target[0] + dr) * cs, cs, p.color, 0.45);
    }
    // clearing cells
    for (const f of S.fx) {
      const k = clamp(f.t / 0.35, 0, 1), s = cs * (1 - easeOut(k) * 0.6);
      drawBlock(f.x + (cs - s) / 2, f.y + (cs - s) / 2, s, f.color, 1 - k, f.gem);
      if (k < 0.3) { ctx.fillStyle = `rgba(255,255,255,${alpha(0.6 * (1 - k / 0.3))})`; rr(f.x, f.y, cs, cs, cs * 0.15); ctx.fill(); }
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
      for (const [dr, dc] of p.cells) {
        const g = p.gems && p.gems[`${dr},${dc}`];
        drawBlock(ox + dc * ss, oy + dr * ss, ss, ok ? p.color : '#5a6390', ok ? 1 : 0.55, g);
      }
    }
    // dragged piece, lifted above the finger
    if (S.drag) {
      const p = S.tray[S.drag.slot], [w, h] = pieceSize(p);
      const x = S.drag.x - (w * cs) / 2, y = S.drag.y - cs * 1.3 - h * cs;
      for (const [dr, dc] of p.cells) drawBlock(x + dc * cs, y + dr * cs, cs, p.color, 0.95, p.gems && p.gems[`${dr},${dc}`]);
    }
    // particles
    for (const q of S.parts) {
      ctx.globalAlpha = clamp(q.life / q.max, 0, 1);
      ctx.fillStyle = q.color;
      ctx.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s);
    }
    ctx.globalAlpha = 1;
    // popups
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const p of S.pops) {
      const k = 1 - p.life / p.max;
      const sc = k < 0.15 ? easeOut(k / 0.15) * 1.15 : 1.15 - Math.min(0.15, k - 0.15);
      ctx.globalAlpha = clamp(p.life / (p.max * 0.35), 0, 1);
      ctx.font = `900 ${p.size * sc}px Nunito, ui-rounded, system-ui, sans-serif`;
      ctx.lineWidth = p.size * 0.16; ctx.strokeStyle = 'rgba(10,14,40,0.75)';
      ctx.strokeText(p.text, p.x, p.y); ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
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
    const piece = { cells: SHAPES[i].cells, color: COLORS[(Math.random() * COLORS.length) | 0], gems: null };
    // in gem levels, some pieces carry a gem so the goal can always be finished
    if (S.kind === 'adventure' && S.cfg.type === 'gems') {
      const need = Object.entries(S.cfg.goal).filter(([k, n]) => (S.collected[k] || 0) + gemsOnBoard(k) < n + 1);
      if (need.length && Math.random() < 0.5) {
        const [dr, dc] = piece.cells[(Math.random() * piece.cells.length) | 0];
        piece.gems = { [`${dr},${dc}`]: need[(Math.random() * need.length) | 0][0] };
      }
    }
    return piece;
  }
  function gemsOnBoard(k) { let n = 0; for (const row of S.grid) for (const x of row) if (x && x.gem === k) n++; return n; }
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
    const need = 3;
    let bestTray = null, bestScore = -1;
    for (let tries = 0; tries < 30; tries++) {
      const tray = [newPiece(d), newPiece(d), newPiece(d)];
      const ok = placeableInSequence(tray);
      if (ok > bestScore) { bestScore = ok; bestTray = tray; }
      if (ok >= need) break;
    }
    S.tray = bestTray;
    S.trayAnim = S.t;
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
    S.mode = 'play';
    showOnly('hud');
    updateHud();
  }
  function resetRun() {
    Object.assign(S, { score: 0, streak: 0, pieces: 0, collected: {}, lines: 0, drag: null, busy: false });
    S.fx.length = 0; S.parts.length = 0; S.pops.length = 0;
    refillTray();
  }

  function place(slot, r, c) {
    const p = S.tray[slot];
    for (const [dr, dc] of p.cells) S.grid[r + dr][c + dc] = { color: p.color, gem: (p.gems && p.gems[`${dr},${dc}`]) || null };
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
      const cleared = new Set();
      rows.forEach((rr2) => { for (let j = 0; j < N; j++) cleared.add(rr2 * N + j); });
      cols.forEach((cc) => { for (let j = 0; j < N; j++) cleared.add(j * N + cc); });
      let gemHit = false;
      for (const k of cleared) {
        const rr2 = (k / N) | 0, cc = k % N, cell = S.grid[rr2][cc];
        const x = bx + cc * cs, y = by + rr2 * cs;
        S.fx.push({ x, y, color: cell.color, gem: cell.gem, t: 0 });
        for (let i = 0; i < 4; i++) S.parts.push({ x: x + cs / 2, y: y + cs / 2, vx: rand(-160, 160), vy: rand(-260, -40), s: rand(3, 7), color: cell.color, life: 0.7, max: 0.7 });
        if (cell.gem) { S.collected[cell.gem] = (S.collected[cell.gem] || 0) + 1; gemHit = true; }
        S.grid[rr2][cc] = null;
      }
      S.lines += lines;
      const gain = Math.round(10 * lines * (lines + 1) * (1 + (S.streak - 1) * 0.5));
      S.score += gain;
      Sound.clear(lines, S.streak);
      if (gemHit) setTimeout(() => Sound.gem(), 120);
      vibrate(lines > 1 ? [20, 30, 20] : 15);
      const cy = by + (rows.length ? (rows[0] + 0.5) * cs : cs * N * 0.5);
      const word = lines >= 5 ? 'amazing' : lines === 4 ? 'excellent' : lines === 3 ? 'great' : lines === 2 ? 'nice' : null;
      if (word) pop(t(word), W / 2, cy - 24, '#ffe07a', 34);
      pop(`+${gain}`, W / 2, cy + 12, '#ffffff', 24);
      if (S.streak >= 2) pop(t('combo', { n: S.streak }), W / 2, by - 4, '#8fd3ff', 22);
    } else {
      S.streak = 0;
    }
    if (S.tray.every((x) => !x)) refillTray();
    updateHud();

    if (S.kind === 'adventure' && goalMet()) return finish(true);
    if (!S.tray.some((x) => x && fitsAnywhere(x))) finish(false);
  }

  function pop(text, x, y, color, size) { S.pops.push({ text, x, y, color, size, life: 1.1, max: 1.1 }); }

  function goalMet() {
    const g = S.cfg.goal;
    if (S.cfg.type === 'gems') return Object.entries(g).every(([k, n]) => (S.collected[k] || 0) >= n);
    if (S.cfg.type === 'score') return S.score >= g.score;
    return S.lines >= g.lines;
  }
  function starsFor() { const par = S.cfg.par; return S.pieces <= par ? 3 : S.pieces <= par * 1.35 ? 2 : 1; }

  function finish(won) {
    S.mode = 'over';
    S.busy = true;
    S.drag = null;
    const n = S.cfg.n;
    let stars = 0, best = false;
    if (S.kind === 'adventure' && won) {
      stars = starsFor();
      save.stars[n] = Math.max(save.stars[n] || 0, stars);
      if (save.level === n) save.level = n + 1;
    }
    if (S.kind === 'classic' && S.score > save.best) { save.best = S.score; best = true; }
    persist();
    setTimeout(() => {
      if (won) Sound.win(); else Sound.fail();
      $('resStars').innerHTML = S.kind === 'adventure' && won ? [1, 2, 3].map((i) => `<span class="${i <= stars ? '' : 'off'}">★</span>`).join('') : '';
      $('resScore').textContent = S.score;
      if (S.kind === 'adventure') {
        $('resTitle').textContent = won ? t('levelComplete') : t('outOfSpace');
        $('resSub').textContent = won ? t('piecesUsed', { n: S.pieces }) : t('outOfSpaceSub');
        $('resPrimary').textContent = won ? t('next') : t('retry');
        $('resSecondary').textContent = t('map');
        $('resPrimary').onclick = () => (won ? startLevel(n + 1) : startLevel(n));
        $('resSecondary').onclick = openMap;
      } else {
        $('resTitle').textContent = best ? t('newBest') : t('gameOver');
        $('resSub').textContent = t('best', { n: save.best });
        $('resPrimary').textContent = t('retry');
        $('resSecondary').textContent = t('home');
        $('resPrimary').onclick = startClassic;
        $('resSecondary').onclick = openHome;
      }
      $('result').classList.remove('hidden');
    }, won ? 700 : 900);
  }

  // ---------------------------------------------------------------- HUD
  const gemSvg = (c) => `<svg viewBox="0 0 20 20"><path d="M10 1.5 18.5 7.5 10 18.5 1.5 7.5Z" fill="${c}" stroke="#fff" stroke-opacity=".85" stroke-width="1.4"/><path d="M1.5 7.5h17M10 1.5 6.8 7.5 10 18.5 13.2 7.5Z" fill="none" stroke="#fff" stroke-opacity=".4"/></svg>`;
  function goalChips(big) {
    const g = S.cfg.goal;
    if (S.cfg.type === 'gems') {
      return Object.entries(g).map(([k, n]) => {
        const left = Math.max(0, n - (big ? 0 : S.collected[k] || 0));
        return `<div class="goal${left ? '' : ' done'}">${gemSvg(GEMS[k])}<span>${left || '✓'}</span></div>`;
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
    S.mode = 'play';
    S.busy = true;
    showOnly('hud');
    updateHud();
    const c = S.cfg;
    $('introLevel').textContent = t('levelN', { n: c.n });
    $('introGoal').textContent = c.type === 'gems' ? t('goalGems') : c.type === 'score' ? t('goalScore', { n: c.goal.score }) : t('goalLines', { n: c.goal.lines });
    $('introGoals').innerHTML = goalChips(true);
    $('introHard').classList.toggle('hidden', !c.hard);
    $('intro').classList.remove('hidden');
  }

  // ---------------------------------------------------------------- screens
  const LAYERS = ['home', 'map', 'hud', 'intro', 'result', 'settings'];
  function showOnly(id) { LAYERS.forEach((l) => $(l).classList.toggle('hidden', l !== id)); }
  function openHome() {
    S.mode = 'home';
    showOnly('home');
    $('advSub').textContent = t('levelN', { n: save.level });
    $('classicSub').textContent = t('best', { n: save.best });
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

  $('advBtn').addEventListener('click', () => { Sound.init(); openMap(); });
  $('classicBtn').addEventListener('click', () => { Sound.init(); startClassic(); });
  $('mapBack').addEventListener('click', openHome);
  $('hudBack').addEventListener('click', () => (S.kind === 'adventure' ? openMap() : openHome()));
  $('introStart').addEventListener('click', () => { $('intro').classList.add('hidden'); S.busy = false; Sound.init(); });
  $('settingsBtn').addEventListener('click', () => {
    $('setSound').checked = save.settings.sound;
    $('setVibe').checked = save.settings.vibe;
    $('setLang').value = save.settings.lang;
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
    if (innerWidth !== W || innerHeight !== H) layout();
    if (!W || !H) return;
    S.t += dt;
    for (let i = S.fx.length - 1; i >= 0; i--) { S.fx[i].t += dt; if (S.fx[i].t > 0.35) S.fx.splice(i, 1); }
    for (let i = S.parts.length - 1; i >= 0; i--) {
      const q = S.parts[i];
      q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 700 * dt;
      if (q.life <= 0) S.parts.splice(i, 1);
    }
    for (let i = S.pops.length - 1; i >= 0; i--) { const p = S.pops[i]; p.life -= dt; p.y -= 30 * dt; if (p.life <= 0) S.pops.splice(i, 1); }
    try { render(); } catch (err) { console.error(err); }
  }

  applyI18n();
  layout();
  openHome();
  requestAnimationFrame(frame);
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
  window.__bj = { S, save, startLevel, startClassic, place, fits, levelConfig, buildBoard, fitsAnywhere, geom: () => ({ cs, bx, by, slots }), pieceSize };
})();
