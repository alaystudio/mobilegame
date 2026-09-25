/* Bloom Blast — the garden. A procedurally drawn 2.5D scene that grows as the player builds.
 * World units: x runs about -1..1 across the stage, z runs 0 (back, horizon) .. 1 (front).
 * The same scene is drawn full screen on the home screen and as a thin live strip above the board.
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
  const easeBack = (k) => { k = clamp(k, 0, 1); const c = 1.7; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };

  // block colors double as flower colors: clearing red blocks blooms tulips, and so on
  const FLOWER_COLORS = ['#ff5a5f', '#ff9f1c', '#ffd23f', '#3fa9ff', '#9b6bff', '#ff7ab8'];
  const FLOWER_KINDS = ['tulip', 'marigold', 'sunflower', 'cornflower', 'lavender', 'rose'];

  // build steps of the Cottage Garden, in order, each with three styles
  const TASKS = [
    { id: 'lawn', cost: 15 },
    { id: 'flowers', cost: 25 },
    { id: 'fence', cost: 35 },
    { id: 'tree', cost: 50 },
    { id: 'path', cost: 65 },
    { id: 'cottage', cost: 80 },
    { id: 'pond', cost: 100 },
    { id: 'bench', cost: 125 },
    { id: 'butterflies', cost: 150 },
    { id: 'beehive', cost: 180 },
  ];
  // where each step sits in the world [x, z], plus a zoom for its preview card
  const FOCUS = [[0, 0.4, 1], [-0.55, 0.78, 2.4], [0, 0, 3], [-0.74, 0.12, 1.1], [0.22, 0.5, 1.1], [0.36, 0.04, 1.3], [-0.18, 0.44, 1.5], [-0.44, 0.3, 2.6], [0, 0.3, 0.9], [0.8, 0.46, 2.6]];

  // fixed pseudo random numbers so decorations never jump between frames
  const R = (() => { let a = 1234567; const out = []; for (let i = 0; i < 400; i++) { a = (a * 16807) % 2147483647; out.push(a / 2147483647); } return out; })();

  let g = null; // current 2d context
  let V = null; // current view
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
    g.strokeStyle = '#3d8a36'; g.lineWidth = Math.max(1, h * 0.06); g.lineCap = 'round'; g.stroke();
    if (h > 9) ell(x + h * 0.1, y - h * 0.32, h * 0.13, h * 0.05, '#4fa844', -0.6);
    head(hx, hy, h * (kind === 'lavender' ? 0.3 : 0.27), kind, col);
  }

  // ---------------------------------------------------------------- backdrop
  function sky() {
    const hz = V.groundY, glow = runEnv(V.run && V.run.rainbow, 5.5);
    const gr = g.createLinearGradient(0, V.y, 0, hz);
    gr.addColorStop(0, glow > 0 ? `rgb(${Math.round(124 + 60 * glow)},${Math.round(200 + 30 * glow)},245)` : '#7cc8f5');
    gr.addColorStop(1, '#e3f5ff');
    g.fillStyle = gr; g.fillRect(V.x, V.y, V.w, hz - V.y + 4);
    const skyH = hz - V.y;
    // sun
    const sx = V.x + V.w * 0.84, sy = V.y + skyH * 0.32, sr = Math.max(7, skyH * 0.12);
    const burst = runEnv(V.run && V.run.burst, 1.4);
    const sg = g.createRadialGradient(sx, sy, sr * 0.4, sx, sy, sr * (3 + burst * 3));
    sg.addColorStop(0, `rgba(255,240,170,${(0.75 + burst * 0.25).toFixed(3)})`); sg.addColorStop(1, 'rgba(255,240,170,0)');
    g.fillStyle = sg; g.fillRect(V.x, V.y, V.w, skyH);
    circ(sx, sy, sr * (1 + burst * 0.25), '#ffe27a');
    // clouds drift slowly
    for (let i = 0; i < 3; i++) {
      const cw = Math.max(26, Math.min(V.w * 0.2, skyH * 0.9));
      const u = ((R[i] + V.t * 0.01 * (1 + i * 0.4)) % 1.3) - 0.15;
      cloud(V.x + u * V.w, V.y + skyH * (0.2 + i * 0.16), cw);
    }
    // rainbow
    const rb = runEnv(V.run && V.run.rainbow, 5.5);
    if (rb > 0) {
      const cols = ['#ff5a5f', '#ff9f1c', '#ffd23f', '#5ccf6b', '#3fa9ff', '#9b6bff'];
      const rad = Math.min(V.w * 0.42, skyH * 1.6), bw = Math.max(2, rad * 0.05);
      g.globalAlpha = rb * 0.75;
      cols.forEach((col, i) => { g.beginPath(); g.arc(V.x + V.w * 0.5, hz + rad * 0.15, rad - i * bw, Math.PI, TAU); g.strokeStyle = col; g.lineWidth = bw + 0.5; g.stroke(); });
      g.globalAlpha = 1;
    }
  }
  // envelope for timed sky effects: rise, hold, fade
  function runEnv(start, dur) {
    if (start == null) return 0;
    const a = V.t - start;
    if (a < 0 || a > dur) return 0;
    return Math.min(1, a / 0.5, (dur - a) / 1.2);
  }
  function cloud(x, y, w) {
    const col = 'rgba(255,255,255,0.92)';
    ell(x, y, w * 0.5, w * 0.15, col);
    ell(x - w * 0.16, y - w * 0.08, w * 0.2, w * 0.15, col);
    ell(x + w * 0.1, y - w * 0.12, w * 0.24, w * 0.18, col);
  }
  function hills() {
    const hz = V.groundY, skyH = hz - V.y;
    const layer = (base, amp, col, freq, ph) => {
      g.beginPath(); g.moveTo(V.x, hz + 2);
      for (let i = 0; i <= 32; i++) { const u = i / 32; g.lineTo(V.x + V.w * u, base - amp * (0.5 + 0.5 * Math.sin(u * TAU * freq + ph))); }
      g.lineTo(V.x + V.w, hz + 2); g.closePath(); g.fillStyle = col; g.fill();
    };
    layer(hz - skyH * 0.16, skyH * 0.12, '#b8e3a3', 0.9, 1.3);
    layer(hz - skyH * 0.05, skyH * 0.08, '#9ad686', 1.7, 0.4);
  }
  function ground() {
    const st = V.built[0], hz = V.groundY, bottom = V.y + V.h;
    const base = st < 0 ? '#c9b67f' : st === 2 ? '#79b852' : '#6cc257';
    rect(V.x, hz, V.w, bottom - hz, base);
    const a = V.appear && V.appear.task === 0 ? V.appear.k : 1;
    if (st < 0) {
      for (let i = 0; i < 14; i++) { const p = P(R[i * 3] * 2.4 - 1.2, R[i * 3 + 1] * 1.2); ell(p.x, p.y, V.s * 0.12 * p.k, V.s * 0.02 * p.k, '#b9a46c'); }
      for (let i = 0; i < 10; i++) { const p = P(R[60 + i] * 2.4 - 1.2, R[80 + i] * 1.1); tuft(p.x, p.y, V.s * 0.03 * p.k, '#9aa35a'); }
    } else {
      if (a < 1) { g.globalAlpha = 1 - a; rect(V.x, hz, V.w, bottom - hz, '#c9b67f'); g.globalAlpha = 1; }
      g.globalAlpha = a;
      if (st === 1) { // striped lawn: mowing bands grow wider toward the viewer
        let z = 0, i = 0;
        while (V.groundY + z * V.depth < bottom && i < 60) { const z1 = z + 0.1 + z * 0.12; if (i % 2) rect(V.x, hz + z * V.depth, V.w, (z1 - z) * V.depth, '#5fb44c'); z = z1; i++; }
      } else if (st === 2) {
        for (let i = 0; i < 40; i++) { const p = P(R[100 + i] * 2.6 - 1.3, R[150 + i] * 1.4); tuft(p.x, p.y, V.s * 0.045 * p.k, i % 3 ? '#5f9f3f' : '#8cc860'); }
      } else {
        for (let i = 0; i < 12; i++) { const p = P(R[200 + i] * 2.4 - 1.2, R[220 + i] * 1.3); ell(p.x, p.y, V.s * 0.14 * p.k, V.s * 0.025 * p.k, '#62b54e'); }
        for (let i = 0; i < 16; i++) { const p = P(R[240 + i] * 2.4 - 1.2, R[260 + i] * 1.3); circ(p.x, p.y, Math.max(0.8, V.s * 0.008 * p.k), i % 2 ? '#ffffff' : '#ffe066'); }
      }
      g.globalAlpha = 1;
    }
    // soft shading toward the viewer
    const sh = g.createLinearGradient(0, hz, 0, bottom);
    sh.addColorStop(0, 'rgba(255,255,255,0.12)'); sh.addColorStop(1, 'rgba(0,40,0,0.12)');
    g.fillStyle = sh; g.fillRect(V.x, hz, V.w, bottom - hz);
  }
  function tuft(x, y, h, col) {
    for (let j = -1; j <= 1; j++) line(x + j * h * 0.25, y, x + j * h * 0.55, y - h * (j ? 0.8 : 1), col, Math.max(0.8, h * 0.15));
  }

  // ---------------------------------------------------------------- garden pieces
  function withAppear(idx, bx, by, fn) {
    const a = V.appear;
    if (!a || a.task !== idx) return fn();
    const e = easeBack(a.k);
    if (e <= 0.001) return undefined;
    g.save(); g.translate(bx, by); g.scale(e, e); g.translate(-bx, -by); fn(); g.restore();
    return undefined;
  }

  function fence(st) {
    const p = P(0, -0.02), s = V.s * p.k, y = p.y;
    withAppear(2, p.x, y, () => {
      if (st === 2) { // hedge
        const hh = s * 0.12;
        rect(V.x, y - hh, V.w, hh, '#3f9a45');
        for (let px = V.x - hh; px < V.x + V.w + hh; px += hh * 0.8) ell(px, y - hh, hh * 0.6, hh * 0.42, '#48a84c');
        for (let px = V.x; px < V.x + V.w; px += hh * 1.3) circ(px + hh * 0.3, y - hh * 1.1, hh * 0.16, '#62c060');
        return;
      }
      const step = s * 0.075, ph = s * 0.15;
      const post = st === 0 ? '#fbf7ee' : '#8a5a33', rail = st === 0 ? '#e6dcc6' : '#a0703f';
      rect(V.x, y - ph * 0.72, V.w, ph * 0.1, rail);
      rect(V.x, y - ph * 0.32, V.w, ph * 0.1, rail);
      const gap = st === 0 ? step : step * 2.4;
      for (let px = V.x + ((p.x - V.x) % gap) - gap; px < V.x + V.w + gap; px += gap) {
        if (st === 0) poly([px - step * 0.28, y, px - step * 0.28, y - ph * 0.82, px, y - ph, px + step * 0.28, y - ph * 0.82, px + step * 0.28, y], post);
        else { rect(px - step * 0.32, y - ph * 1.05, step * 0.64, ph * 1.05, post); ell(px, y - ph * 1.05, step * 0.32, step * 0.12, '#b98a58'); }
      }
    });
  }

  function cottage(st) {
    const p = P(0.36, 0.04), s = V.s * p.k, x = p.x, y = p.y;
    withAppear(5, x, y, () => {
      const bw = s * 0.44, bh = s * 0.27, left = x - bw / 2;
      const wall = st === 2 ? '#dccfb4' : st === 1 ? '#fff3d6' : '#fbfaf5';
      const roof = st === 2 ? '#d6ad55' : st === 1 ? '#4a7fd6' : '#d9534a';
      rect(x + bw * 0.2, y - bh - s * 0.19, s * 0.06, s * 0.14, '#9a6a55');
      for (let i = 0; i < 3; i++) {
        const k = (V.t * 0.3 + i / 3) % 1;
        g.globalAlpha = 0.55 * (1 - k);
        circ(x + bw * 0.2 + s * 0.03 + k * s * 0.08, y - bh - s * 0.22 - k * s * 0.22, s * (0.02 + k * 0.035), '#ffffff');
        g.globalAlpha = 1;
      }
      rect(left, y - bh, bw, bh, wall);
      rect(left, y - bh * 0.1, bw, bh * 0.1, shade(wall, -0.1));
      poly([left - s * 0.04, y - bh, x, y - bh - s * 0.22, left + bw + s * 0.04, y - bh], roof);
      if (st === 2) for (let i = 1; i < 6; i++) line(x - (s * 0.26 * i) / 6, y - bh - (s * 0.22 * (6 - i)) / 6, x - (s * 0.26 * i) / 6 + s * 0.02, y - bh, shade(roof, -0.14), s * 0.008);
      rect(left - s * 0.04, y - bh - s * 0.012, bw + s * 0.08, s * 0.02, shade(roof, -0.18));
      rect(x - bw * 0.08, y - bh * 0.62, bw * 0.16, bh * 0.62, '#8a4b2c');
      circ(x + bw * 0.045, y - bh * 0.3, s * 0.006, '#f4d58d');
      for (const wx of [left + bw * 0.2, left + bw * 0.8]) {
        rect(wx - bw * 0.09, y - bh * 0.72, bw * 0.18, bh * 0.34, '#7a5230');
        rect(wx - bw * 0.075, y - bh * 0.7, bw * 0.15, bh * 0.3, '#9fd8f5');
        rect(wx - bw * 0.005, y - bh * 0.7, bw * 0.01, bh * 0.3, '#7a5230');
        rect(wx - bw * 0.11, y - bh * 0.4, bw * 0.22, bh * 0.05, '#b87a4b');
        for (let j = 0; j < 3; j++) circ(wx - bw * 0.07 + j * bw * 0.07, y - bh * 0.41, s * 0.012, FLOWER_COLORS[(j * 2 + st) % 6]);
      }
    });
  }

  function treeAt(bx, by, s, st) {
    const sw = Math.sin(V.t * 0.8 + bx * 0.05) * s * 0.012;
    poly([bx - s * 0.04, by, bx - s * 0.025, by - s * 0.38, bx + s * 0.025, by - s * 0.38, bx + s * 0.04, by], '#8a5a33');
    const cols = st === 1 ? ['#f7a8c8', '#ffc4dc', '#ee8fb6'] : st === 2 ? ['#4ea346', '#62b755', '#428c3c'] : ['#3f9a45', '#55af50', '#358a3c'];
    const cx = bx + sw, cy = by - s * 0.5;
    ell(cx - s * 0.14, cy + s * 0.05, s * 0.16, s * 0.14, cols[2]);
    ell(cx + s * 0.15, cy + s * 0.04, s * 0.16, s * 0.14, cols[2]);
    ell(cx, cy - s * 0.08, s * 0.21, s * 0.19, cols[0]);
    ell(cx - s * 0.09, cy - s * 0.02, s * 0.15, s * 0.13, cols[1]);
    ell(cx + s * 0.1, cy - s * 0.13, s * 0.11, s * 0.1, cols[1]);
    if (st === 2) for (let i = 0; i < 7; i++) circ(cx + (R[300 + i] - 0.5) * s * 0.42, cy + (R[310 + i] - 0.6) * s * 0.3, s * 0.022, '#e0453e');
    if (st === 1) for (let i = 0; i < 4; i++) { const k = (V.t * 0.25 + R[320 + i]) % 1; g.globalAlpha = 1 - k; ell(cx + (R[330 + i] - 0.5) * s * 0.5 + Math.sin(V.t * 2 + i) * s * 0.04, cy + k * s * 0.5, s * 0.014, s * 0.009, '#f7a8c8'); g.globalAlpha = 1; }
  }
  function tree(st) {
    const p = P(-0.74, 0.12), s = V.s * p.k;
    withAppear(3, p.x, p.y, () => treeAt(p.x, p.y, s, st));
  }

  function bench(st) {
    const p = P(-0.44, 0.3), s = V.s * p.k, x = p.x, y = p.y;
    withAppear(7, x, y, () => {
      if (st === 2) { // picnic blanket and basket
        poly([x - s * 0.19, y, x + s * 0.19, y, x + s * 0.14, y - s * 0.07, x - s * 0.14, y - s * 0.07], '#e0474c');
        g.globalAlpha = 0.55;
        for (let i = 1; i < 5; i++) { const u = i / 5; line(x - s * 0.19 + u * s * 0.38, y, x - s * 0.14 + u * s * 0.28, y - s * 0.07, '#ffffff', s * 0.02); }
        line(x - s * 0.165, y - s * 0.035, x + s * 0.165, y - s * 0.035, '#ffffff', s * 0.02);
        g.globalAlpha = 1;
        rect(x + s * 0.03, y - s * 0.09, s * 0.09, s * 0.05, '#b07a3e');
        g.beginPath(); g.arc(x + s * 0.075, y - s * 0.09, s * 0.035, Math.PI, TAU); g.strokeStyle = '#8a5a2b'; g.lineWidth = Math.max(1, s * 0.01); g.stroke();
        return;
      }
      const wood = st === 1 ? '#f4f4ef' : '#a86d3d', dark = st === 1 ? '#c9c9c2' : '#7d4f2b';
      rect(x - s * 0.12, y - s * 0.07, s * 0.012, s * 0.07, dark);
      rect(x + s * 0.108, y - s * 0.07, s * 0.012, s * 0.07, dark);
      rect(x - s * 0.14, y - s * 0.075, s * 0.28, s * 0.022, wood);
      rect(x - s * 0.13, y - s * 0.16, s * 0.012, s * 0.09, dark);
      rect(x + s * 0.118, y - s * 0.16, s * 0.012, s * 0.09, dark);
      rect(x - s * 0.14, y - s * 0.16, s * 0.28, s * 0.022, wood);
      rect(x - s * 0.14, y - s * 0.122, s * 0.28, s * 0.018, wood);
    });
  }

  function beehive(st) {
    const p = P(0.8, 0.46), s = V.s * p.k, x = p.x, y = p.y;
    withAppear(9, x, y, () => {
      if (st === 0) {
        for (let i = 0; i < 5; i++) ell(x, y - s * 0.02 - i * s * 0.034, s * (0.085 - i * 0.013), s * 0.028, i % 2 ? '#d9a93f' : '#e9bd55');
        ell(x, y - s * 0.02, s * 0.022, s * 0.014, '#5a3a14');
      } else if (st === 1) {
        for (let i = 0; i < 3; i++) { rect(x - s * 0.07, y - s * 0.05 * (i + 1), s * 0.14, s * 0.046, i % 2 ? '#f6ecd4' : '#fffaf0'); }
        rect(x - s * 0.08, y - s * 0.165, s * 0.16, s * 0.02, '#8a5a33');
        rect(x - s * 0.03, y - s * 0.015, s * 0.06, s * 0.008, '#5a3a14');
      } else {
        rect(x - s * 0.008, y - s * 0.14, s * 0.016, s * 0.14, '#8a5a33');
        rect(x - s * 0.055, y - s * 0.22, s * 0.11, s * 0.08, '#ffd166');
        poly([x - s * 0.07, y - s * 0.22, x, y - s * 0.27, x + s * 0.07, y - s * 0.22], '#c0634a');
        circ(x, y - s * 0.18, s * 0.014, '#5a3a14');
      }
      for (let i = 0; i < 4; i++) {
        const a = V.t * 2.2 + i * 1.6;
        const bx = x + Math.cos(a) * s * 0.14, by = y - s * 0.16 + Math.sin(a * 1.3) * s * 0.06;
        ell(bx, by, s * 0.016, s * 0.011, '#ffcc33');
        rect(bx - s * 0.002, by - s * 0.011, s * 0.005, s * 0.022, '#3a2a10');
        g.globalAlpha = 0.7; ell(bx, by - s * 0.012, s * 0.01, s * 0.007, '#ffffff'); g.globalAlpha = 1;
      }
    });
  }

  function flowerBeds(st) {
    const beds = [[-0.55, 0.78], [0.62, 0.84]];
    const kinds = st === 0 ? [['tulip', 0], ['tulip', 5], ['tulip', 2]] : st === 1 ? [['daisy', '#ffffff']] : [['lavender', 4]];
    beds.forEach(([bx, bz], b) => {
      const p = P(bx, bz), s = V.s * p.k;
      withAppear(1, p.x, p.y, () => {
        ell(p.x, p.y, s * 0.25, s * 0.06, '#7a5234');
        ell(p.x, p.y - s * 0.012, s * 0.23, s * 0.045, '#8d6040');
        for (let i = 0; i < 7; i++) {
          const [kind, c] = kinds[(i + b) % kinds.length];
          const col = typeof c === 'number' ? FLOWER_COLORS[c] : c;
          flower(p.x + (i - 3) * s * 0.062, p.y + (i % 2 ? s * 0.012 : -s * 0.012), s * (0.13 + (i % 3) * 0.02), kind, col, Math.sin(V.t * 1.6 + i + b * 2));
        }
      });
    });
  }

  function butterflyGarden(st) {
    for (const [bx, bz] of [[-0.98, 0.22], [0.98, 0.26]]) {
      const p = P(bx, bz), s = V.s * p.k;
      withAppear(8, p.x, p.y, () => {
        ell(p.x, p.y - s * 0.07, s * 0.14, s * 0.08, '#3f9a45');
        ell(p.x - s * 0.06, p.y - s * 0.1, s * 0.08, s * 0.06, '#4fae4f');
        for (let i = 0; i < 6; i++) circ(p.x + (R[340 + i] - 0.5) * s * 0.24, p.y - s * 0.05 - R[350 + i] * s * 0.1, s * 0.016, FLOWER_COLORS[(i + 3) % 6]);
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

  function pond(st) {
    const p = P(-0.18, 0.44), s = V.s * p.k, x = p.x, y = p.y;
    withAppear(6, x, y, () => {
      const rx = s * 0.3, ry = rx * 0.3;
      if (st === 1) for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; ell(x + Math.cos(a) * rx * 1.05, y + Math.sin(a) * ry * 1.12, s * 0.035, s * 0.02, i % 2 ? '#a9a59d' : '#c2beb6'); }
      else ell(x, y, rx * 1.05, ry * 1.12, '#5a9e4a');
      ell(x, y, rx, ry, '#4aa8df');
      ell(x - rx * 0.1, y - ry * 0.15, rx * 0.8, ry * 0.65, '#6cc0ec');
      for (let i = 0; i < 3; i++) { const k = (V.t * 0.2 + i / 3) % 1; g.globalAlpha = 0.7 * Math.sin(k * Math.PI); line(x - rx * 0.5 + k * rx * 0.6, y - ry * 0.3 + i * ry * 0.3, x - rx * 0.35 + k * rx * 0.6, y - ry * 0.3 + i * ry * 0.3, '#ffffff', Math.max(1, s * 0.008)); g.globalAlpha = 1; }
      if (st === 0) {
        [[-0.5, 0.2], [0.35, -0.1], [0.1, 0.45]].forEach(([u, v], i) => {
          const lx = x + u * rx, ly = y + v * ry;
          ell(lx, ly, s * 0.045, s * 0.018, '#3f9a45');
          if (i === 1) head(lx, ly - s * 0.012, s * 0.022, 'daisy', '#ff9fc4');
        });
      }
      if (st === 2) {
        for (let i = 0; i < 2; i++) {
          const a = V.t * 0.3 + i * Math.PI, dir = Math.cos(a + Math.PI / 2) > 0 ? 1 : -1;
          const dx = x + Math.cos(a) * rx * 0.55, dy = y + Math.sin(a) * ry * 0.45;
          ell(dx, dy, s * 0.03, s * 0.016, '#ffffff');
          circ(dx + dir * s * 0.022, dy - s * 0.018, s * 0.012, '#ffffff');
          poly([dx + dir * s * 0.032, dy - s * 0.02, dx + dir * s * 0.046, dy - s * 0.016, dx + dir * s * 0.032, dy - s * 0.012], '#ff9f1c');
        }
      }
    });
  }

  function path(st) {
    const a = V.appear && V.appear.task === 4 ? V.appear.k : 1;
    g.globalAlpha = a;
    const pts = [];
    for (let i = 0; i <= 18; i++) { const k = i / 18; pts.push(P(0.36 + (0.1 - 0.36) * k + Math.sin(k * Math.PI) * 0.16, 0.07 + k * 1.3)); }
    if (st === 0) {
      pts.forEach((p, i) => { if (i === 0) return; const s = V.s * p.k; const off = (i % 2 ? 1 : -1) * s * 0.03; ell(p.x + off, p.y, s * 0.06, s * 0.022, '#aaa59b'); ell(p.x + off, p.y - s * 0.004, s * 0.05, s * 0.015, '#c8c3b9'); });
    } else {
      for (let i = 1; i < pts.length; i++) line(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y, st === 1 ? '#e3d2a6' : '#c46a4f', V.s * pts[i].k * 0.12);
      pts.forEach((p, i) => {
        const s = V.s * p.k;
        if (st === 1) { circ(p.x - s * 0.03, p.y + s * 0.01, Math.max(0.6, s * 0.006), '#b8a57a'); circ(p.x + s * 0.025, p.y - s * 0.008, Math.max(0.6, s * 0.006), '#b8a57a'); }
        else if (i) line(p.x - s * 0.055, p.y, p.x + s * 0.055, p.y, '#9e4f39', Math.max(0.6, s * 0.007));
      });
    }
    g.globalAlpha = 1;
  }

  function sign() {
    const p = P(-0.05, 0.42), s = V.s * p.k;
    rect(p.x - s * 0.01, p.y - s * 0.16, s * 0.02, s * 0.16, '#8a5a33');
    rect(p.x - s * 0.1, p.y - s * 0.22, s * 0.2, s * 0.09, '#c89a62');
    rect(p.x - s * 0.1, p.y - s * 0.14, s * 0.2, s * 0.012, '#a67a48');
    line(p.x, p.y - s * 0.14, p.x, p.y - s * 0.195, '#3d8a36', s * 0.01);
    ell(p.x - s * 0.02, p.y - s * 0.19, s * 0.022, s * 0.01, '#5ccf6b', -0.5);
    ell(p.x + s * 0.02, p.y - s * 0.2, s * 0.022, s * 0.01, '#5ccf6b', 0.5);
  }

  // ---------------------------------------------------------------- live run layer (strip above the board)
  function runLayer() {
    const r = V.run;
    if (!r) return;
    for (const tr of r.trees) {
      const e = easeBack((V.t - tr.born) / 1.1);
      const pz = 0.72 + 0.45 * tr.z;
      if (e > 0.01) treeAt(V.x + tr.u * V.w, V.groundY + tr.z * V.depth, V.s * pz * 0.75 * e, tr.st);
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
  // view: {x, y, w, h, cx, groundY, depth, s, built[10], t, run?, appear?:{task,k}}
  function drawScene(ctx, view) {
    g = ctx; V = view;
    sky();
    hills();
    ground();
    const B = V.built;
    if (B[4] >= 0) path(B[4]);
    if (B[6] >= 0) pond(B[6]);
    const objs = [];
    if (B[2] >= 0) objs.push([-0.02, () => fence(B[2])]);
    if (B[5] >= 0) objs.push([0.04, () => cottage(B[5])]);
    if (B[3] >= 0) objs.push([0.12, () => tree(B[3])]);
    if (B[8] >= 0) objs.push([0.24, () => butterflyGarden(B[8])]);
    if (B[7] >= 0) objs.push([0.3, () => bench(B[7])]);
    if (B[9] >= 0) objs.push([0.46, () => beehive(B[9])]);
    if (B[1] >= 0) objs.push([0.8, () => flowerBeds(B[1])]);
    if (B.every((v) => v < 0)) objs.push([0.42, sign]);
    objs.sort((a, b) => a[0] - b[0]).forEach((o) => o[1]());
    runLayer();
    if (B[8] >= 0) butterflies(B[8], 5, V.appear && V.appear.task === 8 ? easeBack(V.appear.k) : 1);
    g = null; V = null;
  }

  // screen point of a build step, for sparkles when it appears
  function anchor(view, task) {
    const [x, z] = FOCUS[task];
    return { x: view.cx + x * view.s, y: view.groundY + z * view.depth - view.s * 0.15 };
  }

  // small card showing one style of one build step
  function preview(ctx, w, h, task, style, t = 0) {
    const built = Array(TASKS.length).fill(-1);
    built[task] = style;
    if (task !== 0) built[0] = 0;
    const [fx, fz, zoom] = FOCUS[task];
    const s = h * zoom, depth = h * 0.5;
    const groundY = task === 0 ? h * 0.45 : h * 0.8 - fz * depth;
    drawScene(ctx, { x: 0, y: 0, w, h, cx: w / 2 - fx * s, groundY, depth, s, built, t });
  }

  function drawHead(ctx, x, y, r, ci, mono) {
    g = ctx; head(x, y, r, FLOWER_KINDS[ci], FLOWER_COLORS[ci], mono); g = null;
  }

  return { TASKS, FLOWER_COLORS, FLOWER_KINDS, drawScene, preview, anchor, drawHead };
})();
