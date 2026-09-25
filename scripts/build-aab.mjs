// İmzalı Android App Bundle (AAB) üretir: www'yi derler, senkronlar, bundleRelease çalıştırır.
// İmza bilgileri android/keystore.properties dosyasından gelir.
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

if (!existsSync('android/keystore.properties')) {
  console.error('android/keystore.properties bulunamadı; AAB imzasız çıkar. README > Android imzalama bölümüne bak.');
  process.exit(1);
}

const run = (cmd, cwd) => execSync(cmd, { stdio: 'inherit', cwd });
run('npm run sync');
run(process.platform === 'win32' ? '.\\gradlew.bat bundleRelease' : './gradlew bundleRelease', 'android');
console.log('\nHazır: android/app/build/outputs/bundle/release/app-release.aab');
