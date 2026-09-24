// Mağaza ekran görüntülerini üretir: oyunu bir botla oynatır, anları yakalar, üstüne başlık koyar.
//   store/screenshots/<dil>/<cihaz>-<no>.png
// Cihazlar: App Store 6.9" (1320x2868) ve Google Play telefon (1080x1920).
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

const DEVICES = {
  ios69: { w: 440, h: 956, dpr: 3 },     // 1320 x 2868
  play: { w: 360, h: 640, dpr: 3 },      // 1080 x 1920
};
const CAPTIONS = {
  tr: ['Tek dokunuşla oyna', 'Son anda kaç, PERFECT yakala', 'Yeni yörüngeler aç', 'Kalkan ve güçlerle hayatta kal', 'Güçlerini geliştir'],
  en: ['Play with one tap', 'Dodge at the last moment for PERFECT', 'Unlock new orbits', 'Survive with shields and power-ups', 'Upgrade your powers'],
};

// ---- küçük statik sunucu (service worker 127.0.0.1'de devreye girmez)
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const f = join(process.cwd(), p);
  if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
}).listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const URL = `http://127.0.0.1:${server.address().port}/`;

async function launch() {
  for (const channel of ['msedge', 'chrome', undefined]) {
    try { return await chromium.launch(channel ? { channel } : {}); } catch (e) { /* sonraki */ }
  }
  throw new Error('Tarayıcı bulunamadı. Çalıştır: npx playwright install chromium');
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Bot: tehlike bulunduğu halkaya gelince son anda kaçar (PERFECT penceresi içinde)
const BOT = () => {
  const { S, doSwitch } = window.__yorunge;
  let lastTap = 0;
  window.__bot = true;
  (function tick() {
    if (S.mode === 'play' && window.__bot) {
      const ahead = S.obs.filter((o) => !o.passed && o.a + o.hw > S.angle - 0.02).sort((a, b) => a.a - b.a);
      if (ahead.length) {
        const first = ahead[0];
        const cluster = ahead.filter((o) => Math.abs(o.a - first.a) < 0.05);
        const blocked = new Set(cluster.map((o) => (o.flip && !o.flipped ? o.flipTo : o.ring)));
        const dist = first.a - first.hw - S.angle;
        const now = performance.now();
        if (blocked.has(S.ring) && dist < S.speed * (0.12 + 0.2 * (blocked.size - 1)) && now - lastTap > 75) { doSwitch(); lastTap = now; }
      }
    }
    requestAnimationFrame(tick);
  })();
};

async function rawShots(browser, dev) {
  const ctx = await browser.newContext({ viewport: { width: dev.w, height: dev.h }, deviceScaleFactor: dev.dpr, isMobile: true, hasTouch: true });
  await ctx.addInitScript((day) => {
    localStorage.setItem('yorunge.save.v1', JSON.stringify({
      tutorialDone: true, best: 142, stars: 380, lastDay: day, streak: 6, skin: 'neon',
      owned: ['neon', 'lime', 'rose'], upg: { shield: 2, magnet: 1, slow: 1, double: 0 }, name: 'Yıldız',
    }));
  }, today());
  const p = await ctx.newPage();
  await p.goto(URL);
  await p.waitForTimeout(2200);
  const shots = [await p.screenshot()];                                  // 1: menü

  const play = async () => {
    await p.evaluate(() => { window.__yorunge.startRun(); });
    await p.evaluate(BOT);
  };
  const waitFor = async (fn, ms = 30000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      if (await p.evaluate(fn)) return true;
      const m = await p.evaluate(() => window.__yorunge.S.mode);
      if (m === 'over' || m === 'revive') throw new Error('bot öldü');
      await p.waitForTimeout(50);
    }
    return false;
  };
  // Bot ölürse sahneyi baştan kur
  const scene = async (setup, until, ms) => {
    for (let k = 0; k < 6; k++) {
      try {
        if (await p.evaluate(() => window.__yorunge.S.mode !== 'play')) await play();
        await p.evaluate(setup);
        if (await waitFor(until, ms)) return;
      } catch (e) { /* tekrar dene */ }
      await p.evaluate(() => { window.__yorunge.S.mode = 'menu'; });
    }
    throw new Error('sahne kurulamadı');
  };

  // 2: PERFECT kombo
  await scene(() => { const S = window.__yorunge.S; if (S.score < 16) S.score = 16; if (S.score > 30) S.score = 16; },
    () => {
      const S = window.__yorunge.S;
      return S.combo >= 3 && S.ringCount === 2 && S.pendingRings === 0
        && S.pops.some((x) => x.text.startsWith('PERFECT') && x.life > x.max * 0.7)
        && !S.pops.some((x) => /YÖRÜNGE|SEVİYE|REKOR/.test(x.text));
    });
  shots.push(await p.screenshot());

  // 3: dört yörünge
  await scene(() => { if (window.__yorunge.S.score < 88) window.__yorunge.S.score = 88; },
    () => {
      const S = window.__yorunge.S;
      const ahead = S.obs.filter((o) => !o.passed && S.time - o.born > 0.5 && o.a - S.angle < 2.6);
      return S.ringCount === 4 && S.ringAnim >= 1 && S.dirHint <= 0 && ahead.length >= 4 && S.pops.length === 0;
    }, 45000);
  shots.push(await p.screenshot());

  // 4: güçler aktif (kalkan, mıknatıs yıldız çekerken, çift puan)
  await scene(() => {
    const S = window.__yorunge.S;
    if (S.score < 60) S.score = 64;
    S.shield = 1; S.pw.magnet = S.pwMax.magnet = 6; S.pw.double = S.pwMax.double = 7;
  }, () => { const S = window.__yorunge.S; return S.stars.some((s) => s.pulled && !s.taken); }, 15000);
  await p.waitForTimeout(100);
  shots.push(await p.screenshot());

  // 5: güç dükkanı
  await p.evaluate(() => {
    window.__bot = false;
    window.__yorunge.S.mode = 'menu';
    document.querySelectorAll('.screen,.sheet').forEach((e) => e.classList.add('hidden'));
    document.getElementById('menu').classList.remove('hidden');
    document.getElementById('powersBtn').click();
  });
  await p.waitForTimeout(700);
  shots.push(await p.screenshot());
  await ctx.close();
  return shots;
}

// Başlıklı kompozisyon: üstte başlık, altta telefon ekranı
async function compose(browser, dev, png, caption, out) {
  const W = dev.w * dev.dpr, H = dev.h * dev.dpr;
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const img = `data:image/png;base64,${png.toString('base64')}`;
  const cap = Math.round(H * 0.17);
  await page.setContent(`<style>
    html,body{margin:0}
    .bg{width:${W}px;height:${H}px;background:radial-gradient(circle at 50% 0,#27306e 0,#05060f 70%);position:relative;overflow:hidden;font-family:'Segoe UI',system-ui,sans-serif}
    .cap{position:absolute;left:0;right:0;top:0;height:${cap}px;display:flex;align-items:center;justify-content:center;padding:0 ${W * 0.08}px;box-sizing:border-box;text-align:center;
         color:#fff;font-weight:900;font-size:${Math.round(W * 0.068)}px;line-height:1.15;text-wrap:balance}
    .ph{position:absolute;left:50%;top:${cap}px;transform:translateX(-50%);width:${W * 0.84}px;height:${H * 0.84}px;border-radius:${W * 0.07}px;overflow:hidden;
        box-shadow:0 0 0 ${W * 0.012}px #1b2150,0 ${W * 0.03}px ${W * 0.08}px rgba(0,0,0,.6),0 0 ${W * 0.09}px rgba(61,232,255,.22)}
    .ph img{width:100%;height:auto;display:block}
  </style><div class="bg"><div class="cap">${caption}</div><div class="ph"><img src="${img}"></div></div>`);
  await page.waitForTimeout(100);
  await page.screenshot({ path: out });
  await page.close();
}

const browser = await launch();
for (const [name, dev] of Object.entries(DEVICES)) {
  const shots = await rawShots(browser, dev);
  for (const lang of Object.keys(CAPTIONS)) {
    mkdirSync(`store/screenshots/${lang}`, { recursive: true });
    for (let i = 0; i < shots.length; i++) {
      const out = `store/screenshots/${lang}/${name}-${i + 1}.png`;
      await compose(browser, dev, shots[i], CAPTIONS[lang][i], out);
      console.log('✓', out);
    }
  }
}
await browser.close();
server.close();
