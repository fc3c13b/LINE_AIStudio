// Iconimage.jpg を Android 各サイズの mipmap PNG に変換するスクリプト
// 通常アイコン + アダプティブアイコン foreground の両方を生成
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// 通常アイコンサイズ（Android < 8.0）
const regularSizes = [
  { dir: 'mipmap-mdpi',    size: 48  },
  { dir: 'mipmap-hdpi',    size: 72  },
  { dir: 'mipmap-xhdpi',   size: 96  },
  { dir: 'mipmap-xxhdpi',  size: 144 },
  { dir: 'mipmap-xxxhdpi', size: 192 },
];

// アダプティブアイコン foreground サイズ（Android 8.0+ = 108dp 単位）
const adaptiveSizes = [
  { dir: 'mipmap-mdpi',    size: 108 },
  { dir: 'mipmap-hdpi',    size: 162 },
  { dir: 'mipmap-xhdpi',   size: 216 },
  { dir: 'mipmap-xxhdpi',  size: 324 },
  { dir: 'mipmap-xxxhdpi', size: 432 },
];

const srcIcon = path.resolve(root, 'Iconimage.jpg');
const androidRes = path.resolve(root, 'android/app/src/main/res');

const JimpMod = await import('jimp');
const Jimp = JimpMod.Jimp ?? JimpMod.default ?? JimpMod;

// 通常アイコン生成
for (const { dir, size } of regularSizes) {
  const image = await Jimp.read(srcIcon);
  image.resize({ w: size, h: size });
  const buf = await image.getBuffer('image/png');
  const outDir = path.join(androidRes, dir);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'ic_launcher.png'), buf);
  fs.writeFileSync(path.join(outDir, 'ic_launcher_round.png'), buf);
  console.log(`✓ ${dir}/ic_launcher.png (${size}x${size})`);
}

// アダプティブアイコン foreground 生成（Android 8.0+）
for (const { dir, size } of adaptiveSizes) {
  const image = await Jimp.read(srcIcon);
  image.resize({ w: size, h: size });
  const buf = await image.getBuffer('image/png');
  const outDir = path.join(androidRes, dir);
  fs.writeFileSync(path.join(outDir, 'ic_launcher_foreground.png'), buf);
  console.log(`✓ ${dir}/ic_launcher_foreground.png (${size}x${size}) [adaptive]`);
}

// 背景色を画像の基調色に合わせる
const bgXml = path.join(androidRes, 'values/ic_launcher_background.xml');
fs.writeFileSync(bgXml,
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#F5C842</color>\n</resources>\n`
);
console.log('✓ ic_launcher_background color updated');

console.log('\nDone! Run: npm run build && npx cap sync android, then rebuild the APK.');

