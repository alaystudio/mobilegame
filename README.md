# YÖRÜNGE

Tek dokunuşla oynanan, mobil için tasarlanmış bir arcade oyunu. Top çekirdeğin etrafında döner.
Ekrana dokununca iç ve dış yörünge arasında zıplar. Engellerden kaç, yıldız topla, rekorunu kır.

- **PERFECT:** Engele çarpmadan hemen önce kaçarsan kombo ve bonus puan kazanırsın.
- **Yıldızlar:** Yeni top skinleri açar.
- **Günlük seri ve görevler:** Her gün geri gelmen için bir sebep.
- **Günlük Meydan Okuma:** Herkes aynı engel dizisi ve aynı günlük kuralla oynar. Günde 1 hak, reklamla +1.
- **Sıralama:** Tüm zamanlar ve günlük meydan okuma tabloları.

Tasarım detayları: [`docs/TASARIM.md`](docs/TASARIM.md)

> Bu repoda ikinci bir oyun daha var: **[Drift Garden](balon-bahcesi/)** (Balon Bahçesi). Yetişkinler için sakin, odak dostu bir müzik ve balon oyunu. Tasarımı [`balon-bahcesi/TASARIM.md`](balon-bahcesi/TASARIM.md) dosyasında.
>
> Üçüncü oyun: **[Bloom Blast](bloom-blast/)**. Block Blast tarzı, sınırsız seviyeli bir blok bulmacası. Temizlediğin her satır tohum kazandırıyor, tohumlarla bahçeni inşa ediyorsun. Tasarımı [`bloom-blast/TASARIM.md`](bloom-blast/TASARIM.md) dosyasında.

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
Gerçek reklamlar yalnızca mağaza uygulamasında çalışır. Web sürümünde bunların yerine "test reklamı" ekranı çıkar.

```bash
npm init -y
npm i @capacitor/core @capacitor/cli @capacitor/android @capacitor-community/admob
npx cap init Yörünge com.alaystudio.yorunge --web-dir www
mkdir -p www && cp -r index.html style.css config.js ads.js leaderboard.js game.js manifest.webmanifest icons www/
npx cap add android
npx cap sync && npx cap open android
```

- `android/app/src/main/AndroidManifest.xml` dosyasına AdMob uygulama kimliğini ekle:
  `<meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="ca-app-pub-XXXX~YYYY"/>`
- `ads.js` içinde `CONFIG.admob` bölümüne gerçek reklam birimi ID'lerini yaz ve `testing: false` yap. O zamana kadar Google'ın test ID'leri kullanılıyor.
- `ads.js`, `Capacitor.Plugins.AdMob` bulunca otomatik olarak AdMob'a geçer. KVKK/GDPR onay formunu da (UMP) kendisi gösterir.
- "Geçiş reklamlarını kaldır" için mağaza satın alma entegrasyonu (ör. RevenueCat) `ads.js` içindeki `purchaseRemoveAds` fonksiyonuna bağlanacak.
