// İkon, açılış ekranı ve Play Store öne çıkan görselini üretir.
//   assets/*.png  -> `npx capacitor-assets generate` bunlardan tüm boyutları üretir
//   store/*.png   -> mağaza panellerine elle yüklenecek görseller
// Çizim için sistemdeki Edge/Chrome kullanılır (yoksa: npx playwright install chromium).
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

mkdirSync('assets', { recursive: true });
mkdirSync('store', { recursive: true });

const BG = `<radialGradient id="bg" cx="50%" cy="50%" r="70%"><stop offset="0" stop-color="#1d2658"/><stop offset="1" stop-color="#05060f"/></radialGradient>`;
const CORE = `<radialGradient id="core" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#3a4aa0"/><stop offset="1" stop-color="#1d2658"/></radialGradient>`;
// Yörünge çizimi 512'lik koordinat sisteminde, merkez (256,256)
const ORBIT = `
  <circle cx="256" cy="256" r="178" fill="none" stroke="#8fa3ff" stroke-opacity=".45" stroke-width="6"/>
  <circle cx="256" cy="256" r="118" fill="none" stroke="#8fa3ff" stroke-opacity=".25" stroke-width="6"/>
  <circle cx="256" cy="256" r="68" fill="url(#core)" stroke="#8fa3ff" stroke-opacity=".6" stroke-width="5"/>
  <path d="M 381.9 130.1 A 178 178 0 0 1 425.4 201" fill="none" stroke="#ff3d6e" stroke-width="24" stroke-linecap="round"/>
  <path d="M 172.6 353.4 A 118 118 0 0 1 145 296" fill="none" stroke="#ff3d6e" stroke-width="24" stroke-linecap="round"/>
  <circle cx="256" cy="78" r="36" fill="#3de8ff" opacity=".3"/>
  <circle cx="256" cy="78" r="22" fill="#3de8ff"/>
  <circle cx="249" cy="71" r="7" fill="#fff" opacity=".85"/>`;

const svg = (size, inner, vb = '0 0 512 512') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${vb}"><defs>${BG}${CORE}</defs>${inner}</svg>`;

// Ölçekli yörünge: s oranında küçültülmüş, ortalanmış
const scaled = (s) => `<g transform="translate(${256 * (1 - s)} ${256 * (1 - s)}) scale(${s})">${ORBIT}</g>`;

const JOBS = [
  // iOS ve genel ikon: köşesiz, şeffaflıksız tam kare (mağazalar köşeyi kendi yuvarlar)
  { out: 'assets/icon-only.png', w: 1024, h: 1024, html: svg(1024, `<rect width="512" height="512" fill="url(#bg)"/>${ORBIT}`) },
  // Android uyarlanabilir ikon: ön plan güvenli bölgede (orta %66), arka plan ayrı
  { out: 'assets/icon-foreground.png', w: 1024, h: 1024, transparent: true, html: svg(1024, scaled(0.64)) },
  { out: 'assets/icon-background.png', w: 1024, h: 1024, html: svg(1024, `<rect width="512" height="512" fill="url(#bg)"/>`) },
  // Açılış ekranı: koyu zemin, ortada küçük yörünge
  { out: 'assets/splash.png', w: 2732, h: 2732, html: svg(2732, `<rect width="512" height="512" fill="#05060f"/>${scaled(0.22)}`) },
  { out: 'assets/splash-dark.png', w: 2732, h: 2732, html: svg(2732, `<rect width="512" height="512" fill="#05060f"/>${scaled(0.22)}`) },
  // Google Play yüksek çözünürlüklü ikon (512x512, 32-bit PNG)
  { out: 'store/play-icon-512.png', w: 512, h: 512, html: svg(512, `<rect width="512" height="512" fill="url(#bg)"/>${ORBIT}`) },
  // App Store ikonu (1024, şeffaflık yok)
  { out: 'store/appstore-icon-1024.png', w: 1024, h: 1024, html: svg(1024, `<rect width="512" height="512" fill="url(#bg)"/>${ORBIT}`) },
  // Google Play öne çıkan görsel (1024x500), dil başına bir tane
  ...Object.entries({ en: 'One tap. Endless orbit.', tr: 'Tek dokunuş. Sonsuz yörünge.' }).map(([lang, tagline]) => ({
    out: `store/play-feature-${lang}.png`, w: 1024, h: 500,
    html: `<div style="width:1024px;height:500px;position:relative;overflow:hidden;background:radial-gradient(circle at 76% 50%,#1d2658 0,#05060f 62%);font-family:'Segoe UI',system-ui,sans-serif">
      <div style="position:absolute;right:40px;top:30px;width:440px;height:440px">${svg(440, ORBIT)}</div>
      <div style="position:absolute;left:64px;top:150px">
        <div style="font-size:100px;font-weight:900;letter-spacing:.08em;background:linear-gradient(90deg,#3de8ff,#9d6bff 55%,#ff3d6e);-webkit-background-clip:text;color:transparent;filter:drop-shadow(0 0 18px rgba(61,232,255,.35))">ORBITAP</div>
        <div style="margin-top:14px;font-size:30px;font-weight:700;color:#e8edff">${tagline}</div>
      </div></div>`,
  })),
];

async function launch() {
  for (const channel of ['msedge', 'chrome', undefined]) {
    try { return await chromium.launch(channel ? { channel } : {}); } catch (e) { /* sonrakini dene */ }
  }
  throw new Error('Tarayıcı bulunamadı. Çalıştır: npx playwright install chromium');
}

const browser = await launch();
for (const j of JOBS) {
  const page = await browser.newPage({ viewport: { width: j.w, height: j.h } });
  await page.setContent(`<style>html,body{margin:0;background:transparent}</style>${j.html}`);
  await page.screenshot({ path: j.out, omitBackground: !!j.transparent, clip: { x: 0, y: 0, width: j.w, height: j.h } });
  await page.close();
  console.log('✓', j.out);
}
await browser.close();
