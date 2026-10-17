# DigiDZ — Motion graphic (9:16, 36s)

`DigiDZ-motion.mp4` — 1080×1920, 30fps, with music. Ready for Reels / profile / Stories.

Scenes: logo reveal (converging pixels, flare, shockwave) → hook (no Visa / no dollars) → pay in dinars →
category orbit around an AI core (music, films & series, courses, design, video editing, storage) →
payment methods (Edahabia/BaridiMob, Flexy, CCP) → guarantee (pay after activation) → prices → CTA (message us).

## Edit & re-render
- Text/scenes/timing: `index.html` — `CATS` (categories), `T` (scene timings) and `TR` (transition per scene:
  pixel / zoom / whip / glitch) are at the top of the script.
- Motion: kinetic masked word reveals, camera drift + beat pulse + impact shakes, RGB-split glitch,
  speed lines, light sweeps, particle bursts, film grain, and real motion blur (4 sub-frames per frame).
- Live preview: open `index.html?play` in a browser.
- Render:
  ```
  python3 music.py out/music.wav
  node render.mjs out/video-silent.mp4 --sub 4 --workers 4
  ffmpeg -i out/video-silent.mp4 -i out/music.wav -c:v copy -c:a aac -b:a 192k -shortest DigiDZ-motion.mp4
  ```
