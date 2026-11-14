# Architecture

## Stack
| Layer | Choice |
|---|---|
| Framework | Next.js 14 app router, `output: 'export'` (static HTML/JS in `./out`) |
| UI | React 18 + TypeScript + Tailwind CSS + Framer Motion |
| 3D | three.js via react-three-fiber — Breadboard.exe only, lazy-loaded |
| Sound | Web Audio API synthesis (`src/lib/audio/sound-synth.ts`), no audio files |
| Hosting | Vercel from `main` (https://adam-os-two.vercel.app); optional GitHub Pages mirror |
| Tests | `tsc`, circuit solver checks (`scripts/circuit/check-solver.ts`), Playwright visual tests |

## Folder map
```
src/app/                 layout, home page, /resume, robots, sitemap
src/components/          desktop shell: Desktop, Window, Taskbar, StartMenu, CommandPalette, ContextMenu,
                         BootSequence, Screensaver, PixelSpider (mascot), WallpaperFx, …
src/components/windows/  one component per app (AboutWindow, TerminalWindow, PaintWindow, …)
src/components/breadboard/  3D breadboard scene
src/context/             WindowManager, Settings, Sound, Mascot, Language providers
src/lib/apps.ts          registry of every app (drives desktop, Start menu, taskbar, Ctrl+K)
src/lib/circuit/         MNA circuit solver, parts, presets, board model
src/lib/content/         projects + résumé content
src/lib/i18n/            en.json / ar.json
src/lib/pixel-icons.ts   hand-made pixel icon set
src/lib/storage.ts       localStorage helpers (remembered windows, settings, scores)
tests/visual/            Playwright screenshot tests + baselines
```

## Key flows
- **Open an app**: icon / Start menu / Ctrl+K / terminal `open <app>` → WindowManagerContext opens a
  window from `APPS` → window animates out of its icon; position is persisted.
- **Phones**: `useIsMobile` → home screen grid + full-screen app sheets + bottom tab bar.
- **Breadboard**: user places parts → board model builds nodes from strips → solver (MNA, backward-Euler
  for capacitors) → currents/voltages drive LED glow, buzzer, meter.

## Config
- `NEXT_PUBLIC_BASE_PATH` — sub-path hosting (e.g. `/adam-os`).
- `NEXT_PUBLIC_SITE_URL` — public URL for social previews + sitemap.
