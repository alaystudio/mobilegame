# YÖRÜNGE — Oyun Tasarım Dokümanı

## Özet
Merkezdeki çekirdeğin etrafında dönen bir top. Ekrana **tek dokunuş** topu iç ve dış
yörünge arasında zıplatır. Engellerden kaç, yıldız topla, olabildiğince uzun hayatta kal.

- Tür: Hyper-casual / arcade, tek dokunuş
- Tur süresi: 30–120 sn
- Platform: Mobil tarayıcı (PWA, ana ekrana eklenebilir, çevrimdışı çalışır)

## Temel döngü
```
Dokun → Oyna (30-120 sn) → Öl → Skor / "Rekora 3 kaldı!" → Anında TEKRAR
            ↑                                                    |
            └──── Yıldız → Top skinleri, Günlük görev, Seri ─────┘
```

## Mekanikler
| Mekanik | Açıklama |
|---|---|
| Yörünge değiştirme | Dokununca top ~0.11 sn'de bir sonraki halkaya geçer. |
| Gel-git kontrolü | 3+ halkada top bir yönde ilerler, en iç/en dış halkada yön döner (iç → orta → dış → orta → iç). Topun yanındaki ok bir sonraki adımı gösterir. Tek dokunuş korunur, oyuncu önceden plan yapar. |
| Engeller | Halkalar üzerinde sabit neon yaylar. Temas = ölüm. |
| PERFECT | Engele çarpmadan hemen önce (≤0.15 sn) kaçarsan PERFECT. Kombo artar, +1+kombo puan. |
| Kombo | Her PERFECT 2.5 sn'lik kombo süresini yeniler. Süre bitince sıfırlanır (çekirdeğin etrafında sayaç yayı). |
| Yıldız ★ | Toplanabilir para birimi. Çoğunlukla güvenli şeritte durur, doğru hamleyi ödüllendirir. |
| Hız | Açısal hız 2.0 rad/sn'den başlar, geçilen engel başına artar (üst sınır 4.3). |

## Desenler (zorluk sırasıyla açılır)
1. **Tekli** — tek engel.
2. **Zikzak** (3+) — iç/dış dönüşümlü engel dizisi.
3. **Duvar** (6+) — bir halkada uzun yay; diğer halkada yıldız dizisi.
4. **Dönek** (18+) — hayalet çizgiyle önceden gösterilen, yaklaşınca halka değiştiren engel.
5. **Hızlı zikzak** (30+) — daha sık aralıklı zikzak.
6. **Yıldız yolu** — nefes molası; yarıda halka değiştiren yıldız dizisi.
7. **Kapı** (3+ halka) — tek boşluk hariç tüm halkaları kapatan radyal duvar. Boşlukta yıldız var. Gel-git ile boşluğa ulaşmak için önünde yeterli mesafe bırakılır.
8. **Merdiven** (3+ halka) — halkalar boyunca basamak basamak ilerleyen engeller.

Engel arası süre 0.64 sn'den 0.30 sn'ye iner; her zaman insanın geçebileceği minimum açı korunur.

## Seviye / görsel ilerleme
Skor 15 / 35 / 60 / 90 / 130'da renk paleti yumuşakça değişir ve "SEVİYE N" yazısı çıkar.
Bazı seviyeler oyunu gerçekten değiştirir:

| Skor | Seviye | Yenilik |
|---|---|---|
| 35 | 3 | **3. yörünge doğar.** Dış halka ikiye ayrılır, gel-git kontrolü başlar. |
| 60 | 4 | **Yörüngeler nefes alır.** Halkalar hafif faz farkıyla büyüyüp küçülür. |
| 90 | 5 | **4. yörünge doğar.** |

Yeni halka, ekrandaki engeller geçildikten sonra ~1 sn'lik bir animasyonla doğar. Bu sırada yeni engel gelmez, yani oyuncu adil bir geçiş yaşar.
Her seviye yeni bir oyun gibi hissettirir, oyuncu da "sonraki halkayı görmem lazım" diye tekrar oynar.

## Bağımlılık kancaları
- **Anında tekrar:** Ölümden ~1 sn sonra tek dokunuşla yeni tur.
- **Az kaldı etkisi:** Oyun sırasında "Rekora 3!" uyarısı. Oyun sonunda "Rekora X puan kaldı!".
- **Yeni rekor anı:** Tur içinde fanfar, konfeti, "YENİ REKOR!".
- **Juice:** Parçacıklar, ekran sarsıntısı, ölümde ağır çekim, titreşim, sentezlenmiş sesler.
- **Günlük seri:** Her gün girişte seri × 10 ★ bonus (en fazla 50).
- **Günlük görevler:** Tarihe göre üretilen 3 görev ("Tek oyunda X puan", "X PERFECT"...). Görevler oyuncunun rekoruna göre ölçeklenir.
- **Koleksiyon:** 8 top skini (40 ★ → 1000 ★ Gökkuşağı).

## Kontroller
- Dokunmatik: ekranın herhangi bir yerine dokun.
- Masaüstü: Boşluk / Yukarı / Aşağı ok tuşu.
- Uygulama arka plana alınırsa oyun otomatik duraklar.

## Teknik
- Saf HTML5 Canvas + vanilla JS, bağımlılık yok.
- `localStorage` ile kayıt (rekor, yıldız, skinler, seri, görevler).
- Service Worker ile çevrimdışı çalışma. Manifest ile tam ekran kurulum.
- İleride: Capacitor ile Play Store / App Store paketi, ödüllü reklam ile "devam et", liderlik tablosu.
