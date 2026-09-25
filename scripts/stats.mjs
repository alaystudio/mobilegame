// Anonim tur istatistiklerinden zorluk raporu üretir.
// Kullanım: npm run stats            (tüm sürümler)
//           npm run stats -- 1.1     (sadece 1.1 sürümü)
import { readFileSync } from 'node:fs';

async function main() {
const cfgSrc = readFileSync('config.js', 'utf8');
const apiKey = /apiKey:\s*'([^']+)'/.exec(cfgSrc)?.[1];
const projectId = /projectId:\s*'([^']+)'/.exec(cfgSrc)?.[1];
if (!apiKey || !projectId) { console.error('config.js içinde Firebase ayarı yok.'); process.exitCode = 1; return; }
const onlyVersion = process.argv[2];

const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/runs`;
const val = (f) => (f.integerValue !== undefined ? Number(f.integerValue) : f.booleanValue ?? f.stringValue ?? f.timestampValue);

const runs = [];
let token = '';
do {
  const r = await fetch(`${base}?pageSize=300&key=${apiKey}${token ? `&pageToken=${token}` : ''}`);
  if (!r.ok) { console.error('Okuma hatası', r.status, await r.text()); process.exitCode = 1; return; }
  const j = await r.json();
  for (const d of j.documents || []) {
    const o = {};
    for (const [k, f] of Object.entries(d.fields)) o[k] = val(f);
    runs.push(o);
  }
  token = j.nextPageToken || '';
} while (token);

const all = runs.filter((r) => !onlyVersion || r.v === onlyVersion);
if (!all.length) { console.log('Henüz kayıt yok.'); return; }

const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : '-');
const normal = all.filter((r) => !r.ch);
const fromStart = normal.filter((r) => (r.start || 2) === 2);

console.log(`\nORBITAP zorluk raporu${onlyVersion ? ` (sürüm ${onlyVersion})` : ''}`);
console.log(`Toplam tur: ${all.length} (normal ${normal.length}, meydan okuma ${all.length - normal.length})`);
console.log(`Platform: ${Object.entries(all.reduce((m, r) => ((m[r.plat] = (m[r.plat] || 0) + 1), m), {})).map(([k, v]) => `${k} ${v}`).join(', ')}`);
console.log(`İlk tarih: ${all.map((r) => r.ts).sort()[0]?.slice(0, 10)}  Son: ${all.map((r) => r.ts).sort().at(-1)?.slice(0, 10)}`);

console.log('\n1) Baştan başlanan normal turlar');
console.log(`   Medyan süre: ${median(fromStart.map((r) => r.t))} sn   Medyan skor: ${median(fromStart.map((r) => r.score))}`);
console.log(`   3. yörüngeye ulaşan: ${pct(fromStart.filter((r) => r.rings >= 3).length, fromStart.length)}`);
console.log(`   4. yörüngeye ulaşan: ${pct(fromStart.filter((r) => r.rings >= 4).length, fromStart.length)}`);

console.log('\n2) Ölümler: hangi yörüngede ve o evreye girdikten kaç saniye sonra');
const buckets = [[0, 5], [5, 15], [15, 30], [30, 60], [60, Infinity]];
console.log('   yörünge | tur  | medyan evre süresi | 0-5s  5-15s 15-30s 30-60s 60s+');
for (const n of [2, 3, 4]) {
  const d = normal.filter((r) => r.dring === n);
  if (!d.length) continue;
  const b = buckets.map(([lo, hi]) => pct(d.filter((r) => r.pt >= lo && r.pt < hi).length, d.length).padStart(5));
  console.log(`   ${n}       | ${String(d.length).padEnd(4)} | ${String(median(d.map((r) => r.pt))).padStart(4)} sn            | ${b.join(' ')}`);
}

console.log('\n3) Kontrol modu karşılaştırması (baştan başlanan turlar)');
for (const c of ['tap', 'zones']) {
  const d = fromStart.filter((r) => r.ctrl === c);
  if (!d.length) continue;
  const in3 = d.filter((r) => r.rings >= 3);
  console.log(`   ${c.padEnd(5)}: ${d.length} tur, medyan ${median(d.map((r) => r.t))} sn, 3. yörüngeye ${pct(in3.length, d.length)}, 4.'ye ${pct(d.filter((r) => r.rings >= 4).length, d.length)}, 3. yörüngede medyan hayatta kalma ${median(d.filter((r) => r.dring === 3).map((r) => r.pt))} sn`);
}

const skips = normal.filter((r) => (r.start || 2) >= 3);
console.log(`\n4) Kaldığın yerden başlanan tur: ${skips.length} (${pct(skips.length, normal.length)})`);
console.log(`   Devam (revive) kullanılan tur: ${pct(normal.filter((r) => r.rev > 0).length, normal.length)}\n`);
}

main();
