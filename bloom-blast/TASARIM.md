# Bloom Blast: Tasarım

Block Blast tarzı bir blok bulmacası. Üstüne bir bahçe inşa etme katmanı ekleniyor. Oyuncunun kafasında şu bağlantı kurulsun istiyoruz: **iyi oynadım → tohum kazandım → bahçem gelişti**. Combo yaptığında bu bağlantı anında da hissediliyor, çünkü tahtanın üstündeki bahçe o an çiçek açıyor.

## Temel mekanik
- 8×8 tahta ve 3 parçalık tepsi var. Parçalar sürükle-bırak ile yerleştirilir ve parmağın biraz üstünde taşınır.
- Dolan satır ve sütunlar temizlenir. Tahtaya sığmayan parçalar griye döner. Hiçbir parça sığmazsa seviye kaybedilir.
- **Combo:** Bir combo, arka arkaya en fazla 2 temizlemesiz hamleye dayanır. 3. temizlemesiz hamlede sıfırlanır. Şeritte ×N ve kalan hak noktaları gösterilir.
- **Puan formülü:** `10 · L · (L+1) · (1 + (combo−1)·0.3)`

## Renkler çiçektir
Her blok rengi bir çiçeğe karşılık gelir:

| Renk | Çiçek |
|---|---|
| Kırmızı | lale |
| Turuncu | kadife |
| Sarı | ayçiçeği |
| Mavi | peygamber çiçeği |
| Mor | lavanta |
| Pembe | gül |

- "Çiçekleri açtır" seviyelerinde hedef, belirli renklerdeki blokları temizlemektir. Hedef renklerdeki bloklar ve parçalar üzerinde beyaz bir çiçek amblemi görünür.
- Temizlenen blokların renkleri şeritte aynı çiçekler olarak açar.

## Tohum ekonomisi
- **Temizleme:** `çizgi sayısı + min(combo−1, 6)` tohum.
- **Seviye kazanma, ilk kez:** `8 + 4·yıldız`.
- **Seviye kazanma, tekrar oynarken:** `2 + yıldız`.
- **Klasik mod:** Sadece temizlemelerden tohum gelir.
- Bir seviye ortalama 25–35 tohum getirir. Kır Bahçesi yaklaşık 30 seviyede tamamlanır.

## Bahçe (Kır Bahçesi, 10 adım, her adımda 3 stil)
| # | Adım | Fiyat | Stiller |
|---|---|---|---|
| 1 | Çimleri ser | 15 | Çayır / Çizgili çim / Yabani ot |
| 2 | Çiçek tarhı ek | 25 | Laleler / Papatyalar / Lavanta |
| 3 | Çit kur | 35 | Beyaz çit / Kütük çit / Çalı çit |
| 4 | Ağaç dik | 50 | Meşe / Sakura / Elma |
| 5 | Yol döşe | 65 | Basamak taşları / Çakıl / Tuğla |
| 6 | Kulübe yap | 80 | Kırmızı / Mavi / Saman çatı |
| 7 | Gölet kaz | 100 | Nilüferler / Taş kenar / Ördekler |
| 8 | Dinlenme köşesi | 125 | Ahşap bank / Beyaz bank / Piknik |
| 9 | Kelebek bahçesi | 150 | Mavi / Kral / Gökkuşağı |
| 10 | Arı kovanı | 180 | Saman kovan / Kutu kovan / Arı evi |

- Bahçe kendiliğinden büyümez: oyuncu hangi stili istediğini seçer. Seçim yapmak sahiplenme duygusu yaratır.
- Fiyatlar düzgün artar, her adım yaklaşık 1–3 oyunluk emek ister.
- Tüm sahne `garden.js` içinde kodla çiziliyor, hazır görsel dosyası yok. Aynı çizim hem ana ekranda hem şeritte kullanılıyor.
- Görünüm 2.5D: dünya koordinatları x (yatay) ve z (derinlik).

## Combo → bahçe
| Olay | Bahçede |
|---|---|
| Her temizleme | Temizlenen renklerden çiçekler şeritte açar |
| ×3 | "Bahçe çiçek açtı!": çiçek dalgası ve yağan yapraklar |
| ×5, ×10… | "Bir ağaç büyüdü!": şeride ağaç çıkar (en fazla 4) |
| ×8, ×12… | "Gökkuşağı!": gökkuşağı, parlayan gökyüzü ve kelebekler |
| Tek hamlede 3+ çizgi | Güneş parlar |

## Seviyeler
- Seviyeler prosedürel üretilir: seviye numarasıyla tohumlanır (mulberry32), yani herkes aynı seviyeyi görür.
- Zorluk `d = (n−1)/300` ile artar.
- Her 10. seviye zordur.
- Tepsi her zaman adildir: 3 parça sırayla her zaman yerleştirilebilir (`placeableInSequence`).
- Greedy bot ile ölçülen kazanma oranları:

| Seviye | Kazanma oranı |
|---|---|
| 1–60 | ~%80–90 |
| 61–250 | ~%60 |
| 251+ | ~%40 |

## Sonraki adımlar
- Ödüllü reklam, iki kullanım için:
  - Kaybedince "3 satırı temizle ve devam et".
  - Seviye sonunda "tohumları 2 katına çıkar".
- Yeni bahçeler: Japon, Tropik, Sonbahar, Kış, Peri, Ay. Her bahçe yaklaşık 30 seviyelik bir bölüm olur.
- Güçlendiriciler: çekiç, tepsiyi yenile.
- Günlük seviye.
- Mağazaya çıkmadan önce "Bloom Blast" ismi için marka taraması yapılmalı.
