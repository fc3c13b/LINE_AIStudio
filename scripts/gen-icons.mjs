// Iconimage.jpg を Android 各サイズの mipmap PNG に変換するスクリプト
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const sizes = [
  { dir: 'mipmap-mdpi',    size: 48  },
  { dir: 'mipmap-hdpi',    size: 72  },
  { dir: 'mipmap-xhdpi',   size: 96  },
  { dir: 'mipmap-xxhdpi',  size: 144 },
  { dir: 'mipmap-xxxhdpi', size: 192 },
];

const srcIcon = path.resolve(root, 'Iconimage.jpg');
const androidRes = path.resolve(root, 'android/app/src/main/res');

const JimpMod = await import('jimp');
const Jimp = JimpMod.Jimp ?? JimpMod.default ?? JimpMod;

for (const { dir, size } of sizes) {
  const image = await Jimp.read(srcIcon);
  image.resize({ w: size, h: size });
  const buf = await image.getBuffer('image/png');

  const outDir = path.join(androidRes, dir);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'ic_launcher.png'), buf);
  fs.writeFileSync(path.join(outDir, 'ic_launcher_round.png'), buf);
  console.log(`✓ ${dir}/ic_launcher.png (${size}x${size})`);
}

console.log('Done! Rebuild the APK to apply the new icons.');
