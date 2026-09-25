/* ORBITAP — anonim oyun istatistikleri.
 *
 * Her tur bittiğinde tek bir kayıt Firestore'daki `runs` koleksiyonuna gider.
 * Oyuncu adı, oyuncu kimliği veya cihaz kimliği GÖNDERİLMEZ; sadece turun özeti.
 * Amaç: oyuncuların hangi yörüngede ve ne zaman zorlandığını görüp zorluğu ayarlamak.
 *
 * Oyun yalnızca şunu kullanır:
 *   YorungeStats.run(summary)   -> summary: sayısal/metin alanlardan oluşan düz nesne
 *
 * Rapor: `npm run stats`
 */
(() => {
  'use strict';

  const APP_VERSION = '1.1';
  const cfg = window.YORUNGE_CONFIG && window.YORUNGE_CONFIG.firebase;
  const enabled = !!(cfg && cfg.apiKey && cfg.projectId);
  const url = enabled
    ? `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/(default)/documents/runs?key=${encodeURIComponent(cfg.apiKey)}`
    : '';

  const platform = () => {
    const Cap = window.Capacitor;
    try { return Cap && Cap.getPlatform ? Cap.getPlatform() : 'web'; } catch (e) { return 'web'; }
  };

  // JS değerini Firestore REST alan biçimine çevir
  function field(v) {
    if (typeof v === 'boolean') return { booleanValue: v };
    if (typeof v === 'number') return { integerValue: String(Math.max(0, Math.round(v))) };
    return { stringValue: String(v).slice(0, 16) };
  }

  window.YorungeStats = {
    run(summary) {
      if (!enabled) return;
      const data = Object.assign({ v: APP_VERSION, plat: platform(), lang: (window.I18N && I18N.lang) || 'en' }, summary);
      const fields = {};
      for (const [k, v] of Object.entries(data)) fields[k] = field(v);
      fields.ts = { timestampValue: new Date().toISOString() };
      // Oyunu hiç bekletme; başarısız olursa sessizce vazgeç
      try {
        fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }), keepalive: true })
          .catch(() => {});
      } catch (e) { /* yok */ }
    },
  };
})();
