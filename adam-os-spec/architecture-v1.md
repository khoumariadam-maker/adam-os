# Adam OS — Architecture Specification v1.0

Single Source of Truth for Component Tree, State Architecture, Window Manager, and Build Sequence.

---

## 1. System Overview

Adam OS is a static, client-side Windows 9x-themed operating system portfolio built with Next.js (React) + Tailwind CSS + Framer Motion. It operates in two interaction modes:
- **Desktop (width ≥ 768px)**: Draggable, resizable 9x-beveled windows, desktop icons, taskbar, start menu, free-roaming Pixel Spider mascot with web swinging and window crawling.
- **Mobile (width < 768px)**: SpringBoard-style full-screen card navigation, bottom 5-item tab bar, fixed corner mascot, 44px+ touch targets.

---

## 2. Component Inventory & Tree

```
<AppLayout> [State: Language, Sound, ActiveTheme]
├── <BootSequence /> (z-9999) [State: isBooting, lines, progress, skip]
├── <Desktop /> (z-0 to z-10) [State: activeWallpaper, selectedIcon]
│   ├── <Wallpaper /> (z-0)
│   ├── <DesktopIconGrid /> (z-10)
│   │   └── <DesktopIcon /> (6 instances: About, Projects, Downloads, Contact, Sound, Language)
│   ├── <WindowManager /> (z-100 to z-200) [Context: windows, activeId, focusWindow, openWindow, closeWindow, minimizeWindow, resizeWindow]
│   │   ├── <AboutWindow /> (<Window /> wrapped)
│   │   ├── <ProjectsWindow /> (<Window /> wrapped)
│   │   ├── <DownloadsWindow /> (<Window /> wrapped)
│   │   └── <ContactWindow /> (<Window /> wrapped)
│   ├── <PixelSpider /> (z-750) [Props: frame, position, mode]
│   ├── <SpeechBubble /> (z-760) [Props: text, targetRef, onComplete]
│   ├── <StartMenu /> (z-900) [State: isOpen, items, shutdownTrigger]
│   └── <Taskbar /> (z-500)
│       ├── <StartButton />
│       ├── <TaskbarTabs />
│       ├── <LanguageToggle />
│       ├── <SoundToggle />
│       └── <SystemClock />
└── <SoundManager /> (Web Audio API Synthesizer singleton)
```

---

## 3. Dependency Graph

1. **Core Utilities & Theme**:
   - `src/config/tailwind.tokens.ts` (10-token locked palette, spacing grid, z-index map)
   - `src/lib/audio/sound-synth.ts` (Web Audio API synthesis for 9x SFX)
   - `src/lib/i18n/` (`en.json`, `ar.json`, RTL context)

2. **State Contexts**:
   - `WindowManagerContext` (depends on none, manages window instances)
   - `SoundContext` (depends on `sound-synth`)
   - `LanguageContext` (depends on `i18n` dictionaries)

3. **Base UI Components**:
   - `<Window />` (depends on `WindowManagerContext`, Framer Motion, 9x CSS Chrome)
   - `<DesktopIcon />` (depends on `WindowManagerContext`, `SoundContext`)

4. **Feature Windows**:
   - `<AboutWindow />` (uses `<Window />`, bio copy)
   - `<ProjectsWindow />` (uses `<Window />`, project metadata cards)
   - `<DownloadsWindow />` (uses `<Window />`, CV theater trigger, `<PixelSpider />` signal)
   - `<ContactWindow />` (uses `<Window />`, direct mailto/tel buttons)

5. **Mascot & Interaction**:
   - `<PixelSpider />` (renders 256x256 PNG frames, Framer Motion swing/crawl paths)
   - `<SpeechBubble />` (typewriter effect, attached to `<PixelSpider />`)

6. **System Chrome**:
   - `<Taskbar />` (uses `WindowManagerContext`, `LanguageContext`, `SoundContext`)
   - `<StartMenu />` (uses `WindowManagerContext`)
   - `<BootSequence />` (uses `SoundContext`, terminal log state)

---

## 4. State Architecture

### 4.1 Window Manager State
- `windows`: Map of window IDs to `{ id, title, icon, isOpen, isMinimized, isMaximized, position, size, zIndex }`
- `activeWindowId`: string | null
- `maxZIndex`: number (increments on every window focus, baseline = 100)

### 4.2 Language & Layout State
- `lang`: `'en' | 'ar'`
- `dir`: `'ltr' | 'rtl'`
- Persisted in `localStorage` key `'adam_os_lang'`

### 4.3 Sound State
- `isMuted`: boolean (default `true`, opt-in via banner or toggle)
- Persisted in `localStorage` key `'adam_os_muted'`

### 4.4 Mascot Motion State
- `frame`: `'idle' | 'blink' | 'loading' | 'celebrating' | 'sleeping' | 'typing' | 'waving' | 'swinging'`
- `mode`: `'desktop_idle' | 'window_crawl' | 'cv_theater' | 'mobile_corner'`
- `targetWindowId`: string | null

---

## 5. Build Order & Parallel Work Sets

### Set 1: Foundation (Sequential)
- Project setup (Next.js 14 static export + Tailwind configuration)
- Design tokens & 9x CSS chrome classes (`globals.css`)
- Audio synthesizer (`sound-synth.ts`)
- i18n dictionaries (`en.json`, `ar.json`)

### Set 2: Core State & Base Controls (Parallel-Safe)
- `WindowManagerContext`
- `LanguageContext` & `SoundContext`
- `<DesktopIcon />` & `<Window />` container component

### Set 3: Feature Windows & Layout (Parallel-Safe)
- `<AboutWindow />`
- `<ProjectsWindow />`
- `<ContactWindow />`
- `<DownloadsWindow />` (with theater sequence hook)
- `<Taskbar />` & `<StartMenu />`

### Set 4: Mascot & Animation Layer (Sequential)
- Pixel art SVG/PNG placeholder integration for 8 mascot frames + 20 icons
- `<PixelSpider />` component with Framer Motion swing arc & web thread SVG renderer
- CV download theater orchestration (Spider swing -> web grab -> 3D throw -> progress bar -> trigger download)

### Set 5: Mobile & Polish (Sequential)
- Mobile breakpoint layout adaptations (< 768px SpringBoard app grid & card stack)
- Boot sequence overlay (`<BootSequence />`)
- QA anti-slop audit & compliance checks

---

## 6. Window Manager & Mobile Architecture

### Desktop Window Manager Rules
1. Drag bounds constrained to viewport bounds (`top: 0, bottom: calc(100vh - 40px)`).
2. Resize handle at bottom-right corner.
3. Active window gains `zIndex: maxZIndex + 1` (range 100-200).
4. Keyboard `Escape` closes active window; `Tab` cycles focus within active window.

### Mobile Sheet Rules
1. Viewport width < 768px automatically replaces desktop with app launcher grid.
2. Windows render as full-screen cards (`100vw x 100vh`) sliding from right (`400ms ease-out`).
3. Title bar height: `48px`, close target `44px x 44px`.
4. Drag/Resize disabled on mobile.
