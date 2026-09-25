/* BALON BAHÇESİ — balonları patlat, şarkıyı sen çal, bahçeni büyüt.
 * Kaybetmek yok, süre yok. Her dokunuş şarkının bir sonraki notasını çalar.
 */
(() => {
  'use strict';

  // ---------------------------------------------------------------- yardımcılar
  const TAU = Math.PI * 2;
  const $ = (id) => document.getElementById(id);
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  function mulberry32(a) {
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------------------------------------------------------------- veri
  const NOTE_INDEX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function parseNote(s) {
    const m = /^([A-G])(#|b)?(\d)$/.exec(s);
    return 12 * (Number(m[3]) + 1) + NOTE_INDEX[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  }
  const SONGS = window.BALON_SONGS.map((s) => ({ ...s, midi: s.notes.split(/\s+/).map(parseNote) }));

  const BALLOONS = [
    { id: 'classic', name: 'Klasik Balon', inst: 'piano', instName: 'Piyano', price: 0 },
    { id: 'bubble', name: 'Sabun Köpüğü', inst: 'musicbox', instName: 'Müzik kutusu', price: 25 },
    { id: 'cloud', name: 'Bulut', inst: 'pad', instName: 'Yumuşak synth', price: 40 },
    { id: 'lantern', name: 'Fener', inst: 'marimba', instName: 'Marimba', price: 60 },
    { id: 'jelly', name: 'Deniz Anası', inst: 'harp', instName: 'Arp', price: 80 },
  ];

  const DECOR = [
    { id: 'mushroom', emoji: '🍄', name: 'Mantarlar', price: 15, desc: 'Çimenlerin arasında küçük mantarlar' },
    { id: 'butterfly', emoji: '🦋', name: 'Kelebekler', price: 25, desc: 'Bahçende süzülen kelebekler' },
    { id: 'tree', emoji: '🌳', name: 'Ağaç', price: 30, desc: 'Gölgeli, kocaman bir ağaç' },
    { id: 'birds', emoji: '🐦', name: 'Kuşlar', price: 35, desc: 'Bahçeye kuş cıvıltısı ekler', amb: true },
    { id: 'fountain', emoji: '⛲', name: 'Çeşme', price: 45, desc: 'Bahçeye su sesi ekler', amb: true },
    { id: 'chimes', emoji: '🎐', name: 'Rüzgâr Çanı', price: 50, desc: 'Bahçeye tatlı çan sesleri ekler', amb: true },
    { id: 'pond', emoji: '🐸', name: 'Gölet', price: 60, desc: 'Küçük bir gölet ve dostu kurbağa' },
    { id: 'lanterns', emoji: '🏮', name: 'Fener Dizisi', price: 75, desc: 'Bahçenin üstüne asılı fenerler' },
  ];

  const FLOWERS = ['🌷', '🌼', '🌻', '🌸', '🌺', '🌹'];
  const FLOWER_SLOTS = 30;
  const PASTELS = ['#ff9aa2', '#ffb7b2', '#ffcf9e', '#fff1a8', '#c8ecb4', '#a8e6cf', '#a0d8ff', '#c7ceea', '#e5c3ff', '#ffc6e5'];

  // ---------------------------------------------------------------- kayıt
  const SAVE_KEY = 'balon.save.v1';
  const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DEFAULTS = {
    stars: 0,
    songs: ['twinkle', 'frere', 'mary'],
    plays: {},
    balloons: ['classic'],
    balloon: 'classic',
    decor: [],
    flowers: [],
    next: 'twinkle',
    tutorial: true,
    settings: { vol: 80, amb: true, vibe: true, calm: reduceMotion, breakMin: 15 },
  };
  const save = (() => {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
      return { ...DEFAULTS, ...s, settings: { ...DEFAULTS.settings, ...(s.settings || {}) } };
    } catch (e) { return JSON.parse(JSON.stringify(DEFAULTS)); }
  })();
  function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* gizli mod */ } }
  const owns = (list, id) => save[list].includes(id);
  const songById = (id) => SONGS.find((s) => s.id === id) || SONGS[0];
  const currentBalloon = () => BALLOONS.find((b) => b.id === save.balloon) || BALLOONS[0];

  // ---------------------------------------------------------------- ses
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
      // yumuşak yankı: sesleri "odada" gibi duyurur
      const rev = c.createConvolver();
      rev.buffer = this.impulse(2.6);
      const wet = c.createGain(); wet.gain.value = 0.32;
      rev.connect(wet); wet.connect(this.master);
      this.bus = c.createGain();
      this.bus.connect(this.master); this.bus.connect(rev);
      this.amb = c.createGain();
      this.amb.connect(this.master); this.amb.connect(rev);
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
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
      }
      return b;
    },
    hz: (m) => 440 * Math.pow(2, (m - 69) / 12),
    env(g, t, a, peak, d) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    },
    osc(type, f, t, dur, dest, detune = 0) {
      const o = this.ctx.createOscillator();
      o.type = type; o.frequency.value = f; o.detune.value = detune;
      o.connect(dest); o.start(t); o.stop(t + dur + 0.05);
    },
    lp(freq, dest) {
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = freq; f.connect(dest);
      return f;
    },
    gain(dest, v = 1) { const g = this.ctx.createGain(); g.gain.value = v; g.connect(dest); return g; },

    // Enstrümanlar: her balon türü farklı bir ses
    note(m, inst, vel = 1, delay = 0, dest) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime + delay, f = this.hz(m);
      const g = this.gain(dest || this.bus);
      switch (inst) {
        case 'musicbox': {
          this.env(g, t, 0.003, 0.26 * vel, 1.3);
          this.osc('sine', f * 2, t, 1.4, g);
          const g2 = this.gain(dest || this.bus);
          this.env(g2, t, 0.002, 0.07 * vel, 0.35);
          this.osc('sine', f * 2 * 4.07, t, 0.4, g2);
          break;
        }
        case 'pad': {
          const lp = this.lp(1300, g);
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(0.13 * vel, t + 0.1);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 1.9);
          this.osc('sawtooth', f, t, 2, lp, -7);
          this.osc('sawtooth', f, t, 2, lp, 7);
          break;
        }
        case 'marimba': {
          this.env(g, t, 0.003, 0.42 * vel, 0.55);
          this.osc('sine', f, t, 0.65, g);
          const g2 = this.gain(dest || this.bus);
          this.env(g2, t, 0.002, 0.12 * vel, 0.07);
          this.osc('sine', f * 4, t, 0.1, g2);
          break;
        }
        case 'harp': {
          const lp = this.lp(2600, g);
          this.env(g, t, 0.003, 0.3 * vel, 2);
          this.osc('triangle', f, t, 2.1, lp);
          this.osc('sine', f * 2, t, 2.1, this.gain(lp, 0.15));
          break;
        }
        default: { // piyano
          const lp = this.lp(2800, g);
          this.env(g, t, 0.006, 0.34 * vel, 1.6);
          this.osc('triangle', f, t, 1.7, lp);
          this.osc('sine', f * 2, t, 1.7, this.gain(lp, 0.22));
        }
      }
    },
    chord(ms, inst, spread = 0.07) { ms.forEach((m, i) => this.note(m, inst, 0.7, i * spread)); },

    // Bahçe sesleri: süslere göre açılır
    water: null, timers: [],
    updateAmbience() {
      if (!this.ctx) return;
      const want = (id) => owns('decor', id);
      if (want('fountain') && !this.water) {
        const c = this.ctx, len = c.sampleRate * 2, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        const src = c.createBufferSource(); src.buffer = b; src.loop = true;
        const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.6;
        const g = this.gain(this.amb, 0.035);
        src.connect(bp); bp.connect(g); src.start();
        this.water = src;
      }
      this.timers.forEach(clearTimeout);
      this.timers = [];
      const loop = (fn, min, max) => {
        const tick = () => { fn(); this.timers.push(setTimeout(tick, rand(min, max))); };
        this.timers.push(setTimeout(tick, rand(min, max)));
      };
      if (want('birds')) loop(() => this.chirp(), 3500, 9000);
      if (want('chimes')) loop(() => this.note(pick([79, 81, 84, 86, 88, 91]), 'musicbox', 0.35, 0, this.amb), 4000, 10000);
    },
    chirp() {
      const c = this.ctx, n = 2 + ((Math.random() * 3) | 0), base = rand(2600, 3400);
      for (let i = 0; i < n; i++) {
        const t = c.currentTime + i * 0.11;
        const o = c.createOscillator(), g = this.gain(this.amb);
        o.frequency.setValueAtTime(base, t);
        o.frequency.exponentialRampToValueAtTime(base * 1.35, t + 0.07);
        this.env(g, t, 0.01, 0.05, 0.07);
        o.connect(g); o.start(t); o.stop(t + 0.12);
      }
    },
  };
  function vibrate(ms) {
    if (save.settings.vibe && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* yok */ } }
  }

  // ---------------------------------------------------------------- tuval
  const canvas = $('scene');
  const ctx = canvas.getContext('2d');
  let W, H, DPR, U; // U: ekrana göre temel ölçü
  let slots = [];
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2.5);
    W = innerWidth; H = innerHeight;
    canvas.width = Math.floor(W * DPR); canvas.height = Math.floor(H * DPR);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    U = Math.min(W, H * 0.6, 520) / 390;
    // çiçek yuvaları: sabit tohumla hep aynı yerler, arkadan öne sıralı
    const r = mulberry32(7);
    slots = [];
    for (let i = 0; i < FLOWER_SLOTS; i++) {
      const col = (i % 10) / 9;
      slots.push({ x: 0.06 + col * 0.88 + (r() - 0.5) * 0.06, y: 0.12 + ((i / 10) | 0) * 0.13 + r() * 0.08, s: 0.85 + r() * 0.3, ph: r() * TAU });
    }
  }

  // ---------------------------------------------------------------- durum
  const S = {
    mode: 'home', t: 0, groundF: 0.44,
    balloons: [], parts: [], notes: [], petals: [],
    song: null, idx: 0, spawnT: 0, doneT: 0, idleT: 0,
    sessionStart: Date.now(), breakShown: false,
    clouds: [0, 1, 2].map((i) => ({ x: Math.random(), y: 0.08 + i * 0.09, s: 0.8 + Math.random() * 0.6, v: 0.004 + Math.random() * 0.006 })),
  };
  const calm = () => save.settings.calm;

  // ---------------------------------------------------------------- oyun akışı
  function nextOwnedSong(afterId) {
    const owned = SONGS.filter((s) => owns('songs', s.id));
    const i = owned.findIndex((s) => s.id === afterId);
    return owned[(i + 1) % owned.length];
  }

  function startSong(song) {
    Audio.init();
    closeSheets();
    S.song = song;
    S.idx = 0;
    S.balloons.length = 0;
    S.notes.length = 0;
    S.mode = 'play';
    S.spawnT = 0;
    S.idleT = 0;
    for (let i = 0; i < 4; i++) spawnBalloon(H * (0.45 + i * 0.14));
    $('home').classList.add('hidden');
    $('done').classList.add('hidden');
    $('playUi').classList.remove('hidden');
    $('songName').textContent = song.name;
    $('hint').classList.toggle('hidden', !save.tutorial);
    updateProgress();
  }

  function spawnBalloon(y) {
    const b = currentBalloon();
    const r = rand(30, 42) * U;
    S.balloons.push({
      x: rand(r + 10, W - r - 10), y: y ?? H + r * 2, r,
      vy: rand(34, 52) * U * (calm() ? 0.65 : 1),
      ph: Math.random() * TAU, sw: rand(0.6, 1.1),
      color: pick(PASTELS), type: b.id, born: S.t,
    });
  }

  function popBalloon(i) {
    const b = S.balloons[i];
    S.balloons.splice(i, 1);
    const m = S.song.midi[S.idx];
    Audio.note(m, currentBalloon().inst);
    vibrate(8);
    const n = calm() ? 6 : 12;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU + Math.random() * 0.4, v = rand(60, 140) * U;
      S.parts.push({ x: b.x, y: b.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.7, max: 0.7, r: rand(2.5, 5) * U, color: b.color });
    }
    S.notes.push({ x: b.x, y: b.y, life: 1.1, max: 1.1, color: b.color, ch: pick(['♪', '♫', '♩']) });
    S.idx++;
    S.idleT = 0;
    if (save.tutorial && S.idx >= 4) { save.tutorial = false; persist(); $('hint').classList.add('hidden'); }
    updateProgress();
    if (S.idx >= S.song.midi.length) finishSong();
  }

  function updateProgress() {
    $('progressFill').style.width = `${(S.idx / S.song.midi.length) * 100}%`;
  }

  function finishSong() {
    S.mode = 'finale';
    S.doneT = 0;
    const last = S.song.midi[S.song.midi.length - 1];
    setTimeout(() => Audio.chord([last, last + 7, last + 12, last + 16], currentBalloon().inst, 0.09), 350);
    for (let i = 0; i < (calm() ? 18 : 40); i++) {
      S.petals.push({ x: rand(0, W), y: rand(-H * 0.3, 0), vy: rand(40, 90) * U, vx: rand(-20, 20), rot: rand(0, TAU), vr: rand(-2, 2), ch: pick(FLOWERS), s: rand(14, 22) * U, life: 4 });
    }
    // ödüller
    const first = !save.plays[S.song.id];
    const stars = Math.ceil(S.song.midi.length / 5) + (first ? 10 : 0);
    save.stars += stars;
    save.plays[S.song.id] = (save.plays[S.song.id] || 0) + 1;
    let flower = null;
    if (save.flowers.length < FLOWER_SLOTS) {
      flower = pick(FLOWERS);
      save.flowers.push(flower);
    }
    save.next = nextOwnedSong(S.song.id).id;
    persist();

    $('doneSong').textContent = S.song.name;
    $('doneStars').textContent = `+${stars}`;
    $('doneFlower').textContent = flower || '🌿';
    $('doneFlowerText').textContent = flower ? 'bahçende açtı' : 'bahçen dolup taştı';
    const mins = Math.floor((Date.now() - S.sessionStart) / 60000);
    const brk = save.settings.breakMin > 0 && mins >= save.settings.breakMin;
    $('breakNote').classList.toggle('hidden', !brk);
    if (brk) {
      $('breakNote').textContent = `${mins} dakikadır buradasın. Kısa bir mola iyi gelebilir: su iç, biraz esne 🌿`;
      S.sessionStart = Date.now();
    }
    $('againBtn').textContent = `♪ Sıradaki: ${songById(save.next).name}`;
    setTimeout(() => {
      if (S.mode !== 'finale') return;
      S.mode = 'done';
      $('playUi').classList.add('hidden');
      $('done').classList.remove('hidden');
    }, 1600);
  }

  function goHome() {
    S.mode = 'home';
    S.song = null;
    S.balloons.length = 0;
    $('playUi').classList.add('hidden');
    $('done').classList.add('hidden');
    $('home').classList.remove('hidden');
    updateHome();
  }

  // ---------------------------------------------------------------- güncelleme
  function update(dt) {
    S.t += dt;
    const k = Math.min(1, dt * 3);
    S.groundF += ((S.mode === 'home' ? 0.44 : 0.86) - S.groundF) * k;
    for (const c of S.clouds) { c.x += c.v * dt; if (c.x > 1.3) c.x = -0.3; }

    if (S.mode === 'play') {
      S.spawnT -= dt;
      S.idleT += dt;
      const interval = calm() ? 1.35 : 0.95;
      if ((S.spawnT <= 0 && S.balloons.length < 8) || S.balloons.length < 2) {
        spawnBalloon();
        S.spawnT = interval * rand(0.8, 1.2);
      }
      if (S.idleT > 6 && S.idx < 4) $('hint').classList.remove('hidden');
    }

    const fin = S.mode === 'finale' || S.mode === 'done';
    for (let i = S.balloons.length - 1; i >= 0; i--) {
      const b = S.balloons[i];
      b.y -= b.vy * dt * (fin ? 3 : 1);
      b.x += Math.sin(S.t * b.sw + b.ph) * (calm() ? 6 : 14) * U * dt;
      if (b.y < -b.r * 3) S.balloons.splice(i, 1);
    }
    for (let i = S.parts.length - 1; i >= 0; i--) {
      const p = S.parts[i];
      p.life -= dt;
      if (p.life <= 0) { S.parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 1 - 3 * dt; p.vy = p.vy * (1 - 3 * dt) + 40 * U * dt;
    }
    for (let i = S.notes.length - 1; i >= 0; i--) {
      const n = S.notes[i];
      n.life -= dt; n.y -= 40 * U * dt;
      if (n.life <= 0) S.notes.splice(i, 1);
    }
    for (let i = S.petals.length - 1; i >= 0; i--) {
      const p = S.petals[i];
      p.life -= dt; p.y += p.vy * dt; p.x += (p.vx + Math.sin(S.t * 2 + p.rot) * 20) * dt; p.rot += p.vr * dt;
      if (p.life <= 0 || p.y > H + 30) S.petals.splice(i, 1);
    }
  }

  // ---------------------------------------------------------------- çizim
  function drawEmoji(ch, x, y, size, rot = 0, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    ctx.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  }

  function drawBalloon(c, type, x, y, r, color, t, alpha = 1) {
    c.save();
    c.globalAlpha = alpha;
    c.translate(x, y);
    switch (type) {
      case 'bubble': {
        const g = c.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
        g.addColorStop(0, 'rgba(255,255,255,0.35)');
        g.addColorStop(0.8, 'rgba(255,255,255,0.08)');
        g.addColorStop(1, color + 'aa');
        c.fillStyle = g;
        c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
        const s = c.createLinearGradient(-r, -r, r, r);
        s.addColorStop(0, '#ffb3d9'); s.addColorStop(0.35, '#b3e5ff'); s.addColorStop(0.7, '#d4ffb3'); s.addColorStop(1, '#ffe0b3');
        c.strokeStyle = s; c.lineWidth = 2.2;
        c.stroke();
        c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 3; c.lineCap = 'round';
        c.beginPath(); c.arc(0, 0, r * 0.72, Math.PI * 1.15, Math.PI * 1.4); c.stroke();
        break;
      }
      case 'cloud': {
        c.fillStyle = 'rgba(120,140,190,0.18)';
        const puffs = [[-0.45, 0.15, 0.5], [0, -0.15, 0.62], [0.45, 0.12, 0.5], [0.15, 0.3, 0.45], [-0.2, 0.3, 0.45]];
        for (const [px, py, pr] of puffs) { c.beginPath(); c.arc(px * r, py * r + 4, pr * r, 0, TAU); c.fill(); }
        // alt katman renkli, üstte biraz yukarı kaymış beyaz katman: yumuşak, dolgun bir bulut
        c.fillStyle = mix(color, '#ffffff', 0.35);
        for (const [px, py, pr] of puffs) { c.beginPath(); c.arc(px * r, py * r, pr * r, 0, TAU); c.fill(); }
        c.fillStyle = mix(color, '#ffffff', 0.72);
        for (const [px, py, pr] of puffs) { c.beginPath(); c.arc(px * r, py * r - pr * r * 0.18, pr * r * 0.82, 0, TAU); c.fill(); }
        break;
      }
      case 'lantern': {
        const w = r * 1.25, h = r * 1.55;
        const glow = c.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 1.5);
        glow.addColorStop(0, 'rgba(255,220,150,0.45)'); glow.addColorStop(1, 'rgba(255,220,150,0)');
        c.fillStyle = glow; c.beginPath(); c.arc(0, 0, r * 1.5, 0, TAU); c.fill();
        const g = c.createLinearGradient(-w / 2, 0, w / 2, 0);
        g.addColorStop(0, color); g.addColorStop(0.5, '#fff6e0'); g.addColorStop(1, color);
        c.fillStyle = g;
        c.beginPath(); c.ellipse(0, 0, w / 2, h / 2, 0, 0, TAU); c.fill();
        c.strokeStyle = 'rgba(160,90,60,0.35)'; c.lineWidth = 1.2;
        for (let i = -2; i <= 2; i++) { c.beginPath(); c.ellipse(0, 0, Math.abs(i) * w * 0.11 + 0.5, h / 2, 0, 0, TAU); c.stroke(); }
        c.fillStyle = '#a0634a';
        c.fillRect(-w * 0.25, -h / 2 - 4, w * 0.5, 6);
        c.fillRect(-w * 0.25, h / 2 - 2, w * 0.5, 6);
        c.strokeStyle = '#c0504d'; c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(0, h / 2 + 4); c.lineTo(Math.sin(t * 2) * 3, h / 2 + 16); c.stroke();
        break;
      }
      case 'jelly': {
        c.strokeStyle = color; c.lineWidth = 2.2; c.lineCap = 'round'; c.globalAlpha = alpha * 0.8;
        for (let i = 0; i < 5; i++) {
          const x0 = (i - 2) * r * 0.3;
          c.beginPath(); c.moveTo(x0, 0);
          for (let s = 1; s <= 6; s++) c.lineTo(x0 + Math.sin(t * 3 + i + s * 0.8) * r * 0.12, s * r * 0.22);
          c.stroke();
        }
        c.globalAlpha = alpha;
        const g = c.createRadialGradient(-r * 0.2, -r * 0.4, r * 0.1, 0, -r * 0.1, r);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, color + 'dd'); g.addColorStop(1, color + '88');
        c.fillStyle = g;
        c.beginPath();
        c.arc(0, 0, r, Math.PI, 0);
        const wv = Math.sin(t * 3) * r * 0.05;
        c.quadraticCurveTo(r * 0.5, r * 0.2 + wv, 0, r * 0.08);
        c.quadraticCurveTo(-r * 0.5, r * 0.2 - wv, -r, 0);
        c.fill();
        c.fillStyle = 'rgba(255,255,255,0.7)';
        c.beginPath(); c.ellipse(-r * 0.35, -r * 0.5, r * 0.18, r * 0.1, -0.6, 0, TAU); c.fill();
        break;
      }
      default: { // klasik balon
        c.strokeStyle = 'rgba(61,58,75,0.25)'; c.lineWidth = 1.2;
        c.beginPath(); c.moveTo(0, r * 1.05);
        c.quadraticCurveTo(Math.sin(t * 2) * r * 0.3, r * 1.6, Math.sin(t * 2 + 1) * r * 0.15, r * 2.2);
        c.stroke();
        c.fillStyle = color;
        c.beginPath(); c.moveTo(-r * 0.12, r * 1.08); c.lineTo(r * 0.12, r * 1.08); c.lineTo(0, r * 0.95); c.fill();
        const g = c.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r * 1.1);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.25, color); g.addColorStop(1, shade(color, -0.18));
        c.fillStyle = g;
        c.beginPath(); c.ellipse(0, 0, r * 0.86, r, 0, 0, TAU); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.55)';
        c.beginPath(); c.ellipse(-r * 0.32, -r * 0.42, r * 0.14, r * 0.24, -0.5, 0, TAU); c.fill();
      }
    }
    c.restore();
  }

  function mix(a, b, t) {
    const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
    const ch = (sh) => Math.round(lerp((x >> sh) & 255, (y >> sh) & 255, t));
    return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.max(0, Math.min(255, Math.round(v + 255 * amt)));
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  }

  function drawScene() {
    const gy = H * S.groundF;
    const inPlay = S.mode !== 'home';
    const sway = calm() ? 0 : 1;

    // gökyüzü
    const sky = ctx.createLinearGradient(0, 0, 0, gy);
    sky.addColorStop(0, '#bfe3ff');
    sky.addColorStop(1, '#fff0e3');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // güneş
    const sx = W * 0.8, sy = H * 0.16, sr = 34 * U;
    const glow = ctx.createRadialGradient(sx, sy, sr * 0.5, sx, sy, sr * 3);
    glow.addColorStop(0, 'rgba(255,236,170,0.7)'); glow.addColorStop(1, 'rgba(255,236,170,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(sx, sy, sr * 3, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, TAU); ctx.fill();

    // bulutlar
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (const c of S.clouds) {
      const x = c.x * W, y = c.y * H, s = 30 * U * c.s;
      ctx.beginPath();
      ctx.arc(x, y, s, 0, TAU); ctx.arc(x + s * 1.1, y + s * 0.2, s * 0.8, 0, TAU); ctx.arc(x - s * 1.1, y + s * 0.25, s * 0.75, 0, TAU);
      ctx.fill();
    }

    // fener dizisi
    if (owns('decor', 'lanterns') && !inPlay) {
      const y0 = H * 0.2;
      ctx.strokeStyle = 'rgba(120,90,70,0.5)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-10, y0 - 20); ctx.quadraticCurveTo(W / 2, y0 + 40, W + 10, y0 - 20); ctx.stroke();
      for (let i = 1; i <= 5; i++) {
        const tt = i / 6, x = W * tt;
        const y = (1 - tt) * (1 - tt) * (y0 - 20) + 2 * (1 - tt) * tt * (y0 + 40) + tt * tt * (y0 - 20);
        drawEmoji('🏮', x, y + 14 * U, 22 * U, Math.sin(S.t + i) * 0.08 * sway);
      }
    }
    if (owns('decor', 'chimes') && !inPlay) drawEmoji('🎐', W * 0.12, H * 0.27, 34 * U, Math.sin(S.t * 1.3) * 0.15 * sway);

    // tepeler
    ctx.fillStyle = '#c9e8b4';
    ctx.beginPath(); ctx.moveTo(0, gy + 10);
    ctx.bezierCurveTo(W * 0.3, gy - 40 * U, W * 0.6, gy + 20, W, gy - 20 * U);
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
    ctx.fillStyle = '#addb95';
    ctx.beginPath(); ctx.moveTo(0, gy + 30 * U);
    ctx.bezierCurveTo(W * 0.35, gy + 5, W * 0.7, gy + 45 * U, W, gy + 20 * U);
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();

    const band = H - gy;
    const sc = inPlay ? 0.75 : 1;
    // arka süsler
    if (owns('decor', 'tree')) drawEmoji('🌳', W * 0.17, gy - 18 * U * sc, 110 * U * sc, Math.sin(S.t * 0.6) * 0.02 * sway);
    if (owns('decor', 'birds')) {
      const bx = owns('decor', 'tree') ? W * 0.24 : W * 0.86, by = owns('decor', 'tree') ? gy - 50 * U * sc : gy - 6 * U;
      drawEmoji('🐦', bx, by + Math.abs(Math.sin(S.t * 2)) * -3 * sway, 24 * U * sc);
    }
    if (owns('decor', 'fountain')) drawEmoji('⛲', W * 0.52, gy + 6 * U, 62 * U * sc);
    if (owns('decor', 'pond')) {
      const px = W * 0.76, py = gy + band * (inPlay ? 0.5 : 0.62);
      ctx.fillStyle = '#9fd3f5';
      ctx.beginPath(); ctx.ellipse(px, py, W * 0.14, 16 * U * sc, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath(); ctx.ellipse(px - W * 0.04, py - 4, W * 0.04, 3, 0, 0, TAU); ctx.fill();
      drawEmoji('🐸', px + W * 0.05, py - 4 * U, 22 * U * sc);
    }

    // çiçekler
    save.flowers.forEach((f, i) => {
      const s = slots[i];
      const x = s.x * W, y = gy + (inPlay ? s.y * 0.5 : s.y) * band * (inPlay ? 1 : 0.62) + 24 * U;
      drawEmoji(f, x, y, 28 * U * s.s * sc, Math.sin(S.t * 1.2 + s.ph) * 0.07 * sway);
    });

    // sıradaki çiçeğin yeri: küçük bir fide, bahçenin büyüyeceğini hissettirir
    if (!inPlay && save.flowers.length < FLOWER_SLOTS) {
      const s = slots[save.flowers.length];
      drawEmoji('🌱', s.x * W, gy + s.y * band * 0.62 + 28 * U, 20 * U, Math.sin(S.t * 1.5) * 0.08 * sway, 0.55 + 0.25 * Math.sin(S.t * 2));
    }

    if (owns('decor', 'mushroom')) {
      drawEmoji('🍄', W * 0.06, gy + band * (inPlay ? 0.4 : 0.45), 24 * U * sc);
      drawEmoji('🍄', W * 0.93, gy + band * (inPlay ? 0.35 : 0.4), 20 * U * sc);
    }
    if (owns('decor', 'butterfly')) {
      for (let i = 0; i < 3; i++) {
        const x = W * (0.5 + 0.4 * Math.sin(S.t * 0.25 * (sway || 0.3) + i * 2.1));
        const y = gy - 30 * U + Math.sin(S.t * 0.8 + i * 1.7) * 26 * U;
        drawEmoji('🦋', x, y, 20 * U, Math.sin(S.t * 6 + i) * 0.2 * sway);
      }
    }
  }

  function render() {
    drawScene();

    // balonlar
    for (const b of S.balloons) {
      const age = Math.min(1, (S.t - b.born) / 0.4);
      drawBalloon(ctx, b.type, b.x, b.y, b.r * easeOut(age), b.color, S.t + b.ph, S.mode === 'play' ? 1 : 0.8);
    }
    // patlama parçacıkları
    for (const p of S.parts) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // nota simgeleri
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const n of S.notes) {
      ctx.globalAlpha = Math.min(1, n.life / (n.max * 0.6));
      ctx.font = `800 ${26 * U}px ui-rounded, system-ui, sans-serif`;
      ctx.fillStyle = shade(n.color, -0.25);
      ctx.fillText(n.ch, n.x, n.y);
    }
    ctx.globalAlpha = 1;
    // final taç yaprakları
    for (const p of S.petals) drawEmoji(p.ch, p.x, p.y, p.s, p.rot, Math.min(1, p.life));
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(1 / 30, (now - last) / 1000);
    last = now;
    update(dt);
    render();
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- dokunma
  canvas.addEventListener('pointerdown', (e) => {
    if (S.mode !== 'play') return;
    e.preventDefault();
    const x = e.clientX, y = e.clientY;
    // öndeki (en son çizilen) balondan başla; geniş ve affedici dokunma alanı
    let best = -1, bestD = Infinity;
    for (let i = S.balloons.length - 1; i >= 0; i--) {
      const b = S.balloons[i];
      const d = Math.hypot(x - b.x, y - b.y);
      if (d < b.r * 1.35 && d < bestD) { best = i; bestD = d; }
    }
    if (best >= 0) popBalloon(best);
  }, { passive: false });

  // ---------------------------------------------------------------- arayüz
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
    $('nextTitle').textContent = songById(save.next).name;
  }

  function spend(price, what) {
    if (save.stars < price) { toast(`${price - save.stars} yıldız daha lazım ⭐`); return false; }
    save.stars -= price;
    persist();
    Audio.init();
    Audio.chord([72, 76, 79], currentBalloon().inst, 0.06);
    toast(`${what} senin oldu ✨`);
    return true;
  }

  function actBtn(label, cls, onClick) {
    const b = document.createElement('button');
    b.className = 'act ' + cls;
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  function renderSongs() {
    const list = $('songList');
    list.innerHTML = '';
    const sorted = [...SONGS].sort((a, b) => (owns('songs', b.id) - owns('songs', a.id)) || a.price - b.price);
    for (const s of sorted) {
      const li = document.createElement('li');
      li.className = 'row' + (s.id === save.next ? ' current' : '');
      const owned = owns('songs', s.id);
      const plays = save.plays[s.id] || 0;
      li.innerHTML = `<span class="emo">${owned ? (plays ? '🎼' : '🎵') : '🔒'}</span><div class="body"><b></b><small></small></div>`;
      li.querySelector('b').textContent = s.name;
      li.querySelector('small').textContent = `${s.origin} · ${s.midi.length} nota${plays ? ` · ✓ ${plays} kez` : ''}`;
      if (owned) {
        li.appendChild(actBtn('♪ Çal', '', () => { save.next = s.id; persist(); startSong(s); }));
      } else {
        li.appendChild(actBtn(`⭐ ${s.price}`, save.stars >= s.price ? 'buy' : 'cant', () => {
          if (spend(s.price, s.name)) { save.songs.push(s.id); save.next = s.id; persist(); renderSongs(); updateHome(); }
        }));
      }
      list.appendChild(li);
    }
    updateHome();
  }

  function renderBalloons() {
    const grid = $('balloonGrid');
    grid.innerHTML = '';
    for (const b of BALLOONS) {
      const owned = owns('balloons', b.id), sel = save.balloon === b.id;
      const card = document.createElement('button');
      card.className = 'bcard' + (sel ? ' selected' : '');
      const cv = document.createElement('canvas');
      cv.width = 180; cv.height = 180;
      const c2 = cv.getContext('2d');
      c2.scale(2, 2);
      drawBalloon(c2, b.id, 45, b.id === 'classic' ? 36 : 45, 26, PASTELS[BALLOONS.indexOf(b) * 2 % PASTELS.length], 0);
      card.appendChild(cv);
      card.insertAdjacentHTML('beforeend', `<b></b><small></small><span class="tag"></span>`);
      card.querySelector('b').textContent = b.name;
      card.querySelector('small').textContent = `🎵 ${b.instName}`;
      const tag = card.querySelector('.tag');
      if (sel) { tag.textContent = 'Seçili'; tag.classList.add('sel'); }
      else if (owned) { tag.textContent = 'Kullan'; tag.classList.add('use'); }
      else { tag.textContent = `⭐ ${b.price}`; tag.classList.add(save.stars >= b.price ? 'buy' : 'cant'); }
      card.addEventListener('click', () => {
        Audio.init();
        Audio.chord([60, 64, 67, 72], b.inst, 0.12);
        if (sel) return;
        if (owned) { save.balloon = b.id; persist(); renderBalloons(); return; }
        if (spend(b.price, b.name)) { save.balloons.push(b.id); save.balloon = b.id; persist(); renderBalloons(); updateHome(); }
      });
      grid.appendChild(card);
    }
    updateHome();
  }

  function renderDecor() {
    const list = $('decorList');
    list.innerHTML = '';
    for (const d of DECOR) {
      const owned = owns('decor', d.id);
      const li = document.createElement('li');
      li.className = 'row';
      li.innerHTML = `<span class="emo">${d.emoji}</span><div class="body"><b></b><small></small></div>`;
      li.querySelector('b').textContent = d.name;
      li.querySelector('small').textContent = d.desc + (d.amb ? ' 🔊' : '');
      if (owned) li.appendChild(actBtn('Bahçende', 'owned', () => {}));
      else {
        li.appendChild(actBtn(`⭐ ${d.price}`, save.stars >= d.price ? 'buy' : 'cant', () => {
          if (spend(d.price, d.name)) { save.decor.push(d.id); persist(); Audio.updateAmbience(); renderDecor(); updateHome(); }
        }));
      }
      list.appendChild(li);
    }
    const count = document.createElement('li');
    count.className = 'muted';
    count.textContent = `Bahçende ${save.flowers.length} / ${FLOWER_SLOTS} çiçek açtı.`;
    list.appendChild(count);
    updateHome();
  }

  function renderSettings() {
    const st = save.settings;
    $('setVol').value = st.vol;
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

  $('setVol').addEventListener('input', (e) => { save.settings.vol = Number(e.target.value); persist(); Audio.applyVolume(); });
  $('setVol').addEventListener('change', () => { Audio.init(); Audio.note(72, currentBalloon().inst); });
  $('setAmb').addEventListener('change', (e) => { save.settings.amb = e.target.checked; persist(); Audio.init(); Audio.applyVolume(); });
  $('setVibe').addEventListener('change', (e) => { save.settings.vibe = e.target.checked; persist(); vibrate(20); });
  $('setCalm').addEventListener('change', (e) => { save.settings.calm = e.target.checked; persist(); });
  $('setBreak').addEventListener('change', (e) => { save.settings.breakMin = Number(e.target.value); persist(); });

  // İlk dokunuşta ses motorunu başlat (tarayıcılar bunu şart koşar), bahçe sesleri çalsın
  window.addEventListener('pointerdown', () => Audio.init(), { once: true });
  document.addEventListener('visibilitychange', () => {
    if (!Audio.ctx) return;
    if (document.hidden) Audio.ctx.suspend(); else Audio.ctx.resume();
  });
  window.addEventListener('resize', resize);
  document.addEventListener('contextmenu', (e) => e.preventDefault());

  resize();
  updateHome();
  requestAnimationFrame(frame);

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  window.__balon = { S, save, startSong, SONGS, popBalloon };
})();
