/* Bloom Blast — the gardens. Procedurally drawn 2.5D scenes that grow as the player builds.
 * World units: x runs about -1..1 across the stage, z runs 0 (back, horizon) .. 1 (front).
 * The same scene is drawn full screen on the home screen and as a live strip above the board.
 * Light comes from the sun on the upper right, so shadows fall to the left.
 * Hills and ground are static per view, so they are rendered once into an offscreen canvas.
 */
window.Garden = (() => {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const shade = (h, amt) => {
    if (h[0] !== '#') return h;
    const c = hexRgb(h).map((v) => clamp(Math.round(v + 255 * amt), 0, 255));
    return `rgb(${c.join(',')})`;
  };
  const rgba = (h, a) => { const c = hexRgb(h); return `rgba(${c[0]},${c[1]},${c[2]},${clamp(a, 0, 1).toFixed(3)})`; };
  const easeBack = (k) => { k = clamp(k, 0, 1); const c = 1.7; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
  function mulberry32(a) {
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // block colors double as flower colors: clearing red blocks blooms tulips, and so on
  const FLOWER_COLORS = ['#ff5a5f', '#ff9f1c', '#ffd23f', '#3fa9ff', '#9b6bff', '#ff7ab8'];
  const FLOWER_KINDS = ['tulip', 'marigold', 'sunflower', 'cornflower', 'lavender', 'rose'];

  // Each garden: build steps in order (three styles each) and where each step sits [x, z, preview zoom]
  const GARDENS = [
    {
      id: 'cottage',
      tasks: [
        { id: 'lawn', cost: 15 }, { id: 'flowers', cost: 25 }, { id: 'fence', cost: 35 }, { id: 'tree', cost: 50 }, { id: 'path', cost: 65 },
        { id: 'cottage', cost: 80 }, { id: 'pond', cost: 100 }, { id: 'bench', cost: 125 }, { id: 'butterflies', cost: 150 }, { id: 'beehive', cost: 180 },
      ],
      focus: [[0, 0.4, 1], [-0.55, 0.78, 2.4], [0, 0, 3], [-0.74, 0.12, 1.1], [0.22, 0.5, 1.1], [0.36, 0.04, 1.3], [-0.18, 0.44, 1.5], [-0.44, 0.3, 2.6], [0, 0.3, 0.9], [0.8, 0.46, 2.6]],
    },
    {
      id: 'japanese',
      tasks: [
        { id: 'j_ground', cost: 30 }, { id: 'j_fence', cost: 45 }, { id: 'j_tree', cost: 60 }, { id: 'j_path', cost: 75 }, { id: 'j_lantern', cost: 95 },
        { id: 'j_pond', cost: 115 }, { id: 'j_bridge', cost: 140 }, { id: 'j_shrubs', cost: 170 }, { id: 'j_teahouse', cost: 200 }, { id: 'j_torii', cost: 240 },
      ],
      focus: [[0, 0.4, 1], [0, 0, 2.6], [-0.74, 0.14, 1.1], [0.3, 0.6, 1.1], [0.66, 0.55, 2.6], [-0.12, 0.52, 1.2], [-0.12, 0.52, 1.4], [-0.6, 0.82, 2.2], [0.45, 0.04, 1.3], [-0.22, 0.08, 1.3]],
    },
  ];

  // fixed pseudo random numbers so decorations never jump between frames
  const R = (() => { const r = mulberry32(99); return Array.from({ length: 600 }, () => r()); })();
  // foliage clusters of a tree crown, back ones first
  const CROWN = Array.from({ length: 18 }, (_, i) => {
    const a = R[i] * TAU, d = Math.sqrt(R[i + 20]) * 0.19;
    return { dx: Math.cos(a) * d * 1.25, dy: Math.sin(a) * d * 0.85 - 0.01, r: 0.075 + R[i + 40] * 0.06, back: i < 7 };
  });

  let g = null; // current 2d context
  let V = null; // current view
  let G = GARDENS[0];
  const P = (x, z) => ({ x: V.cx + x * V.s, y: V.groundY + z * V.depth, k: 0.72 + 0.45 * z });

  // ---------------------------------------------------------------- primitives
  function ell(x, y, rx, ry, col, rot = 0) {
    g.beginPath(); g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU);
    g.fillStyle = col; g.fill();
  }
  const circ = (x, y, r, col) => ell(x, y, r, r, col);
  function rect(x, y, w, h, col) { g.fillStyle = col; g.fillRect(x, y, w, h); }
  function poly(pts, col) {
    g.beginPath(); g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.closePath(); g.fillStyle = col; g.fill();
  }
  function line(x1, y1, x2, y2, col, w) {
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2);
    g.strokeStyle = col; g.lineWidth = Math.max(0.5, w); g.lineCap = 'round'; g.stroke();
  }
  function lin(x0, y0, x1, y1, stops) {
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    stops.forEach(([o, c]) => gr.addColorStop(o, c));
    return gr;
  }
  // a sphere lit from the upper right
  function ball(x, y, r, col, rx = r) {
    if (r <= 0.3) return;
    const gr = g.createRadialGradient(x + r * 0.35, y - r * 0.45, r * 0.08, x, y, r * 1.05);
    gr.addColorStop(0, shade(col, 0.16)); gr.addColorStop(0.55, col); gr.addColorStop(1, shade(col, -0.17));
    g.beginPath(); g.ellipse(x, y, rx, r, 0, 0, TAU); g.fillStyle = gr; g.fill();
  }
  // soft contact shadow, pushed left (sun on the right)
  function shadow(x, y, rx, ry, a = 0.26) {
    if (rx <= 0.3) return;
    const cx = x - rx * 0.3;
    const gr = g.createRadialGradient(cx, y, 0, cx, y, rx);
    gr.addColorStop(0, `rgba(25,40,15,${a})`); gr.addColorStop(1, 'rgba(25,40,15,0)');
    g.save(); g.translate(cx, y); g.scale(1, ry / rx); g.translate(-cx, -y);
    g.beginPath(); g.arc(cx, y, rx, 0, TAU); g.fillStyle = gr; g.fill();
    g.restore();
  }

  // ---------------------------------------------------------------- flowers
  // mono: draw a single-color silhouette (used as an emblem on blocks)
  function head(x, y, r, kind, col, mono) {
    if (r < 0.4) return;
    const c = (v) => mono || v;
    switch (kind) {
      case 'tulip':
        poly([x - r * 0.8, y - r * 0.7, x - r * 0.4, y - r * 0.2, x, y - r * 0.85, x + r * 0.4, y - r * 0.2, x + r * 0.8, y - r * 0.7, x + r * 0.7, y + r * 0.35, x, y + r * 0.8, x - r * 0.7, y + r * 0.35], c(col));
        if (!mono) poly([x, y - r * 0.85, x + r * 0.4, y - r * 0.2, x + r * 0.8, y - r * 0.7, x + r * 0.7, y + r * 0.35, x, y + r * 0.8], shade(col, 0.1));
        break;
      case 'lavender':
        for (let i = 0; i < 6; i++) ell(x + (i % 2 ? r * 0.22 : -r * 0.22), y + r * 0.9 - i * r * 0.36, r * 0.26, r * 0.2, c(i % 2 ? col : shade(col, 0.12)));
        break;
      case 'sunflower':
        g.fillStyle = c(col);
        for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; g.beginPath(); g.ellipse(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.4, r * 0.17, a, 0, TAU); g.fill(); }
        if (!mono) { circ(x, y, r * 0.44, '#6b3f1f'); circ(x - r * 0.1, y - r * 0.1, r * 0.16, '#8a5a2e'); }
        break;
      case 'marigold':
        for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; circ(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.42, c(col)); }
        circ(x, y, r * 0.55, c(shade(col, -0.1)));
        if (!mono) circ(x, y, r * 0.24, shade(col, -0.25));
        break;
      case 'cornflower':
        g.fillStyle = c(col);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU;
          g.beginPath(); g.moveTo(x, y);
          g.lineTo(x + Math.cos(a - 0.3) * r, y + Math.sin(a - 0.3) * r);
          g.lineTo(x + Math.cos(a) * r * 1.08, y + Math.sin(a) * r * 1.08);
          g.lineTo(x + Math.cos(a + 0.3) * r, y + Math.sin(a + 0.3) * r);
          g.closePath(); g.fill();
        }
        if (!mono) circ(x, y, r * 0.3, shade(col, -0.3));
        break;
      case 'rose':
        circ(x, y, r * 0.88, c(shade(col, -0.1)));
        if (!mono) { circ(x + r * 0.1, y - r * 0.05, r * 0.64, col); circ(x - r * 0.05, y + r * 0.05, r * 0.4, shade(col, -0.16)); circ(x + r * 0.04, y - r * 0.02, r * 0.18, shade(col, 0.1)); }
        break;
      default: // daisy
        g.fillStyle = c(col);
        for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; g.beginPath(); g.ellipse(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.48, r * 0.22, a, 0, TAU); g.fill(); }
        if (!mono) circ(x, y, r * 0.3, '#ffcf3a');
    }
  }
  function flower(x, y, h, kind, col, sway = 0) {
    if (h < 1) return;
    const hx = x + sway * h * 0.12, hy = y - h;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x, y - h * 0.55, hx, hy);
    g.strokeStyle = '#3d7f33'; g.lineWidth = Math.max(1, h * 0.06); g.lineCap = 'round'; g.stroke();
    if (h > 9) { ell(x + h * 0.1, y - h * 0.32, h * 0.13, h * 0.05, '#4f9a40', -0.6); ell(x - h * 0.08, y - h * 0.2, h * 0.11, h * 0.045, '#44893a', 0.6); }
    head(hx, hy, h * (kind === 'lavender' ? 0.3 : 0.27), kind, col);
  }

  // ---------------------------------------------------------------- sky (animated)
  function sky() {
    const hz = V.groundY, skyH = hz - V.y, glow = runEnv(V.run && V.run.rainbow, 5.5);
    g.fillStyle = lin(0, V.y, 0, hz, [[0, glow > 0 ? `rgb(${Math.round(84 + 70 * glow)},${Math.round(165 + 40 * glow)},235)` : '#54a5e4'], [0.6, '#9fd0f0'], [1, '#e9f5fb']]);
    g.fillRect(V.x, V.y, V.w, skyH + 4);
    // sun with a wide soft glow
    const sx = V.x + V.w * 0.84, sy = V.y + skyH * 0.3, sr = Math.max(7, skyH * 0.1);
    const burst = runEnv(V.run && V.run.burst, 1.4);
    const sg = g.createRadialGradient(sx, sy, sr * 0.5, sx, sy, sr * (4.5 + burst * 3));
    sg.addColorStop(0, `rgba(255,245,200,${(0.8 + burst * 0.2).toFixed(3)})`); sg.addColorStop(0.3, 'rgba(255,240,190,0.25)'); sg.addColorStop(1, 'rgba(255,240,190,0)');
    g.fillStyle = sg; g.fillRect(V.x, V.y, V.w, skyH);
    const core = g.createRadialGradient(sx, sy, 0, sx, sy, sr);
    core.addColorStop(0, '#fffdf2'); core.addColorStop(0.7, '#fff2b8'); core.addColorStop(1, '#ffe38a');
    g.beginPath(); g.arc(sx, sy, sr * (1 + burst * 0.2), 0, TAU); g.fillStyle = core; g.fill();
    // clouds drift slowly; higher ones are smaller
    for (let i = 0; i < 4; i++) {
      const cw = Math.max(26, Math.min(V.w * 0.22, skyH * 0.9)) * (1 - i * 0.15);
      const u = ((R[i + 500] + V.t * 0.008 * (1 + i * 0.35)) % 1.35) - 0.2;
      cloud(V.x + u * V.w, V.y + skyH * (0.14 + i * 0.13), cw);
    }
    const rb = runEnv(V.run && V.run.rainbow, 5.5);
    if (rb > 0) {
      const cols = ['#ff5a5f', '#ff9f1c', '#ffd23f', '#5ccf6b', '#3fa9ff', '#9b6bff'];
      const rad = Math.min(V.w * 0.42, skyH * 1.6), bw = Math.max(2, rad * 0.05);
      g.globalAlpha = rb * 0.7;
      cols.forEach((col, i) => { g.beginPath(); g.arc(V.x + V.w * 0.5, hz + rad * 0.15, rad - i * bw, Math.PI, TAU); g.strokeStyle = col; g.lineWidth = bw + 0.5; g.stroke(); });
      g.globalAlpha = 1;
    }
  }
  function runEnv(start, dur) {
    if (start == null) return 0;
    const a = V.t - start;
    if (a < 0 || a > dur) return 0;
    return Math.min(1, a / 0.5, (dur - a) / 1.2);
  }
  function cloud(x, y, w) {
    const puffs = [[-0.28, 0.02, 0.2], [-0.1, -0.08, 0.24], [0.12, -0.1, 0.26], [0.3, 0, 0.19], [0, 0.04, 0.3]];
    for (const [dx, dy, r] of puffs) ell(x + dx * w, y + dy * w + w * 0.03, r * w, r * w * 0.7, 'rgba(150,170,195,0.25)');
    for (const [dx, dy, r] of puffs) ell(x + dx * w, y + dy * w, r * w, r * w * 0.7, 'rgba(255,255,255,0.95)');
    ell(x, y + w * 0.08, w * 0.46, w * 0.07, 'rgba(225,232,242,0.9)');
  }

  // ---------------------------------------------------------------- backdrop (cached)
  const cache = new Map();
  function backdrop(style) {
    const m = g.getTransform ? g.getTransform() : { a: 1, b: 0 };
    const sc = Math.max(1, Math.hypot(m.a, m.b));
    const key = [G.id, style, V.x, V.y, V.w, V.h, V.groundY, V.depth, V.s, V.cx, sc].map((v) => (typeof v === 'number' ? Math.round(v * 10) : v)).join('|');
    let c = cache.get(key);
    if (!c) {
      c = document.createElement('canvas');
      c.width = Math.max(1, Math.ceil(V.w * sc)); c.height = Math.max(1, Math.ceil(V.h * sc));
      const og = g;
      g = c.getContext('2d');
      g.scale(sc, sc); g.translate(-V.x, -V.y);
      hills();
      ground(style);
      g = og;
      cache.set(key, c);
      if (cache.size > 12) cache.delete(cache.keys().next().value);
    }
    return c;
  }
  const blit = (c) => g.drawImage(c, V.x, V.y, V.w, V.h);

  function hills() {
    const hz = V.groundY, skyH = hz - V.y;
    const layer = (base, amp, col, freq, ph, trees) => {
      const yAt = (u) => base - amp * (0.5 + 0.5 * Math.sin(u * TAU * freq + ph)) - amp * 0.25 * Math.sin(u * TAU * freq * 2.7 + ph * 2);
      g.beginPath(); g.moveTo(V.x, hz + 2);
      for (let i = 0; i <= 48; i++) { const u = i / 48; g.lineTo(V.x + V.w * u, yAt(u)); }
      g.lineTo(V.x + V.w, hz + 2); g.closePath(); g.fillStyle = col; g.fill();
      if (trees) {
        // a line of distant trees along the ridge
        const n = Math.round(V.w / Math.max(4, skyH * 0.05));
        for (let i = 0; i < n; i++) {
          const u = (i + R[(i * 7) % 600] * 0.8) / n, h = skyH * (0.035 + R[(i * 13) % 600] * 0.03);
          const x = V.x + V.w * u, y = yAt(u) + h * 0.35;
          if (trees === 'pine') poly([x - h * 0.35, y, x, y - h * 1.5, x + h * 0.35, y], shade(col, -0.12));
          else ell(x, y - h * 0.4, h * 0.55, h * 0.6, shade(col, -0.1 - R[(i * 3) % 600] * 0.06));
        }
      }
    };
    if (G.id === 'japanese') {
      // a snow-capped mountain far away
      const mx = V.x + V.w * 0.62, mh = skyH * 0.62, mw = Math.max(V.w * 0.5, mh * 2.4);
      g.beginPath(); g.moveTo(mx - mw, hz); g.quadraticCurveTo(mx - mw * 0.35, hz - mh * 0.55, mx - mw * 0.08, hz - mh);
      g.lineTo(mx + mw * 0.08, hz - mh); g.quadraticCurveTo(mx + mw * 0.35, hz - mh * 0.55, mx + mw, hz); g.closePath();
      g.fillStyle = lin(0, hz - mh, 0, hz, [[0, '#8fa6c2'], [1, '#c3d3e2']]); g.fill();
      g.beginPath(); g.moveTo(mx - mw * 0.08, hz - mh); g.lineTo(mx + mw * 0.08, hz - mh);
      g.lineTo(mx + mw * 0.2, hz - mh * 0.72); g.lineTo(mx + mw * 0.1, hz - mh * 0.76); g.lineTo(mx + mw * 0.02, hz - mh * 0.7);
      g.lineTo(mx - mw * 0.07, hz - mh * 0.77); g.lineTo(mx - mw * 0.2, hz - mh * 0.72); g.closePath();
      g.fillStyle = '#f5f8fc'; g.fill();
      layer(hz - skyH * 0.12, skyH * 0.08, '#a7c49a', 1.3, 0.8, 'pine');
      layer(hz - skyH * 0.04, skyH * 0.05, '#8fb982', 2.1, 2.2, null);
    } else {
      layer(hz - skyH * 0.2, skyH * 0.12, '#b3cfbe', 0.8, 1.3, null);
      layer(hz - skyH * 0.1, skyH * 0.1, '#a2cf8d', 1.4, 0.4, 'round');
      layer(hz - skyH * 0.03, skyH * 0.06, '#8cc475', 2.3, 2.6, null);
    }
    // haze at the horizon (atmospheric perspective)
    g.fillStyle = lin(0, hz - skyH * 0.3, 0, hz, [[0, 'rgba(235,245,250,0)'], [1, 'rgba(235,245,250,0.4)']]);
    g.fillRect(V.x, hz - skyH * 0.3, V.w, skyH * 0.3);
  }

  function ground(style) {
    const hz = V.groundY, bottom = V.y + V.h, rnd = mulberry32(G.id.length * 1000 + style * 17 + 5);
    const zAt = () => Math.pow(rnd(), 0.8) * ((bottom - hz) / Math.max(1, V.depth));
    const fillGrad = (stops) => { g.fillStyle = lin(0, hz, 0, bottom, stops); g.fillRect(V.x, hz, V.w, bottom - hz); };
    const scatter = (n, fn) => { for (let i = 0; i < n; i++) { const z = zAt(); const p = P(0, z); fn(V.x + rnd() * V.w, p.y, p.k, z); } };
    const density = clamp((V.w * (bottom - hz)) / 60000, 0.3, 3);

    if (style < 0) {
      // freshly plowed field: furrows converge toward a vanishing point
      fillGrad([[0, '#c7aa7c'], [0.5, '#a07e55'], [1, '#7c5c3b']]);
      const vy = hz - V.depth * 0.8, sp = V.s * 0.11;
      for (let i = -70; i <= 70; i++) {
        const b0 = V.cx + i * sp, b1 = b0 + sp * 0.45;
        const at = (bx) => V.cx + ((bx - V.cx) * (hz - vy)) / (bottom - vy);
        poly([at(b0), hz, at(b1), hz, b1, bottom, b0, bottom], 'rgba(90,62,36,0.35)');
        g.beginPath(); g.moveTo(at(b1), hz); g.lineTo(b1, bottom); g.strokeStyle = 'rgba(230,205,160,0.28)'; g.lineWidth = Math.max(0.6, V.s * 0.006); g.stroke();
      }
      scatter(Math.round(260 * density), (x, y, k) => ell(x, y, V.s * 0.012 * k, V.s * 0.006 * k, rnd() < 0.5 ? 'rgba(80,55,30,0.35)' : 'rgba(220,195,150,0.35)'));
      scatter(Math.round(26 * density), (x, y, k) => { ell(x, y + V.s * 0.004 * k, V.s * 0.014 * k, V.s * 0.006 * k, 'rgba(60,40,20,0.3)'); ball(x, y, V.s * 0.009 * k, '#a8a098', V.s * 0.013 * k); });
      return;
    }

    if (G.id === 'japanese') {
      const moss = () => {
        fillGrad([[0, '#8db25a'], [0.5, '#5f8f3a'], [1, '#3f6a2a']]);
        scatter(Math.round(1400 * density), (x, y, k) => circ(x, y, Math.max(0.5, V.s * 0.004 * k), rnd() < 0.5 ? 'rgba(40,80,25,0.45)' : 'rgba(170,205,110,0.4)'));
      };
      const gravel = (x0, x1) => {
        g.fillStyle = lin(0, hz, 0, bottom, [[0, '#ece6d8'], [1, '#cdbfa6']]);
        g.fillRect(x0, hz, x1 - x0, bottom - hz);
        // raked lines, spacing grows toward the viewer
        let z = 0.02;
        while (hz + z * V.depth < bottom) {
          const y = hz + z * V.depth, k = 0.72 + 0.45 * z;
          g.beginPath();
          for (let x = x0; x <= x1; x += 8) g.lineTo(x, y + Math.sin(x * 0.02 + z * 9) * V.s * 0.006 * k);
          g.strokeStyle = 'rgba(140,125,100,0.45)'; g.lineWidth = Math.max(0.6, V.s * 0.005 * k); g.stroke();
          g.beginPath();
          for (let x = x0; x <= x1; x += 8) g.lineTo(x, y + V.s * 0.006 * k + Math.sin(x * 0.02 + z * 9) * V.s * 0.006 * k);
          g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = Math.max(0.5, V.s * 0.003 * k); g.stroke();
          z += 0.035 + z * 0.05;
        }
        scatter(Math.round(500 * density), (x, y, k) => circ(x, y, Math.max(0.4, V.s * 0.0025 * k), rnd() < 0.5 ? 'rgba(120,105,85,0.35)' : 'rgba(255,255,255,0.5)'));
      };
      if (style === 0) moss();
      else if (style === 1) {
        gravel(V.x, V.x + V.w);
        // moss borders along the edges
        for (let i = 0; i < 26; i++) { const side = i % 2 ? -1 : 1, p = P(side * (1.02 + rnd() * 0.25), rnd() * 1.2); ell(p.x, p.y, V.s * 0.12 * p.k, V.s * 0.035 * p.k, rnd() < 0.5 ? '#5f8f3a' : '#6f9e45'); }
      } else {
        gravel(V.x, V.x + V.w);
        // moss islands in the gravel
        for (let i = 0; i < 9; i++) {
          const p = P(rnd() * 2.4 - 1.2, 0.15 + rnd() * 1.1);
          for (let j = 0; j < 5; j++) ell(p.x + (rnd() - 0.5) * V.s * 0.2 * p.k, p.y + (rnd() - 0.5) * V.s * 0.03 * p.k, V.s * (0.06 + rnd() * 0.06) * p.k, V.s * (0.018 + rnd() * 0.014) * p.k, j % 2 ? '#5f8f3a' : '#6f9e45');
        }
      }
      return;
    }

    // cottage lawns
    const pal = style === 2 ? ['#a9c565', '#6f9a3c', '#4b7a2d'] : ['#9fd070', '#5ea443', '#3e8732'];
    fillGrad([[0, pal[0]], [0.45, pal[1]], [1, pal[2]]]);
    if (style === 1) { // mowing stripes
      let z = 0, i = 0;
      while (hz + z * V.depth < bottom && i < 80) {
        const z1 = z + 0.09 + z * 0.1;
        if (i % 2) { g.fillStyle = 'rgba(255,255,255,0.09)'; g.fillRect(V.x, hz + z * V.depth, V.w, (z1 - z) * V.depth); }
        z = z1; i++;
      }
    }
    // mottled patches
    scatter(Math.round(150 * density), (x, y, k) => ell(x, y, V.s * (0.04 + rnd() * 0.08) * k, V.s * (0.01 + rnd() * 0.015) * k, rnd() < 0.5 ? 'rgba(40,90,25,0.18)' : 'rgba(190,230,130,0.16)'));
    // grass blades, longer toward the viewer
    const blades = style === 2 ? ['#557f2e', '#8aa84a', '#c2c07a', '#3f6e28'] : ['#3f7f2e', '#5da244', '#86c460', '#2f6a25'];
    const len = style === 1 ? 0.012 : style === 2 ? 0.045 : 0.022;
    scatter(Math.round((style === 2 ? 900 : 1300) * density), (x, y, k) => {
      const h = V.s * len * k * (0.6 + rnd() * 0.8), lean = (rnd() - 0.5) * h * 0.6;
      line(x, y, x + lean, y - h, blades[(rnd() * blades.length) | 0], Math.max(0.6, V.s * 0.004 * k));
    });
    if (style === 0) scatter(Math.round(60 * density), (x, y, k) => circ(x, y - V.s * 0.01 * k, Math.max(0.7, V.s * 0.005 * k), rnd() < 0.6 ? '#ffffff' : '#ffe066'));
    if (style === 2) scatter(Math.round(50 * density), (x, y, k) => { const h = V.s * 0.07 * k; line(x, y, x + h * 0.1, y - h, '#9a9a55', Math.max(0.5, V.s * 0.003 * k)); ell(x + h * 0.1, y - h, V.s * 0.004 * k, V.s * 0.01 * k, '#d8c98a'); });
  }

  // ---------------------------------------------------------------- shared object helpers
  function withAppear(idx, bx, by, fn) {
    const a = V.appear;
    if (!a || a.task !== idx) return fn();
    const e = easeBack(a.k);
    if (e <= 0.001) return undefined;
    g.save(); g.translate(bx, by); g.scale(e, e); g.translate(-bx, -by); fn(); g.restore();
    return undefined;
  }

  // round-crowned tree; style picks the palette (oak, cherry blossom, apple, japanese maple)
  const CROWNS = [
    ['#2f7a36', '#3f9443', '#5aae4e'], // oak
    ['#e58fb2', '#f3a9c7', '#ffd0e2'], // cherry blossom
    ['#3a8a3a', '#4c9f44', '#6cb85a'], // apple
    ['#a82c24', '#cf4430', '#ef7a45'], // japanese maple
  ];
  function treeAt(bx, by, s, pal, extra) {
    shadow(bx, by, s * 0.32, s * 0.07);
    const sw = Math.sin(V.t * 0.8 + bx * 0.05) * s * 0.01;
    const tw = s * 0.045;
    g.fillStyle = lin(bx - tw, 0, bx + tw, 0, [[0, '#4e3320'], [0.6, '#7a5436'], [1, '#95694a']]);
    g.beginPath();
    g.moveTo(bx - tw * 1.4, by); g.quadraticCurveTo(bx - tw * 0.5, by - s * 0.15, bx - tw * 0.55, by - s * 0.42);
    g.lineTo(bx + tw * 0.55, by - s * 0.42); g.quadraticCurveTo(bx + tw * 0.5, by - s * 0.15, bx + tw * 1.4, by); g.closePath(); g.fill();
    line(bx, by - s * 0.3, bx - s * 0.1, by - s * 0.45, '#6b4a2e', tw * 0.45);
    line(bx, by - s * 0.33, bx + s * 0.09, by - s * 0.47, '#6b4a2e', tw * 0.4);
    const cx = bx + sw, cy = by - s * 0.52, cols = CROWNS[pal];
    ell(cx - s * 0.02, cy + s * 0.1, s * 0.24, s * 0.08, rgba(cols[0], 0.8)); // shade under the crown
    for (const c of CROWN) ball(cx + c.dx * s, cy + c.dy * s, c.r * s, c.back ? cols[0] : c.dy < -0.05 ? cols[2] : cols[1]);
    if (extra === 'apples') for (let i = 0; i < 8; i++) ball(cx + (R[300 + i] - 0.5) * s * 0.4, cy + (R[310 + i] - 0.45) * s * 0.28, s * 0.022, '#d8352f');
    if (extra === 'petals') {
      for (let i = 0; i < 5; i++) {
        const k = (V.t * 0.22 + R[320 + i]) % 1;
        g.globalAlpha = 1 - k;
        ell(cx + (R[330 + i] - 0.5) * s * 0.5 + Math.sin(V.t * 2 + i) * s * 0.04, cy + k * s * 0.55, s * 0.012, s * 0.008, '#f7b3cf');
        g.globalAlpha = 1;
      }
    }
  }
  function pineAt(bx, by, s) { // cloud-pruned black pine
    shadow(bx, by, s * 0.34, s * 0.07);
    g.beginPath(); g.moveTo(bx - s * 0.04, by);
    g.bezierCurveTo(bx - s * 0.02, by - s * 0.2, bx + s * 0.12, by - s * 0.25, bx + s * 0.04, by - s * 0.5);
    g.lineTo(bx + s * 0.08, by - s * 0.5);
    g.bezierCurveTo(bx + s * 0.16, by - s * 0.25, bx + s * 0.04, by - s * 0.2, bx + s * 0.04, by);
    g.closePath(); g.fillStyle = lin(bx - s * 0.05, 0, bx + s * 0.1, 0, [[0, '#3e2a1c'], [1, '#6e4e36']]); g.fill();
    const pads = [[-0.14, -0.3, 0.13], [0.2, -0.38, 0.12], [-0.02, -0.5, 0.14], [0.12, -0.62, 0.09]];
    for (const [dx, dy, r] of pads) {
      const x = bx + dx * s, y = by + dy * s;
      line(bx + s * 0.05, y + s * 0.02, x, y + s * 0.01, '#4a3322', s * 0.015);
      ell(x, y + r * s * 0.2, r * s * 1.05, r * s * 0.32, '#1f4226');
      ell(x, y, r * s, r * s * 0.34, '#2f5d34');
      ell(x + r * s * 0.15, y - r * s * 0.1, r * s * 0.7, r * s * 0.2, '#467a45');
    }
  }
  function weepingAt(bx, by, s) { // weeping cherry
    shadow(bx, by, s * 0.34, s * 0.07);
    rect(bx - s * 0.03, by - s * 0.45, s * 0.06, s * 0.45, '#5e3f2a');
    ball(bx, by - s * 0.5, s * 0.18, '#eaa1c0', s * 0.24);
    for (let i = 0; i < 16; i++) {
      const u = (i / 15 - 0.5) * 2, x0 = bx + u * s * 0.2, y0 = by - s * 0.55 + Math.abs(u) * s * 0.08;
      const sw = Math.sin(V.t * 1.2 + i) * s * 0.01;
      g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(x0 + u * s * 0.1, y0 + s * 0.1, x0 + u * s * 0.12 + sw, y0 + s * (0.25 + R[400 + i] * 0.1));
      g.strokeStyle = '#d98aab'; g.lineWidth = Math.max(1, s * 0.02); g.stroke();
      for (let j = 1; j < 4; j++) circ(x0 + u * s * 0.04 * j + sw * j / 3, y0 + s * 0.08 * j, s * 0.012, j % 2 ? '#f7c0d6' : '#ffe0ec');
    }
  }

  // ---------------------------------------------------------------- cottage garden
  function fence(st) {
    const p = P(0, -0.02), s = V.s * p.k, y = p.y;
    withAppear(2, p.x, y, () => {
      g.fillStyle = 'rgba(30,50,20,0.18)'; g.fillRect(V.x, y, V.w, s * 0.02);
      if (st === 2) { // hedge
        const hh = s * 0.13;
        g.fillStyle = lin(0, y - hh, 0, y, [[0, '#4f9c48'], [1, '#2c6a2e']]); g.fillRect(V.x, y - hh * 0.9, V.w, hh * 0.9);
        for (let px = V.x - hh; px < V.x + V.w + hh; px += hh * 0.7) ball(px, y - hh * 0.95, hh * 0.45, '#3f8f40', hh * 0.55);
        return;
      }
      const step = s * 0.075, ph = s * 0.16;
      if (st === 0) {
        rect(V.x, y - ph * 0.72, V.w, ph * 0.09, '#ddd6c6'); rect(V.x, y - ph * 0.32, V.w, ph * 0.09, '#ddd6c6');
        for (let px = V.x + ((p.x - V.x) % step) - step; px < V.x + V.w + step; px += step) {
          const w = step * 0.3;
          poly([px - w, y, px - w, y - ph * 0.82, px, y - ph, px + w, y - ph * 0.82, px + w, y], '#fbf8ef');
          poly([px, y - ph, px + w, y - ph * 0.82, px + w, y, px, y], '#e8e1d1');
        }
      } else {
        const gap = step * 2.4;
        for (let px = V.x + ((p.x - V.x) % gap) - gap; px < V.x + V.w + gap; px += gap) {
          g.fillStyle = lin(px - step * 0.32, 0, px + step * 0.32, 0, [[0, '#6b4528'], [1, '#9c6d42']]); g.fillRect(px - step * 0.32, y - ph * 1.05, step * 0.64, ph * 1.05);
          ell(px, y - ph * 1.05, step * 0.32, step * 0.12, '#c49a68');
        }
        for (const hy of [0.72, 0.35]) {
          g.fillStyle = lin(0, y - ph * hy - ph * 0.06, 0, y - ph * hy + ph * 0.06, [[0, '#b0804f'], [1, '#7a5230']]);
          g.fillRect(V.x, y - ph * hy - ph * 0.06, V.w, ph * 0.12);
        }
      }
    });
  }

  function cottage(st) {
    const p = P(0.36, 0.04), s = V.s * p.k, x = p.x, y = p.y;
    withAppear(5, x, y, () => {
      const bw = s * 0.4, bh = s * 0.25, left = x - bw / 2, sd = s * 0.12, rh = s * 0.2;
      const wall = st === 2 ? '#d9ccb1' : st === 1 ? '#fff2d4' : '#fbfaf4';
      const roof = st === 2 ? '#c99a45' : st === 1 ? '#3f6fbf' : '#c2463d';
      // shadow cast to the left
      poly([left - sd, y - sd * 0.35, left, y, left - s * 0.1, y + s * 0.03, left - sd - s * 0.2, y - sd * 0.3], 'rgba(25,40,15,0.22)');
      // side wall receding to the back left
      poly([left, y, left, y - bh, left - sd, y - bh - sd * 0.35, left - sd, y - sd * 0.35], shade(wall, -0.16));
      poly([left - sd * 0.62, y - bh * 0.72 - sd * 0.22, left - sd * 0.25, y - bh * 0.72 - sd * 0.09, left - sd * 0.25, y - bh * 0.35 - sd * 0.09, left - sd * 0.62, y - bh * 0.35 - sd * 0.22], '#6f95ad');
      // roof plane on the left side
      const ax = x, ay = y - bh - rh;
      g.fillStyle = lin(left, ay, left - sd, y - bh, [[0, shade(roof, 0.05)], [1, shade(roof, -0.14)]]);
      g.beginPath(); g.moveTo(left - s * 0.035, y - bh + s * 0.01); g.lineTo(ax, ay); g.lineTo(ax - sd, ay - sd * 0.35); g.lineTo(left - s * 0.035 - sd, y - bh + s * 0.01 - sd * 0.35); g.closePath(); g.fill();
      for (let i = 1; i < 6; i++) { const u = i / 6; line(left - s * 0.035 + (ax - left + s * 0.035) * u, y - bh + s * 0.01 + (ay - y + bh - s * 0.01) * u, left - s * 0.035 + (ax - left + s * 0.035) * u - sd, y - bh + s * 0.01 + (ay - y + bh - s * 0.01) * u - sd * 0.35, shade(roof, -0.2), s * (st === 2 ? 0.008 : 0.004)); }
      // chimney on the roof plane
      g.fillStyle = lin(ax - sd * 0.8, 0, ax - sd * 0.5, 0, [[0, '#7c5242'], [1, '#a8725c']]);
      g.fillRect(ax - sd * 0.75 - s * 0.03, ay + s * 0.02 - s * 0.08, s * 0.05, s * 0.12);
      for (let i = 0; i < 3; i++) {
        const k = (V.t * 0.3 + i / 3) % 1;
        g.globalAlpha = 0.5 * (1 - k);
        circ(ax - sd * 0.75 + k * s * 0.08, ay - s * 0.08 - k * s * 0.22, s * (0.02 + k * 0.035), '#ffffff');
        g.globalAlpha = 1;
      }
      // front wall with gable
      g.fillStyle = lin(left, 0, left + bw, 0, [[0, shade(wall, -0.05)], [1, wall]]);
      g.fillRect(left, y - bh, bw, bh);
      poly([left, y - bh, ax, ay + s * 0.01, left + bw, y - bh], shade(wall, -0.03));
      rect(left, y - s * 0.02, bw, s * 0.02, shade(wall, -0.2));
      if (st === 2) for (let i = 0; i < 16; i++) ell(left + R[450 + i] * bw, y - R[470 + i] * bh, s * 0.012, s * 0.007, shade(wall, -0.1));
      // bargeboards along the gable
      line(left - s * 0.03, y - bh + s * 0.012, ax, ay - s * 0.004, shade(roof, -0.25), s * (st === 2 ? 0.035 : 0.02));
      line(ax, ay - s * 0.004, left + bw + s * 0.03, y - bh + s * 0.012, shade(roof, -0.1), s * (st === 2 ? 0.035 : 0.02));
      circ(ax, ay + rh * 0.45, s * 0.022, '#7a5230'); circ(ax, ay + rh * 0.45, s * 0.015, '#9fd0ea');
      // door and windows
      g.fillStyle = lin(0, y - bh * 0.62, 0, y, [[0, '#8a4b2c'], [1, '#6a3820']]); g.fillRect(x - bw * 0.08, y - bh * 0.62, bw * 0.16, bh * 0.62);
      rect(x - bw * 0.06, y - bh * 0.56, bw * 0.12, bh * 0.2, 'rgba(255,255,255,0.1)');
      circ(x + bw * 0.045, y - bh * 0.3, s * 0.006, '#f4d58d');
      for (const wx of [left + bw * 0.2, left + bw * 0.8]) {
        rect(wx - bw * 0.1, y - bh * 0.74, bw * 0.2, bh * 0.36, '#7a5230');
        g.fillStyle = lin(0, y - bh * 0.72, 0, y - bh * 0.4, [[0, '#dff2fb'], [1, '#78b3d4']]); g.fillRect(wx - bw * 0.085, y - bh * 0.72, bw * 0.17, bh * 0.32);
        rect(wx - bw * 0.005, y - bh * 0.72, bw * 0.01, bh * 0.32, '#7a5230');
        rect(wx - bw * 0.085, y - bh * 0.565, bw * 0.17, bh * 0.012, '#7a5230');
        rect(wx - bw * 0.12, y - bh * 0.4, bw * 0.24, bh * 0.05, '#a86d3d');
        for (let j = 0; j < 4; j++) circ(wx - bw * 0.09 + j * bw * 0.06, y - bh * 0.42, s * 0.012, FLOWER_COLORS[(j * 2 + st) % 6]);
      }
    });
  }

  function bench(st) {
    const p = P(-0.44, 0.3), s = V.s * p.k, x = p.x, y = p.y;
    withAppear(7, x, y, () => {
      shadow(x, y, s * 0.2, s * 0.03);
      if (st === 2) { // picnic blanket and basket
        poly([x - s * 0.19, y, x + s * 0.19, y, x + s * 0.14, y - s * 0.07, x - s * 0.14, y - s * 0.07], '#d8413f');
        g.globalAlpha = 0.5;
        for (let i = 1; i < 5; i++) { const u = i / 5; line(x - s * 0.19 + u * s * 0.38, y, x - s * 0.14 + u * s * 0.28, y - s * 0.07, '#ffffff', s * 0.02); }
        line(x - s * 0.165, y - s * 0.035, x + s * 0.165, y - s * 0.035, '#ffffff', s * 0.02);
        g.globalAlpha = 1;
        g.fillStyle = lin(0, y - s * 0.09, 0, y - s * 0.04, [[0, '#c8914e'], [1, '#8a5a2b']]); g.fillRect(x + s * 0.03, y - s * 0.09, s * 0.09, s * 0.05);
        g.beginPath(); g.arc(x + s * 0.075, y - s * 0.09, s * 0.035, Math.PI, TAU); g.strokeStyle = '#8a5a2b'; g.lineWidth = Math.max(1, s * 0.01); g.stroke();
        ball(x - s * 0.06, y - s * 0.045, s * 0.02, '#d8352f');
        return;
      }
      const wood = st === 1 ? '#f4f4ef' : '#a86d3d', dark = st === 1 ? '#bdbdb5' : '#6d4526';
      for (const lx of [-0.12, 0.108]) rect(x + lx * s, y - s * 0.07, s * 0.014, s * 0.07, dark);
      for (const lx of [-0.13, 0.116]) rect(x + lx * s, y - s * 0.17, s * 0.014, s * 0.1, dark);
      const plank = (py, h) => { g.fillStyle = lin(0, py, 0, py + h, [[0, shade(wood, 0.06)], [1, shade(wood, -0.12)]]); g.fillRect(x - s * 0.14, py, s * 0.28, h); };
      plank(y - s * 0.078, s * 0.024); plank(y - s * 0.17, s * 0.022); plank(y - s * 0.13, s * 0.02);
    });
  }

  function beehive(st) {
    const p = P(0.8, 0.46), s = V.s * p.k, x = p.x, y = p.y;
    withAppear(9, x, y, () => {
      shadow(x, y, s * 0.11, s * 0.025);
      if (st === 0) {
        for (let i = 0; i < 5; i++) ball(x, y - s * 0.022 - i * s * 0.034, s * 0.03, i % 2 ? '#d19f3a' : '#e6b852', s * (0.088 - i * 0.013));
        ell(x, y - s * 0.02, s * 0.022, s * 0.014, '#4a2e10');
      } else if (st === 1) {
        rect(x - s * 0.075, y - s * 0.012, s * 0.15, s * 0.012, '#6d4526');
        for (let i = 0; i < 3; i++) { g.fillStyle = lin(x - s * 0.07, 0, x + s * 0.07, 0, [[0, '#e8dfc8'], [1, '#fffaf0']]); g.fillRect(x - s * 0.07, y - s * 0.012 - s * 0.048 * (i + 1), s * 0.14, s * 0.045); }
        poly([x - s * 0.085, y - s * 0.16, x, y - s * 0.19, x + s * 0.085, y - s * 0.16], '#7a5230');
        rect(x - s * 0.03, y - s * 0.022, s * 0.06, s * 0.008, '#4a2e10');
      } else {
        rect(x - s * 0.008, y - s * 0.14, s * 0.016, s * 0.14, '#7a5230');
        g.fillStyle = lin(x - s * 0.055, 0, x + s * 0.055, 0, [[0, '#f0bd4f'], [1, '#ffd98a']]); g.fillRect(x - s * 0.055, y - s * 0.22, s * 0.11, s * 0.08);
        poly([x - s * 0.07, y - s * 0.22, x, y - s * 0.27, x + s * 0.07, y - s * 0.22], '#b0513c');
        circ(x, y - s * 0.18, s * 0.014, '#4a2e10');
      }
      for (let i = 0; i < 5; i++) {
        const a = V.t * 2.2 + i * 1.3;
        const bx = x + Math.cos(a) * s * 0.15, by = y - s * 0.16 + Math.sin(a * 1.3) * s * 0.06;
        ell(bx, by, s * 0.016, s * 0.011, '#ffcc33');
        rect(bx - s * 0.002, by - s * 0.011, s * 0.005, s * 0.022, '#3a2a10');
        g.globalAlpha = 0.6; ell(bx, by - s * 0.012, s * 0.01, s * 0.007, '#ffffff'); g.globalAlpha = 1;
      }
    });
  }

  function flowerBeds(st) {
    const beds = [[-0.55, 0.78], [0.62, 0.84]];
    const kinds = st === 0 ? [['tulip', 0], ['tulip', 5], ['tulip', 2]] : st === 1 ? [['daisy', '#ffffff']] : [['lavender', 4]];
    beds.forEach(([bx, bz], b) => {
      const p = P(bx, bz), s = V.s * p.k;
      withAppear(1, p.x, p.y, () => {
        shadow(p.x, p.y + s * 0.01, s * 0.28, s * 0.05);
        ell(p.x, p.y, s * 0.25, s * 0.06, '#5e3c24');
        g.fillStyle = lin(0, p.y - s * 0.055, 0, p.y + s * 0.03, [[0, '#9a6a45'], [1, '#6a4428']]);
        g.beginPath(); g.ellipse(p.x, p.y - s * 0.012, s * 0.235, s * 0.048, 0, 0, TAU); g.fill();
        for (let i = 0; i < 9; i++) {
          const [kind, c] = kinds[(i + b) % kinds.length];
          const col = typeof c === 'number' ? FLOWER_COLORS[c] : c;
          flower(p.x + (i - 4) * s * 0.048, p.y + (i % 2 ? s * 0.014 : -s * 0.014), s * (0.13 + (i % 3) * 0.02), kind, col, Math.sin(V.t * 1.6 + i + b * 2));
        }
      });
    });
  }

  function butterflyGarden() {
    for (const [bx, bz] of [[-0.98, 0.22], [0.98, 0.26]]) {
      const p = P(bx, bz), s = V.s * p.k;
      withAppear(8, p.x, p.y, () => {
        shadow(p.x, p.y, s * 0.16, s * 0.03);
        ball(p.x + s * 0.05, p.y - s * 0.07, s * 0.08, '#3a8a3e', s * 0.11);
        ball(p.x - s * 0.06, p.y - s * 0.09, s * 0.07, '#4a9c48', s * 0.09);
        for (let i = 0; i < 8; i++) circ(p.x + (R[340 + i] - 0.5) * s * 0.24, p.y - s * 0.04 - R[350 + i] * s * 0.12, s * 0.014, FLOWER_COLORS[(i + 3) % 6]);
      });
    }
  }
  function butterfly(x, y, sz, col, ph) {
    const f = 0.25 + 0.75 * Math.abs(Math.sin(V.t * 9 + ph));
    ell(x - sz * 0.45 * f, y - sz * 0.1, sz * 0.45 * f, sz * 0.38, col);
    ell(x + sz * 0.45 * f, y - sz * 0.1, sz * 0.45 * f, sz * 0.38, col);
    ell(x - sz * 0.3 * f, y + sz * 0.22, sz * 0.3 * f, sz * 0.22, shade(col, -0.12));
    ell(x + sz * 0.3 * f, y + sz * 0.22, sz * 0.3 * f, sz * 0.22, shade(col, -0.12));
    line(x, y - sz * 0.35, x, y + sz * 0.35, '#2b2b2b', sz * 0.12);
  }
  function butterflies(st, count, appearK) {
    const cols = st === 0 ? ['#3fa9ff', '#5bc0ff'] : st === 1 ? ['#ff8c1a', '#ffa23a'] : FLOWER_COLORS;
    for (let i = 0; i < count; i++) {
      const wx = Math.sin(V.t * 0.33 + i * 2.1) * 0.85, wz = 0.25 + 0.4 * (0.5 + 0.5 * Math.sin(V.t * 0.27 + i * 1.3));
      const p = P(wx, wz), alt = V.s * (0.14 + 0.05 * Math.sin(V.t * 1.7 + i)) * p.k;
      butterfly(p.x, p.y - alt, V.s * 0.035 * p.k * appearK, cols[i % cols.length], i);
    }
  }

  // water: dark center, sky reflection toward the back edge, moving ripples
  function water(x, y, rx, ry, s) {
    const gr = g.createRadialGradient(x, y + ry * 0.2, ry * 0.2, x, y, rx);
    gr.addColorStop(0, '#2b6f99'); gr.addColorStop(0.7, '#3f8fbe'); gr.addColorStop(1, '#6fb6db');
    g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fillStyle = gr; g.fill();
    g.save(); g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.clip();
    g.fillStyle = lin(0, y - ry, 0, y, [[0, 'rgba(230,245,255,0.55)'], [1, 'rgba(230,245,255,0)']]); g.fillRect(x - rx, y - ry, rx * 2, ry);
    for (let i = 0; i < 2; i++) {
      const k = (V.t * 0.25 + i / 2) % 1;
      g.globalAlpha = 0.5 * (1 - k);
      g.beginPath(); g.ellipse(x + rx * (i ? 0.3 : -0.25), y + ry * 0.15, rx * 0.4 * k + 1, ry * 0.4 * k + 0.5, 0, 0, TAU);
      g.strokeStyle = '#ffffff'; g.lineWidth = Math.max(0.6, s * 0.004); g.stroke();
    }
    g.globalAlpha = 1;
    g.restore();
    g.beginPath(); g.ellipse(x, y, rx, ry, 0, Math.PI * 1.05, Math.PI * 1.95); g.strokeStyle = 'rgba(20,50,25,0.35)'; g.lineWidth = Math.max(1, s * 0.012); g.stroke();
  }
  function lilyPad(x, y, r, col) {
    g.beginPath(); g.moveTo(x, y); g.ellipse(x, y, r, r * 0.42, 0, 0.35, TAU - 0.05); g.closePath();
    g.fillStyle = col; g.fill();
  }

  function pond(st) {
    const p = P(-0.18, 0.44), s = V.s * p.k, x = p.x, y = p.y;
    withAppear(6, x, y, () => {
      const rx = s * 0.3, ry = rx * 0.3;
      if (st === 1) for (let i = 0; i < 18; i++) { const a = (i / 18) * TAU; ball(x + Math.cos(a) * rx * 1.04, y + Math.sin(a) * ry * 1.14, s * 0.018, i % 2 ? '#a19d95' : '#bdb9b0', s * 0.034); }
      else ell(x, y + ry * 0.05, rx * 1.07, ry * 1.18, '#4a7f3a');
      water(x, y, rx, ry, s);
      if (st === 0) {
        [[-0.5, 0.2], [0.35, -0.1], [0.1, 0.45], [-0.15, -0.35]].forEach(([u, v], i) => {
          const lx = x + u * rx, ly = y + v * ry;
          lilyPad(lx, ly, s * 0.045, i % 2 ? '#3f8f3a' : '#4fa244');
          if (i === 1) head(lx, ly - s * 0.012, s * 0.022, 'daisy', '#ff9fc4');
        });
      }
      if (st === 2) {
        for (let i = 0; i < 2; i++) {
          const a = V.t * 0.3 + i * Math.PI, dir = Math.cos(a + Math.PI / 2) > 0 ? 1 : -1;
          const dx = x + Math.cos(a) * rx * 0.55, dy = y + Math.sin(a) * ry * 0.45;
          ell(dx, dy + s * 0.008, s * 0.034, s * 0.008, 'rgba(0,30,50,0.25)');
          ball(dx, dy, s * 0.016, '#ffffff', s * 0.03);
          ball(dx + dir * s * 0.022, dy - s * 0.02, s * 0.012, '#ffffff');
          poly([dx + dir * s * 0.032, dy - s * 0.022, dx + dir * s * 0.046, dy - s * 0.018, dx + dir * s * 0.032, dy - s * 0.014], '#ff9f1c');
        }
      }
    });
  }

  function pathAlong(pts, st, taskIdx, kind) {
    const a = V.appear && V.appear.task === taskIdx ? V.appear.k : 1;
    g.globalAlpha = a;
    if (kind === 'slabs' || kind === 'mossy') {
      pts.forEach((p, i) => {
        if (i === 0 || i % 2) return;
        const s = V.s * p.k, off = (i % 4 ? 1 : -1) * s * 0.02;
        if (kind === 'mossy') ell(p.x + off, p.y + s * 0.004, s * 0.1, s * 0.03, '#5f8f3a');
        ell(p.x + off - s * 0.01, p.y + s * 0.008, s * 0.075, s * 0.024, 'rgba(30,30,20,0.3)');
        g.fillStyle = lin(0, p.y - s * 0.02, 0, p.y + s * 0.02, [[0, '#c9c4ba'], [1, '#8f8a80']]);
        g.beginPath(); g.ellipse(p.x + off, p.y, s * 0.075, s * 0.022, (R[i] - 0.5) * 0.3, 0, TAU); g.fill();
      });
    } else if (kind === 'stones') {
      pts.forEach((p, i) => {
        if (i === 0) return;
        const s = V.s * p.k, off = (i % 2 ? 1 : -1) * s * 0.03;
        ell(p.x + off - s * 0.006, p.y + s * 0.006, s * 0.06, s * 0.02, 'rgba(30,30,20,0.3)');
        g.fillStyle = lin(0, p.y - s * 0.02, 0, p.y + s * 0.02, [[0, '#d2cdc2'], [1, '#9a958b']]);
        g.beginPath(); g.ellipse(p.x + off, p.y, s * 0.058, s * 0.02, 0, 0, TAU); g.fill();
      });
    } else {
      const col = kind === 'gravel' ? '#e2d3ae' : '#b9614a';
      for (let i = 1; i < pts.length; i++) line(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y, shade(col, -0.18), V.s * pts[i].k * 0.135);
      for (let i = 1; i < pts.length; i++) line(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y, col, V.s * pts[i].k * 0.115);
      pts.forEach((p, i) => {
        const s = V.s * p.k;
        if (kind === 'gravel') for (let j = 0; j < 4; j++) circ(p.x + (R[i * 4 + j] - 0.5) * s * 0.1, p.y + (R[i * 4 + j + 100] - 0.5) * s * 0.02, Math.max(0.5, s * 0.005), j % 2 ? '#b8a57a' : '#fff6de');
        else if (i) { line(p.x - s * 0.055, p.y, p.x + s * 0.055, p.y, '#8a4332', Math.max(0.6, s * 0.006)); line(p.x + (i % 2 ? -1 : 1) * s * 0.02, p.y, p.x + (i % 2 ? -1 : 1) * s * 0.02, p.y - s * 0.012, '#8a4332', Math.max(0.5, s * 0.004)); }
      });
    }
    g.globalAlpha = 1;
  }
  function curve(x0, z0, x1, z1, bend) {
    const pts = [];
    for (let i = 0; i <= 18; i++) { const k = i / 18; pts.push(P(x0 + (x1 - x0) * k + Math.sin(k * Math.PI) * bend, z0 + (z1 - z0) * k)); }
    return pts;
  }

  function sign() {
    const p = P(-0.05, 0.42), s = V.s * p.k;
    shadow(p.x, p.y, s * 0.08, s * 0.015);
    rect(p.x - s * 0.01, p.y - s * 0.16, s * 0.02, s * 0.16, '#7a5230');
    g.fillStyle = lin(0, p.y - s * 0.22, 0, p.y - s * 0.13, [[0, '#d6aa72'], [1, '#b0844f']]); g.fillRect(p.x - s * 0.1, p.y - s * 0.22, s * 0.2, s * 0.09);
    line(p.x, p.y - s * 0.14, p.x, p.y - s * 0.195, '#3d8a36', s * 0.01);
    ell(p.x - s * 0.02, p.y - s * 0.19, s * 0.022, s * 0.01, '#5ccf6b', -0.5);
    ell(p.x + s * 0.02, p.y - s * 0.2, s * 0.022, s * 0.01, '#5ccf6b', 0.5);
  }

  function drawCottage(B) {
    if (B[4] >= 0) pathAlong(curve(0.36, 0.07, 0.1, 1.37, 0.16), B[4], 4, ['stones', 'gravel', 'brick'][B[4]]);
    if (B[6] >= 0) pond(B[6]);
    const objs = [];
    if (B[2] >= 0) objs.push([-0.02, () => fence(B[2])]);
    if (B[5] >= 0) objs.push([0.04, () => cottage(B[5])]);
    if (B[3] >= 0) objs.push([0.12, () => { const p = P(-0.74, 0.12); withAppear(3, p.x, p.y, () => treeAt(p.x, p.y, V.s * p.k, B[3], B[3] === 1 ? 'petals' : B[3] === 2 ? 'apples' : null)); }]);
    if (B[8] >= 0) objs.push([0.24, butterflyGarden]);
    if (B[7] >= 0) objs.push([0.3, () => bench(B[7])]);
    if (B[9] >= 0) objs.push([0.46, () => beehive(B[9])]);
    if (B[1] >= 0) objs.push([0.8, () => flowerBeds(B[1])]);
    return objs;
  }

  // ---------------------------------------------------------------- japanese garden
  function fenceJ(st) {
    const p = P(0, -0.02), s = V.s * p.k, y = p.y;
    withAppear(1, p.x, y, () => {
      g.fillStyle = 'rgba(30,50,20,0.18)'; g.fillRect(V.x, y, V.w, s * 0.02);
      const h = s * 0.19;
      if (st === 0) { // bamboo
        const w = s * 0.024;
        for (let px = V.x - w; px < V.x + V.w + w; px += w * 1.05) {
          const i = Math.round((px - V.x) / w);
          g.fillStyle = lin(px, 0, px + w, 0, [[0, '#a8924e'], [0.5, i % 3 ? '#d6c27c' : '#c9b46a'], [1, '#9a8445']]);
          g.fillRect(px, y - h, w, h);
          for (let k = 1; k < 4; k++) rect(px, y - h * (k / 4) - (i % 2) * h * 0.06, w, Math.max(0.6, s * 0.004), '#8a7438');
        }
        for (const hy of [0.3, 0.7]) { rect(V.x, y - h * hy - s * 0.008, V.w, s * 0.016, '#6b5a2c'); }
        for (let px = V.x; px < V.x + V.w; px += s * 0.2) { rect(px, y - h * 0.7 - s * 0.014, s * 0.012, s * 0.028, '#2a2420'); rect(px, y - h * 0.3 - s * 0.014, s * 0.012, s * 0.028, '#2a2420'); }
      } else if (st === 1) { // dark wooden slats with a cap
        g.fillStyle = lin(0, y - h, 0, y, [[0, '#4a403a'], [1, '#2b2522']]); g.fillRect(V.x, y - h, V.w, h);
        for (let px = V.x; px < V.x + V.w; px += s * 0.04) rect(px, y - h, Math.max(0.6, s * 0.004), h, 'rgba(0,0,0,0.35)');
        rect(V.x, y - h - s * 0.018, V.w, s * 0.02, '#5a4f48');
        for (let px = V.x; px < V.x + V.w; px += s * 0.3) rect(px, y - h - s * 0.02, s * 0.03, h + s * 0.02, '#221d1a');
      } else { // plastered wall with a tiled cap
        g.fillStyle = lin(0, y - h, 0, y, [[0, '#f1ece2'], [1, '#d7cfbf']]); g.fillRect(V.x, y - h * 0.85, V.w, h * 0.85);
        rect(V.x, y - h * 0.25, V.w, h * 0.25, '#8e8a83');
        for (let px = V.x; px < V.x + V.w; px += s * 0.06) rect(px, y - h * 0.25, Math.max(0.5, s * 0.003), h * 0.25, 'rgba(0,0,0,0.25)');
        g.fillStyle = lin(0, y - h - s * 0.03, 0, y - h * 0.82, [[0, '#6d737a'], [1, '#3e4349']]);
        g.beginPath(); g.moveTo(V.x, y - h * 0.82); g.lineTo(V.x, y - h - s * 0.01); g.lineTo(V.x + V.w, y - h - s * 0.01); g.lineTo(V.x + V.w, y - h * 0.82); g.fill();
        for (let px = V.x; px < V.x + V.w; px += s * 0.03) circ(px, y - h * 0.83, s * 0.009, '#4a5057');
      }
    });
  }

  function treeJ(st) {
    const p = P(-0.74, 0.14), s = V.s * p.k;
    withAppear(2, p.x, p.y, () => {
      if (st === 1) pineAt(p.x, p.y, s * 1.05);
      else if (st === 2) weepingAt(p.x, p.y, s);
      else treeAt(p.x, p.y, s * 0.95, 3, null);
    });
  }

  function lantern(st) {
    const p = P(0.66, 0.55), s = V.s * p.k, x = p.x, y = p.y;
    withAppear(4, x, y, () => {
      shadow(x, y, s * 0.1, s * 0.022);
      const stone = (x0, y0, w, h) => { g.fillStyle = lin(x0, 0, x0 + w, 0, [[0, '#7d7a73'], [0.6, '#a9a59c'], [1, '#bdb9af']]); g.fillRect(x0, y0, w, h); };
      const roof = (cy, w, h) => {
        g.fillStyle = lin(0, cy - h, 0, cy, [[0, '#b3afa6'], [1, '#77746d']]);
        g.beginPath(); g.moveTo(x - w, cy); g.quadraticCurveTo(x - w * 0.9, cy - h * 0.3, x - w * 0.35, cy - h * 0.7); g.lineTo(x, cy - h);
        g.lineTo(x + w * 0.35, cy - h * 0.7); g.quadraticCurveTo(x + w * 0.9, cy - h * 0.3, x + w, cy); g.closePath(); g.fill();
        ball(x, cy - h - s * 0.012, s * 0.012, '#a9a59c');
      };
      const box = (cy, w, h) => {
        stone(x - w, cy - h, w * 2, h);
        const flick = 0.75 + 0.25 * Math.sin(V.t * 7) * Math.sin(V.t * 3.1);
        rect(x - w * 0.45, cy - h * 0.8, w * 0.9, h * 0.6, `rgba(255,214,120,${(0.55 * flick).toFixed(3)})`);
      };
      if (st === 0) { // kasuga: tall
        stone(x - s * 0.04, y - s * 0.02, s * 0.08, s * 0.02);
        stone(x - s * 0.018, y - s * 0.17, s * 0.036, s * 0.15);
        stone(x - s * 0.04, y - s * 0.185, s * 0.08, s * 0.018);
        box(y - s * 0.185, s * 0.032, s * 0.06);
        roof(y - s * 0.24, s * 0.07, s * 0.05);
      } else if (st === 1) { // yukimi: wide roof, curved legs
        for (const lx of [-1, 1]) { g.beginPath(); g.moveTo(x + lx * s * 0.06, y); g.quadraticCurveTo(x + lx * s * 0.05, y - s * 0.05, x + lx * s * 0.025, y - s * 0.07); g.strokeStyle = '#8f8b83'; g.lineWidth = s * 0.014; g.stroke(); }
        box(y - s * 0.07, s * 0.035, s * 0.05);
        roof(y - s * 0.12, s * 0.1, s * 0.045);
      } else { // oki: small and low
        stone(x - s * 0.03, y - s * 0.02, s * 0.06, s * 0.02);
        box(y - s * 0.02, s * 0.025, s * 0.04);
        roof(y - s * 0.06, s * 0.05, s * 0.035);
      }
    });
  }

  const KOI = [['#ffffff', '#e0452f'], ['#ffc53a', '#f0a51a'], ['#f07a2a', '#222222']];
  function pondJ(st) {
    const p = P(-0.12, 0.52), s = V.s * p.k, x = p.x, y = p.y;
    withAppear(5, x, y, () => {
      const rx = s * 0.42, ry = rx * 0.3;
      ell(x, y + ry * 0.06, rx * 1.06, ry * 1.2, '#3f6a2a');
      water(x, y, rx, ry, s);
      // koi glide in slow loops
      g.save(); g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.clip();
      for (let i = 0; i < 4; i++) {
        const a = V.t * (0.35 + i * 0.05) + i * 1.7, dir = -Math.sin(a) > 0 ? 1 : -1;
        const kx = x + Math.cos(a) * rx * (0.35 + i * 0.12), ky = y + Math.sin(a) * ry * (0.3 + i * 0.1);
        const [body, spot] = KOI[st === 2 ? i % 3 : st];
        ell(kx, ky, s * 0.032, s * 0.011, body);
        ell(kx + dir * s * 0.006, ky - s * 0.002, s * 0.012, s * 0.006, spot);
        poly([kx - dir * s * 0.03, ky, kx - dir * s * 0.048, ky - s * 0.01, kx - dir * s * 0.048, ky + s * 0.01], body);
      }
      g.restore();
      // rocks on the rim
      [[-0.95, 0.1, 0.06], [-0.75, -0.6, 0.045], [0.9, 0.2, 0.055], [0.55, 0.8, 0.04]].forEach(([u, v, r]) => {
        const rx2 = x + u * rx, ry2 = y + v * ry;
        shadow(rx2, ry2 + s * 0.01, r * s * 1.2, r * s * 0.35);
        ball(rx2, ry2 - r * s * 0.3, r * s * 0.6, '#8f8b82', r * s);
      });
    });
  }

  function bridge(st) {
    const p = P(-0.12, 0.52), s = V.s * p.k, x = p.x, y = p.y;
    withAppear(6, x, y, () => {
      const half = s * 0.3, rise = s * 0.13, deck = s * 0.03;
      const col = st === 0 ? '#c8372d' : st === 1 ? '#9c6a3c' : '#9d9990';
      const arc = (dy) => { g.moveTo(x - half, y + dy); g.quadraticCurveTo(x, y - rise * 2 + dy, x + half, y + dy); };
      ell(x, y + s * 0.02, half * 1.05, s * 0.02, 'rgba(10,40,60,0.3)');
      if (st === 2) { // stone arch: solid with an opening
        g.beginPath(); arc(0); g.lineTo(x + half, y + s * 0.01); g.quadraticCurveTo(x, y - rise * 1.2, x - half, y + s * 0.01); g.closePath();
        g.fillStyle = lin(0, y - rise, 0, y, [[0, '#b8b4ab'], [1, '#7d796f']]); g.fill();
      }
      g.beginPath(); arc(0); g.lineTo(x + half, y + deck); g.quadraticCurveTo(x, y - rise * 2 + deck, x - half, y + deck); g.closePath();
      g.fillStyle = shade(col, -0.12); g.fill();
      g.beginPath(); arc(-deck * 0.3); g.strokeStyle = shade(col, 0.1); g.lineWidth = Math.max(1, deck * 0.5); g.stroke();
      // railing
      const rail = (t) => { const u = t; return { px: x - half + u * half * 2, py: (1 - u) * (1 - u) * y + 2 * (1 - u) * u * (y - rise * 2) + u * u * y }; };
      for (let i = 0; i <= 8; i++) { const { px, py } = rail(i / 8); rect(px - s * 0.006, py - s * 0.06, s * 0.012, s * 0.06, col); }
      g.beginPath(); for (let i = 0; i <= 16; i++) { const { px, py } = rail(i / 16); g.lineTo(px, py - s * 0.06); }
      g.strokeStyle = st === 0 ? '#e0503f' : shade(col, 0.1); g.lineWidth = Math.max(1, s * 0.012); g.stroke();
      if (st === 0) for (const t of [0, 1]) { const { px, py } = rail(t); rect(px - s * 0.008, py - s * 0.085, s * 0.016, s * 0.085, '#1f1a18'); ball(px, py - s * 0.09, s * 0.012, '#d9b44a'); }
    });
  }

  function shrubsJ(st) {
    const spots = [[-0.6, 0.82], [0.88, 0.86], [-0.95, 0.35]];
    spots.forEach(([bx, bz], i) => {
      const p = P(bx, bz), s = V.s * p.k;
      withAppear(7, p.x, p.y, () => {
        shadow(p.x, p.y, s * 0.16, s * 0.03);
        if (st === 0) { // azaleas
          ball(p.x - s * 0.05, p.y - s * 0.05, s * 0.06, '#c43a7a', s * 0.09);
          ball(p.x + s * 0.05, p.y - s * 0.06, s * 0.065, '#e0559a', s * 0.1);
          for (let j = 0; j < 10; j++) circ(p.x + (R[j + i * 10] - 0.5) * s * 0.2, p.y - s * 0.03 - R[j + 50 + i * 10] * s * 0.09, s * 0.01, '#ffc2dd');
        } else if (st === 1) { // clipped boxwood balls
          ball(p.x - s * 0.06, p.y - s * 0.05, s * 0.05, '#3f7f35');
          ball(p.x + s * 0.03, p.y - s * 0.07, s * 0.07, '#4a8f3d');
          ball(p.x + s * 0.1, p.y - s * 0.035, s * 0.035, '#3f7f35');
        } else { // bonsai on a low stand
          g.fillStyle = lin(0, p.y - s * 0.05, 0, p.y, [[0, '#7a5230'], [1, '#4e3320']]); g.fillRect(p.x - s * 0.1, p.y - s * 0.05, s * 0.2, s * 0.02);
          rect(p.x - s * 0.09, p.y - s * 0.03, s * 0.015, s * 0.03, '#4e3320'); rect(p.x + s * 0.075, p.y - s * 0.03, s * 0.015, s * 0.03, '#4e3320');
          g.fillStyle = lin(p.x - s * 0.06, 0, p.x + s * 0.06, 0, [[0, '#28506e'], [1, '#3f7aa0']]); g.fillRect(p.x - s * 0.06, p.y - s * 0.08, s * 0.12, s * 0.03);
          line(p.x, p.y - s * 0.08, p.x + s * 0.02, p.y - s * 0.14, '#4e3320', s * 0.012);
          ell(p.x - s * 0.02, p.y - s * 0.13, s * 0.05, s * 0.017, '#2f5d34'); ell(p.x + s * 0.035, p.y - s * 0.16, s * 0.04, s * 0.014, '#3f7a42');
        }
      });
    });
  }

  function teahouse(st) {
    const p = P(0.45, 0.04), s = V.s * p.k, x = p.x, y = p.y;
    withAppear(8, x, y, () => {
      const bw = s * 0.46, bh = s * 0.15, left = x - bw / 2, lift = s * 0.035;
      poly([left - s * 0.12, y - s * 0.03, left, y, left + bw, y, left + bw - s * 0.1, y - s * 0.03], 'rgba(25,40,15,0.2)');
      // veranda and posts
      g.fillStyle = lin(0, y - lift, 0, y, [[0, '#9a6d45'], [1, '#6d4a2c']]); g.fillRect(left - s * 0.02, y - lift, bw + s * 0.04, lift);
      rect(left - s * 0.03, y - lift - s * 0.008, bw + s * 0.06, s * 0.01, '#b98a5c');
      // shoji front
      g.fillStyle = lin(0, y - lift - bh, 0, y - lift, [[0, '#fbf7ec'], [1, '#e7dfcb']]); g.fillRect(left, y - lift - bh, bw, bh);
      for (let i = 0; i <= 8; i++) rect(left + (bw * i) / 8 - s * 0.003, y - lift - bh, s * 0.006, bh, '#5a3e2a');
      for (let j = 1; j < 4; j++) rect(left, y - lift - (bh * j) / 4, bw, Math.max(0.5, s * 0.003), '#8a6a50');
      g.fillStyle = 'rgba(255,220,150,0.25)'; g.fillRect(left + bw * 0.375, y - lift - bh, bw * 0.25, bh);
      // big roof with upturned eaves
      const ry = y - lift - bh, over = s * 0.09, rh = s * 0.17;
      const roofCol = st === 0 ? '#4a5058' : st === 1 ? '#b58a45' : '#4f9383';
      g.fillStyle = lin(0, ry - rh, 0, ry, [[0, shade(roofCol, 0.1)], [1, shade(roofCol, -0.12)]]);
      g.beginPath(); g.moveTo(left - over, ry - s * 0.02);
      g.quadraticCurveTo(left - over * 0.4, ry, left + bw * 0.1, ry - rh * 0.55);
      g.lineTo(left + bw * 0.9, ry - rh * 0.55);
      g.quadraticCurveTo(left + bw + over * 0.4, ry, left + bw + over, ry - s * 0.02);
      g.lineTo(left + bw + over * 0.6, ry + s * 0.012); g.lineTo(left - over * 0.6, ry + s * 0.012); g.closePath(); g.fill();
      poly([left + bw * 0.1, ry - rh * 0.55, left + bw * 0.25, ry - rh, left + bw * 0.75, ry - rh, left + bw * 0.9, ry - rh * 0.55], shade(roofCol, 0.04));
      rect(left + bw * 0.22, ry - rh - s * 0.012, bw * 0.56, s * 0.016, shade(roofCol, -0.25));
      if (st === 0) for (let i = 1; i < 12; i++) line(left - over * 0.4 + ((bw + over * 0.8) * i) / 12, ry, left + bw * 0.1 + (bw * 0.8 * i) / 12, ry - rh * 0.55, shade(roofCol, -0.15), Math.max(0.5, s * 0.004));
      if (st === 1) for (let i = 0; i < 18; i++) line(left + (bw * i) / 17, ry - rh * 0.55, left - over * 0.3 + ((bw + over * 0.6) * i) / 17, ry + s * 0.01, shade(roofCol, -0.12), Math.max(0.5, s * 0.004));
    });
  }

  function torii(st) {
    const p = P(-0.22, 0.08), s = V.s * p.k, x = p.x, y = p.y;
    withAppear(9, x, y, () => {
      const col = st === 0 ? '#d2402a' : st === 1 ? '#2a2522' : '#a29e95', w = s * 0.26, h = s * 0.42;
      shadow(x, y, w * 1.1, s * 0.03, 0.2);
      for (const px of [-w * 0.7, w * 0.7]) {
        g.fillStyle = lin(x + px - s * 0.02, 0, x + px + s * 0.02, 0, [[0, shade(col, -0.15)], [1, shade(col, 0.08)]]);
        g.fillRect(x + px - s * 0.018, y - h, s * 0.036, h);
        rect(x + px - s * 0.024, y - s * 0.03, s * 0.048, s * 0.03, '#2a2522');
      }
      rect(x - w * 0.85, y - h * 0.78, w * 1.7, s * 0.03, col); // nuki
      g.beginPath(); g.moveTo(x - w * 1.1, y - h * 0.94); g.quadraticCurveTo(x, y - h * 0.86, x + w * 1.1, y - h * 0.94);
      g.lineTo(x + w * 1.05, y - h * 1.02); g.quadraticCurveTo(x, y - h * 0.94, x - w * 1.05, y - h * 1.02); g.closePath();
      g.fillStyle = st === 0 ? '#2a2522' : shade(col, -0.1); g.fill(); // kasagi
      rect(x - w * 0.95, y - h * 0.94, w * 1.9, s * 0.028, col);
      rect(x - s * 0.012, y - h * 0.9, s * 0.024, h * 0.12, col);
    });
  }

  function drawJapanese(B) {
    if (B[3] >= 0) pathAlong(curve(0.45, 0.07, 0.3, 1.37, -0.16), B[3], 3, ['slabs', 'gravel', 'mossy'][B[3]]);
    if (B[5] >= 0) pondJ(B[5]);
    const objs = [];
    if (B[1] >= 0) objs.push([-0.02, () => fenceJ(B[1])]);
    if (B[8] >= 0) objs.push([0.04, () => teahouse(B[8])]);
    if (B[9] >= 0) objs.push([0.08, () => torii(B[9])]);
    if (B[2] >= 0) objs.push([0.14, () => treeJ(B[2])]);
    if (B[6] >= 0) objs.push([0.52, () => bridge(B[6])]);
    if (B[4] >= 0) objs.push([0.55, () => lantern(B[4])]);
    if (B[7] >= 0) objs.push([0.8, () => shrubsJ(B[7])]);
    return objs;
  }

  // ---------------------------------------------------------------- live run layer (strip above the board)
  function runLayer() {
    const r = V.run;
    if (!r) return;
    for (const tr of r.trees) {
      const e = easeBack((V.t - tr.born) / 1.1);
      const pz = 0.72 + 0.45 * tr.z, s = V.s * pz * 0.75 * e, x = V.x + tr.u * V.w, y = V.groundY + tr.z * V.depth;
      if (e <= 0.01) continue;
      if (G.id === 'japanese') { if (tr.st === 1) pineAt(x, y, s); else if (tr.st === 2) weepingAt(x, y, s); else treeAt(x, y, s, 3, null); }
      else treeAt(x, y, s, tr.st, tr.st === 1 ? 'petals' : tr.st === 2 ? 'apples' : null);
    }
    for (const f of r.flowers) {
      const e = easeBack((V.t - f.born) / 0.45);
      const fade = f.die ? clamp(1 - (V.t - f.die) / 0.6, 0, 1) : 1;
      if (e * fade <= 0.01) continue;
      g.globalAlpha = fade;
      flower(V.x + f.u * V.w, V.groundY + f.z * V.depth, V.s * (0.72 + 0.45 * f.z) * 0.17 * e, FLOWER_KINDS[f.ci], FLOWER_COLORS[f.ci], Math.sin(V.t * 2 + f.u * 20));
      g.globalAlpha = 1;
    }
    r.flies.forEach((b, i) => {
      const k = clamp((V.t - b.born) / 1, 0, 1);
      const x = V.x + V.w * (0.5 + 0.45 * Math.sin(V.t * 0.5 + b.ph)), y = V.y + (V.groundY - V.y) * (0.45 + 0.3 * Math.sin(V.t * 0.9 + b.ph * 2));
      butterfly(x, y, V.s * 0.05 * k, FLOWER_COLORS[i % 6], b.ph);
    });
  }

  // ---------------------------------------------------------------- scene
  // view: {x, y, w, h, cx, groundY, depth, s, garden, built[10], t, run?, appear?:{task,k}}
  function drawScene(ctx, view) {
    if (!(view.s > 1) || view.w < 2 || view.h < 2 || !(view.groundY > view.y)) return;
    g = ctx; V = view; G = GARDENS[view.garden || 0] || GARDENS[0];
    sky();
    const B = V.built, st0 = B[0];
    const a0 = V.appear && V.appear.task === 0 ? V.appear.k : 1;
    if (st0 >= 0 && a0 < 1) { blit(backdrop(-1)); g.globalAlpha = a0; blit(backdrop(st0)); g.globalAlpha = 1; }
    else blit(backdrop(st0));
    const objs = G.id === 'japanese' ? drawJapanese(B) : drawCottage(B);
    if (B.every((v) => v < 0)) objs.push([0.42, sign]);
    objs.sort((a, b) => a[0] - b[0]).forEach((o) => o[1]());
    runLayer();
    if (G.id === 'cottage' && B[8] >= 0) butterflies(B[8], 5, V.appear && V.appear.task === 8 ? easeBack(V.appear.k) : 1);
    g = null; V = null;
  }

  // screen point of a build step, for sparkles when it appears
  function anchor(view, garden, task) {
    const [x, z] = GARDENS[garden].focus[task];
    return { x: view.cx + x * view.s, y: view.groundY + z * view.depth - view.s * 0.15 };
  }

  // small card showing one style of one build step
  function preview(ctx, w, h, garden, task, style, t = 0) {
    const built = Array(GARDENS[garden].tasks.length).fill(-1);
    built[task] = style;
    if (task !== 0) built[0] = 0;
    if (garden === 1 && task === 6) built[5] = 0; // the bridge needs its pond
    const [fx, fz, zoom] = GARDENS[garden].focus[task];
    const s = h * zoom, depth = h * 0.5;
    const groundY = task === 0 ? h * 0.45 : h * 0.8 - fz * depth;
    drawScene(ctx, { x: 0, y: 0, w, h, cx: w / 2 - fx * s, groundY, depth, s, garden, built, t });
  }

  function drawHead(ctx, x, y, r, ci, mono) {
    g = ctx; head(x, y, r, FLOWER_KINDS[ci], FLOWER_COLORS[ci], mono); g = null;
  }

  return { GARDENS, FLOWER_COLORS, FLOWER_KINDS, drawScene, preview, anchor, drawHead };
})();
