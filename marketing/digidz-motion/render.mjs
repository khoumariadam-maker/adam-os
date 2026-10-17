// Renders index.html frame-by-frame to MP4 (1080x1920, 30fps) with motion blur.
// Usage: node render.mjs [out.mp4] [--sub 4] [--workers 4]
//        node render.mjs --stills 1.2,5.5,...
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');

const dir = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const FPS = 30, SUB = +opt('--sub', 4), WORKERS = +opt('--workers', 4), SHUTTER = 0.5;
fs.mkdirSync(path.join(dir, 'out'), { recursive: true });

const browser = await chromium.launch({ args: ['--force-color-profile=srgb'] });
async function openPage() {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.join(dir, 'index.html'));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  return page;
}
const run = (cmd, a) => new Promise((res, rej) => spawn(cmd, a, { stdio: 'inherit' }).on('close', c => c ? rej(new Error(cmd + ' ' + c)) : res()));

if (args.includes('--stills')) {
  const page = await openPage();
  for (const t of opt('--stills').split(',').map(Number)) {
    await page.evaluate(t => window.seek(t), t);
    await page.screenshot({ path: path.join(dir, 'out', `still-${t}.jpg`), type: 'jpeg', quality: 90 });
  }
} else {
  const out = args[0] && !args[0].startsWith('--') ? args[0] : path.join(dir, 'out', 'video-silent.mp4');
  const page0 = await openPage();
  const n = Math.round(await page0.evaluate(() => window.DURATION) * FPS);
  await page0.close();
  const per = Math.ceil(n / WORKERS);
  // each worker renders SUB sub-frames per frame across the shutter; ffmpeg averages them (motion blur)
  const chunk = async w => {
    const page = await openPage();
    const from = w * per, to = Math.min(n, from + per);
    const file = path.join(dir, 'out', `chunk-${w}.mp4`);
    const vf = SUB > 1 ? `tmix=frames=${SUB},select='eq(mod(n\\,${SUB})\\,${SUB - 1})',setpts=N/${FPS}/TB` : 'null';
    const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS * SUB), '-c:v', 'mjpeg', '-i', '-',
      '-vf', vf, '-r', String(FPS), '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', file], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let f = from; f < to; f++) {
      for (let s = 0; s < SUB; s++) {
        const t = (f + (SUB > 1 ? (s / (SUB - 1) - 0.5) * SHUTTER : 0)) / FPS;
        await page.evaluate(t => window.seek(Math.max(0, t)), t);
        const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
        if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      }
      if ((f - from) % 60 === 0) console.log(`worker ${w}: ${f - from}/${to - from}`);
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
    return file;
  };
  const files = await Promise.all([...Array(WORKERS).keys()].map(chunk));
  const list = path.join(dir, 'out', 'chunks.txt');
  fs.writeFileSync(list, files.map(f => `file '${f}'`).join('\n'));
  await run('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', out]);
}
await browser.close();
