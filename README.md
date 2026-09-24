# YÖRÜNGE

Tek dokunuşla oynanan, mobil için tasarlanmış bir arcade oyunu. Top çekirdeğin etrafında döner.
Ekrana dokununca iç ve dış yörünge arasında zıplar. Engellerden kaç, yıldız topla, rekorunu kır.

- **PERFECT:** Engele çarpmadan hemen önce kaçarsan kombo ve bonus puan kazanırsın.
- **Yıldızlar:** Yeni top skinleri açar.
- **Günlük seri ve görevler:** Her gün geri gelmen için bir sebep.

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
| `index.html` | Ekranlar (menü, oyun sonu, toplar, görevler) |
| `style.css` | Arayüz stilleri |
| `game.js` | Oyun motoru: fizik, desen üretimi, çizim, ses, kayıt |
| `sw.js` | Çevrimdışı önbellek (her yayında `CACHE` sürümünü artır) |
| `manifest.webmanifest`, `icons/` | PWA kurulum bilgileri |

## Kontroller
- Mobil: ekrana dokun
- Masaüstü: `Boşluk` / `↑` / `↓`
