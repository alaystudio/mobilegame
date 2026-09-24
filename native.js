/* YÖRÜNGE — mağaza uygulamasına özel davranışlar (Capacitor).
 * Web/PWA sürümünde hiçbir şey yapmaz. Oyun yalnızca şunları kullanır:
 *   YorungeNative.isNative
 *   YorungeNative.vibrate(pattern)   -> iOS dahil gerçek dokunsal geri bildirim
 *   YorungeNative.onBack(handler)    -> Android geri tuşu; handler true dönerse işlendi sayılır
 */
(() => {
  'use strict';

  const Cap = window.Capacitor;
  const isNative = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
  const P = (name) => (isNative && Cap.Plugins ? Cap.Plugins[name] : null);
  let backHandler = null;

  // Web titreşim desenini (ms veya [titreşim, ara, titreşim...]) yerel dokunuşlara çevir
  function vibrate(pattern) {
    const H = P('Haptics');
    if (!H) {
      if (navigator.vibrate) { try { navigator.vibrate(pattern); } catch (e) { /* yok */ } }
      return;
    }
    const pulses = Array.isArray(pattern) ? pattern.filter((_, i) => i % 2 === 0) : [pattern];
    const gaps = Array.isArray(pattern) ? pattern.filter((_, i) => i % 2 === 1) : [];
    let t = 0;
    pulses.forEach((ms, i) => {
      const style = ms >= 50 ? 'HEAVY' : ms >= 15 ? 'MEDIUM' : 'LIGHT';
      setTimeout(() => { H.impact({ style }).catch(() => {}); }, t);
      t += ms + (gaps[i] || 0);
    });
  }

  async function init() {
    if (!isNative) return;
    document.documentElement.classList.add('native');
    const SB = P('StatusBar');
    if (SB) {
      SB.setOverlaysWebView({ overlay: true }).catch(() => {});
      SB.setStyle({ style: 'DARK' }).catch(() => {});
      SB.hide().catch(() => {});
    }
    const App = P('App');
    if (App) {
      App.addListener('backButton', () => {
        if (backHandler && backHandler()) return;
        App.exitApp();
      });
    }
    // Açılış ekranını ilk kare çizildikten sonra kapat
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const Splash = P('SplashScreen');
      if (Splash) Splash.hide({ fadeOutDuration: 250 }).catch(() => {});
    }));
  }

  window.YorungeNative = {
    isNative,
    vibrate,
    onBack(fn) { backHandler = fn; },
  };
  init();
})();
