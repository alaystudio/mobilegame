# Orbitap (eski adı Yörünge) — Claude için proje notları

Kullanıcıyla **Türkçe** konuş. Kod yorumları ve dokümanlar Türkçe.

## Dallar — önce buna bak
- **`claude/store-release`** → **asıl geliştirme hattı.** Oyunun mağaza sürümü: yeni ad **Orbitap**, EN/TR arayüz (`i18n.js`),
  Capacitor ile Android/iOS projeleri, gerçek AdMob birimleri, Firebase (proje `orbitap-game`: çevrimiçi sıralama + anonim tur
  istatistikleri `analytics.js`), gizlilik politikası, mağaza metinleri ve görselleri (`docs/MAGAZA.md`, `store/`),
  GitHub Actions ile Mac'siz TestFlight yüklemesi (`.github/workflows/ios-testflight.yml`), imzalı AAB (`npm run aab`).
  Yeni işler bu dala yapılır.
- `claude/mobile-game-analysis-design-z6zmf1` → ilk tasarım/geliştirme dalı (repo'nun varsayılan dalı). Web/PWA sürümü;
  Drift Garden ve Bloom Blast buradan kendi repolarına taşındı.
- `main`, `gh-pages` → yayın için.

## Oyun
Tek dokunuşla oynanan hyper-casual arcade. Top çekirdeğin etrafında döner; dokununca halkalar arasında zıplar
(3+ halkada gel-git: iç → orta → dış → orta → iç). Engellerden kaç, yıldız topla; PERFECT kaçışlar kombo verir.
Güçler (kalkan, mıknatıs, ağır çekim, çift puan), top skinleri, günlük seri ve görevler, **Günlük Meydan Okuma**
(herkes aynı parkur, günde 1 hak + reklamla 1) ve liderlik tabloları.
Kullanıcı başta oyunu "çok çabuk hızlanıyor, çabuk yanıyorum" diye kolaylaştırdı; zorlukla oynarken dikkatli ol,
kararları gerçek oyuncu verisiyle (`npm run stats`) ver.
Tasarım: **`docs/TASARIM.md`**, mağaza paketi: `docs/MAGAZA.md` (store-release dalında), kullanım: `README.md`.

## Yapı
Oyun saf HTML5 Canvas + vanilla JS (kütüphane yok). Mağaza sürümü bunu Capacitor ile paketler (`webDir: www`,
`npm run build` → `scripts/build-www.mjs`).

| Dosya | İçerik |
|---|---|
| `game.js` | Oyun motoru: fizik, desen üretimi, çizim, ses, kayıt, meydan okuma |
| `ads.js` | Reklam altyapısı (web'de test reklamı, uygulamada AdMob); ayarlar `CONFIG` içinde |
| `leaderboard.js`, `config.js` | Firebase/Firestore sıralama (config boşsa yerel) |
| `analytics.js` | (store-release) anonim tur özeti → Firestore `runs`; kişisel kimlik göndermez |
| `native.js`, `capacitor.config.json`, `android/`, `ios/` | (store-release) Capacitor/yerel katman |
| `sw.js` | PWA önbelleği; **her yayında `CACHE` sürümünü artır** |

- Kayıt: `localStorage['yorunge.save.v1']`; reklam durumu `yorunge.ads.v1` (anahtarlar isim değişikliğinden önce konmuştu, değiştirme — oyuncu ilerlemesi kaybolur).
- Gelir modeli kararı: ana oyun sınırsız ve ücretsiz, **hak/enerji sistemi yok** (hak yalnızca günlük meydan okumada).
  Ödüllü reklamlar isteğe bağlı (günde en fazla 10); geçiş reklamı ilk 3 dk yok, sonra en fazla 4 oyunda bir.
  "Geçiş reklamlarını kaldır" satın alması var.

## Çalıştırma
```bash
python3 -m http.server 8000          # web sürümü → http://localhost:8000
npm install && npm run serve         # (store-release) 8123 portunda
npm run android / npm run ios        # (store-release) Capacitor projelerini açar
npm run stats                        # (store-release) oyuncu istatistikleri raporu
```

## Kardeş repolar
Aynı hesapta, bu repodan ayrılan diğer oyunlar (private): `alaystudio/bloom-blast` (blok bulmacası + bahçe),
`alaystudio/drift-garden` (sakin müzik/balon oyunu). Her birinin kendi `CLAUDE.md`'si var.
