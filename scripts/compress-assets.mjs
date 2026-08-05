import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const ICONS_DIR = path.join(process.cwd(), 'public', 'icons');
const MASCOT_DIR = path.join(process.cwd(), 'public', 'mascot');

async function processIcons() {
  console.log('--- Crushing Icons to 64x64 PNG-8 ---');
  if (!fs.existsSync(ICONS_DIR)) return;
  const files = fs.readdirSync(ICONS_DIR).filter(f => f.endsWith('.png'));

  for (const file of files) {
    const filePath = path.join(ICONS_DIR, file);
    try {
      const buffer = await sharp(filePath)
        .resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png({ palette: true, quality: 80, colors: 16 })
        .toBuffer();
      fs.writeFileSync(filePath, buffer);
      console.log(`✓ Optimized ${file} -> ${Math.round(buffer.length / 1024)} KB`);
    } catch (err) {
      console.error(`✗ Error processing ${file}:`, err);
    }
  }
}

async function processMascot() {
  console.log('--- Crushing Mascot Frames to 256x256 PNG-8 ---');
  if (!fs.existsSync(MASCOT_DIR)) return;
  const files = fs.readdirSync(MASCOT_DIR).filter(f => f.endsWith('.png'));

  for (const file of files) {
    const filePath = path.join(MASCOT_DIR, file);
    try {
      const buffer = await sharp(filePath)
        .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png({ palette: true, quality: 80, colors: 32 })
        .toBuffer();
      fs.writeFileSync(filePath, buffer);
      console.log(`✓ Optimized ${file} -> ${Math.round(buffer.length / 1024)} KB`);
    } catch (err) {
      console.error(`✗ Error processing ${file}:`, err);
    }
  }
}

async function main() {
  await processIcons();
  await processMascot();
  console.log('=== All Asset Compression Complete ===');
}

main();
