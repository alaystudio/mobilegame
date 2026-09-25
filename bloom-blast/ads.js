/* Bloom Blast — ad layer (same design as Yörünge's).
 *
 * The game only uses this interface:
 *   BloomAds.init()
 *   BloomAds.rewardedLeft()            -> rewarded ads left today
 *   BloomAds.showRewarded(placement)   -> Promise<boolean>  (true = reward earned)
 *   BloomAds.maybeInterstitial(ctx)    -> Promise<void>     (rare interstitial between levels)
 *   BloomAds.noAds() / purchaseRemoveAds()
 *
 * Placements: 'continue' (out of space → clear 3 rows), 'double' (2× seeds), 'booster' (+1 power-up).
 * Providers:
 *   - admob: in the Capacitor app when @capacitor-community/admob is present
 *   - mock : web/PWA build shows a "test ad" screen (no real ads)
 */
(() => {
  'use strict';

  const CONFIG = {
    rewardedDailyCap: 12,
    interstitial: {
      enabled: true,
      minPlaySeconds: 240, // no interstitials during the first 4 minutes of play
      everyNGames: 4, // then at most one every 4 levels
      minGapSeconds: 180,
    },
    admob: {
      // Google's official TEST ad units. Replace with real ids from the AdMob console before release.
      rewardedId: 'ca-app-pub-3940256099942544/5224354917',
      interstitialId: 'ca-app-pub-3940256099942544/1033173712',
      testing: true,
    },
  };

  const KEY = 'bb.ads.v1';
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
  const blank = () => ({ day: '', count: 0, noAds: false, games: 0, lastInter: 0, byPlacement: {} });
  const st = (() => {
    try { return Object.assign(blank(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { return blank(); }
  })();
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* private mode */ } };
  function rollDay() { if (st.day !== today()) { st.day = today(); st.count = 0; persist(); } }

  // ------------------------------------------------------------ AdMob (Capacitor)
  const admobPlugin = () => window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AdMob;
  const AdMobProvider = {
    name: 'admob',
    async init() {
      const AdMob = admobPlugin();
      await AdMob.initialize({ initializeForTesting: CONFIG.admob.testing });
      try {
        const info = await AdMob.requestConsentInfo();
        if (info.isConsentFormAvailable && info.status === 'REQUIRED') await AdMob.showConsentForm();
      } catch (e) { /* no consent form */ }
    },
    async rewarded() {
      const AdMob = admobPlugin();
      await AdMob.prepareRewardVideoAd({ adId: CONFIG.admob.rewardedId, isTesting: CONFIG.admob.testing });
      return !!(await AdMob.showRewardVideoAd());
    },
    async interstitial() {
      const AdMob = admobPlugin();
      await AdMob.prepareInterstitial({ adId: CONFIG.admob.interstitialId, isTesting: CONFIG.admob.testing });
      await AdMob.showInterstitial();
    },
    async purchaseRemoveAds() { return false; }, // hook up in-app purchase (e.g. RevenueCat) in the store build
  };

  // ------------------------------------------------------------ test ads (web)
  function overlay(html) {
    const el = document.createElement('div');
    el.className = 'ad-overlay';
    el.innerHTML = `<div class="ad-box">${html}</div>`;
    document.body.appendChild(el);
    return el;
  }
  const MockProvider = {
    name: 'mock',
    async init() {},
    rewarded() {
      return new Promise((resolve) => {
        let left = 5;
        const el = overlay(
          `<div class="ad-tag">TEST AD</div>
           <div class="ad-visual"><span>A rewarded video plays here</span></div>
           <div class="ad-count">Reward in <b class="adLeft">${left}</b> s</div>
           <div class="ad-actions">
             <button class="ad-btn ghost adClose">Close (no reward)</button>
             <button class="ad-btn adClaim" disabled>Claim reward</button>
           </div>`);
        const claim = el.querySelector('.adClaim');
        const timer = setInterval(() => {
          left--;
          const lbl = el.querySelector('.adLeft');
          if (lbl) lbl.textContent = Math.max(0, left);
          if (left <= 0) { clearInterval(timer); claim.disabled = false; el.querySelector('.ad-count').textContent = 'Ad finished'; }
        }, 1000);
        const done = (ok) => { clearInterval(timer); el.remove(); resolve(ok); };
        el.querySelector('.adClose').addEventListener('click', () => done(false));
        claim.addEventListener('click', () => done(true));
      });
    },
    interstitial() {
      return new Promise((resolve) => {
        const el = overlay(
          `<div class="ad-tag">TEST INTERSTITIAL</div>
           <div class="ad-visual"><span>An interstitial ad plays here</span></div>
           <div class="ad-actions"><button class="ad-btn adSkip" disabled>2</button></div>`);
        const b = el.querySelector('.adSkip');
        let left = 2;
        const timer = setInterval(() => {
          left--;
          if (left <= 0) { clearInterval(timer); b.disabled = false; b.textContent = 'Close ✕'; } else b.textContent = left;
        }, 1000);
        b.addEventListener('click', () => { clearInterval(timer); el.remove(); resolve(); });
      });
    },
    purchaseRemoveAds() {
      return new Promise((resolve) => {
        const el = overlay(
          `<div class="ad-tag">TEST PURCHASE</div>
           <p class="ad-text">The store build opens the real payment sheet here. You can confirm for free while testing.</p>
           <div class="ad-actions">
             <button class="ad-btn ghost buyNo">Cancel</button>
             <button class="ad-btn buyYes">Confirm</button>
           </div>`);
        el.querySelector('.buyNo').addEventListener('click', () => { el.remove(); resolve(false); });
        el.querySelector('.buyYes').addEventListener('click', () => { el.remove(); resolve(true); });
      });
    },
  };

  let provider = MockProvider;
  let busy = false;

  window.BloomAds = {
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
        if (ok) { st.count++; st.byPlacement[placement] = (st.byPlacement[placement] || 0) + 1; persist(); }
        return ok;
      } catch (e) {
        return false;
      } finally {
        busy = false;
      }
    },
    // ctx: { playSeconds: total play time this session }
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
      try { await provider.interstitial(); st.lastInter = now; persist(); } catch (e) { /* no fill */ } finally { busy = false; }
    },
    noAds() { return st.noAds; },
    async purchaseRemoveAds() {
      const ok = await provider.purchaseRemoveAds();
      if (ok) { st.noAds = true; persist(); }
      return ok;
    },
  };
})();
