# DigiDZ — Motion graphic (9:16, 36s)

`DigiDZ-motion.mp4` — 1080×1920, 30fps, with music. Ready for Reels / profile / Stories.

Scenes: logo reveal → hook (no Visa / no dollars) → pay in dinars → catalogue (AI first) →
payment methods (Edahabia/BaridiMob, Flexy, CCP) → guarantee (pay after activation) → prices → CTA (message us).

## Edit & re-render
- Text/scenes/timing: `index.html` (the `SERVICES` list and `T` timings are at the top of the script).
  Real logos: put PNGs in `assets/logos/` and add `img:"assets/logos/name.png"` to a service.
- Live preview: open `index.html?play` in a browser.
- Render:
  ```
  python3 music.py out/music.wav
  node render.mjs out/video-silent.mp4
  ffmpeg -i out/video-silent.mp4 -i out/music.wav -c:v copy -c:a aac -b:a 192k -shortest DigiDZ-motion.mp4
  ```
