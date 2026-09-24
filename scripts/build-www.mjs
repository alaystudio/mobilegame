// Mağaza uygulaması için web dosyalarını www/ klasörüne kopyalar (Capacitor webDir).
// Service worker ve manifest uygulamada gerekmez; native.js service worker'ı zaten kapatır.
import { cpSync, rmSync, mkdirSync } from 'node:fs';

const FILES = ['index.html', 'style.css', 'config.js', 'native.js', 'ads.js', 'leaderboard.js', 'game.js', 'privacy.html'];
rmSync('www', { recursive: true, force: true });
mkdirSync('www');
for (const f of FILES) cpSync(f, `www/${f}`);
cpSync('icons', 'www/icons', { recursive: true });
console.log(`www/ hazır (${FILES.length} dosya + icons/)`);
