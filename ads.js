/* ORBITAP — reklam altyapısı.
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
  const t = (k, v) => (window.I18N ? I18N.t(k, v) : k);

  const CONFIG = {
    rewardedDailyCap: 10,          // günde en fazla ödüllü reklam
    interstitial: {
      enabled: false,              // 1.0'da kapalı. Açınca: ilk 3 dk yok, en fazla 4 oyunda bir
      minPlaySeconds: 180,
      everyNGames: 4,
      minGapSeconds: 150,
    },
    // Uygulama içi satın alma (StoreKit / Play Billing) bağlanana kadar "Reklamları kaldır" gizli
    removeAdsEnabled: false,
    admob: {
      // Orbitap'in AdMob reklam birimleri. (Uygulama ID'leri AndroidManifest.xml ve Info.plist içinde.)
      // Geçiş reklamı 1.0'da kapalı; açılacaksa AdMob'da birim oluşturup interstitialId'leri değiştir.
      android: {
        rewardedId: 'ca-app-pub-4611251963734836/4263730904',
        interstitialId: 'ca-app-pub-3940256099942544/1033173712',
      },
      ios: {
        rewardedId: 'ca-app-pub-4611251963734836/5937748530',
        interstitialId: 'ca-app-pub-3940256099942544/4411468910',
      },
      // true iken eklenti gerçek birimler yerine Google'ın test reklamlarını gösterir.
      // Cihaz testleri bitince, mağazaya göndermeden hemen önce false yap.
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
  const platformIds = () => {
    const p = window.Capacitor && window.Capacitor.getPlatform ? window.Capacitor.getPlatform() : 'android';
    return p === 'ios' ? CONFIG.admob.ios : CONFIG.admob.android;
  };

  // Tek seferlik olay bekleyici: dinleyiciyi kurar, ilk olayda çözülür ve kendini kaldırır
  function once(AdMob, events, timeoutMs) {
    return new Promise((resolve) => {
      const handles = [];
      let done = false;
      const finish = (name, data) => {
        if (done) return;
        done = true;
        handles.forEach((h) => Promise.resolve(h).then((x) => x && x.remove && x.remove()));
        resolve({ name, data });
      };
      for (const ev of events) handles.push(AdMob.addListener(ev, (d) => finish(ev, d)));
      if (timeoutMs) setTimeout(() => finish('timeout'), timeoutMs);
    });
  }

  const AdMobProvider = {
    name: 'admob',
    rewardedReady: false,
    interReady: false,
    async init() {
      const AdMob = admobPlugin();
      // 1) KVKK/GDPR onayı (Google UMP). Mesajı AdMob > Gizlilik ve mesajlaşma bölümünde yayınla.
      try {
        const info = await AdMob.requestConsentInfo();
        if (info.isConsentFormAvailable && info.status === 'REQUIRED') await AdMob.showConsentForm();
        this.privacyRequired = info.privacyOptionsRequirementStatus === 'REQUIRED';
      } catch (e) { /* onay formu yoksa devam */ }
      // 2) iOS: App Tracking Transparency izni (Android ve eski iOS'ta işlem yapmaz)
      try {
        const t = await AdMob.trackingAuthorizationStatus();
        if (t && t.status === 'notDetermined') await AdMob.requestTrackingAuthorization();
      } catch (e) { /* yok */ }
      await AdMob.initialize({ initializeForTesting: CONFIG.admob.testing });
      this.preloadRewarded();
      if (CONFIG.interstitial.enabled) this.preloadInterstitial();
    },
    async preloadRewarded() {
      if (this.rewardedReady) return true;
      try {
        await admobPlugin().prepareRewardVideoAd({ adId: platformIds().rewardedId, isTesting: CONFIG.admob.testing });
        this.rewardedReady = true;
      } catch (e) { this.rewardedReady = false; }
      return this.rewardedReady;
    },
    async preloadInterstitial() {
      if (this.interReady) return true;
      try {
        await admobPlugin().prepareInterstitial({ adId: platformIds().interstitialId, isTesting: CONFIG.admob.testing });
        this.interReady = true;
      } catch (e) { this.interReady = false; }
      return this.interReady;
    },
    async rewarded() {
      const AdMob = admobPlugin();
      if (!this.rewardedReady && !(await this.preloadRewarded())) {
        MockProvider.notice(t('ad.none'));
        return false;
      }
      this.rewardedReady = false;
      // Ödül olayı kapanmadan önce gelir; kapanınca sonucu bildir.
      // Not: Android'de showRewardVideoAd ödül yoksa hiç çözülmez, bu yüzden olaylara bakıyoruz.
      let earned = false;
      const rewardH = AdMob.addListener('onRewardedVideoAdReward', () => { earned = true; });
      const end = once(AdMob, ['onRewardedVideoAdDismissed', 'onRewardedVideoAdFailedToShow']);
      AdMob.showRewardVideoAd().then(() => { earned = true; }).catch(() => {});
      const r = await end;
      Promise.resolve(rewardH).then((h) => h && h.remove && h.remove());
      this.preloadRewarded();
      return earned && r.name === 'onRewardedVideoAdDismissed';
    },
    async interstitial() {
      const AdMob = admobPlugin();
      if (!this.interReady) { this.preloadInterstitial(); return; }
      this.interReady = false;
      const end = once(AdMob, ['interstitialAdDismissed', 'interstitialAdFailedToShow'], 60000);
      AdMob.showInterstitial().catch(() => {});
      await end;
      this.preloadInterstitial();
    },
    async purchaseRemoveAds() {
      // Uygulama içi satın alma (ör. RevenueCat) bağlandığında burası doldurulacak.
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
    notice(text) {
      const el = overlay(`<p class="ad-text">${text}</p><div class="ad-actions"><button class="ad-btn" id="adOk">${t('ad.ok')}</button></div>`);
      el.querySelector('#adOk').addEventListener('click', () => el.remove());
    },
    rewarded() {
      return new Promise((resolve) => {
        let left = 5;
        const el = overlay(
          `<div class="ad-tag">${t('ad.test')}</div>
           <div class="ad-visual"><span>${t('ad.rewardHere')}</span></div>
           <div class="ad-count">${t('ad.left', { n: left })}</div>
           <div class="ad-actions">
             <button class="ad-btn ghost" id="adClose">${t('ad.close')}</button>
             <button class="ad-btn" id="adClaim" disabled>${t('ad.claim')}</button>
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
          `<div class="ad-tag">${t('ad.testInter')}</div>
           <div class="ad-visual"><span>${t('ad.interHere')}</span></div>
           <div class="ad-actions"><button class="ad-btn" id="adSkip" disabled>2</button></div>`);
        const b = el.querySelector('#adSkip');
        let left = 2;
        const t = setInterval(() => {
          left--;
          if (left <= 0) { clearInterval(t); b.disabled = false; b.textContent = t('ad.closeX'); } else b.textContent = left;
        }, 1000);
        b.addEventListener('click', () => { clearInterval(t); el.remove(); resolve(); });
      });
    },
    purchaseRemoveAds() {
      return new Promise((resolve) => {
        const el = overlay(
          `<div class="ad-tag">${t('ad.testBuy')}</div>
           <p class="ad-text">${t('ad.buyText')}</p>
           <div class="ad-actions">
             <button class="ad-btn ghost" id="buyNo">${t('ad.cancel')}</button>
             <button class="ad-btn" id="buyYes">${t('ad.confirm')}</button>
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
    removeAdsAvailable() { return CONFIG.removeAdsEnabled; },
    // AB/BK: oyuncunun reklam onayını sonradan değiştirebileceği giriş noktası (Google UMP şartı)
    privacyOptionsRequired() { return provider === AdMobProvider && !!AdMobProvider.privacyRequired; },
    async showPrivacyOptions() {
      try { await admobPlugin().showPrivacyOptionsForm(); } catch (e) { /* yok */ }
    },
    async purchaseRemoveAds() {
      const ok = await provider.purchaseRemoveAds();
      if (ok) { st.noAds = true; persist(); }
      return ok;
    },
  };
})();
