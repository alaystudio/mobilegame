/* YÖRÜNGE — tek dokunuşla yörünge değiştirme oyunu. Bağımlılık yok, saf Canvas. */
(() => {
  'use strict';

  // ---------------------------------------------------------------- yardımcılar
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const chance = (p) => Math.random() < p;
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const $ = (id) => document.getElementById(id);

  const hex = (h) => {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

  function weighted(list) {
    let total = 0;
    for (const [, w] of list) total += w;
    let r = Math.random() * total;
    for (const [k, w] of list) if ((r -= w) < 0) return k;
    return list[0][0];
  }

  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
  }
  function mulberry32(a) {
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const dayKey = (d = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  // ---------------------------------------------------------------- ayarlar
  const SWITCH_T = 0.11;        // yörünge geçiş süresi (sn)
  const PERFECT_T = 0.18;       // çarpmaya bu kadar kala kaçış = PERFECT
  const COMBO_T = 2.5;          // kombo süresi
  const OMEGA_START = 1.6;      // rad/sn
  const OMEGA_MAX = 3.4;
  const REVIVE_COST = 30;       // devam etme bedeli (★)

  // Oyun içinde halkalarda çıkan güç topları
  const POWERS = {
    magnet: { name: 'Mıknatıs', color: '#ff4d6d', base: 6, per: 1.5 },
    slow:   { name: 'Yavaş Çekim', color: '#7cf5ff', base: 5, per: 1.2 },
    double: { name: 'Çift Puan', color: '#ffd84d', base: 7, per: 1.5 },
  };
  const SHIELD_COLOR = '#6be0ff';
  const SHIELD_NEED = [12, 10, 8, 7, 6];   // kalkan için gereken yıldız (geliştirme seviyesine göre)
  const UPG_COST = [60, 120, 200, 320];
  const UPG_MAX = 4;
  const durOf = (t, l) => String(+(POWERS[t].base + POWERS[t].per * l).toFixed(1));
  const UPGRADES = [
    { id: 'shield', icon: '🛡️', name: 'Kalkan', color: SHIELD_COLOR, info: (l) => `Her ${SHIELD_NEED[l]} yıldızda bir kalkan dolar` },
    { id: 'magnet', icon: '🧲', name: 'Mıknatıs', color: POWERS.magnet.color, info: (l) => `Yıldızları kendine çeker, ${durOf('magnet', l)} sn` },
    { id: 'slow', icon: '⏳', name: 'Yavaş Çekim', color: POWERS.slow.color, info: (l) => `Zamanı yavaşlatır, ${durOf('slow', l)} sn` },
    { id: 'double', icon: '×2', name: 'Çift Puan', color: POWERS.double.color, info: (l) => `Her geçiş 2 kat puan, ${durOf('double', l)} sn` },
  ];
  const LOOKAHEAD = Math.PI * 1.35;

  const LEVELS = [
    { at: 0,   bg1: '#141a3d', bg2: '#05060f', obs: '#ff3d6e', ring: '#8fa3ff', core: '#1d2658' },
    { at: 15,  bg1: '#2a0f45', bg2: '#08030f', obs: '#ff9f1c', ring: '#c69bff', core: '#3a1766' },
    { at: 35,  bg1: '#06343a', bg2: '#010a0c', obs: '#ff4d8d', ring: '#6ff7e8', core: '#0b4a52', rings: 3, msg: '3. YÖRÜNGE AÇILDI' },
    { at: 60,  bg1: '#3d0a16', bg2: '#0b0204', obs: '#ffd23f', ring: '#ff8fa6', core: '#5a1222', breath: true, msg: 'YÖRÜNGELER NEFES ALIYOR' },
    { at: 90,  bg1: '#0f3a12', bg2: '#020a02', obs: '#ff5ef0', ring: '#9dff8f', core: '#15521b', rings: 4, msg: '4. YÖRÜNGE AÇILDI' },
    { at: 130, bg1: '#1a1a1a', bg2: '#000000', obs: '#ffffff', ring: '#ff3d6e', core: '#2a2a2a' },
  ].map((l) => ({ ...l, bg1: hex(l.bg1), bg2: hex(l.bg2), obs: hex(l.obs), ring: hex(l.ring), core: hex(l.core) }));

  // Halka sayısına göre iç/dış yarıçap (M'nin katı olarak)
  const LAYOUT = { 2: [0.28, 0.42], 3: [0.24, 0.44], 4: [0.2, 0.46] };
  const BREATH_AMP = 0.028;

  const SKINS = [
    { id: 'neon', name: 'Neon', price: 0, color: '#3de8ff' },
    { id: 'lime', name: 'Limon', price: 40, color: '#b6ff3d' },
    { id: 'rose', name: 'Gül', price: 80, color: '#ff6bd6' },
    { id: 'sun', name: 'Güneş', price: 150, color: '#ffc93d' },
    { id: 'ice', name: 'Buz', price: 250, color: '#e8f6ff' },
    { id: 'lava', name: 'Lav', price: 400, color: '#ff5a1f' },
    { id: 'void', name: 'Boşluk', price: 600, color: '#9d6bff' },
    { id: 'rainbow', name: 'Gökkuşağı', price: 1000, color: '#ffffff', rainbow: true },
  ];

  const MISSION_TYPES = {
    score:   { cum: false, text: (t) => `Tek oyunda ${t} puan yap` },
    stars:   { cum: true,  text: (t) => `${t} yıldız topla` },
    perfect: { cum: true,  text: (t) => `${t} kez PERFECT yap` },
    games:   { cum: true,  text: (t) => `${t} oyun oyna` },
    combo:   { cum: false, text: (t) => `x${t} kombo yakala` },
  };

  // ---------------------------------------------------------------- kayıt
  const SAVE_KEY = 'yorunge.save.v1';
  const DEFAULTS = {
    best: 0, stars: 0, skin: 'neon', owned: ['neon'], sound: true, vibe: true,
    games: 0, totalStars: 0, tutorialDone: false, upg: {},
    lastDay: null, streak: 0, missionsDay: null, missions: [],
  };
  const save = (() => {
    try { return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); }
    catch (e) { return Object.assign({}, DEFAULTS); }
  })();
  save.upg = Object.assign({ shield: 0, magnet: 0, slow: 0, double: 0 }, save.upg);
  const powerDur = (t) => POWERS[t].base + POWERS[t].per * save.upg[t];
  const shieldNeed = () => SHIELD_NEED[save.upg.shield];

  function persist() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* gizli mod vb. */ }
  }

  // ---------------------------------------------------------------- ses
  const Sound = {
    ctx: null, master: null,
    init() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
    },
    tone(freq, dur, type = 'sine', vol = 0.5, slideTo = null, delay = 0) {
      if (!save.sound || !this.ctx) return;
      const t = this.ctx.currentTime + delay;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + dur + 0.02);
    },
    noise(dur, vol) {
      if (!save.sound || !this.ctx) return;
      const len = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(3000, this.ctx.currentTime);
      f.frequency.exponentialRampToValueAtTime(200, this.ctx.currentTime + dur);
      const g = this.ctx.createGain();
      g.gain.value = vol;
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start();
    },
    tap(ring) { this.tone(ring ? 540 : 400, 0.07, 'sine', 0.3, ring ? 720 : 300); },
    pass() { this.tone(880, 0.04, 'sine', 0.06); },
    star() { this.tone(1320, 0.1, 'triangle', 0.25); this.tone(1980, 0.12, 'triangle', 0.18, null, 0.05); },
    perfect(c) {
      const base = 523 * Math.pow(2, Math.min(c, 12) / 12);
      this.tone(base, 0.1, 'square', 0.12);
      this.tone(base * 1.5, 0.16, 'square', 0.1, null, 0.06);
    },
    flip() { this.tone(300, 0.15, 'triangle', 0.15, 600); },
    die() { this.tone(320, 0.55, 'sawtooth', 0.25, 50); this.noise(0.45, 0.5); },
    record() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.22, null, i * 0.08)); },
    level() { [392, 523, 659].forEach((f, i) => this.tone(f, 0.2, 'sine', 0.25, null, i * 0.07)); },
    power() { [660, 880, 1320].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.2, null, i * 0.05)); },
    shieldUp() { this.tone(440, 0.3, 'sine', 0.3, 880); this.tone(1320, 0.2, 'triangle', 0.12, null, 0.15); },
    shieldBreak() { this.noise(0.25, 0.45); this.tone(900, 0.3, 'square', 0.12, 200); },
    coin() { this.tone(988, 0.08, 'square', 0.1); this.tone(1319, 0.2, 'square', 0.1, null, 0.08); },
  };
  function vibrate(p) {
    if (save.vibe && navigator.vibrate) { try { navigator.vibrate(p); } catch (e) { /* yok */ } }
  }

  // ---------------------------------------------------------------- tuval & ölçüler
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  let W, H, DPR, CX, CY, M, R_IN, R_OUT, BALL_R, OBS_T, OBS_L, CORE_R, SAFE_TOP;
  let bgStars = [];
  // Halka yarıçapı: yeni halka doğarken eski düzenden yenisine yumuşak geçiş + nefes alma
  function ringR(i) {
    const n = S.ringCount;
    const [lo, hi] = LAYOUT[n];
    let r = lerp(lo, hi, i / (n - 1)) * M;
    if (S.ringAnim < 1 && LAYOUT[n - 1]) {
      const [plo, phi] = LAYOUT[n - 1];
      const rOld = lerp(plo, phi, Math.min(i, n - 2) / (n - 2)) * M;
      r = lerp(rOld, r, easeOut(S.ringAnim));
    }
    if (S.breath > 0) r += Math.sin(S.time * 1.5 - i * 0.5) * BREATH_AMP * M * S.breath;
    return r;
  }
  const innerR = () => LAYOUT[S.ringCount][0] * M;
  const outerR = () => LAYOUT[S.ringCount][1] * M;

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2.5);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.floor(W * DPR); canvas.height = Math.floor(H * DPR);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    M = Math.min(W, H * 0.62, 560);
    CX = W / 2; CY = H * 0.5;
    R_OUT = M * 0.42; R_IN = M * 0.28;
    BALL_R = M * 0.03; OBS_T = M * 0.038; OBS_L = M * 0.048;
    CORE_R = R_IN * 0.58;
    if (S) CORE_R = Math.min(CORE_R, innerR() * 0.72);
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;top:0;height:var(--sat);visibility:hidden';
    document.body.appendChild(probe);
    SAFE_TOP = probe.getBoundingClientRect().height || 0;
    probe.remove();
    if (S) { S.from = S.radius = ringR(Math.min(S.ring, S.ringCount - 1)); S.trail.length = 0; }
    bgStars = [];
    const n = Math.floor((W * H) / 6000);
    for (let i = 0; i < n; i++) {
      bgStars.push({ a: rand(0, TAU), d: Math.sqrt(Math.random()) * Math.hypot(W, H) * 0.6, s: rand(0.5, 1.8), tw: rand(0, TAU) });
    }
  }

  // ---------------------------------------------------------------- oyun durumu
  const S = {
    mode: 'menu', time: 0, angle: -Math.PI / 2, omega: OMEGA_START, ring: 1, radius: 0, from: 0, switchP: 1,
    score: 0, passed: 0, combo: 0, comboT: 0, maxCombo: 0, runStars: 0, runPerfects: 0,
    obs: [], stars: [], parts: [], pops: [], trail: [],
    nextSpawn: 0, shake: 0, dieT: 0, coreKick: 0, flash: 0, levelIdx: 0,
    pal: null, paused: false, recordBeaten: false, tutorial: false, hint: 0, demoT: 0, deadAt: null,
    ringCount: 2, ringAnim: 1, pendingRings: 0, breath: 0, dir: -1, dirHint: 0,
    shield: 0, shieldProg: 0, invuln: 0, pw: { magnet: 0, slow: 0, double: 0 }, pwMax: {}, items: [],
    revived: false, slowF: 1, speed: OMEGA_START,
  };
  S.pal = {
    bg1: LEVELS[0].bg1.slice(), bg2: LEVELS[0].bg2.slice(), obs: LEVELS[0].obs.slice(),
    ring: LEVELS[0].ring.slice(), core: LEVELS[0].core.slice(),
  };

  const currentSkin = () => SKINS.find((s) => s.id === save.skin) || SKINS[0];
  function ballColor() {
    const s = currentSkin();
    return s.rainbow ? `hsl(${(S.time * 140) % 360},100%,65%)` : s.color;
  }

  // ---------------------------------------------------------------- günlük sistem
  function checkDay(showToasts) {
    const today = dayKey();
    if (save.lastDay !== today) {
      const y = new Date(); y.setDate(y.getDate() - 1);
      save.streak = save.lastDay === dayKey(y) ? save.streak + 1 : 1;
      save.lastDay = today;
      const bonus = Math.min(10 * save.streak, 50);
      save.stars += bonus;
      if (showToasts) {
        setTimeout(() => {
          toast(`🔥 ${save.streak}. gün serisi! <b>+${bonus} ★</b>`);
          Sound.coin();
        }, 400);
      }
    }
    if (save.missionsDay !== today) {
      save.missionsDay = today;
      save.missions = genMissions(today);
    }
    persist();
  }

  function genMissions(day) {
    const rng = mulberry32(hashStr(day));
    const types = Object.keys(MISSION_TYPES);
    for (let i = types.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [types[i], types[j]] = [types[j], types[i]];
    }
    const tier = (arr) => arr[Math.floor(rng() * arr.length)];
    return types.slice(0, 3).map((type) => {
      let target, reward;
      switch (type) {
        case 'score':
          target = Math.max(10, Math.round((save.best * tier([0.5, 0.7, 0.9])) / 5) * 5);
          reward = 30; break;
        case 'stars': target = tier([15, 25, 40]); reward = 25; break;
        case 'perfect': target = tier([5, 10, 20]); reward = 30; break;
        case 'games': target = tier([3, 5, 8]); reward = 20; break;
        case 'combo': target = tier([3, 4, 6]); reward = 35; break;
      }
      return { type, target, progress: 0, reward, done: false };
    });
  }

  function progressMissions(run) {
    const completed = [];
    for (const m of save.missions) {
      if (m.done) continue;
      const v = run[m.type] || 0;
      m.progress = MISSION_TYPES[m.type].cum ? m.progress + v : Math.max(m.progress, v);
      if (m.progress >= m.target) {
        m.progress = m.target; m.done = true;
        save.stars += m.reward;
        completed.push(m);
      }
    }
    return completed;
  }

  // ---------------------------------------------------------------- engel üretimi
  function difficulty() { return S.passed; }
  function omegaTarget() { return Math.min(OMEGA_MAX, OMEGA_START + difficulty() * 0.014); }
  function gapAngle(mult = 1) {
    const w = omegaTarget();
    const tGap = Math.max(0.36, 0.8 - difficulty() * 0.0035);
    const minA = 2 * ((OBS_L + BALL_R + OBS_T * 0.5) / innerR()) + w * SWITCH_T * 1.6;
    return Math.max(minA, w * tGap * mult);
  }

  function addObs(a, ring, opt = {}) {
    const o = {
      a, ring, fromRing: ring, flipP: 1, flipTo: opt.flipTo,
      hw: opt.hw != null ? opt.hw : OBS_L / (opt.flip ? (ringR(ring) + ringR(opt.flipTo)) / 2 : ringR(ring)),
      flip: !!opt.flip, flipped: false, passed: false, perfect: false, born: S.time,
    };
    S.obs.push(o);
    return o;
  }
  function addStar(a, ring) { S.stars.push({ a, ring, taken: false, born: S.time, takenT: 0 }); }

  function spawnPattern() {
    const d = difficulty();
    const a = S.nextSpawn;
    const G = gapAngle();

    if (S.tutorial && !S.tutSpawned) {
      S.tutSpawned = true;
      addObs(a + G, 1); addStar(a + G, 0);
      addObs(a + G * 3, 0); addStar(a + G * 3, 1);
      S.nextSpawn = a + G * 4.5;
      return;
    }

    const n = S.ringCount;
    const rr = () => (Math.random() * n) | 0;
    const other = (r) => { let o = (Math.random() * (n - 1)) | 0; return o >= r ? o + 1 : o; };

    const kind = weighted([
      ['single', 3],
      ['zig', d >= 5 ? 3 : 0],
      ['wall', d >= 10 ? 1.6 : 0],
      ['flip', d >= 25 ? 1.8 : 0],
      ['fastzig', d >= 45 ? 1.5 : 0],
      ['gate', n >= 3 ? 2.2 : 0],
      ['ladder', n >= 3 ? 1.4 : 0],
      ['stars', 1.1],
    ]);

    switch (kind) {
      case 'single': {
        const r = rr();
        addObs(a, r);
        if (chance(0.45)) addStar(a, other(r));
        S.nextSpawn = a + G * 1.35;
        break;
      }
      case 'zig':
      case 'fastzig': {
        const fast = kind === 'fastzig';
        const g = fast ? gapAngle(0.75) : G;
        const cnt = fast ? 2 + ((Math.random() * 2) | 0) : 2 + ((Math.random() * (d > 40 ? 4 : 2)) | 0);
        let r = rr();
        for (let i = 0; i < cnt; i++) {
          addObs(a + i * g, r);
          if (chance(0.3)) addStar(a + i * g, other(r));
          r = other(r);
        }
        S.nextSpawn = a + (cnt - 1) * g + G * 1.3;
        break;
      }
      case 'wall': {
        const r = rr();
        const span = rand(0.45, 0.95);
        addObs(a + span / 2, r, { hw: span / 2 });
        const cnt = Math.floor(span / 0.2);
        const sr = other(r);
        for (let i = 0; i <= cnt; i++) addStar(a + (span * i) / Math.max(1, cnt), sr);
        S.nextSpawn = a + span + G * 1.2;
        break;
      }
      case 'flip': {
        const r = rr();
        const to = r === 0 ? 1 : r === n - 1 ? n - 2 : r + (chance(0.5) ? 1 : -1);
        addObs(a, r, { flip: true, flipTo: to });
        if (chance(0.5)) addStar(a, r);
        S.nextSpawn = a + G * 1.7;
        break;
      }
      case 'gate': {
        // tek boşluklu kapı: gel-git ile boşluğa ulaşmak için önünde yeterli boşluk bırak
        const ga = a + omegaTarget() * 0.16 * (2 * n - 4);
        const gap = rr();
        for (let r = 0; r < n; r++) if (r !== gap) addObs(ga, r);
        addStar(ga, gap);
        S.nextSpawn = ga + G * 1.5;
        break;
      }
      case 'ladder': {
        const up = chance(0.5);
        for (let i = 0; i < n; i++) {
          const r = up ? i : n - 1 - i;
          addObs(a + i * G, r);
        }
        S.nextSpawn = a + (n - 1) * G + G * 1.3;
        break;
      }
      case 'stars': {
        const r = rr(), r2 = other(r);
        const step = 0.15;
        for (let i = 0; i < 6; i++) addStar(a + i * step, i < 3 ? r : r2);
        S.nextSpawn = a + 5 * step + G;
        break;
      }
    }
  }

  function spawnAhead() {
    if (S.pendingRings || S.ringAnim < 1) return;
    while (S.nextSpawn < S.angle + LOOKAHEAD) { spawnPattern(); maybeSpawnItem(); }
  }

  function maybeSpawnItem() {
    if (S.tutorial || S.passed < 5 || S.items.length || !chance(0.15)) return;
    const types = Object.keys(POWERS).filter((t) => S.pw[t] <= 0);
    if (!types.length) return;
    S.items.push({ a: S.nextSpawn - gapAngle() * 0.55, ring: (Math.random() * S.ringCount) | 0, type: pick(types), born: S.time, taken: false });
  }

  const obsRadius = (o) =>
    o.flipP >= 1 ? ringR(o.ring) : lerp(ringR(o.fromRing), ringR(o.ring), easeOut(o.flipP));
  const ballPos = () => [CX + Math.cos(S.angle) * S.radius, CY + Math.sin(S.angle) * S.radius];
  const polar = (a, r) => [CX + Math.cos(a) * r, CY + Math.sin(a) * r];

  // ---------------------------------------------------------------- efektler
  function burst(x, y, color, n, speed = 220, size = 3, life = 0.6) {
    for (let i = 0; i < n; i++) {
      if (S.parts.length > 400) S.parts.shift();
      const a = rand(0, TAU), v = rand(0.3, 1) * speed;
      S.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(0.5, 1) * life, max: life, color, size: rand(0.6, 1.2) * size });
    }
  }
  function popup(text, x, y, color = '#fff', size = 22, life = 0.9) {
    S.pops.push({ text, x, y, color, size, life, max: life });
  }

  // ---------------------------------------------------------------- akış
  function startRun() {
    Sound.init();
    checkDay(false);
    Object.assign(S, {
      mode: 'play', angle: -Math.PI / 2, omega: OMEGA_START, ring: 1, radius: LAYOUT[2][1] * M, from: LAYOUT[2][1] * M, switchP: 1,
      score: 0, passed: 0, combo: 0, comboT: 0, maxCombo: 0, runStars: 0, runPerfects: 0,
      shake: 0, dieT: 0, flash: 0, levelIdx: 0, paused: false, recordBeaten: false,
      tutorial: !save.tutorialDone, tutSpawned: false, deadAt: null,
      ringCount: 2, ringAnim: 1, pendingRings: 0, breath: 0, dir: -1, dirHint: 0,
      shield: 0, shieldProg: 0, invuln: 0, pw: { magnet: 0, slow: 0, double: 0 }, pwMax: {},
      revived: false, slowF: 1, speed: OMEGA_START,
    });
    S.items.length = 0;
    S.hint = S.tutorial ? 1 : 0;
    S.obs.length = 0; S.stars.length = 0; S.pops.length = 0; S.trail.length = 0;
    S.nextSpawn = S.angle + Math.PI * 0.55;
    hideAll();
  }

  function doSwitch() {
    const old = S.ring;
    S.from = S.radius;
    S.ring += S.dir;
    if (S.ring >= S.ringCount - 1) S.dir = -1;
    if (S.ring <= 0) S.dir = 1;
    S.switchP = 0;
    // PERFECT: bırakılan halkadaki engele çarpmaya çok az kala kaçış
    for (const o of S.obs) {
      if (o.passed || o.ring !== old || (o.flip && !o.flipped)) continue;
      const edge = o.a - o.hw - S.angle - (BALL_R + OBS_T * 0.5) / ringR(old);
      if (edge > -0.03 && edge < S.speed * PERFECT_T) { o.perfect = true; break; }
    }
    Sound.tap(S.ring > old ? 1 : 0);
    vibrate(6);
    const [x, y] = ballPos();
    burst(x, y, ballColor(), 5, 90, 2, 0.3);
  }

  function onPass(o) {
    o.passed = true;
    S.passed++;
    let gain = 1;
    const mult = S.pw.double > 0 ? 2 : 1;
    const [x, y] = polar(o.a, obsRadius(o));
    if (o.perfect) {
      S.combo++;
      S.comboT = COMBO_T;
      S.maxCombo = Math.max(S.maxCombo, S.combo);
      S.runPerfects++;
      gain += Math.min(S.combo, 10);
      popup(S.combo > 1 ? `PERFECT x${S.combo}` : 'PERFECT', x, y - 30, ballColor(), 20 + Math.min(S.combo, 8));
      popup(`+${gain * mult}`, x, y - 4, mult > 1 ? POWERS.double.color : '#fff', 16, 0.8);
      burst(x, y, rgba(S.pal.obs), 14, 260, 3);
      Sound.perfect(S.combo);
      vibrate(15);
      S.flash = 0.25;
    } else {
      Sound.pass();
      popup(`+${mult}`, CX, CY - CORE_R - 18, mult > 1 ? POWERS.double.color : 'rgba(255,255,255,0.7)', 15, 0.5);
    }
    S.score += gain * mult;
    S.coreKick = 1;
    if (S.tutorial) { S.tutorial = false; save.tutorialDone = true; persist(); }
    if (S.hint > 0 && S.passed >= 2) S.hint = 0;

    if (!S.recordBeaten && save.best > 0 && S.score > save.best) {
      S.recordBeaten = true;
      popup('YENİ REKOR!', CX, CY - outerR() - 40, '#ffd84d', 30, 1.6);
      Sound.record();
      vibrate([30, 40, 30]);
      for (let i = 0; i < 3; i++) burst(CX + rand(-80, 80), CY - outerR() - 30, `hsl(${rand(0, 360)},100%,65%)`, 16, 300, 3, 1);
    }
    const next = LEVELS[S.levelIdx + 1];
    if (next && S.score >= next.at) {
      S.levelIdx++;
      popup(`SEVİYE ${S.levelIdx + 1}`, CX, CY + outerR() + 44, '#fff', 28, 1.6);
      if (next.msg) popup(next.msg, CX, CY + outerR() + 76, rgba(next.ring), 17, 2.6);
      if (next.rings) S.pendingRings = next.rings;
      Sound.level();
      S.flash = 0.5;
    }
  }

  function die() {
    S.mode = 'dying';
    S.dieT = 0;
    S.shake = 16;
    const [x, y] = ballPos();
    S.deadAt = [x, y];
    burst(x, y, ballColor(), 40, 380, 4, 1.1);
    burst(x, y, rgba(S.pal.obs), 20, 260, 3, 0.9);
    Sound.die();
    vibrate([60, 40, 120]);
  }

  // ---------------------------------------------------------------- devam et (revive)
  let reviveTimer = null;
  const canRevive = () => !S.revived && S.score >= 5 && save.stars + S.runStars >= REVIVE_COST;
  function offerReviveOrFinish() {
    if (!canRevive()) { finishRun(); return; }
    S.mode = 'revive';
    $('reviveCost').textContent = REVIVE_COST;
    $('reviveScore').textContent = S.score;
    const bar = $('reviveBar');
    bar.style.animation = 'none';
    void bar.offsetWidth;
    bar.style.animation = '';
    show('revive');
    reviveTimer = setTimeout(() => { if (S.mode === 'revive') finishRun(); }, 4000);
  }
  function acceptRevive() {
    if (S.mode !== 'revive') return;
    clearTimeout(reviveTimer);
    const fromBank = Math.min(save.stars, REVIVE_COST);
    save.stars -= fromBank;
    S.runStars -= REVIVE_COST - fromBank;
    persist();
    $('revive').classList.add('hidden');
    S.revived = true;
    S.mode = 'play';
    S.invuln = 2.5;
    S.shake = 0;
    S.trail.length = 0;
    S.switchP = 1;
    // topun önündeki engelleri temizle
    for (let i = S.obs.length - 1; i >= 0; i--) {
      const o = S.obs[i];
      if (!o.passed && o.a - S.angle < 1.6) {
        burst(...polar(o.a, obsRadius(o)), rgba(S.pal.obs), 8, 200, 3);
        S.obs.splice(i, 1);
      }
    }
    popup('DEVAM!', CX, CY - outerR() - 40, SHIELD_COLOR, 30, 1.4);
    Sound.level();
    vibrate(30);
    last = performance.now();
  }

  function finishRun() {
    clearTimeout(reviveTimer);
    $('revive').classList.add('hidden');
    S.mode = 'over';
    const prevBest = save.best;
    const isRecord = S.score > prevBest;
    if (isRecord) save.best = S.score;
    save.games++;
    save.stars += S.runStars;
    save.totalStars += S.runStars;
    const done = progressMissions({ score: S.score, stars: S.runStars, perfect: S.runPerfects, combo: S.maxCombo, games: 1 });
    persist();

    $('overScore').textContent = S.score;
    $('overBest').textContent = save.best;
    $('overStars').textContent = '+' + S.runStars;
    $('overPerfect').textContent = S.runPerfects;
    $('newRecord').classList.toggle('hidden', !isRecord || S.score === 0);
    const gap = prevBest - S.score;
    let sub;
    if (isRecord) sub = prevBest > 0 ? `Önceki rekor: ${prevBest}` : 'İlk rekorun! Şimdi kır bakalım.';
    else if (gap <= Math.max(3, Math.ceil(prevBest * 0.2))) sub = gap === 0 ? 'Rekorla berabere! Bir puan daha!' : `Rekora ${gap} puan kaldı!`;
    else sub = pick(['Bir daha dene!', 'Ritmi yakala!', 'Son anda kaç, PERFECT al!', 'Bu sefer olacak!']);
    $('overSub').textContent = sub;
    show('over');
    const retry = $('retryBtn');
    retry.disabled = true;
    S.overAt = performance.now();
    setTimeout(() => { retry.disabled = false; }, 350);

    done.forEach((m, i) => setTimeout(() => {
      toast(`✓ Görev tamam: ${MISSION_TYPES[m.type].text(m.target)} <b>+${m.reward} ★</b>`);
      Sound.coin();
    }, 500 + i * 700));
    updateMenuInfo();
  }

  // ---------------------------------------------------------------- güncelleme
  function update(dt) {
    S.time += dt;
    // palet yumuşak geçiş
    const target = LEVELS[S.mode === 'menu' ? 0 : S.levelIdx];
    const k = Math.min(1, dt * 1.5);
    for (const key of ['bg1', 'bg2', 'obs', 'ring', 'core']) {
      for (let i = 0; i < 3; i++) S.pal[key][i] = lerp(S.pal[key][i], target[key][i], k);
    }
    S.coreKick = Math.max(0, S.coreKick - dt * 4);
    S.flash = Math.max(0, S.flash - dt);
    S.shake = Math.max(0, S.shake - dt * 40);

    let pdt = dt;
    if (S.mode === 'play' && !S.paused) {
      stepPlay(dt);
    } else if (S.mode === 'dying') {
      S.dieT += dt;
      pdt = dt * (S.dieT < 0.5 ? 0.3 : 1);
      if (S.dieT > 0.85) offerReviveOrFinish();
    } else if (S.mode === 'menu') {
      S.angle += 1.3 * dt;
      S.demoT += dt;
      if (S.demoT > 0.9) { S.demoT = 0; S.from = S.radius; S.ring = S.ring ? 0 : 1; S.switchP = 0; }
      if (S.switchP < 1) S.switchP = Math.min(1, S.switchP + dt / SWITCH_T);
      S.radius = lerp(S.from, ringR(S.ring), easeOut(S.switchP));
      pushTrail();
    }

    for (let i = S.parts.length - 1; i >= 0; i--) {
      const p = S.parts[i];
      p.life -= pdt;
      if (p.life <= 0) { S.parts.splice(i, 1); continue; }
      p.x += p.vx * pdt; p.y += p.vy * pdt;
      p.vx *= 1 - 2.5 * pdt; p.vy *= 1 - 2.5 * pdt;
    }
    for (let i = S.pops.length - 1; i >= 0; i--) {
      const p = S.pops[i];
      p.life -= dt;
      p.y -= 30 * dt;
      if (p.life <= 0) S.pops.splice(i, 1);
    }
  }

  function pushTrail() {
    S.trail.push(ballPos());
    if (S.trail.length > 16) S.trail.shift();
  }

  function stepPlay(dt) {
    // yeni halka: ekrandaki engeller geçilince doğar
    if (S.pendingRings && S.obs.every((o) => o.passed)) {
      S.ringCount = S.pendingRings;
      S.pendingRings = 0;
      S.ringAnim = 0;
      if (S.ring < S.ringCount - 1 && S.ring > 0) { /* yön korunur */ } else if (S.ring === 0) S.dir = 1;
      else S.dir = -1;
      S.dirHint = 4;
      S.flash = 0.6;
      S.shake = 5;
      Sound.level();
      vibrate([20, 30, 20]);
      for (let i = 0; i < 24; i++) {
        const [x, y] = polar(rand(0, TAU), outerR());
        burst(x, y, rgba(S.pal.ring), 1, 120, 2.5, 0.8);
      }
    }
    if (S.ringAnim < 1) {
      S.ringAnim = Math.min(1, S.ringAnim + dt / 1.1);
      if (S.ringAnim >= 1) S.nextSpawn = S.angle + Math.PI * 0.9;
    }
    if (S.ring > S.ringCount - 1) S.ring = S.ringCount - 1;
    const breathOn = LEVELS.slice(0, S.levelIdx + 1).some((l) => l.breath);
    S.breath += ((breathOn ? 1 : 0) - S.breath) * Math.min(1, dt * 0.6);
    S.dirHint = Math.max(0, S.dirHint - dt);
    CORE_R = Math.min(R_IN * 0.58, innerR() * 0.72);
    for (const t in S.pw) S.pw[t] = Math.max(0, S.pw[t] - dt);
    S.invuln = Math.max(0, S.invuln - dt);
    S.slowF += ((S.pw.slow > 0 ? 0.6 : 1) - S.slowF) * Math.min(1, dt * 4);
    S.omega += (omegaTarget() - S.omega) * Math.min(1, dt * 2);
    S.speed = S.omega * S.slowF;
    S.angle += S.speed * dt;
    if (S.switchP < 1) S.switchP = Math.min(1, S.switchP + dt / SWITCH_T);
    S.radius = lerp(S.from, ringR(S.ring), easeOut(S.switchP));
    pushTrail();
    spawnAhead();

    const hitR = BALL_R + OBS_T * 0.5;
    for (let i = S.obs.length - 1; i >= 0; i--) {
      const o = S.obs[i];
      if (o.flip && !o.flipped && o.a - S.angle < S.speed * 0.62) {
        o.flipped = true; o.fromRing = o.ring; o.ring = o.flipTo; o.flipP = 0;
        Sound.flip();
      }
      if (o.flipP < 1) o.flipP = Math.min(1, o.flipP + dt / 0.2);
      const orad = obsRadius(o);
      const d = S.angle - o.a;
      if (!o.passed) {
        if (Math.abs(d) < o.hw + (hitR * 0.62) / orad && Math.abs(S.radius - orad) < hitR * 0.7) {
          if (S.invuln > 0) { /* dokunulmaz: içinden geç */ }
          else if (S.shield) { breakShield(o); S.obs.splice(i, 1); continue; }
          else { die(); return; }
        }
        if (d > o.hw + hitR / orad) onPass(o);
      }
      if (d > o.hw + 0.9) S.obs.splice(i, 1);
    }

    for (let i = S.stars.length - 1; i >= 0; i--) {
      const s = S.stars[i];
      const d = S.angle - s.a;
      if (!s.taken && !s.pulled && S.pw.magnet > 0 && d > -1.4 && d < 0.4) {
        s.pulled = true;
        [s.x, s.y] = polar(s.a, ringR(s.ring));
      }
      if (!s.taken && s.pulled) {
        const [bx, by] = ballPos();
        const k = Math.min(1, dt * 9);
        s.x += (bx - s.x) * k; s.y += (by - s.y) * k;
        if (Math.hypot(bx - s.x, by - s.y) < BALL_R * 1.8) collectStar(s);
      } else if (!s.taken && Math.abs(d) < 0.08 + BALL_R / S.radius && Math.abs(S.radius - ringR(s.ring)) < BALL_R + OBS_T * 0.7) {
        [s.x, s.y] = polar(s.a, ringR(s.ring));
        collectStar(s);
      }
      if ((d > 0.9 && !s.pulled) || (s.taken && S.time - s.takenT > 0.3)) S.stars.splice(i, 1);
    }

    for (let i = S.items.length - 1; i >= 0; i--) {
      const it = S.items[i];
      const d = S.angle - it.a;
      const r = ringR(it.ring);
      if (!it.taken && Math.abs(d) < 0.1 + BALL_R / S.radius && Math.abs(S.radius - r) < BALL_R + OBS_T * 0.8) {
        it.taken = true; it.takenT = S.time;
        const P = POWERS[it.type];
        S.pw[it.type] = S.pwMax[it.type] = powerDur(it.type);
        popup(P.name.toUpperCase() + '!', CX, CY - outerR() - 40, P.color, 26, 1.3);
        burst(...polar(it.a, r), P.color, 18, 240, 3);
        Sound.power();
        vibrate(20);
      }
      if (d > 0.9 || (it.taken && S.time - it.takenT > 0.3)) S.items.splice(i, 1);
    }

    if (S.comboT > 0) {
      S.comboT -= dt;
      if (S.comboT <= 0) S.combo = 0;
    }
  }

  function collectStar(s) {
    s.taken = true; s.takenT = S.time;
    S.runStars++;
    burst(s.x, s.y, '#ffd84d', 10, 160, 2.5, 0.5);
    Sound.star();
    if (!S.shield) {
      S.shieldProg++;
      if (S.shieldProg >= shieldNeed()) {
        S.shield = 1; S.shieldProg = 0;
        popup('KALKAN HAZIR!', CX, CY + outerR() + 44, SHIELD_COLOR, 22, 1.4);
        Sound.shieldUp();
        vibrate(20);
      }
    }
  }

  function breakShield(o) {
    S.shield = 0;
    S.invuln = Math.max(1.3, (2 * o.hw) / S.speed + 0.4);
    const [x, y] = polar(o.a, obsRadius(o));
    burst(x, y, SHIELD_COLOR, 26, 320, 3.5, 0.9);
    burst(x, y, rgba(S.pal.obs), 14, 260, 3);
    popup('KALKAN!', x, y - 26, SHIELD_COLOR, 24, 1);
    S.shake = 9; S.flash = 0.4; S.combo = 0; S.comboT = 0;
    Sound.shieldBreak();
    vibrate([40, 30, 40]);
  }

  // ---------------------------------------------------------------- çizim
  function arc(r, a0, a1) {
    ctx.beginPath();
    ctx.arc(CX, CY, r, a0, a1);
  }

  function drawStarShape(x, y, r, rot) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 ? r * 0.45 : r;
      const a = rot + (i * Math.PI) / 5 - Math.PI / 2;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
  }

  function shieldPath(r) {
    ctx.beginPath();
    ctx.moveTo(0, -0.55 * r);
    ctx.lineTo(0.45 * r, -0.32 * r);
    ctx.lineTo(0.4 * r, 0.12 * r);
    ctx.quadraticCurveTo(0.24 * r, 0.46 * r, 0, 0.6 * r);
    ctx.quadraticCurveTo(-0.24 * r, 0.46 * r, -0.4 * r, 0.12 * r);
    ctx.lineTo(-0.45 * r, -0.32 * r);
    ctx.closePath();
  }

  // Güç simgeleri: r = simge dairesinin yarıçapı
  function drawGlyph(type, x, y, r, color = '#fff') {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = color; ctx.fillStyle = color;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1.5, r * 0.22);
    if (type === 'magnet') {
      ctx.beginPath();
      ctx.moveTo(-0.38 * r, -0.45 * r);
      ctx.lineTo(-0.38 * r, 0);
      ctx.arc(0, 0, 0.38 * r, Math.PI, 0, true);
      ctx.lineTo(0.38 * r, -0.45 * r);
      ctx.stroke();
    } else if (type === 'slow') {
      ctx.beginPath(); ctx.arc(0, 0, 0.45 * r, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -0.28 * r); ctx.moveTo(0, 0); ctx.lineTo(0.22 * r, 0.08 * r); ctx.stroke();
    } else if (type === 'double') {
      ctx.font = `900 ${r * 0.85}px system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('×2', 0, r * 0.04);
    } else if (type === 'shield') {
      shieldPath(r);
      ctx.fill();
    }
    ctx.restore();
  }

  // Topun yanında bir sonraki dokunuşun yönünü gösteren ok (gel-git kontrolü)
  function drawDirArrow(col) {
    const a = S.angle;
    const pulse = Math.sin(S.time * 8) * 0.5 + 0.5;
    const off = BALL_R * (2.1 + pulse * 0.4);
    const r = S.radius + S.dir * off;
    const x = CX + Math.cos(a) * r, y = CY + Math.sin(a) * r;
    const ux = Math.cos(a) * S.dir, uy = Math.sin(a) * S.dir;   // ok yönü
    const px = -uy, py = ux;                                     // dik
    const s = BALL_R * 0.75;
    ctx.fillStyle = col;
    ctx.globalAlpha = 0.75 + 0.25 * pulse;
    ctx.beginPath();
    ctx.moveTo(x + ux * s, y + uy * s);
    ctx.lineTo(x - ux * s * 0.4 + px * s * 0.8, y - uy * s * 0.4 + py * s * 0.8);
    ctx.lineTo(x - ux * s * 0.4 - px * s * 0.8, y - uy * s * 0.4 - py * s * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawPowerHud() {
    // aktif güçler: üst ortada kalan süre halkalarıyla
    const act = Object.keys(POWERS).filter((t) => S.pw[t] > 0);
    const top = SAFE_TOP + 26;
    act.forEach((t, i) => {
      const x = CX + (i - (act.length - 1) / 2) * 42;
      const P = POWERS[t];
      const frac = S.pw[t] / (S.pwMax[t] || 1);
      const warn = S.pw[t] < 1.5 && Math.sin(S.time * 20) > 0;
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.beginPath(); ctx.arc(x, top, 16, 0, TAU); ctx.fill();
      ctx.strokeStyle = P.color;
      ctx.lineWidth = 3;
      ctx.globalAlpha = warn ? 0.4 : 1;
      ctx.beginPath(); ctx.arc(x, top, 16, -Math.PI / 2, -Math.PI / 2 + TAU * frac); ctx.stroke();
      drawGlyph(t, x, top, 15, P.color);
      ctx.globalAlpha = 1;
    });

    // kalkan göstergesi: altta, yıldızla dolan halka
    const y = H - 56 - Math.max(0, SAFE_TOP * 0.6);
    const r = 20;
    const need = shieldNeed();
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath(); ctx.arc(CX, y, r, 0, TAU); ctx.stroke();
    if (S.shield) {
      ctx.globalAlpha = 0.25 + 0.15 * Math.sin(S.time * 5);
      ctx.fillStyle = SHIELD_COLOR;
      ctx.beginPath(); ctx.arc(CX, y, r * 1.5, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = SHIELD_COLOR;
      ctx.beginPath(); ctx.arc(CX, y, r, 0, TAU); ctx.stroke();
      drawGlyph('shield', CX, y, r * 1.2, SHIELD_COLOR);
    } else {
      ctx.strokeStyle = SHIELD_COLOR;
      ctx.beginPath(); ctx.arc(CX, y, r, -Math.PI / 2, -Math.PI / 2 + TAU * (S.shieldProg / need)); ctx.stroke();
      ctx.globalAlpha = 0.35;
      drawGlyph('shield', CX, y, r * 1.2, '#fff');
      ctx.globalAlpha = 1;
    }
    ctx.font = '800 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = S.shield ? SHIELD_COLOR : 'rgba(255,255,255,0.55)';
    ctx.fillText(S.shield ? 'KALKAN HAZIR' : `KALKAN ${S.shieldProg}/${need} ★`, CX, y + r + 14);
  }

  function render() {
    const P = S.pal;
    ctx.save();
    if (S.shake > 0) ctx.translate(rand(-S.shake, S.shake), rand(-S.shake, S.shake));

    // arka plan
    const g = ctx.createRadialGradient(CX, CY, 0, CX, CY, Math.max(W, H) * 0.8);
    g.addColorStop(0, rgba(P.bg1));
    g.addColorStop(1, rgba(P.bg2));
    ctx.fillStyle = g;
    ctx.fillRect(-30, -30, W + 60, H + 60);

    // yıldız tozu
    const rot = S.angle * 0.04;
    ctx.fillStyle = '#fff';
    for (const s of bgStars) {
      const a = s.a + rot;
      ctx.globalAlpha = 0.25 + 0.25 * Math.sin(S.time * 2 + s.tw);
      ctx.fillRect(CX + Math.cos(a) * s.d, CY + Math.sin(a) * s.d, s.s, s.s);
    }
    ctx.globalAlpha = 1;

    if (S.flash > 0) {
      ctx.fillStyle = rgba(P.ring, S.flash * 0.18);
      ctx.fillRect(-30, -30, W + 60, H + 60);
    }

    // halkalar
    const alive = S.mode === 'play' || S.mode === 'menu';
    ctx.lineWidth = 2;
    for (let i = 0; i < S.ringCount; i++) {
      const active = alive && S.ring === i;
      const born = i === S.ringCount - 1 && S.ringAnim < 1 ? easeOut(S.ringAnim) : 1;
      ctx.strokeStyle = rgba(P.ring, (active ? 0.4 : 0.16) * born + (1 - born) * 0.9 * Math.sin(born * Math.PI));
      arc(ringR(i), 0, TAU);
      ctx.stroke();
    }

    // çekirdek
    const kick = 1 + S.coreKick * 0.08 + Math.sin(S.time * 3) * 0.015;
    const cr = CORE_R * kick;
    const cg = ctx.createRadialGradient(CX, CY, cr * 0.2, CX, CY, cr * 1.6);
    cg.addColorStop(0, rgba(P.core, 1));
    cg.addColorStop(0.6, rgba(P.core, 0.9));
    cg.addColorStop(1, rgba(P.core, 0));
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.arc(CX, CY, cr * 1.6, 0, TAU); ctx.fill();
    ctx.strokeStyle = rgba(P.ring, 0.5);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(CX, CY, cr, 0, TAU); ctx.stroke();

    // kombo sayacı yayı
    if (S.combo > 0 && S.mode === 'play') {
      ctx.strokeStyle = ballColor();
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      arc(cr + 7, -Math.PI / 2, -Math.PI / 2 + TAU * (S.comboT / COMBO_T));
      ctx.stroke();
    }

    if (S.mode !== 'menu') {
      const txt = String(S.score);
      const fs = CORE_R * (txt.length > 2 ? 0.62 : 0.85);
      ctx.fillStyle = '#fff';
      ctx.font = `900 ${fs}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(txt, CX, CY + fs * 0.04);
      if (S.combo > 1 && S.mode === 'play') {
        ctx.font = `800 ${CORE_R * 0.24}px system-ui, sans-serif`;
        ctx.fillStyle = ballColor();
        ctx.fillText(`KOMBO x${S.combo}`, CX, CY + CORE_R * 0.62);
      } else if (S.mode === 'play' && !S.recordBeaten && save.best > 0 && save.best - S.score > 0 && save.best - S.score <= 5) {
        ctx.font = `800 ${CORE_R * 0.22}px system-ui, sans-serif`;
        ctx.fillStyle = `rgba(255,216,77,${0.6 + 0.4 * Math.sin(S.time * 10)})`;
        ctx.fillText(`Rekora ${save.best - S.score}!`, CX, CY + CORE_R * 0.62);
      }
    }

    // yıldızlar
    for (const s of S.stars) {
      const [x, y] = s.pulled || s.taken ? [s.x, s.y] : polar(s.a, ringR(s.ring));
      const born = Math.min(1, (S.time - s.born) / 0.3);
      let sc = easeOut(born), al = born;
      if (s.taken) { const t = (S.time - s.takenT) / 0.3; sc = 1 + t; al = 1 - t; }
      const d = S.angle - s.a;
      if (d > 0.1 && !s.taken && !s.pulled) al *= Math.max(0, 1 - (d - 0.1) / 0.6);
      if (al <= 0) continue;
      ctx.globalAlpha = al * 0.3;
      ctx.fillStyle = '#ffd84d';
      ctx.beginPath(); ctx.arc(x, y, BALL_R * 1.3 * sc, 0, TAU); ctx.fill();
      ctx.globalAlpha = al;
      drawStarShape(x, y, BALL_R * 0.85 * sc, S.time * 2 + s.a);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // güç topları
    for (const it of S.items) {
      const [x, y] = polar(it.a, ringR(it.ring));
      const P = POWERS[it.type];
      let sc = easeOut(Math.min(1, (S.time - it.born) / 0.3)) * (1 + Math.sin(S.time * 6) * 0.08), al = 1;
      if (it.taken) { const t = (S.time - it.takenT) / 0.3; sc = 1 + t; al = 1 - t; }
      if (al <= 0) continue;
      const rr = BALL_R * 1.3 * sc;
      ctx.globalAlpha = al * 0.3;
      ctx.fillStyle = P.color;
      ctx.beginPath(); ctx.arc(x, y, rr * 1.7, 0, TAU); ctx.fill();
      ctx.globalAlpha = al;
      ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.stroke();
      drawGlyph(it.type, x, y, rr * 1.1, '#0a0c1c');
    }
    ctx.globalAlpha = 1;

    // engeller
    ctx.lineCap = 'round';
    for (const o of S.obs) {
      const r = obsRadius(o);
      let al = Math.min(1, (S.time - o.born) / 0.3);
      const d = S.angle - o.a;
      if (d > o.hw) al *= Math.max(0, 1 - (d - o.hw) / 0.8);
      if (al <= 0) continue;
      if (o.flip && !o.flipped) {
        ctx.setLineDash([4, 7]);
        ctx.strokeStyle = rgba(P.obs, al * (0.35 + 0.25 * Math.sin(S.time * 14)));
        ctx.lineWidth = OBS_T * 0.55;
        arc(ringR(o.flipTo), o.a - o.hw, o.a + o.hw);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      const col = o.perfect && o.passed ? [255, 255, 255] : P.obs;
      ctx.strokeStyle = rgba(col, 0.22 * al);
      ctx.lineWidth = OBS_T * 2;
      arc(r, o.a - o.hw, o.a + o.hw); ctx.stroke();
      ctx.strokeStyle = rgba(col, al);
      ctx.lineWidth = OBS_T;
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${0.45 * al})`;
      ctx.lineWidth = OBS_T * 0.28;
      ctx.stroke();
    }

    // top + iz
    if (S.mode === 'play' || S.mode === 'menu') {
      const col = ballColor();
      for (let i = 0; i < S.trail.length; i++) {
        const t = i / S.trail.length;
        ctx.globalAlpha = t * 0.35;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(S.trail[i][0], S.trail[i][1], BALL_R * (0.3 + 0.6 * t), 0, TAU);
        ctx.fill();
      }
      const [x, y] = ballPos();
      const blink = S.invuln > 0 && Math.sin(S.time * 30) > 0 ? 0.35 : 1;
      if (S.pw.magnet > 0) {
        const t = (S.time * 1.5) % 1;
        ctx.strokeStyle = POWERS.magnet.color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = (1 - t) * 0.6;
        ctx.beginPath(); ctx.arc(x, y, BALL_R * (5 - 3.5 * t), 0, TAU); ctx.stroke();
      }
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.25 * blink;
      ctx.beginPath(); ctx.arc(x, y, BALL_R * 2.1, 0, TAU); ctx.fill();
      ctx.globalAlpha = blink;
      ctx.beginPath(); ctx.arc(x, y, BALL_R, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath(); ctx.arc(x - BALL_R * 0.3, y - BALL_R * 0.3, BALL_R * 0.35, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      if (S.shield && S.mode === 'play') {
        ctx.strokeStyle = SHIELD_COLOR;
        ctx.lineWidth = 2.5;
        ctx.globalAlpha = 0.6 + 0.3 * Math.sin(S.time * 5);
        ctx.beginPath(); ctx.arc(x, y, BALL_R * 1.75, 0, TAU); ctx.stroke();
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = SHIELD_COLOR;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (S.ringCount > 2 && S.mode === 'play') drawDirArrow(col);
    }

    // parçacıklar
    for (const p of S.parts) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // yazılar
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const p of S.pops) {
      const t = 1 - p.life / p.max;
      const sc = t < 0.15 ? easeOut(t / 0.15) * 1.2 : 1.2 - Math.min(0.2, (t - 0.15));
      ctx.globalAlpha = Math.min(1, p.life / (p.max * 0.4));
      ctx.font = `900 ${p.size * sc}px system-ui, -apple-system, sans-serif`;
      const hw = ctx.measureText(p.text).width / 2 + 10;
      const px = clamp(p.x, hw, W - hw);
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.strokeText(p.text, px, p.y);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, px, p.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // HUD
    if (S.slowF < 0.98) {
      ctx.fillStyle = `rgba(124,245,255,${(1 - S.slowF) * 0.15})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (S.mode === 'play') drawPowerHud();
    if (S.mode === 'play' || S.mode === 'dying') {
      const top = SAFE_TOP + 26;
      ctx.font = '800 14px system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillText(`EN İYİ ${Math.max(save.best, S.recordBeaten ? S.score : 0)}`, 18, top);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffd84d';
      ctx.fillText(`★ ${save.stars + S.runStars}`, W - 18, top);
    }

    if (S.mode === 'play' && S.dirHint > 0 && S.ringAnim >= 1) {
      const y = CY + outerR() + 100;
      ctx.textAlign = 'center';
      ctx.globalAlpha = Math.min(1, S.dirHint);
      ctx.fillStyle = '#fff';
      ctx.font = '800 17px system-ui, sans-serif';
      ctx.fillText('Top gel-git yapar', CX, y);
      ctx.font = '600 14px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillText('Oktaki yön, bir sonraki dokunuşun', CX, y + 22);
      ctx.globalAlpha = 1;
    }

    if (S.mode === 'play' && S.hint > 0) {
      const y = CY + outerR() + 70;
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(255,255,255,${0.65 + 0.35 * Math.sin(S.time * 6)})`;
      ctx.font = '800 18px system-ui, sans-serif';
      ctx.fillText('DOKUN → yörünge değiştir', CX, y);
      ctx.font = '600 14px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillText('Engele çok yakınken kaç: PERFECT!', CX, y + 26);
    }

    if (S.paused && S.mode === 'play') {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.font = '900 28px system-ui, sans-serif';
      ctx.fillText('DURAKLATILDI', CX, CY - 12);
      ctx.font = '600 16px system-ui, sans-serif';
      ctx.fillText('Devam etmek için dokun', CX, CY + 22);
    }
  }

  // ---------------------------------------------------------------- döngü
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(1 / 30, (now - last) / 1000);
    last = now;
    update(dt);
    render();
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- arayüz
  const screens = ['menu', 'over', 'skins', 'missions', 'powers', 'revive'];
  function hideAll() { screens.forEach((s) => $(s).classList.add('hidden')); }
  function show(id) { $(id).classList.remove('hidden'); }

  function toast(html) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = html;
    $('toasts').appendChild(el);
    setTimeout(() => el.remove(), 2800);
  }

  function updateMenuInfo() {
    $('menuBest').textContent = save.best;
    $('menuStars').textContent = save.stars;
    $('streakVal').textContent = save.streak;
    $('soundIcon').textContent = save.sound ? '♪' : '✕';
    $('soundLabel').textContent = save.sound ? 'Ses' : 'Sessiz';
    $('missionDot').classList.toggle('hidden', save.missions.every((m) => m.done));
  }

  function showMenu() {
    hideAll();
    S.mode = 'menu';
    S.obs.length = 0; S.stars.length = 0; S.pops.length = 0;
    S.score = 0; S.combo = 0; S.levelIdx = 0;
    S.ringCount = 2; S.ringAnim = 1; S.pendingRings = 0; S.breath = 0; S.dir = -1;
    S.items.length = 0; S.shield = 0; S.invuln = 0;
    for (const t in S.pw) S.pw[t] = 0;
    CORE_R = R_IN * 0.58;
    S.radius = ringR(S.ring); S.from = S.radius; S.switchP = 1;
    updateMenuInfo();
    show('menu');
  }

  function renderSkins() {
    $('skinStars').textContent = save.stars;
    const grid = $('skinGrid');
    grid.innerHTML = '';
    for (const s of SKINS) {
      const owned = save.owned.includes(s.id);
      const btn = document.createElement('button');
      btn.className = 'skin' + (save.skin === s.id ? ' selected' : '') + (owned ? '' : ' locked');
      let price;
      if (save.skin === s.id) price = '<span class="price ok">Seçili</span>';
      else if (owned) price = '<span class="price ok">Seç</span>';
      else price = `<span class="price ${save.stars >= s.price ? '' : 'cant'}">★ ${s.price}</span>`;
      btn.innerHTML =
        `<span class="ball${s.rainbow ? ' rainbow' : ''}" style="background:${s.color};box-shadow:0 0 14px ${s.color}"></span>` +
        `<span class="name">${s.name}</span>${price}`;
      btn.addEventListener('click', () => {
        if (owned) {
          save.skin = s.id;
        } else if (save.stars >= s.price) {
          save.stars -= s.price;
          save.owned.push(s.id);
          save.skin = s.id;
          Sound.init(); Sound.coin();
          toast(`Yeni top açıldı: <b>${s.name}</b>`);
        } else {
          toast(`${s.price - save.stars} ★ daha lazım`);
          return;
        }
        persist();
        renderSkins();
        updateMenuInfo();
      });
      grid.appendChild(btn);
    }
  }

  function renderPowers() {
    $('powerStars').textContent = save.stars;
    const list = $('upgList');
    list.innerHTML = '';
    for (const u of UPGRADES) {
      const lvl = save.upg[u.id];
      const maxed = lvl >= UPG_MAX;
      const cost = maxed ? 0 : UPG_COST[lvl];
      const li = document.createElement('li');
      li.className = 'upg';
      let pips = '';
      for (let i = 0; i <= UPG_MAX; i++) pips += `<i class="${i <= lvl ? 'on' : ''}" style="--c:${u.color}"></i>`;
      li.innerHTML =
        `<span class="upg-icon" style="--c:${u.color}">${u.icon}</span>` +
        `<div class="upg-body"><b>${u.name}</b><span class="upg-info">${u.info(lvl)}</span>` +
        (maxed ? '' : `<span class="upg-next">Sonraki: ${u.info(lvl + 1)}</span>`) +
        `<span class="pips">${pips}</span></div>` +
        `<button class="upg-buy${!maxed && save.stars < cost ? ' cant' : ''}" ${maxed ? 'disabled' : ''}>${maxed ? 'MAKS' : `★ ${cost}`}</button>`;
      li.querySelector('button').addEventListener('click', () => {
        if (maxed) return;
        if (save.stars < cost) { toast(`${cost - save.stars} ★ daha lazım`); return; }
        save.stars -= cost;
        save.upg[u.id]++;
        persist();
        Sound.init(); Sound.coin();
        toast(`${u.name} geliştirildi: <b>Seviye ${save.upg[u.id] + 1}</b>`);
        renderPowers();
        updateMenuInfo();
      });
      list.appendChild(li);
    }
  }

  function renderMissions() {
    $('streakBig').textContent = save.streak;
    const list = $('missionList');
    list.innerHTML = '';
    for (const m of save.missions) {
      const li = document.createElement('li');
      li.className = 'mission' + (m.done ? ' done' : '');
      const pct = Math.round((m.progress / m.target) * 100);
      li.innerHTML =
        `<div class="row"><span>${m.done ? '✓ ' : ''}${MISSION_TYPES[m.type].text(m.target)}</span>` +
        `<span class="reward">${m.done ? 'Alındı' : `+${m.reward} ★`}</span></div>` +
        `<div class="bar-bg"><div class="bar-fill" style="width:${pct}%"></div></div>` +
        `<div class="prog">${m.progress} / ${m.target}</div>`;
      list.appendChild(li);
    }
  }

  $('playBtn').addEventListener('click', startRun);
  $('retryBtn').addEventListener('click', (e) => { e.stopPropagation(); startRun(); });
  $('homeBtn').addEventListener('click', (e) => { e.stopPropagation(); showMenu(); });
  $('skinsBtn').addEventListener('click', () => { renderSkins(); show('skins'); });
  $('powersBtn').addEventListener('click', () => { renderPowers(); show('powers'); });
  $('reviveBtn').addEventListener('click', (e) => { e.stopPropagation(); acceptRevive(); });
  $('reviveSkip').addEventListener('click', (e) => { e.stopPropagation(); if (S.mode === 'revive') finishRun(); });
  $('missionsBtn').addEventListener('click', () => { checkDay(true); renderMissions(); updateMenuInfo(); show('missions'); });
  $('soundBtn').addEventListener('click', () => {
    save.sound = !save.sound;
    persist();
    Sound.init();
    if (save.sound) Sound.tap(1);
    updateMenuInfo();
  });
  document.querySelectorAll('[data-close]').forEach((b) =>
    b.addEventListener('click', () => b.closest('.sheet').classList.add('hidden')));
  document.querySelectorAll('.sheet').forEach((sh) =>
    sh.addEventListener('pointerdown', (e) => { if (e.target === sh) sh.classList.add('hidden'); }));

  // oyun sonu ekranında boş bir yere dokunmak da yeniden başlatır
  $('over').addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    if (performance.now() - (S.overAt || 0) > 450) startRun();
  });

  window.addEventListener('pointerdown', (e) => {
    if (S.mode !== 'play') return;
    if (e.target.closest && e.target.closest('button, .sheet, .screen')) return;
    e.preventDefault();
    if (S.paused) { S.paused = false; last = performance.now(); return; }
    doSwitch();
  }, { passive: false });

  window.addEventListener('keydown', (e) => {
    if (!['Space', 'ArrowUp', 'ArrowDown', 'Enter'].includes(e.code)) return;
    e.preventDefault();
    if (e.repeat) return;
    if (S.mode === 'play') {
      if (S.paused) S.paused = false;
      else doSwitch();
    } else if (S.mode === 'over' && performance.now() - (S.overAt || 0) > 450) startRun();
    else if (S.mode === 'revive') acceptRevive();
    else if (S.mode === 'menu' && ['skins', 'missions', 'powers'].every((id) => $(id).classList.contains('hidden'))) startRun();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && S.mode === 'play') S.paused = true;
  });
  window.addEventListener('resize', resize);
  document.addEventListener('contextmenu', (e) => e.preventDefault());

  // ---------------------------------------------------------------- başlat
  resize();
  S.radius = ringR(1); S.from = S.radius;
  checkDay(true);
  showMenu();
  requestAnimationFrame(frame);

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  // test/hata ayıklama için
  window.__yorunge = { S, save, startRun, doSwitch };
})();
