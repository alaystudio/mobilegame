/* Drift Garden — pop drifting balloons, play the melody yourself, grow a quiet night garden.
 * No failing, no timers. Each balloon carries the next note of the song as it rises;
 * popping them in the order they rise plays the melody correctly.
 */
(() => {
  'use strict';

  // ---------------------------------------------------------------- helpers
  const TAU = Math.PI * 2;
  const $ = (id) => document.getElementById(id);
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
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
  const rgba = (h, a) => { const [r, g, b] = hexRgb(h); return `rgba(${r},${g},${b},${a})`; };
  const mix = (a, b, t) => { const x = hexRgb(a), y = hexRgb(b); return `rgb(${x.map((v, i) => Math.round(lerp(v, y[i], t))).join(',')})`; };

  // ---------------------------------------------------------------- save
  const SAVE_KEY = 'drift.save.v1';
  const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DEFAULTS = {
    stars: 0,
    songs: ['ode', 'grace', 'scarborough'],
    plays: {},
    balloons: ['orb'],
    balloon: 'orb',
    decor: [],
    blooms: [],
    next: 'ode',
    tutorial: true,
    settings: { lang: 'en', vol: 80, amb: true, vibe: true, calm: reduceMotion, guide: true, mode: 'order', breakMin: 15 },
  };
  const save = (() => {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
      return { ...JSON.parse(JSON.stringify(DEFAULTS)), ...s, settings: { ...DEFAULTS.settings, ...(s.settings || {}) } };
    } catch (e) { return JSON.parse(JSON.stringify(DEFAULTS)); }
  })();
  function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* private mode */ } }
  const owns = (list, id) => save[list].includes(id);

  // ---------------------------------------------------------------- language
  const I18N = window.DRIFT_I18N;
  const lang = () => (I18N[save.settings.lang] ? save.settings.lang : 'en');
  const t = (key, p = {}) => String((I18N[lang()] || {})[key] ?? I18N.en[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => p[k]);
  const L = (obj) => (typeof obj === 'string' ? obj : obj[lang()] || obj.en);
  function applyI18n() {
    document.documentElement.lang = lang();
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
    document.title = t('appName');
    const sel = $('setBreak');
    sel.innerHTML = '';
    [0, 10, 15, 20, 30].forEach((m) => {
      const o = document.createElement('option');
      o.value = m;
      o.textContent = m ? t('minutes', { n: m }) : t('off');
      sel.appendChild(o);
    });
  }

  // ---------------------------------------------------------------- data
  const NOTE_INDEX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function parseNote(s) {
    const m = /^([A-G])(#|b)?(\d)$/.exec(s);
    return 12 * (Number(m[3]) + 1) + NOTE_INDEX[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  }
  const SONGS = window.DRIFT_SONGS.map((s) => ({ ...s, midi: s.notes.split(/\s+/).map(parseNote), droneMidi: parseNote(s.drone) }));
  const songById = (id) => SONGS.find((s) => s.id === id) || SONGS[0];

  const BALLOONS = [
    { id: 'orb', price: 0, inst: 'piano', name: { en: 'Glass Orb', tr: 'Cam Küre' }, instName: { en: 'Piano', tr: 'Piyano' } },
    { id: 'bubble', price: 25, inst: 'musicbox', name: { en: 'Soap Bubble', tr: 'Sabun Köpüğü' }, instName: { en: 'Music box', tr: 'Müzik kutusu' } },
    { id: 'mist', price: 40, inst: 'pad', name: { en: 'Mist', tr: 'Sis' }, instName: { en: 'Warm pad', tr: 'Sıcak synth' } },
    { id: 'lantern', price: 60, inst: 'marimba', name: { en: 'Sky Lantern', tr: 'Dilek Feneri' }, instName: { en: 'Marimba', tr: 'Marimba' } },
    { id: 'jelly', price: 80, inst: 'harp', name: { en: 'Moon Jelly', tr: 'Ay Denizanası' }, instName: { en: 'Harp', tr: 'Arp' } },
  ];
  const currentBalloon = () => BALLOONS.find((b) => b.id === save.balloon) || BALLOONS[0];

  const DECOR = [
    { id: 'fireflies', price: 15, name: { en: 'Fireflies', tr: 'Ateşböcekleri' }, desc: { en: 'Soft lights drifting over the grass', tr: 'Çimenlerin üstünde süzülen ışıklar' } },
    { id: 'willow', price: 30, name: { en: 'Willow', tr: 'Söğüt' }, desc: { en: 'A quiet willow swaying in the breeze', tr: 'Rüzgârda sallanan sessiz bir söğüt' } },
    { id: 'crickets', price: 35, amb: true, name: { en: 'Crickets', tr: 'Cırcırböcekleri' }, desc: { en: 'Evening crickets in the grass', tr: 'Çimenlerde akşam cırcırböcekleri' } },
    { id: 'stream', price: 45, amb: true, name: { en: 'Stream', tr: 'Dere' }, desc: { en: 'The sound of running water', tr: 'Akan su sesi' } },
    { id: 'chimes', price: 50, amb: true, name: { en: 'Wind Chimes', tr: 'Rüzgâr Çanı' }, desc: { en: 'Gentle chimes on the breeze', tr: 'Rüzgârda tatlı çan sesleri' } },
    { id: 'pond', price: 60, name: { en: 'Moon Pond', tr: 'Ay Göleti' }, desc: { en: 'A still pond that holds the moon', tr: 'Ayı içinde tutan durgun bir gölet' } },
    { id: 'lanterns', price: 75, name: { en: 'Stone Lanterns', tr: 'Taş Fenerler' }, desc: { en: 'Warm light along the path', tr: 'Patika boyunca sıcak ışık' } },
    { id: 'aurora', price: 100, name: { en: 'Aurora', tr: 'Kutup Işığı' }, desc: { en: 'Slow ribbons of light across the sky', tr: 'Gökyüzünde yavaş ışık kurdeleleri' } },
  ];
  const ICONS = {
    fireflies: '<circle cx="7" cy="8" r="1.4"/><circle cx="16" cy="6" r="1.4"/><circle cx="12" cy="13" r="1.4"/><path d="M4 20c5-2.5 11-2.5 16 0"/>',
    willow: '<path d="M12 21V8"/><path d="M12 8c-4 0-6 3-7 9M12 8c4 0 6 3 7 9M12 8c-1 4-2 7-3 11M12 8c1 4 2 7 3 11"/>',
    crickets: '<path d="M4 18c3-6 13-6 16 0"/><path d="M9 13 7 7M15 13l2-6"/>',
    stream: '<path d="M3 9c3-2 6 2 9 0s6-2 9 0M3 15c3-2 6 2 9 0s6-2 9 0"/>',
    chimes: '<path d="M5 4h14M8 4v9M12 4v12M16 4v7"/><circle cx="12" cy="19" r="1.4"/>',
    pond: '<ellipse cx="12" cy="16" rx="9" ry="3.5"/><path d="M8 16h3M13 17h3"/><circle cx="17" cy="6" r="2.4"/>',
    lanterns: '<path d="M9 8h6l1.2 8H7.8z"/><path d="M12 4v4M10 20h4M9 12h6"/>',
    aurora: '<path d="M3 16c4-8 8 2 12-6 2-4 4-4 6-2"/><path d="M3 20c4-6 8 1 12-4"/>',
  };
  const svg = (inner) => `<svg viewBox="0 0 24 24">${inner}</svg>`;

  const BLOOM_COLORS = ['#f2b5a7', '#ecd08f', '#b9d9c6', '#bdb8ea', '#eaa9c6', '#a9cde6'];
  const BLOOM_SLOTS = 30;
  const TINTS = ['#f2b5a7', '#ecd08f', '#b9d9c6', '#bdb8ea', '#eaa9c6', '#a9cde6', '#f4c9a0', '#c9e1ef'];

  // ---------------------------------------------------------------- audio
  const Audio = {
    ctx: null,
    init() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const c = (this.ctx = new AC());
      this.master = c.createGain();
      const comp = c.createDynamicsCompressor();
      this.master.connect(comp); comp.connect(c.destination);
      const rev = c.createConvolver();
      rev.buffer = this.impulse(3);
      const wet = c.createGain(); wet.gain.value = 0.38;
      rev.connect(wet); wet.connect(this.master);
      this.bus = c.createGain(); this.bus.connect(this.master); this.bus.connect(rev);
      this.amb = c.createGain(); this.amb.connect(this.master); this.amb.connect(rev);
      this.applyVolume();
      this.updateAmbience();
    },
    applyVolume() {
      if (!this.ctx) return;
      this.master.gain.value = (save.settings.vol / 100) * 0.8;
      this.amb.gain.value = save.settings.amb ? 1 : 0;
    },
    impulse(sec) {
      const c = this.ctx, len = Math.floor(c.sampleRate * sec), b = c.createBuffer(2, len, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = b.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.4);
      }
      return b;
    },
    hz: (m) => 440 * Math.pow(2, (m - 69) / 12),
    env(g, t0, a, peak, d) {
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(peak, t0 + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
    },
    osc(type, f, t0, dur, dest, detune = 0) {
      const o = this.ctx.createOscillator();
      o.type = type; o.frequency.value = f; o.detune.value = detune;
      o.connect(dest); o.start(t0); o.stop(t0 + dur + 0.05);
      return o;
    },
    lp(freq, dest) { const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq; f.connect(dest); return f; },
    gain(dest, v = 1) { const g = this.ctx.createGain(); g.gain.value = v; g.connect(dest); return g; },

    note(m, inst, vel = 1, delay = 0, dest) {
      if (!this.ctx) return;
      const out = dest || this.bus, t0 = this.ctx.currentTime + delay, f = this.hz(m);
      const g = this.gain(out);
      switch (inst) {
        case 'musicbox': {
          this.env(g, t0, 0.003, 0.24 * vel, 1.4);
          this.osc('sine', f * 2, t0, 1.5, g);
          const g2 = this.gain(out);
          this.env(g2, t0, 0.002, 0.06 * vel, 0.35);
          this.osc('sine', f * 2 * 4.07, t0, 0.4, g2);
          break;
        }
        case 'pad': {
          const lp = this.lp(1200, g);
          g.gain.setValueAtTime(0.0001, t0);
          g.gain.linearRampToValueAtTime(0.12 * vel, t0 + 0.12);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.2);
          this.osc('sawtooth', f, t0, 2.3, lp, -7);
          this.osc('sawtooth', f, t0, 2.3, lp, 7);
          this.osc('sine', f / 2, t0, 2.3, this.gain(lp, 0.6));
          break;
        }
        case 'marimba': {
          this.env(g, t0, 0.003, 0.4 * vel, 0.6);
          this.osc('sine', f, t0, 0.7, g);
          const g2 = this.gain(out);
          this.env(g2, t0, 0.002, 0.1 * vel, 0.07);
          this.osc('sine', f * 4, t0, 0.1, g2);
          break;
        }
        case 'harp': {
          const lp = this.lp(2600, g);
          this.env(g, t0, 0.003, 0.3 * vel, 2.2);
          this.osc('triangle', f, t0, 2.3, lp);
          this.osc('sine', f * 2, t0, 2.3, this.gain(lp, 0.15));
          break;
        }
        default: { // piano: soft, felt-like
          const lp = this.lp(2400, g);
          this.env(g, t0, 0.006, 0.34 * vel, 1.8);
          this.osc('triangle', f, t0, 1.9, lp);
          this.osc('sine', f * 2, t0, 1.9, this.gain(lp, 0.18));
          this.osc('sine', f / 2, t0, 1.9, this.gain(lp, 0.12));
        }
      }
    },
    chord(ms, inst, spread = 0.08) { ms.forEach((m, i) => this.note(m, inst, 0.7, i * spread)); },
    // wrong balloon: a muffled wooden tap, never a clashing note
    tick() {
      if (!this.ctx) return;
      const t0 = this.ctx.currentTime, g = this.gain(this.master);
      this.env(g, t0, 0.002, 0.06, 0.06);
      this.osc('sine', 180, t0, 0.08, this.lp(400, g));
    },
    // soft root + fifth underneath the melody
    drone: null,
    startDrone(root) {
      if (!this.ctx) return;
      this.stopDrone();
      const c = this.ctx, t0 = c.currentTime;
      const g = this.gain(this.bus, 0.0001);
      g.gain.exponentialRampToValueAtTime(0.05, t0 + 3);
      const lp = this.lp(500, g);
      const oscs = [
        this.osc('sine', this.hz(root), t0, 3600, lp),
        this.osc('triangle', this.hz(root + 7), t0, 3600, this.gain(lp, 0.5)),
        this.osc('sine', this.hz(root + 12), t0, 3600, this.gain(lp, 0.3), 4),
      ];
      this.drone = { g, oscs };
    },
    stopDrone() {
      if (!this.drone) return;
      const { g, oscs } = this.drone, t0 = this.ctx.currentTime;
      g.gain.cancelScheduledValues(t0);
      g.gain.setValueAtTime(g.gain.value, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.5);
      oscs.forEach((o) => { try { o.stop(t0 + 2.6); } catch (e) { /* already stopped */ } });
      this.drone = null;
    },

    water: null, timers: [],
    updateAmbience() {
      if (!this.ctx) return;
      if (owns('decor', 'stream') && !this.water) {
        const c = this.ctx, len = c.sampleRate * 2, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        const src = c.createBufferSource(); src.buffer = b; src.loop = true;
        const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 850; bp.Q.value = 0.6;
        src.connect(bp); bp.connect(this.gain(this.amb, 0.03)); src.start();
        this.water = src;
      }
      this.timers.forEach(clearTimeout);
      this.timers = [];
      const loop = (fn, min, max) => {
        const tick = () => { fn(); this.timers.push(setTimeout(tick, rand(min, max))); };
        this.timers.push(setTimeout(tick, rand(min, max)));
      };
      if (owns('decor', 'crickets')) loop(() => this.cricket(), 1800, 4500);
      if (owns('decor', 'chimes')) loop(() => this.note(pick([79, 81, 84, 86, 88, 91]), 'musicbox', 0.3, 0, this.amb), 5000, 11000);
    },
    cricket() {
      const c = this.ctx, n = 2 + ((Math.random() * 3) | 0), f = rand(4200, 4800);
      for (let i = 0; i < n; i++) {
        const t0 = c.currentTime + i * 0.09;
        const g = this.gain(this.amb);
        this.env(g, t0, 0.005, 0.018, 0.04);
        this.osc('sine', f, t0, 0.06, g);
      }
    },
  };
  function vibrate(ms) {
    if (save.settings.vibe && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* unsupported */ } }
  }

  // ---------------------------------------------------------------- canvas
  const canvas = $('scene');
  const ctx = canvas.getContext('2d');
  let W, H, DPR, U;
  let slots = [], skyStars = [], flies = [];
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2.5);
    W = innerWidth; H = innerHeight;
    canvas.width = Math.floor(W * DPR); canvas.height = Math.floor(H * DPR);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    U = Math.min(W, H * 0.6, 520) / 390;
    const r = mulberry32(11);
    slots = [];
    for (let i = 0; i < BLOOM_SLOTS; i++) {
      slots.push({ x: 0.06 + ((i * 7) % BLOOM_SLOTS) / (BLOOM_SLOTS - 1) * 0.88 + (r() - 0.5) * 0.03, y: 0.1 + r() * 0.3, s: 0.8 + r() * 0.4, ph: r() * TAU });
    }
    slots.sort((a, b) => a.y - b.y);
    skyStars = Array.from({ length: 70 }, () => ({ x: r(), y: r() * 0.55, s: r() * 1.3 + 0.3, ph: r() * TAU }));
    flies = Array.from({ length: 14 }, () => ({ x: r(), y: r(), ph: r() * TAU, sp: 0.3 + r() * 0.5 }));
  }

  // ---------------------------------------------------------------- state
  const S = {
    mode: 'home', t: 0, groundF: 0.56,
    balloons: [], parts: [], rings: [], motes: [],
    song: null, idx: 0, spawnIdx: 0, spawnT: 0, idleT: 0, wrongs: 0,
    sessionStart: Date.now(), homeT: 0, newBloom: -1,
  };
  const calm = () => save.settings.calm;
  // the garden sits between the horizon and the top of the bottom panel on the home screen
  let panelTop = 0;
  function measurePanel() {
    const el = document.querySelector('.home-bottom');
    if (el && !$('home').classList.contains('hidden')) panelTop = el.getBoundingClientRect().top;
    if (!panelTop) panelTop = H * 0.72;
  }
  const homeGround = () => clamp(panelTop - 150 * U, H * 0.36, H * 0.58);
  const inOrder = () => save.settings.mode !== 'any';

  // ---------------------------------------------------------------- flow
  function nextOwnedSong(afterId) {
    const owned = SONGS.filter((s) => owns('songs', s.id));
    const i = owned.findIndex((s) => s.id === afterId);
    return owned[(i + 1) % owned.length];
  }

  function startSong(song) {
    Audio.init();
    closeSheets();
    Object.assign(S, { song, idx: 0, spawnIdx: 0, spawnT: 0, idleT: 0, wrongs: 0, mode: 'play' });
    S.balloons.length = 0;
    S.motes.length = 0;
    Audio.startDrone(song.droneMidi);
    // first balloons appear mid-screen so there is something to tap right away
    for (let i = 0; i < 3; i++) spawnBalloon(H * (0.42 + i * 0.13));
    $('home').classList.add('hidden');
    $('done').classList.add('hidden');
    $('playUi').classList.remove('hidden');
    $('songName').textContent = L(song.name);
    $('hint').textContent = t(inOrder() ? 'hintOrder' : 'hintAny');
    $('hint').classList.toggle('hidden', !save.tutorial);
    updateProgress();
  }

  function spawnBalloon(y) {
    if (S.spawnIdx >= S.song.midi.length) return;
    const r = rand(30, 38) * U;
    // stay clear of the previous balloon horizontally so new ones never stack on top of each other
    const prev = S.balloons[S.balloons.length - 1];
    let x = rand(r + 16, W - r - 16);
    for (let k = 0; k < 8 && prev && Math.abs(x - prev.x) < r * 2.4; k++) x = rand(r + 16, W - r - 16);
    S.balloons.push({
      n: S.spawnIdx++,
      x, y: y ?? H + r * 1.2, r,
      ph: Math.random() * TAU, sw: rand(0.5, 0.9),
      color: pick(TINTS), type: currentBalloon().id, born: S.t, wob: 0,
    });
  }

  // The expected balloon waits near the top instead of escaping; the rest queue below it.
  const hoverY = () => H * 0.2 + 30 * U;
  const queueGap = () => 64 * U;

  function tapBalloon(b) {
    if (inOrder() && b.n !== S.idx) {
      b.wob = 0.4;
      S.wrongs++;
      Audio.tick();
      vibrate(4);
      const next = S.balloons.find((x) => x.n === S.idx);
      if (next) next.pulse = 1;
      return;
    }
    popBalloon(b);
  }

  function popBalloon(b) {
    S.balloons.splice(S.balloons.indexOf(b), 1);
    // in "any" mode the tapped balloon plays the next note; renumber so the queue stays ordered
    if (!inOrder()) {
      S.balloons.forEach((x) => { if (x.n < b.n) x.n++; });
    }
    Audio.note(S.song.midi[S.idx], currentBalloon().inst);
    vibrate(6);
    S.rings.push({ x: b.x, y: b.y, r: b.r, life: 0.8, max: 0.8, color: b.color });
    const n = calm() ? 5 : 10;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU + Math.random() * 0.5, v = rand(30, 90) * U;
      S.parts.push({ x: b.x, y: b.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20 * U, life: 1, max: 1, r: rand(1.2, 2.4) * U, color: b.color });
    }
    S.idx++;
    S.idleT = 0;
    if (save.tutorial && S.idx >= 5) { save.tutorial = false; persist(); $('hint').classList.add('hidden'); }
    updateProgress();
    if (S.idx >= S.song.midi.length) finishSong();
  }

  function updateProgress() { $('progressFill').style.width = `${(S.idx / S.song.midi.length) * 100}%`; }

  function finishSong() {
    S.mode = 'finale';
    const last = S.song.midi[S.song.midi.length - 1];
    setTimeout(() => Audio.chord([last - 12, last - 5, last, last + 4], currentBalloon().inst, 0.12), 400);
    setTimeout(() => Audio.stopDrone(), 2200);
    for (let i = 0; i < (calm() ? 16 : 36); i++) {
      S.motes.push({ x: rand(0, W), y: rand(H * 0.5, H), vy: rand(18, 40) * U, ph: rand(0, TAU), r: rand(1.2, 2.6) * U, color: pick(TINTS), life: rand(3, 5) });
    }
    const first = !save.plays[S.song.id];
    const stars = Math.ceil(S.song.midi.length / 5) + (first ? 10 : 0);
    save.stars += stars;
    save.plays[S.song.id] = (save.plays[S.song.id] || 0) + 1;
    let bloom = -1;
    if (save.blooms.length < BLOOM_SLOTS) {
      bloom = (Math.random() * BLOOM_COLORS.length) | 0;
      save.blooms.push(bloom);
      S.newBloom = save.blooms.length - 1;
    }
    save.next = nextOwnedSong(S.song.id).id;
    persist();

    $('doneSong').textContent = L(S.song.name);
    $('doneStars').textContent = `+${stars}`;
    $('doneBloomText').textContent = bloom >= 0 ? t('newBloom') : t('gardenFull');
    const bc = $('doneBloom').getContext('2d');
    bc.setTransform(1, 0, 0, 1, 0, 0);
    bc.clearRect(0, 0, 96, 96);
    bc.scale(2, 2);
    drawBloom(bc, 24, 40, 8, BLOOM_COLORS[bloom >= 0 ? bloom : 0], 0, 1);
    const mins = Math.floor((Date.now() - S.sessionStart) / 60000);
    const brk = save.settings.breakMin > 0 && mins >= save.settings.breakMin;
    $('breakNote').classList.toggle('hidden', !brk);
    if (brk) { $('breakNote').textContent = t('breakNote', { min: mins }); S.sessionStart = Date.now(); }
    $('againBtn').textContent = t('nextSong', { name: L(songById(save.next).name) });
    setTimeout(() => {
      if (S.mode !== 'finale') return;
      S.mode = 'done';
      $('playUi').classList.add('hidden');
      $('done').classList.remove('hidden');
    }, 1800);
  }

  function goHome() {
    requestAnimationFrame(measurePanel);
    Audio.stopDrone();
    S.mode = 'home';
    S.song = null;
    S.balloons.length = 0;
    S.homeT = S.t;
    $('playUi').classList.add('hidden');
    $('done').classList.add('hidden');
    $('home').classList.remove('hidden');
    updateHome();
  }

  // ---------------------------------------------------------------- update
  function update(dt) {
    S.t += dt;
    S.groundF += ((S.mode === 'home' ? homeGround() / H : 0.88) - S.groundF) * Math.min(1, dt * 2.5);

    if (S.mode === 'play') {
      S.spawnT -= dt;
      S.idleT += dt;
      const pending = S.balloons.length;
      const lowest = S.balloons.reduce((m, b) => Math.max(m, b.y), 0);
      // keep up to 7 waiting; when the player is quick and few are left, top up sooner
      const ready = S.spawnT <= 0 || pending < 3;
      if (ready && pending < 7 && (pending === 0 || lowest < H + 10 * U)) {
        spawnBalloon();
        S.spawnT = calm() ? 0.8 : 0.55;
      }
      if (S.idleT > 7 && S.idx < 5) $('hint').classList.remove('hidden');
    }

    const fin = S.mode !== 'play';
    const speed = (calm() ? 26 : 38) * U;
    const hy = hoverY(), gap = queueGap();
    for (let i = S.balloons.length - 1; i >= 0; i--) {
      const b = S.balloons[i];
      if (fin) {
        b.y -= speed * 3 * dt;
        if (b.y < -b.r * 3) S.balloons.splice(i, 1);
        continue;
      }
      const floor = hy + (b.n - S.idx) * gap; // can't rise above its place in the queue
      b.y = Math.max(b.y - speed * dt, floor);
      b.x += Math.sin(S.t * b.sw + b.ph) * (calm() ? 4 : 9) * U * dt;
      b.x = clamp(b.x, b.r + 8, W - b.r - 8);
      b.wob = Math.max(0, b.wob - dt);
      if (b.pulse) b.pulse = Math.max(0, b.pulse - dt * 1.5);
    }
    for (let i = S.parts.length - 1; i >= 0; i--) {
      const p = S.parts[i];
      p.life -= dt;
      if (p.life <= 0) { S.parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 1 - 2 * dt; p.vy *= 1 - 2 * dt;
    }
    for (let i = S.rings.length - 1; i >= 0; i--) {
      S.rings[i].life -= dt;
      if (S.rings[i].life <= 0) S.rings.splice(i, 1);
    }
    for (let i = S.motes.length - 1; i >= 0; i--) {
      const m = S.motes[i];
      m.life -= dt; m.y -= m.vy * dt; m.x += Math.sin(S.t + m.ph) * 8 * dt;
      if (m.life <= 0) S.motes.splice(i, 1);
    }
  }

  // ---------------------------------------------------------------- drawing
  function glow(c, x, y, r, color, a) {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(color, a));
    g.addColorStop(1, rgba(color, 0));
    c.fillStyle = g;
    c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  }

  function drawBloom(c, x, y, s, color, time, grow = 1) {
    const sw = calm() ? 0 : Math.sin(time * 1.1) * s * 0.12;
    const hx = x + sw, hy = y - s * 2.2 * grow;
    c.strokeStyle = 'rgba(160,190,170,0.45)';
    c.lineWidth = Math.max(1, s * 0.12);
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x, y - s * grow, hx, hy); c.stroke();
    if (grow < 0.35) return;
    const k = clamp((grow - 0.35) / 0.65, 0, 1);
    glow(c, hx, hy, s * 2.4 * k, color, 0.35);
    c.fillStyle = rgba(color, 0.85);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + time * 0.05;
      c.beginPath();
      c.ellipse(hx + Math.cos(a) * s * 0.45 * k, hy + Math.sin(a) * s * 0.45 * k, s * 0.5 * k, s * 0.28 * k, a, 0, TAU);
      c.fill();
    }
    c.fillStyle = '#fff6e4';
    c.beginPath(); c.arc(hx, hy, s * 0.18 * k, 0, TAU); c.fill();
  }

  function drawBalloon(c, type, x, y, r, color, time, alpha = 1) {
    c.save();
    c.globalAlpha = alpha;
    c.translate(x, y);
    switch (type) {
      case 'bubble': {
        const g = c.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
        g.addColorStop(0, 'rgba(255,255,255,0.22)');
        g.addColorStop(0.85, rgba(color, 0.1));
        g.addColorStop(1, rgba(color, 0.35));
        c.fillStyle = g;
        c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
        const s = c.createLinearGradient(-r, -r, r, r);
        s.addColorStop(0, 'rgba(255,190,220,0.9)'); s.addColorStop(0.35, 'rgba(180,230,255,0.9)');
        s.addColorStop(0.7, 'rgba(210,255,190,0.9)'); s.addColorStop(1, 'rgba(255,225,180,0.9)');
        c.strokeStyle = s; c.lineWidth = 1.6;
        c.stroke();
        c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 2; c.lineCap = 'round';
        c.beginPath(); c.arc(0, 0, r * 0.74, Math.PI * 1.15, Math.PI * 1.4); c.stroke();
        break;
      }
      case 'mist': {
        glow(c, 0, 0, r * 1.7, color, 0.25);
        for (let i = 0; i < 3; i++) {
          const a = time * 0.4 + i * 2.1;
          glow(c, Math.cos(a) * r * 0.25, Math.sin(a) * r * 0.2, r * 0.95, i === 1 ? '#ffffff' : color, i === 1 ? 0.35 : 0.55);
        }
        break;
      }
      case 'lantern': {
        const w1 = r * 1.2, w2 = r * 0.85, h = r * 1.5;
        glow(c, 0, r * 0.2, r * 2, '#ffc987', 0.28);
        const g = c.createLinearGradient(0, -h / 2, 0, h / 2);
        g.addColorStop(0, mix(color, '#fff3dc', 0.55)); g.addColorStop(1, mix('#ffcf8f', color, 0.25));
        c.fillStyle = g;
        c.beginPath();
        c.moveTo(-w1 / 2, -h / 2); c.lineTo(w1 / 2, -h / 2); c.lineTo(w2 / 2, h / 2); c.lineTo(-w2 / 2, h / 2); c.closePath();
        c.fill();
        c.strokeStyle = 'rgba(120,70,50,0.25)'; c.lineWidth = 1;
        for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(i * w1 * 0.25, -h / 2); c.lineTo(i * w2 * 0.25, h / 2); c.stroke(); }
        const fl = 0.8 + 0.2 * Math.sin(time * 9);
        glow(c, 0, h / 2 - 2, r * 0.35 * fl, '#ffe2a8', 0.9);
        break;
      }
      case 'jelly': {
        glow(c, 0, 0, r * 1.8, color, 0.22);
        c.strokeStyle = rgba(color, 0.55); c.lineWidth = 1.6; c.lineCap = 'round';
        for (let i = 0; i < 5; i++) {
          const x0 = (i - 2) * r * 0.28;
          c.beginPath(); c.moveTo(x0, 0);
          for (let s = 1; s <= 6; s++) c.lineTo(x0 + Math.sin(time * 2.4 + i + s * 0.8) * r * 0.12, s * r * 0.22);
          c.stroke();
        }
        const g = c.createRadialGradient(-r * 0.2, -r * 0.4, r * 0.1, 0, -r * 0.1, r);
        g.addColorStop(0, 'rgba(255,255,255,0.85)'); g.addColorStop(0.5, rgba(color, 0.7)); g.addColorStop(1, rgba(color, 0.3));
        c.fillStyle = g;
        c.beginPath();
        c.arc(0, 0, r, Math.PI, 0);
        const wv = Math.sin(time * 2.4) * r * 0.05;
        c.quadraticCurveTo(r * 0.5, r * 0.2 + wv, 0, r * 0.08);
        c.quadraticCurveTo(-r * 0.5, r * 0.2 - wv, -r, 0);
        c.fill();
        break;
      }
      default: { // glass orb
        glow(c, 0, 0, r * 1.7, color, 0.3);
        const g = c.createRadialGradient(-r * 0.25, -r * 0.3, r * 0.05, 0, 0, r);
        g.addColorStop(0, 'rgba(255,255,255,0.8)');
        g.addColorStop(0.35, rgba(color, 0.75));
        g.addColorStop(1, rgba(color, 0.25));
        c.fillStyle = g;
        c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
        c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 1;
        c.stroke();
        c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 1.6; c.lineCap = 'round';
        c.beginPath(); c.arc(0, 0, r * 0.78, Math.PI * 1.1, Math.PI * 1.35); c.stroke();
      }
    }
    c.restore();
  }

  function bloomY(s, gy, band, inPlay) {
    const k = (s.y - 0.1) / 0.3;
    if (inPlay) return gy + 16 * U + k * band * 0.35;
    const room = Math.max(40 * U, Math.min(panelTop, H) - gy - 26 * U);
    return gy + 30 * U + k * room;
  }

  function drawScene() {
    const gy = H * S.groundF;
    const inPlay = S.mode !== 'home';
    const sway = calm() ? 0 : 1;
    const T = S.t;

    // twilight sky
    const sky = ctx.createLinearGradient(0, 0, 0, gy + 40);
    sky.addColorStop(0, '#11152e');
    sky.addColorStop(0.55, '#2c2d58');
    sky.addColorStop(0.85, '#6b5a7e');
    sky.addColorStop(1, '#c99486');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // stars
    for (const s of skyStars) {
      ctx.globalAlpha = 0.35 + 0.35 * Math.sin(T * 0.8 + s.ph);
      ctx.fillStyle = '#f3eee6';
      ctx.fillRect(s.x * W, s.y * gy, s.s, s.s);
    }
    ctx.globalAlpha = 1;

    // aurora
    if (owns('decor', 'aurora')) {
      for (let k = 0; k < 2; k++) {
        const col = k ? '#b4a2f0' : '#8fe3c8';
        const g = ctx.createLinearGradient(0, H * 0.08, 0, H * 0.34);
        g.addColorStop(0, rgba(col, 0)); g.addColorStop(0.5, rgba(col, 0.16)); g.addColorStop(1, rgba(col, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, H * 0.3);
        for (let x = 0; x <= W; x += 20) ctx.lineTo(x, H * (0.2 + k * 0.04) + Math.sin(x / W * 5 + T * 0.15 + k) * 26 * U);
        for (let x = W; x >= 0; x -= 20) ctx.lineTo(x, H * (0.1 + k * 0.04) + Math.sin(x / W * 4 + T * 0.12 + k * 2) * 30 * U);
        ctx.fill();
      }
    }

    // moon
    const mx = W * 0.78, my = H * 0.15, mr = 20 * U;
    glow(ctx, mx, my, mr * 5, '#f4ead2', 0.16);
    ctx.fillStyle = '#f4ead2';
    ctx.beginPath(); ctx.arc(mx, my, mr, 0, TAU); ctx.fill();

    // hanging chimes
    if (owns('decor', 'chimes') && !inPlay) {
      const cx0 = W * 0.9, top = H * 0.2;
      ctx.strokeStyle = 'rgba(243,238,230,0.35)'; ctx.lineWidth = 1;
      ctx.fillStyle = 'rgba(243,238,230,0.5)';
      ctx.fillRect(cx0 - 20 * U, H * 0.17 - 1, 40 * U, 2);
      ctx.beginPath(); ctx.moveTo(cx0, top - 26 * U); ctx.lineTo(cx0, H * 0.17); ctx.stroke();
      for (let i = 0; i < 5; i++) {
        const x = cx0 - 16 * U + i * 8 * U + Math.sin(T * 1.3 + i) * 2 * sway;
        const len = (26 + (i % 3) * 10) * U;
        ctx.strokeStyle = 'rgba(243,238,230,0.25)';
        ctx.beginPath(); ctx.moveTo(cx0 - 16 * U + i * 8 * U, H * 0.17); ctx.lineTo(x, H * 0.17 + len); ctx.stroke();
        ctx.fillStyle = 'rgba(236,208,143,0.8)';
        ctx.fillRect(x - 1.5, H * 0.17 + len, 3, 10 * U);
      }
    }

    // distant hills
    const hill = (y0, amp, freq, ph, col) => {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(0, H);
      for (let x = 0; x <= W + 20; x += 20) ctx.lineTo(x, y0 + Math.sin(x / W * freq + ph) * amp);
      ctx.lineTo(W, H); ctx.fill();
    };
    hill(gy - 40 * U, 18 * U, 3.2, 0.5, '#3a3763');
    hill(gy - 16 * U, 14 * U, 4.1, 2.1, '#2a2a4f');
    // mist band
    const mist = ctx.createLinearGradient(0, gy - 30 * U, 0, gy + 20 * U);
    mist.addColorStop(0, 'rgba(230,200,200,0)'); mist.addColorStop(0.6, 'rgba(230,200,200,0.12)'); mist.addColorStop(1, 'rgba(230,200,200,0)');
    ctx.fillStyle = mist; ctx.fillRect(0, gy - 30 * U, W, 50 * U);
    hill(gy + 6 * U, 10 * U, 2.6, 4, '#1c2140');

    const band = H - gy;
    const sc = inPlay ? 0.7 : 1;

    // willow: a dark dome of leaves with long hanging strands
    if (owns('decor', 'willow')) {
      const tx = W * 0.2, ty = gy + 16 * U, th = 112 * U * sc, cw = 15 * U * sc;
      const crownY = (x) => ty - th + Math.pow((x - tx) / cw, 2) * 3 * U * sc;
      ctx.strokeStyle = '#121629'; ctx.lineWidth = 6 * U * sc; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(tx + 8 * U * sc, ty - th * 0.55, tx - 2 * U, ty - th + 8 * U); ctx.stroke();
      for (let i = 0; i <= 26; i++) {
        const f = i / 26 - 0.5;
        const sx = tx + f * 7 * cw;
        const len = (78 - Math.abs(f) * 60 + ((i * 37) % 5) * 7) * U * sc;
        const swv = Math.sin(T * 0.8 + i * 0.5) * 5 * U * sway;
        ctx.strokeStyle = i % 2 ? 'rgba(120,170,150,0.45)' : 'rgba(90,140,130,0.5)';
        ctx.lineWidth = 1.4 * U;
        const y0 = crownY(sx) + 8 * U;
        ctx.beginPath(); ctx.moveTo(sx, y0); ctx.quadraticCurveTo(sx + swv * 0.5, y0 + len * 0.5, sx + swv * 1.5, y0 + len); ctx.stroke();
      }
      ctx.fillStyle = '#18253a';
      for (let k = -3; k <= 3; k++) {
        const cx = tx + k * cw;
        ctx.beginPath(); ctx.arc(cx, crownY(cx) + 4 * U, 19 * U * sc, 0, TAU); ctx.fill();
      }
    }

    // stream
    if (owns('decor', 'stream')) {
      ctx.strokeStyle = 'rgba(120,150,210,0.35)'; ctx.lineWidth = 14 * U * sc; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(W * 0.45, H + 10);
      ctx.bezierCurveTo(W * 0.55, gy + band * 0.6, W * 0.9, gy + band * 0.5, W + 20, gy + band * 0.2);
      ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const p = ((T * 0.08 + i / 6) % 1);
        const x = lerp(W * 0.5, W, p), y = lerp(gy + band * 0.75, gy + band * 0.25, p);
        ctx.fillStyle = `rgba(244,234,210,${0.35 * Math.sin(p * Math.PI)})`;
        ctx.fillRect(x, y, 8 * U, 1.5);
      }
    }

    // pond with the moon's reflection
    if (owns('decor', 'pond')) {
      const px = W * 0.74, py = inPlay ? gy + band * 0.45 : gy + (panelTop - gy) * 0.72;
      ctx.fillStyle = '#232c55';
      ctx.beginPath(); ctx.ellipse(px, py, W * 0.15, 14 * U * sc, 0, 0, TAU); ctx.fill();
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = `rgba(244,234,210,${0.25 + 0.2 * Math.sin(T * 2 + i)})`;
        ctx.fillRect(px - (10 - i * 2) * U, py - 6 * U + i * 3.5 * U, (20 - i * 4) * U, 1.5);
      }
    }

    // blooms
    save.blooms.forEach((ci, i) => {
      const s = slots[i];
      const x = s.x * W, y = bloomY(s, gy, band, inPlay);
      let grow = 1;
      if (i === S.newBloom && S.mode === 'home') grow = clamp((S.t - S.homeT - 0.3) / 1.6, 0, 1);
      drawBloom(ctx, x, y, 9 * U * s.s * sc, BLOOM_COLORS[ci] || BLOOM_COLORS[0], T + s.ph, easeOut(grow));
    });
    // a faint sprout where the next bloom will open
    if (!inPlay && save.blooms.length < BLOOM_SLOTS) {
      const s = slots[save.blooms.length];
      drawBloom(ctx, s.x * W, bloomY(s, gy, band, false), 9 * U, '#9fc9b8', T, 0.3 + 0.05 * Math.sin(T * 2));
    }

    // stone lanterns
    if (owns('decor', 'lanterns')) {
      [0.36, 0.58, 0.88].forEach((fx, i) => {
        const x = W * fx, y = inPlay ? gy + band * 0.2 + i * 6 * U : gy + (panelTop - gy) * 0.45 + i * 6 * U;
        glow(ctx, x, y - 10 * U * sc, 26 * U * sc, '#ffc987', 0.3 + 0.08 * Math.sin(T * 3 + i));
        ctx.fillStyle = '#141830';
        ctx.fillRect(x - 5 * U * sc, y - 6 * U * sc, 10 * U * sc, 12 * U * sc);
        ctx.fillRect(x - 8 * U * sc, y - 18 * U * sc, 16 * U * sc, 4 * U * sc);
        ctx.fillStyle = '#ffd9a0';
        ctx.fillRect(x - 3 * U * sc, y - 13 * U * sc, 6 * U * sc, 6 * U * sc);
      });
    }

    // fireflies
    if (owns('decor', 'fireflies')) {
      for (const f of flies) {
        const x = (f.x + Math.sin(T * 0.1 * f.sp * (sway || 0.3) + f.ph) * 0.08) * W;
        const y = gy - 40 * U + f.y * (band * 0.8) * (inPlay ? 0.4 : 1) + Math.sin(T * f.sp + f.ph) * 10 * U;
        const a = 0.4 + 0.6 * Math.max(0, Math.sin(T * 1.4 * f.sp + f.ph));
        glow(ctx, x, y, 9 * U, '#e8f5a0', 0.35 * a);
        ctx.fillStyle = `rgba(245,250,200,${a})`;
        ctx.beginPath(); ctx.arc(x, y, 1.4 * U, 0, TAU); ctx.fill();
      }
    }
  }

  function render() {
    drawScene();
    const guide = save.settings.guide && inOrder() && S.mode === 'play';
    for (const b of S.balloons) {
      const age = Math.min(1, (S.t - b.born) / 0.5);
      const wx = b.wob ? Math.sin(S.t * 50) * 4 * U * (b.wob / 0.4) : 0;
      if (guide && b.n === S.idx) {
        const p = 0.5 + 0.5 * Math.sin(S.t * 3);
        ctx.strokeStyle = `rgba(244,234,210,${0.25 + 0.3 * p + (b.pulse || 0) * 0.4})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(b.x + wx, b.y, b.r * (1.3 + 0.06 * p + (b.pulse || 0) * 0.3), 0, TAU); ctx.stroke();
      }
      drawBalloon(ctx, b.type, b.x + wx, b.y, b.r * easeOut(age), b.color, S.t + b.ph, S.mode === 'play' ? 1 : 0.7);
    }
    for (const r of S.rings) {
      const k = 1 - r.life / r.max;
      ctx.strokeStyle = rgba(r.color, 0.6 * (1 - k));
      ctx.lineWidth = 2 * (1 - k) + 0.5;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r * (1 + k * 1.2), 0, TAU); ctx.stroke();
      glow(ctx, r.x, r.y, r.r * (1.4 - k * 0.6), r.color, 0.25 * (1 - k));
    }
    for (const p of S.parts) {
      const a = Math.max(0, p.life / p.max);
      glow(ctx, p.x, p.y, p.r * 4, p.color, 0.3 * a);
      ctx.fillStyle = `rgba(255,248,232,${a})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
    }
    for (const m of S.motes) {
      const a = Math.min(1, m.life) * 0.9;
      glow(ctx, m.x, m.y, m.r * 5, m.color, 0.3 * a);
      ctx.fillStyle = `rgba(255,248,232,${a})`;
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, TAU); ctx.fill();
    }
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(1 / 30, (now - last) / 1000);
    last = now;
    update(dt);
    render();
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- input
  canvas.addEventListener('pointerdown', (e) => {
    if (S.mode !== 'play') return;
    e.preventDefault();
    const x = e.clientX, y = e.clientY;
    let best = null, bestD = Infinity;
    for (const b of S.balloons) {
      const d = Math.hypot(x - b.x, y - b.y);
      if (d < b.r * 1.35 && d < bestD) { best = b; bestD = d; }
    }
    if (best) tapBalloon(best);
  }, { passive: false });

  // ---------------------------------------------------------------- UI
  function toast(text) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    $('toasts').appendChild(el);
    setTimeout(() => el.remove(), 2900);
  }

  function updateHome() {
    $('stars').textContent = save.stars;
    document.querySelectorAll('.starCount').forEach((e) => { e.textContent = save.stars; });
    if (!owns('songs', save.next)) save.next = SONGS[0].id;
    const s = songById(save.next);
    $('nextTitle').textContent = L(s.name);
    $('nextOrigin').textContent = L(s.origin);
  }

  function spend(price, name) {
    if (save.stars < price) { toast(t('needStars', { n: price - save.stars })); return false; }
    save.stars -= price;
    persist();
    Audio.init();
    Audio.chord([67, 71, 74, 79], currentBalloon().inst, 0.09);
    toast(t('unlocked', { name }));
    return true;
  }

  function actBtn(label, cls, onClick) {
    const b = document.createElement('button');
    b.className = 'act ' + cls;
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  function row(iconSvg, title, sub, locked) {
    const li = document.createElement('li');
    li.className = 'row';
    li.innerHTML = `<span class="ico${locked ? ' locked' : ''}">${iconSvg}</span><div class="body"><b></b><small></small></div>`;
    li.querySelector('b').textContent = title;
    li.querySelector('small').textContent = sub;
    return li;
  }

  function renderSongs() {
    const list = $('songList');
    list.innerHTML = '';
    const sorted = [...SONGS].sort((a, b) => (owns('songs', b.id) - owns('songs', a.id)) || a.price - b.price);
    for (const s of sorted) {
      const owned = owns('songs', s.id), plays = save.plays[s.id] || 0;
      const sub = [L(s.origin), t('notes', { n: s.midi.length }), plays ? t('playedTimes', { n: plays }) : ''].filter(Boolean).join(' · ');
      const li = row(svg('<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>'), L(s.name), sub, !owned);
      if (s.id === save.next) li.classList.add('current');
      if (owned) li.appendChild(actBtn(t('playSong'), '', () => { save.next = s.id; persist(); startSong(s); }));
      else {
        li.appendChild(actBtn(`✦ ${s.price}`, save.stars >= s.price ? 'buy' : 'cant', () => {
          if (spend(s.price, L(s.name))) { save.songs.push(s.id); save.next = s.id; persist(); renderSongs(); updateHome(); }
        }));
      }
      list.appendChild(li);
    }
    updateHome();
  }

  function renderBalloons() {
    const grid = $('balloonGrid');
    grid.innerHTML = '';
    BALLOONS.forEach((b, i) => {
      const owned = owns('balloons', b.id), sel = save.balloon === b.id;
      const card = document.createElement('button');
      card.className = 'bcard' + (sel ? ' selected' : '');
      const cv = document.createElement('canvas');
      cv.width = 192; cv.height = 192;
      const c2 = cv.getContext('2d');
      c2.scale(2, 2);
      drawBalloon(c2, b.id, 48, b.id === 'jelly' ? 40 : 48, 24, TINTS[(i * 3) % TINTS.length], 1.3);
      card.appendChild(cv);
      card.insertAdjacentHTML('beforeend', '<b></b><small></small><span class="tag"></span>');
      card.querySelector('b').textContent = L(b.name);
      card.querySelector('small').textContent = L(b.instName);
      const tag = card.querySelector('.tag');
      if (sel) { tag.textContent = t('selected'); tag.classList.add('sel'); }
      else if (owned) { tag.textContent = t('use'); tag.classList.add('use'); }
      else { tag.textContent = `✦ ${b.price}`; tag.classList.add(save.stars >= b.price ? 'buy' : 'cant'); }
      card.addEventListener('click', () => {
        Audio.init();
        Audio.chord([60, 64, 67, 72], b.inst, 0.14);
        if (sel) return;
        if (owned) { save.balloon = b.id; persist(); renderBalloons(); return; }
        if (spend(b.price, L(b.name))) { save.balloons.push(b.id); save.balloon = b.id; persist(); renderBalloons(); updateHome(); }
      });
      grid.appendChild(card);
    });
    updateHome();
  }

  function renderDecor() {
    const list = $('decorList');
    list.innerHTML = '';
    for (const d of DECOR) {
      const owned = owns('decor', d.id);
      const li = row(svg(ICONS[d.id]), L(d.name), L(d.desc) + (d.amb ? ` · ${t('addsSound')}` : ''), false);
      if (owned) li.appendChild(actBtn(t('inGarden'), 'owned', () => {}));
      else {
        li.appendChild(actBtn(`✦ ${d.price}`, save.stars >= d.price ? 'buy' : 'cant', () => {
          if (spend(d.price, L(d.name))) { save.decor.push(d.id); persist(); Audio.updateAmbience(); renderDecor(); updateHome(); }
        }));
      }
      list.appendChild(li);
    }
    $('bloomCount').textContent = t('bloomCount', { n: save.blooms.length, max: BLOOM_SLOTS });
    updateHome();
  }

  function renderSettings() {
    const st = save.settings;
    $('setVol').value = st.vol;
    $('setMode').value = st.mode;
    $('setGuide').checked = st.guide;
    $('setAmb').checked = st.amb;
    $('setVibe').checked = st.vibe;
    $('setCalm').checked = st.calm;
    $('setBreak').value = String(st.breakMin);
  }

  function openSheet(id, render) { render(); $(id).classList.remove('hidden'); }
  function closeSheets() { document.querySelectorAll('.sheet').forEach((s) => s.classList.add('hidden')); }

  $('playBtn').addEventListener('click', () => startSong(songById(save.next)));
  $('againBtn').addEventListener('click', () => startSong(songById(save.next)));
  $('homeBtn').addEventListener('click', goHome);
  $('quitBtn').addEventListener('click', goHome);
  $('songsBtn').addEventListener('click', () => openSheet('songs', renderSongs));
  $('balloonsBtn').addEventListener('click', () => openSheet('balloons', renderBalloons));
  $('gardenBtn').addEventListener('click', () => openSheet('garden', renderDecor));
  $('settingsBtn').addEventListener('click', () => openSheet('settings', renderSettings));
  document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeSheets));
  document.querySelectorAll('.sheet').forEach((sh) => sh.addEventListener('pointerdown', (e) => { if (e.target === sh) closeSheets(); }));

  const setting = (id, key, read, after) => $(id).addEventListener('change', (e) => { save.settings[key] = read(e.target); persist(); if (after) after(); });
  $('setVol').addEventListener('input', (e) => { save.settings.vol = Number(e.target.value); persist(); Audio.applyVolume(); });
  setting('setVol', 'vol', (el) => Number(el.value), () => { Audio.init(); Audio.note(72, currentBalloon().inst); });
  setting('setMode', 'mode', (el) => el.value);
  setting('setGuide', 'guide', (el) => el.checked);
  setting('setAmb', 'amb', (el) => el.checked, () => { Audio.init(); Audio.applyVolume(); });
  setting('setVibe', 'vibe', (el) => el.checked, () => vibrate(20));
  setting('setCalm', 'calm', (el) => el.checked);
  setting('setBreak', 'breakMin', (el) => Number(el.value));

  // browsers require a user gesture before audio can start
  window.addEventListener('pointerdown', () => Audio.init(), { once: true });
  document.addEventListener('visibilitychange', () => {
    if (!Audio.ctx) return;
    if (document.hidden) Audio.ctx.suspend(); else Audio.ctx.resume();
  });
  window.addEventListener('resize', resize);
  document.addEventListener('contextmenu', (e) => e.preventDefault());

  applyI18n();
  resize();
  updateHome();
  measurePanel();
  S.groundF = homeGround() / H;
  window.addEventListener('resize', measurePanel);
  requestAnimationFrame(frame);

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  window.__drift = { S, save, startSong, tapBalloon, SONGS };
})();
