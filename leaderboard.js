/* YÖRÜNGE — liderlik tablosu.
 *
 * Oyun yalnızca bu arayüzü kullanır:
 *   YorungeBoard.init()                 -> sağlayıcıyı seçer
 *   YorungeBoard.online                 -> çevrimiçi mi?
 *   YorungeBoard.submit(board, entry)   -> entry: { pid, name, score }
 *   YorungeBoard.top(board, n)          -> Promise<[{ pid, name, score }]>
 *
 * board: 'all' (tüm zamanlar) veya 'daily-YYYY-MM-DD' (günlük meydan okuma)
 *
 * Sağlayıcılar (ilk çalışan seçilir):
 *   1. firebase : config.js içinde window.YORUNGE_CONFIG.firebase = { apiKey, projectId } varsa
 *                 (Firestore REST API; SDK gerekmez)
 *   2. artifact : claude.ai önizlemesinde paylaşılan veritabanı
 *   3. local    : sadece bu cihazdaki skorlar
 */
(() => {
  'use strict';

  const collectionFor = (board) => (board === 'all' ? 'scores_all' : `scores_${board.replace(/[^a-z0-9-]/gi, '')}`);

  // ------------------------------------------------------------ Firebase (Firestore REST)
  function FirebaseProvider(cfg) {
    const base = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/(default)/documents`;
    const key = `key=${encodeURIComponent(cfg.apiKey)}`;
    return {
      name: 'firebase',
      async submit(board, e) {
        const url = `${base}/${collectionFor(board)}/${encodeURIComponent(e.pid)}?${key}`;
        const body = { fields: {
          name: { stringValue: e.name },
          score: { integerValue: String(e.score) },
          ts: { timestampValue: new Date().toISOString() },
        } };
        const r = await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!r.ok) throw new Error('submit ' + r.status);
      },
      async top(board, n) {
        const r = await fetch(`${base}:runQuery?${key}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ structuredQuery: {
            from: [{ collectionId: collectionFor(board) }],
            orderBy: [{ field: { fieldPath: 'score' }, direction: 'DESCENDING' }],
            limit: n,
          } }),
        });
        if (!r.ok) throw new Error('top ' + r.status);
        const rows = await r.json();
        return rows.filter((x) => x.document).map((x) => ({
          pid: x.document.name.split('/').pop(),
          name: x.document.fields.name.stringValue,
          score: Number(x.document.fields.score.integerValue),
        }));
      },
    };
  }

  // ------------------------------------------------------------ claude.ai artifact veritabanı
  function ArtifactProvider(db) {
    return {
      name: 'artifact',
      async submit(board, e) {
        await db.collection(collectionFor(board)).doc(e.pid).set({ name: e.name, score: e.score, ts: Date.now() });
      },
      async top(board, n) {
        const snap = await db.collection(collectionFor(board)).orderBy('score', 'desc').limit(n).get();
        return snap.docs.map((d) => ({ pid: d.id, name: String(d.data().name || 'Oyuncu'), score: Number(d.data().score) || 0 }));
      },
    };
  }

  // ------------------------------------------------------------ yerel (çevrimdışı)
  const LOCAL_KEY = 'yorunge.board.v1';
  const LocalProvider = {
    name: 'local',
    load() { try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}'); } catch (e) { return {}; } },
    async submit(board, e) {
      const all = this.load();
      all[board] = all[board] || {};
      all[board][e.pid] = { name: e.name, score: e.score };
      try { localStorage.setItem(LOCAL_KEY, JSON.stringify(all)); } catch (err) { /* yok */ }
    },
    async top(board, n) {
      const b = this.load()[board] || {};
      return Object.entries(b).map(([pid, v]) => ({ pid, ...v })).sort((a, c) => c.score - a.score).slice(0, n);
    },
  };

  let provider = LocalProvider;
  let initP = null;

  window.YorungeBoard = {
    get online() { return provider.name !== 'local'; },
    get providerName() { return provider.name; },
    init() {
      if (initP) return initP;
      initP = (async () => {
        const cfg = window.YORUNGE_CONFIG && window.YORUNGE_CONFIG.firebase;
        if (cfg && cfg.apiKey && cfg.projectId) { provider = FirebaseProvider(cfg); return; }
        if (window.claude && typeof window.claude.use === 'function') {
          try {
            const db = await window.claude.use('db');
            if (db) provider = ArtifactProvider(db);
          } catch (e) { /* yerel kal */ }
        }
      })();
      return initP;
    },
    async submit(board, entry) {
      await this.init();
      try { await provider.submit(board, entry); return true; }
      catch (e) { await LocalProvider.submit(board, entry); return false; }
    },
    async top(board, n = 50) {
      await this.init();
      try { return await provider.top(board, n); }
      catch (e) { return LocalProvider.top(board, n); }
    },
  };
})();
