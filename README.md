# ORBITAP

Tek dokunuşla oynanan, mobil için tasarlanmış bir arcade oyunu. Top çekirdeğin etrafında döner.
Ekrana dokununca iç ve dış yörünge arasında zıplar. Engellerden kaç, yıldız topla, rekorunu kır.

- **PERFECT:** Engele çarpmadan hemen önce kaçarsan kombo ve bonus puan kazanırsın.
- **Yıldızlar:** Yeni top skinleri açar.
- **Günlük seri ve görevler:** Her gün geri gelmen için bir sebep.
- **Günlük Meydan Okuma:** Herkes aynı engel dizisi ve aynı günlük kuralla oynar. Günde 1 hak, reklamla +1.
- **Sıralama:** Tüm zamanlar ve günlük meydan okuma tabloları.

Tasarım detayları: [`docs/TASARIM.md`](docs/TASARIM.md)

## Çalıştırma
Kurulum gerekmez, saf HTML/JS'dir. Service worker için bir sunucu üzerinden aç:

```bash
python3 -m http.server 8000
# veya
npx serve .
```

Tarayıcıda `http://localhost:8000` adresini aç.

**Telefonda denemek için:** Bilgisayarla aynı Wi-Fi'da `http://<bilgisayar-ip>:8000` adresini aç.
Ya da GitHub Pages'e yayınla (aşağıda).

## GitHub Pages ile yayınlama
1. Repo **Settings → Pages → Source** ayarını **GitHub Actions** yap.
2. `main` dalına push et. `.github/workflows/pages.yml` oyunu otomatik yayınlar.
3. Telefonda linki aç → tarayıcı menüsü → **Ana ekrana ekle**. Oyun tam ekran, uygulama gibi açılır ve çevrimdışı da çalışır.

## Dosyalar
| Dosya | Açıklama |
|---|---|
| `index.html` | Ekranlar (menü, oyun sonu, devam, hediye, sıralama, güçler, toplar, görevler) |
| `style.css` | Arayüz stilleri |
| `game.js` | Oyun motoru: fizik, desen üretimi, çizim, ses, kayıt, meydan okuma |
| `ads.js` | Reklam altyapısı (web'de test reklamı, uygulamada AdMob) |
| `leaderboard.js` | Liderlik tablosu (Firebase / yerel) |
| `config.js` | Yayın ayarları (Firebase anahtarları) |
| `sw.js` | Çevrimdışı önbellek (her yayında `CACHE` sürümünü artır) |
| `manifest.webmanifest`, `icons/` | PWA kurulum bilgileri |

## Kontroller
- Mobil: ekrana dokun
- Masaüstü: `Boşluk` / `↑` / `↓`

## Gelir modeli
- **Ana oyun sınırsız ve ücretsiz.** Hak/enerji sistemi yok.
- **Ödüllü reklamlar** (hepsi isteğe bağlı, günde en fazla 10):
  - Devam et: turda 1 kez 30 ★ ile, 1 kez reklamla
  - Oyun sonunda yıldızları 2 katına çıkar
  - Günlük seri ödülünü 2 katına çıkar
  - Güçlü başla: sonraki tura kalkan + mıknatısla başla
  - Günlük meydan okumada +1 hak
- **Geçiş reklamı:** İlk 3 dakika hiç yok. Sonra en fazla 4 oyunda bir ve en az 2.5 dakika arayla. "Geçiş reklamlarını kaldır" satın alımıyla tamamen kapanır.

Ayarların hepsi `ads.js` içindeki `CONFIG` nesnesinde.

## Liderlik tablosu (Firebase) kurulumu
`config.js` boşken skorlar sadece cihazda tutulur. Çevrimiçi sıralama için:

1. [Firebase konsolunda](https://console.firebase.google.com) proje oluştur. **Firestore Database**'i aç (production mode).
2. Projeye bir **Web uygulaması** ekle. `apiKey` ve `projectId` değerlerini `config.js`'e yaz. Bu anahtarlar gizli değildir, güvenliği aşağıdaki kurallar sağlar.
3. Firestore **Rules** sekmesine şunu yapıştır:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{db}/documents {
       match /{col}/{pid} {
         allow read: if col.matches('scores_.*');
         allow write: if col.matches('scores_.*')
           && request.resource.data.keys().hasOnly(['name', 'score', 'ts'])
           && request.resource.data.name is string
           && request.resource.data.name.size() <= 14
           && request.resource.data.score is int
           && request.resource.data.score >= 0
           && request.resource.data.score < 100000;
       }
     }
   }
   ```
4. Hepsi bu kadar. `scores_all` (tüm zamanlar) ve `scores_daily-YYYY-MM-DD` koleksiyonları otomatik oluşur.

**Maliyet:** Ücretsiz Spark planında günde 50.000 okuma ve 20.000 yazma hakkı var. Sıralama ekranı her açılışta en fazla 50 okuma yapar, yani günde yaklaşık 1.000 açılış bedava.

**Hile notu:** İstemci taraflı oyunlarda skor sahteciliği tamamen engellenemez. Oyun büyürse Firebase Anonymous Auth + App Check eklenmeli.

## Mağaza sürümü (Capacitor + AdMob)
Android ve iOS projeleri `android/` ve `ios/` klasörlerinde hazır (Capacitor 8). Mağaza metinleri, form cevapları ve yayın kontrol listesi: [`docs/MAGAZA.md`](docs/MAGAZA.md).

```bash
npm install
npm run android     # www/ oluşturur, eşitler, Android Studio'yu açar
npm run ios         # www/ oluşturur, eşitler, Xcode'u açar (Mac gerekir)
```

- Web dosyalarını değiştirdikten sonra `npm run sync` çalıştır; `www/` klasörü her seferinde yeniden oluşur, elle düzenleme.
- **Android derleme:** Android Studio (JDK 21 dahil gelir) → *Build → Generate Signed App Bundle*. İmza anahtarını (`.jks`) repoya koyma; `.gitignore` bunu engelliyor.
- **iOS derleme:** Xcode → *Signing & Capabilities* bölümünde ekibini seç → *Product → Archive* → TestFlight'a yükle. Paketler Swift Package Manager ile gelir, CocoaPods gerekmez.
- **Sürüm artırma:** `android/app/build.gradle` içinde `versionCode`/`versionName`, Xcode'da `MARKETING_VERSION`/`CURRENT_PROJECT_VERSION`.

**Reklamlar:** `ads.js`, uygulamada `Capacitor.Plugins.AdMob`'u bulunca otomatik olarak gerçek AdMob'a geçer. Sırasıyla GDPR onay formunu (UMP) ve iOS'ta ATT iznini gösterir, sonra reklamları önceden yükler. Şu an bütün kimlikler Google'ın **test** kimlikleri. Gerçek kimliklerin girileceği yerler `docs/MAGAZA.md` kontrol listesinde.

**1.0 için kapalı olanlar:** Geçiş reklamı (`CONFIG.interstitial.enabled`) ve "Reklamları kaldır" satın alımı (`CONFIG.removeAdsEnabled`). Satın alma, uygulama içi ödeme entegrasyonu (ör. RevenueCat) bağlanınca `ads.js` içindeki `purchaseRemoveAds` fonksiyonuna eklenecek.

**Diller (`i18n.js`):** İngilizce ve Türkçe. Cihaz dili Türkçeyse Türkçe, değilse İngilizce açılır. Yeni dil için `STRINGS` içine aynı anahtarlarla bir sözlük ekle. HTML'deki sabit metinler `data-i18n` öznitelikleriyle çevrilir.

**Yerel davranışlar (`native.js`):** iOS dahil gerçek titreşim (Haptics), gizli durum çubuğu, açılış ekranı, Android geri tuşu. Service worker sadece web sürümünde çalışır.

**Görseller:** `npm run assets` ikon ve açılış ekranlarını, `npm run screenshots` mağaza ekran görüntülerini (`store/`) yeniden üretir. İkisi de sistemdeki Edge/Chrome'u kullanır.
