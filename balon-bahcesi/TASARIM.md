# BALON BAHÇESİ — Oyun Tasarım Dokümanı

## Özet
Sakin, odak dostu bir müzik ve balon oyunu. Balonlar yavaşça yükselir, oyuncu dokundukça patlarlar. **Her dokunuş şarkının bir sonraki notasını çalar**, oyuncu farkında olmadan şarkıyı kendisi çalar. Tamamlanan her şarkı bahçede bir çiçek açtırır.

- Hedef kitle: Rahatlamak isteyen herkes, özellikle DEHB'li bireyler
- Tur: Bir şarkı, yaklaşık 1–2 dakika
- Platform: Mobil tarayıcı (PWA), ileride Capacitor ile mağazalar

## Tasarım ilkeleri (araştırmadan)
| İlke | Uygulama |
|---|---|
| Kaybetmek yok | Yanlış dokunuş yok. Kaçan balon sadece uçup gider. |
| Süre ve baskı yok | Tempo oyuncunun elinde: yavaş dokunursan şarkı yavaş çalar. |
| Doğal bitiş noktası | Her şarkının sonu var. "Zaman körlüğüne" karşı tasarlandı. |
| Duyusal yük düşük | Pastel renkler, yumuşak sesler, "Sakin hareket" ayarı (işletim sistemindeki "hareketi azalt" ayarına uyar). |
| Kaçırma korkusu (FOMO) yok | Gerçek zamanlı bekleme yok, çiçekler solmaz, seri/ceza yok. |
| Mola | İsteğe bağlı hatırlatıcı (10–30 dk). Şarkı bitişinde nazikçe hatırlatır. |
| Dürüstlük | Tedavi iddiası yok. Ayarlarda "tedavi aracı değildir" notu var. |

## Döngü
```
Çal → Balonlar yükselir → Dokun → Nota → Şarkı tamamlandı
  → ⭐ Yıldız + 🌷 Bahçede çiçek açar
  → Bahçe: süs al / yeni balon (enstrüman) / yeni şarkı
  → Sıradaki şarkı
```

## Mekanikler
- **Balonlar:** Ekranda en fazla 8 balon, en az 2 balon her zaman var. Dokunma alanı balonun 1.35 katı, yani affedici.
- **Şarkı ilerlemesi:** Üstte ince bir çubuk. Son notada kısa bir akor ve taç yaprağı yağmuru.
- **Ödül:** Nota sayısı ÷ 5 yıldız. İlk tamamlamada +10 bonus. Her şarkıda bir çiçek (en fazla 30 yuva).
- **Sıradaki şarkı:** Sahip olunan şarkılar arasında sırayla ilerler.

## Balonlar = enstrümanlar
| Balon | Enstrüman | Fiyat |
|---|---|---|
| 🎈 Klasik | Piyano | Ücretsiz |
| 🫧 Sabun Köpüğü | Müzik kutusu | 25 ⭐ |
| ☁️ Bulut | Yumuşak synth | 40 ⭐ |
| 🏮 Fener | Marimba | 60 ⭐ |
| 🪼 Deniz Anası | Arp | 80 ⭐ |

Tüm sesler Web Audio ile sentezleniyor, ses dosyası yok. Yumuşak bir yankı (convolver) ekleniyor.

## Bahçe süsleri
Mantarlar 15, Kelebekler 25, Ağaç 30, **Kuşlar 35 🔊**, **Çeşme 45 🔊**, **Rüzgâr Çanı 50 🔊**, Gölet 60, Fener Dizisi 75.
🔊 işaretli süsler bahçeye kendi ambiyans sesini ekler: kuş cıvıltısı, su sesi, çan sesi. Bahçe hem gözle hem kulakla büyür.

## Şarkılar
3 ücretsiz, 8 yıldızla açılan şarkı var. Hepsi kamu malı ezgiler (Twinkle, Frère Jacques, Neşeye Övgü, Brahms Ninnisi, Greensleeves...) ya da özgün besteler (Bahçe Valsi, Yağmur Damlaları). Telifli şarkı yok.
Anonim Türk ezgileri eklenmeden önce her birinin gerçekten anonim olduğu doğrulanmalı.

## Sonraki adımlar
- **Odak modu:** "Sadece mavileri patlat". Ceza yok, yanlış balon sadece ses çıkarmaz.
- **Nefes arası:** Basılı tut, balon şişsin (4 sn nefes al); bırak, sönsün (6 sn nefes ver).
- **Serbest mod:** Pentatonik gamda doğaçlama.
- Yeni şarkı paketleri, gece bahçesi teması.
- Gelir: Geçiş reklamı yok. Ödüllü reklamla yeni ses paketleri ya da tek seferlik "tam sürüm".
