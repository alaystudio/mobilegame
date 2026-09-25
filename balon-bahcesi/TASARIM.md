# DRIFT GARDEN (Balon Bahçesi) — Oyun Tasarım Dokümanı

## Özet
Yetişkinler için sakin, odak dostu bir müzik oyunu. Alacakaranlıkta parlayan balonlar yavaşça yükselir. **Her balon doğduğu anda şarkının bir sonraki notasını taşır**; balonları yükseliş sırasıyla patlatırsan melodi doğru çalar. Tamamlanan her şarkı gece bahçesinde parlayan bir çiçek açtırır.

- Hedef kitle: Rahatlamak isteyen yetişkinler, özellikle DEHB'li bireyler
- Arayüz dili: İngilizce (Türkçe `i18n.js`'e eklenecek)
- Tur: Bir şarkı, yaklaşık 1–2 dakika

## Görsel yön
- Alacakaranlık gökyüzü, yıldızlar, ay, sisli tepeler. Emoji yok, her şey kodla çiziliyor.
- Balonlar ışık saçan nesneler: cam küre, sabun köpüğü, sis, dilek feneri, ay denizanası.
- Serif başlıklar (Iowan/Palatino/Georgia), sade ikonlar, koyu cam paneller.

## Çekirdek mekanik: sıralı melodi
| Durum | Ne olur |
|---|---|
| Balon doğar | Şarkının sıradaki notasını alır (1, 2, 3...) |
| Sıradaki balona dokunma | Patlar, doğru nota çalar, ilerleme artar |
| Başka balona dokunma | Patlamaz, hafifçe sallanır, yumuşak tahta "tık" sesi çıkar. Sıradaki balon kısa bir parlama ile kendini gösterir. **Ceza yok.** |
| Oyuncu bekler | Sıradaki balon ekranın üstünde **bekler**, diğerleri altında sıraya girer. Hiçbir nota kaçmaz. |
| Melodi rehberi (ayar) | Sıradaki balonun etrafında soluk bir halka |
| "Any balloon" modu (ayar) | Eski davranış: hangi balona dokunursan dokun sıradaki nota çalar |

Her şarkının altında, şarkının tonunda kısık bir **drone** (kök + beşli) çalar. Tek notalar bile dolu duyulur.

**Tempo çubuğu:** Oyun ekranında Slow ↔ Fast (0.5×–1.8×). Balonların yükselme ve doğma hızını belirler, seçim kaydedilir.

## Tasarım ilkeleri
- Kaybetmek, süre, seri cezası, gerçek zamanlı bekleme yok.
- Her şarkının doğal bir sonu var ("zaman körlüğüne" karşı).
- Sakin hareket ayarı (işletim sistemindeki "hareketi azalt" ayarına uyar), mola hatırlatıcısı.
- Tedavi iddiası yok.

## İlerleme
- Ödül: nota sayısı ÷ 5 yıldız (✦), ilk tamamlamada +10.
- Her şarkıda bir çiçek, en fazla 30. Bir sonraki çiçeğin yerinde soluk bir fide bekler.
- **Balonlar = enstrümanlar:** Cam Küre/Piyano (ücretsiz), Sabun Köpüğü/Müzik kutusu 25, Sis/Sıcak synth 40, Dilek Feneri/Marimba 60, Ay Denizanası/Arp 80.
- **Bahçe:** Ateşböcekleri 15, Söğüt 30, Cırcırböcekleri 35 🔊, Dere 45 🔊, Rüzgâr Çanı 50 🔊, Ay Göleti 60, Taş Fenerler 75, Kutup Işığı 100. 🔊 işaretliler bahçeye ses de ekler.

## Şarkılar (25)
Ücretsiz: Ode to Joy, Amazing Grace, Scarborough Fair.
Yıldızla (15–60 ✦): Evening Waltz, Paper Lanterns, Morning Mood, Minuet in G, Silent Night, Rain on Glass, Going Home, Low Tide, Greensleeves, Prelude in C, Eine kleine Nachtmusik, Für Elise, Canon, First Snow, Brahms' Lullaby, Auld Lang Syne, Jesu Joy of Man's Desiring, Moonlight Sonata, Night Train, Rondo alla Turca, The Blue Danube, In the Hall of the Mountain King.
Özgün besteler: Evening Waltz, Paper Lanterns, Rain on Glass, Low Tide, First Snow, Night Train.

**Şarkı açma akışı:**
- Şarkı bitince açılmamış en ucuz şarkı gösterilir. Yıldız yetiyorsa "Unlock & play" butonu çıkar. Yetmiyorsa "Evening Waltz: 8 of 15 stars" ve bir ilerleme çubuğu görünür.
- Sahip olunan tüm şarkılar en az bir kez çalınmışsa ve yıldız yetiyorsa ana ekranda "New song ready" kartı çıkar.
Hepsi kamu malı ya da özgün. Melodiler kulakla kontrol edilmeli; yanlış nota varsa `songs.js`'te düzeltilir.

## Sonraki adımlar
- Türkçe arayüz (`i18n.js`'e `tr` bloğu) ve ayarlara dil seçimi
- Nefes arası, serbest doğaçlama modu
- Şarkılarda ritim bilgisi (balonların doğuş aralığı melodiye göre)
