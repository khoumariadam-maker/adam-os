// Renders index.html frame-by-frame to MP4 (1080x1920, 30fps).
// Usage: node render.mjs [out.mp4] [--stills t1,t2,...]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const stillsArg = args.indexOf('--stills');
const FPS = 30;

const browser = await chromium.launch({ args: ['--force-color-profile=srgb'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
await page.goto('file://' + path.join(dir, 'index.html'));
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);

if (stillsArg >= 0) {
  for (const t of args[stillsArg + 1].split(',').map(Number)) {
    await page.evaluate(t => window.seek(t), t);
    await page.screenshot({ path: path.join(dir, 'out', `still-${t}.jpg`), type: 'jpeg', quality: 90 });
  }
} else {
  const out = args[0] || path.join(dir, 'out', 'video-silent.mp4');
  const dur = await page.evaluate(() => window.DURATION);
  const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const n = Math.round(dur * FPS);
  for (let f = 0; f < n; f++) {
    await page.evaluate(t => window.seek(t), f / FPS);
    const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (f % 90 === 0) console.log(`frame ${f}/${n}`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
}
await browser.close();
