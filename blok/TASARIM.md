# Block Journey (Blok Yolculuğu): Tasarım

Block Blast tarzı bir blok bulmacası. Fark: **sınırsız seviyeli bir macera haritası** var. Klasik sonsuz mod da ayrıca oynanabiliyor.

## Temel mekanik
- 8×8 tahta. Altta 3 parçalık bir tepsi var. Parçalar sürükle-bırak ile yerleştirilir ve parmağın biraz üstünde taşınır, böylece parmak parçayı kapatmaz.
- Dolan satır ve sütunlar temizlenir. Aynı hamlede birden fazla çizgi temizlemek ve arka arkaya temizlemek (streak) kombo puanı verir.
  - Formül: `10 · L · (L+1) · (1 + (streak−1)·0.5)`
- Tahtaya sığmayan parçalar griye döner. Hiçbir parça sığmazsa seviye kaybedilir ("Out of space").

## Seviyeler (prosedürel, sonsuz)
`levelConfig(n)` her seviyeyi `mulberry32` tohumlu RNG ile üretir. Aynı seviye her oynanışta ve her cihazda aynıdır. Elle seviye tasarlamaya gerek yoktur.

- **Hedef türleri**
  - Gems: belirtilen mücevherleri çizgi temizleyerek topla.
  - Score: hedef puana ulaş.
  - Lines: belirtilen sayıda çizgi temizle.
- **Zorluk** `d = (n−1)/300` ile yavaşça artar ve 300. seviyeden sonra sabitlenir. Zorluk şunları etkiler:
  - başlangıç doluluğu,
  - hedef miktarı,
  - büyük parçaların sıklığı.
- **Zor seviyeler:** Her 10. seviye "Hard" olarak işaretlenir. Bu seviyelerde tahta daha dolu başlar ve hedefler daha büyüktür.
- **Başlangıç desenleri:** scatter, mirror, rows, frame, diamond, blocks.
- **Yıldızlar:** Hedefi par parça sayısı içinde bitirirsen ★★★, par×1.35 içinde bitirirsen ★★ alırsın. Diğer durumlarda ★ alırsın.

## Adil tepsi
Her yeni tepside, 3 parçanın da bir sıra hâlinde (temizlemeler dahil) yerleştirilebildiği simüle edilerek doğrulanır (`placeableInSequence`). Kayıp her zaman oyuncunun kendi yerleştirmelerinden kaynaklanır. "Oyun beni kandırdı" hissi oluşmaz. Zorluğu parça şansı belirlemez; tahta, hedef ve parça karışımı belirler.

## Denge (greedy bot ile, bant başına kazanma oranı)
| Seviye | Kazanma |
|---|---|
| 1–10 | ~%90 |
| 11–60 | ~%90 |
| 61–150 | ~%70 |
| 151–250 | ~%50 |
| 251–400 | ~%40 |

Bot basit ve açgözlüdür, iyi bir oyuncu daha yüksek oranlar görür. Test API'si `window.__bj` üzerinden erişilebilir.

## Sonraki adımlar
- Yörünge'deki ödüllü reklam altyapısını bağlamak: kaybedince "tahtayı 3 satır temizle" ile devam etme hakkı.
- Güçlendiriciler: çekiç (tek hücre sil), tepsiyi yenile, döndür.
- Günlük seviye ve harita üzerinde bölüm temaları.
