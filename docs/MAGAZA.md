# Orbitap: Mağaza Yayın Paketi

Bu doküman App Store Connect ve Google Play Console'a girilecek bütün metinleri, form cevaplarını ve görselleri tek yerde toplar. Parantez içindeki sayılar karakter sınırıdır.

- Paket adı / Bundle ID: `com.alaystudio.orbitap`
- Sürüm: 1.0 (derleme 1)
- Diller: İngilizce (varsayılan) ve Türkçe. Oyun cihaz diline göre açılır.
- Kategori: Oyunlar → Arcade (Play) / Games → Arcade + Casual (App Store)
- Gizlilik politikası: `https://alaystudio.github.io/mobilegame/privacy.html` (GitHub Pages açıldıktan sonra)

## Görseller

| Dosya | Nereye |
|---|---|
| `store/appstore-icon-1024.png` | App Store Connect ikonu (Xcode'daki AppIcon zaten aynı görsel) |
| `store/play-icon-512.png` | Play Console → Ana mağaza girişi → Uygulama simgesi |
| `store/play-feature-en.png` | Play Console → Öne çıkan grafik (İngilizce, varsayılan) |
| `store/play-feature-tr.png` | Play Console → Öne çıkan grafik (Türkçe çeviri) |
| `store/screenshots/tr/ios69-1..5.png` | App Store → iPhone 6.9" ekran görüntüleri (Türkçe) |
| `store/screenshots/en/ios69-1..5.png` | App Store → iPhone 6.9" (İngilizce) |
| `store/screenshots/tr/play-1..5.png` | Play Console → Telefon ekran görüntüleri (Türkçe) |
| `store/screenshots/en/play-1..5.png` | Play Console → Telefon ekran görüntüleri (İngilizce) |

Görselleri yeniden üretmek için: `npm run assets` ve `npm run screenshots`.

Varsayılan dil olarak **İngilizce (en-US)** seç, **Türkçe (tr-TR)** listelemeyi çeviri olarak ekle. Her dilin ekran görüntülerinde oyun o dilde görünüyor.

---

## İngilizce listeleme (varsayılan)

**App name** (30): `Orbitap: One Tap Orbit`

**App Store subtitle** (30): `Dodge, collect, beat your best`

**Play short description** (80): `Switch orbits with one tap, dodge obstacles, collect stars and beat your record!`

**App Store promotional text** (170): `A new challenge every day! Everyone races the same obstacle course. Climb to the top of today's leaderboard.`

**Description**
```
The ball spins around the core. Tap to switch orbits. Dodge at the very last moment and score a PERFECT!

Orbitap is a one-tap arcade game that gets deeper the better you get. Every run starts in seconds, and it's hard to stop at just one more.

HOW TO PLAY
• Tap the screen to jump between the inner and outer orbit
• Avoid obstacles, collect stars
• Dodge right before an obstacle to score PERFECT and build combos

NEW ORBITS
• A third and then a fourth orbit unlock as your score climbs
• Orbits start to breathe and the rhythm changes
• Gates, ladders and shape-shifting obstacles

POWER-UPS
• Shield: fills as you collect stars and forgives one hit
• Magnet: pulls stars toward you
• Slow Motion and Double Points
• Upgrade your powers and unlock new balls with stars

A REASON TO COME BACK EVERY DAY
• Daily Challenge: everyone plays the same course
• Leaderboards: all-time and today's best
• Daily missions and streak rewards

Ads are optional: watch one only when you want an extra reward. Plays offline too.
```

**Keywords** (100): `orbit,arcade,reflex,one tap,space,ball,timing,high score,daily challenge,stars,hyper casual`

---

## Türkçe listeleme

**Uygulama adı** (App Store 30 / Play 30)
`Orbitap: Tek Dokunuş`

**App Store alt başlık** (30)
`Kaç, topla, rekorunu kır`

**Play kısa açıklama** (80)
`Tek dokunuşla yörünge değiştir, engellerden kaç, yıldız topla, rekorunu kır!`

**App Store tanıtım metni** (170)
`Her gün yeni bir meydan okuma! Herkes aynı engel dizisiyle yarışıyor. Bugünün sıralamasında zirveye çık.`

**Açıklama** (4000)
```
Top çekirdeğin etrafında dönüyor. Ekrana dokun, yörünge değiştir. Engele çarpmadan son anda kaç ve PERFECT yakala!

Orbitap, tek dokunuşla oynanan ama ustalaştıkça derinleşen bir arcade oyunu. Her tur birkaç saniyede başlar, "bir tur daha" demeden bırakamazsın.

NASIL OYNANIR
• Ekrana dokun: top iç ve dış yörünge arasında zıplar
• Engellere çarpma, yıldızları topla
• Engele çok yakınken kaçarsan PERFECT alırsın, kombo yaparsın

YENİ YÖRÜNGELER
• Skor arttıkça üçüncü, sonra dördüncü yörünge açılır
• Halkalar nefes almaya başlar, ritim değişir
• Kapılar, merdivenler, yön değiştiren engeller

GÜÇLER
• Kalkan: yıldız topladıkça dolar, bir çarpmayı affeder
• Mıknatıs: yıldızları kendine çeker
• Yavaş Çekim ve Çift Puan
• Yıldızlarınla güçlerini geliştir, yeni toplar aç

HER GÜN YENİ BİR SEBEP
• Günlük Meydan Okuma: herkes aynı engel dizisiyle yarışır
• Sıralama: tüm zamanlar ve günün en iyileri
• Günlük görevler ve seri ödülleri

Reklamlar isteğe bağlıdır: sadece ekstra ödül istediğinde izlersin. Oyun internetsiz de oynanır.
```

**App Store anahtar kelimeler** (100, virgülle ve boşluksuz)
`yörünge,arcade,refleks,tek dokunuş,uzay,top,zamanlama,rekor,meydan okuma,yıldız,hyper casual`

---

## Google Play Console formları

**Uygulama içeriği → Reklamlar:** Evet, reklam içeriyor.

**Hedef kitle ve içerik:** 13-15, 16-17, 18+ seç. 13 yaş altını seçme; seçersen Aile Politikası ve ek reklam kısıtlamaları devreye girer. "Uygulama çocukların ilgisini çekebilir mi?" → Hayır.

**İçerik derecelendirme (IARC):** Kategori "Oyun". Şiddet, cinsellik, küfür, uyuşturucu yok. Kumar ve gerçek parayla ödül yok. Kullanıcılar arası iletişim yok. Sadece oyuncu adı paylaşılıyor, sohbet yok. Beklenen sonuç: PEGI 3 / Herkes.

**Veri güvenliği**

| Veri türü | Toplanıyor | Paylaşılıyor | Amaç | İsteğe bağlı mı |
|---|---|---|---|---|
| Cihaz veya diğer kimlikler (reklam kimliği) | Evet | Evet (Google AdMob) | Reklam, analiz, dolandırıcılık önleme | Hayır |
| Uygulama etkinliği → Uygulama etkileşimleri | Evet | Evet (AdMob) | Reklam | Hayır |
| Uygulama etkinliği → Diğer kullanıcı içeriği (oyuncu adı, skor) | Evet | Hayır | Uygulama işlevleri (sıralama) | Hayır |
| Konum → Yaklaşık konum (IP'den, AdMob) | Evet | Evet | Reklam, dolandırıcılık önleme | Hayır |
| Uygulama bilgileri ve performansı → Kilitlenme günlükleri, tanılama (AdMob SDK) | Evet | Evet | Analiz | Hayır |

- Veriler aktarım sırasında şifreleniyor mu? → Evet (HTTPS).
- Kullanıcı veri silme isteyebilir mi? → Evet (gizlilik politikasındaki e-posta ile).
- Hesap oluşturma: Yok.

**Reklam kimliği beyanı:** "Uygulamanız reklam kimliğini kullanıyor mu?" → Evet, reklam amaçlı. AdMob eklentisi `AD_ID` iznini manifeste otomatik ekler.

**Hedef API:** `targetSdkVersion = 36` (`android/variables.gradle`).

**Kapalı test:** Hesap Kasım 2023'ten sonra açılmış kişisel bir hesapsa, üretime çıkmadan önce 12 test kullanıcısıyla 14 günlük kapalı test gerekir.

---

## App Store Connect formları

**App Privacy (Uygulama Gizliliği)**

| Veri türü | Kullanım | Kullanıcıya bağlı | İzleme için |
|---|---|---|---|
| Tanımlayıcılar → Cihaz kimliği (IDFA) | Üçüncü taraf reklamı, analiz | Hayır | Evet |
| Konum → Kaba konum | Üçüncü taraf reklamı | Hayır | Evet |
| Kullanım verileri → Ürün etkileşimi, reklam verileri | Üçüncü taraf reklamı, analiz | Hayır | Evet |
| Tanılama → Kilitlenme / performans verileri | Analiz | Hayır | Hayır |
| Kullanıcı içeriği → Diğer kullanıcı içeriği (oyuncu adı) | Uygulama işlevselliği | Hayır | Hayır |
| Kullanıcı içeriği → Oyun içeriği (skor) | Uygulama işlevselliği | Hayır | Hayır |

**Yaş derecelendirmesi:** Tüm sorulara "Yok". Beklenen sonuç: 4+. Reklam içerdiği için yine de 4+ kalır. Kullanıcı tarafından üretilen içerik yok (oyuncu adı serbest metin ama sohbet yok); Apple sorarsa "sıralamada sadece takma ad gösteriliyor" diye açıkla.

**Şifreleme:** `ITSAppUsesNonExemptEncryption = false` Info.plist'e eklendi, yüklemede soru sorulmaz.

**Cihaz:** Sadece iPhone (`TARGETED_DEVICE_FAMILY = 1`). iPad ekran görüntüsü gerekmez.

**İnceleme notu (App Review Information → Notes)**
```
No account or login is required. All ads are optional rewarded ads that the player chooses to watch (continue a run, double stars, daily bonus, power start, extra daily challenge attempt). There are no in-app purchases in this version. The game works offline; the leaderboard needs an internet connection.
```

---

## Yayından önce kontrol listesi

**Kodda değişecekler** (hepsi test değerleriyle çalışıyor, gerçek değerler senden gelecek)
- [ ] `ads.js` → `CONFIG.admob.android` ve `CONFIG.admob.ios` içine gerçek ödüllü reklam birimi ID'leri, `testing: false`
- [ ] `android/app/src/main/AndroidManifest.xml` → `com.google.android.gms.ads.APPLICATION_ID` gerçek Android uygulama kimliği
- [ ] `ios/App/App/Info.plist` → `GADApplicationIdentifier` gerçek iOS uygulama kimliği
- [ ] `ios/App/App/Info.plist` → `SKAdNetworkItems` listesini Google'ın güncel listesiyle tamamla
- [ ] `config.js` → Firebase `apiKey` ve `projectId`
- [ ] `privacy.html` → iletişim e-postası (`destek@ALAN-ADINIZ` ve `support@YOUR-DOMAIN`)
- [ ] `app-ads.txt` → AdMob yayıncı kimliği; dosyayı geliştirici web sitesinin **kök** alan adında yayınla

**Panellerde**
- [ ] AdMob: iki uygulama + ödüllü reklam birimleri, GDPR mesajı ve IDFA açıklama mesajı yayında
- [ ] Firebase: Firestore açık, README'deki güvenlik kuralları yapıştırıldı
- [ ] Play Console: iç test → (gerekirse) kapalı test → üretim
- [ ] App Store Connect: TestFlight → incelemeye gönder

**Gerçek cihazda test**
- [ ] İlk açılışta AB onay formu ve (iOS) ATT izni çıkıyor
- [ ] Ödüllü reklam: izleyip kapatınca ödül geliyor, erken kapatınca gelmiyor ve oyun takılmıyor
- [ ] Titreşim iOS ve Android'de çalışıyor
- [ ] Android geri tuşu: panel kapatır, oyunu duraklatır, menüde uygulamadan çıkar
- [ ] Çentikli ekranlarda üst çubuk ve alt kalkan göstergesi kesilmiyor
- [ ] Uçak modunda oyun açılıyor ve oynanıyor
