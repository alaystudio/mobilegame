/* YÖRÜNGE — reklam altyapısı.
 *
 * Oyun yalnızca bu arayüzü kullanır:
 *   YorungeAds.init()
 *   YorungeAds.rewardedLeft()            -> bugün kalan ödüllü reklam hakkı
 *   YorungeAds.showRewarded(placement)   -> Promise<boolean>  (true = ödül kazanıldı)
 *   YorungeAds.maybeInterstitial(ctx)    -> Promise<void>     (seyrek geçiş reklamı)
 *   YorungeAds.noAds() / purchaseRemoveAds()
 *
 * Sağlayıcılar:
 *   - admob: Capacitor uygulamasında @capacitor-community/admob eklentisi varsa
 *   - mock : web/PWA sürümünde "test reklamı" ekranı (gerçek reklam yok)
 */
(() => {
  'use strict';

  const CONFIG = {
    rewardedDailyCap: 10,          // günde en fazla ödüllü reklam
    interstitial: {
      enabled: true,
      minPlaySeconds: 180,         // ilk 3 dakika oyunda hiç geçiş reklamı yok
      everyNGames: 4,              // sonra en fazla 4 oyunda bir
      minGapSeconds: 150,          // iki geçiş reklamı arasında en az 2.5 dk
    },
    admob: {
      // Google'ın resmi TEST reklam birimleri. Yayından önce AdMob panelindeki gerçek ID'lerle değiştir.
      rewardedId: 'ca-app-pub-3940256099942544/5224354917',
      interstitialId: 'ca-app-pub-3940256099942544/1033173712',
      testing: true,
    },
  };

  const KEY = 'yorunge.ads.v1';
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  };
  const st = (() => {
    try { return Object.assign({ day: '', count: 0, noAds: false, games: 0, lastInter: 0 }, JSON.parse(localStorage.getItem(KEY) || '{}')); }
    catch (e) { return { day: '', count: 0, noAds: false, games: 0, lastInter: 0 }; }
  })();
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* yok */ } };
  function rollDay() { if (st.day !== today()) { st.day = today(); st.count = 0; persist(); } }

  // ------------------------------------------------------------ AdMob (Capacitor)
  const admobPlugin = () => window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AdMob;

  const AdMobProvider = {
    name: 'admob',
    ready: false,
    async init() {
      const AdMob = admobPlugin();
      await AdMob.initialize({ initializeForTesting: CONFIG.admob.testing });
      // KVKK/GDPR onayı (Google UMP): gerekiyorsa formu göster
      try {
        const info = await AdMob.requestConsentInfo();
        if (info.isConsentFormAvailable && info.status === 'REQUIRED') await AdMob.showConsentForm();
      } catch (e) { /* onay formu yoksa devam */ }
      this.ready = true;
    },
    async rewarded() {
      const AdMob = admobPlugin();
      await AdMob.prepareRewardVideoAd({ adId: CONFIG.admob.rewardedId, isTesting: CONFIG.admob.testing });
      const reward = await AdMob.showRewardVideoAd();
      return !!reward;
    },
    async interstitial() {
      const AdMob = admobPlugin();
      await AdMob.prepareInterstitial({ adId: CONFIG.admob.interstitialId, isTesting: CONFIG.admob.testing });
      await AdMob.showInterstitial();
    },
    async purchaseRemoveAds() {
      // Mağaza sürümünde uygulama içi satın alma (ör. RevenueCat) buraya bağlanacak.
      return false;
    },
  };

  // ------------------------------------------------------------ Test reklamı (web)
  function overlay(html) {
    const el = document.createElement('div');
    el.className = 'ad-overlay';
    el.innerHTML = `<div class="ad-box">${html}</div>`;
    document.body.appendChild(el);
    return el;
  }

  const MockProvider = {
    name: 'mock',
    ready: true,
    async init() {},
    rewarded() {
      return new Promise((resolve) => {
        let left = 5;
        const el = overlay(
          `<div class="ad-tag">TEST REKLAMI</div>
           <div class="ad-visual"><span>Burada ödüllü reklam oynar</span></div>
           <div class="ad-count">Ödül için <b id="adLeft">${left}</b> sn</div>
           <div class="ad-actions">
             <button class="ad-btn ghost" id="adClose">Kapat (ödül yok)</button>
             <button class="ad-btn" id="adClaim" disabled>Ödülü al</button>
           </div>`);
        const claim = el.querySelector('#adClaim');
        const t = setInterval(() => {
          left--;
          const lbl = el.querySelector('#adLeft');
          if (lbl) lbl.textContent = Math.max(0, left);
          if (left <= 0) { clearInterval(t); claim.disabled = false; el.querySelector('.ad-count').textContent = 'Reklam bitti'; }
        }, 1000);
        const done = (ok) => { clearInterval(t); el.remove(); resolve(ok); };
        el.querySelector('#adClose').addEventListener('click', () => done(false));
        claim.addEventListener('click', () => done(true));
      });
    },
    interstitial() {
      return new Promise((resolve) => {
        const el = overlay(
          `<div class="ad-tag">TEST GEÇİŞ REKLAMI</div>
           <div class="ad-visual"><span>Burada geçiş reklamı oynar</span></div>
           <div class="ad-actions"><button class="ad-btn" id="adSkip" disabled>2</button></div>`);
        const b = el.querySelector('#adSkip');
        let left = 2;
        const t = setInterval(() => {
          left--;
          if (left <= 0) { clearInterval(t); b.disabled = false; b.textContent = 'Kapat ✕'; } else b.textContent = left;
        }, 1000);
        b.addEventListener('click', () => { clearInterval(t); el.remove(); resolve(); });
      });
    },
    purchaseRemoveAds() {
      return new Promise((resolve) => {
        const el = overlay(
          `<div class="ad-tag">TEST SATIN ALMA</div>
           <p class="ad-text">Mağaza sürümünde burada gerçek ödeme ekranı açılır. Test için ücretsiz onaylayabilirsin.</p>
           <div class="ad-actions">
             <button class="ad-btn ghost" id="buyNo">Vazgeç</button>
             <button class="ad-btn" id="buyYes">Onayla</button>
           </div>`);
        el.querySelector('#buyNo').addEventListener('click', () => { el.remove(); resolve(false); });
        el.querySelector('#buyYes').addEventListener('click', () => { el.remove(); resolve(true); });
      });
    },
  };

  let provider = MockProvider;
  let busy = false;

  window.YorungeAds = {
    CONFIG,
    get providerName() { return provider.name; },
    async init() {
      if (admobPlugin()) {
        try { await AdMobProvider.init(); provider = AdMobProvider; } catch (e) { provider = MockProvider; }
      }
      rollDay();
    },
    rewardedLeft() { rollDay(); return Math.max(0, CONFIG.rewardedDailyCap - st.count); },
    async showRewarded(placement) {
      rollDay();
      if (busy || st.count >= CONFIG.rewardedDailyCap) return false;
      busy = true;
      try {
        const ok = await provider.rewarded(placement);
        if (ok) { st.count++; persist(); }
        return ok;
      } catch (e) {
        return false;
      } finally {
        busy = false;
      }
    },
    // ctx: { playSeconds: toplam oynama süresi }
    async maybeInterstitial(ctx) {
      st.games++;
      persist();
      const c = CONFIG.interstitial;
      const now = Date.now() / 1000;
      if (!c.enabled || st.noAds || busy) return;
      if ((ctx.playSeconds || 0) < c.minPlaySeconds) return;
      if (st.games % c.everyNGames !== 0) return;
      if (now - st.lastInter < c.minGapSeconds) return;
      busy = true;
      try { await provider.interstitial(); st.lastInter = now; persist(); } catch (e) { /* reklam yüklenemedi */ }
      finally { busy = false; }
    },
    noAds() { return st.noAds; },
    async purchaseRemoveAds() {
      const ok = await provider.purchaseRemoveAds();
      if (ok) { st.noAds = true; persist(); }
      return ok;
    },
  };
})();
