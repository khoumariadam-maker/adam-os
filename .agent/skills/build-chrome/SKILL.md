---
name: build-chrome
description: Build React components with locked Tailwind config, 9x beveled chrome, and 8px grid
---

# Build Chrome

## Objective

Build all React components for Adam OS: Window, Taskbar, BootSequence, Desktop, WindowManager, SoundManager, StartMenu, LanguageToggle, and all window content components. Every component must follow the locked Tailwind config, implement beveled 9x chrome, and respect the 8px grid system.

## Rules of Engagement

1. **Tailwind config is locked.** Use only the values defined in the project's `tailwind.config.ts`. Never add new colors, spacing values, or breakpoints that are not in the config. If a value is missing, escalate to the OS Architect rather than inventing one.
2. **z-index map is authoritative.** The z-index map defines the stacking order: Desktop < Windows < Window-Active < Taskbar < StartMenu < BootSequence < Modals. Never hardcode a z-index value. Always use the named z-index from the map.
3. **8px grid system.** All spacing, padding, margins, and component dimensions must be multiples of 8px. No exceptions. Use the Tailwind spacing scale which is already configured for 8px increments.
4. **9x beveled window chrome.** Every window must have the classic 9x-style beveled border: outer highlight (top-left), outer shadow (bottom-right), inner highlight, inner shadow, and the characteristic title bar with gradient. Follow the Art Bible pixel specification exactly.
5. **Buttons follow the 9x spec.** All buttons must have the beveled 3D appearance: raised state (highlight top-left, shadow bottom-right), pressed state (inverted), and the 1px focus indicator. No flat buttons, no rounded buttons, no modern button styles.
6. **Focus rings are mandatory.** Every interactive element must have a visible focus indicator for keyboard navigation. Use the 1px dotted outline matching the 9x specification. Never remove focus styles.
7. **No Lucide, no Material Icons.** All icons must be custom 64x64 pixel art icons from the `public/` directory. Never import from lucide-react, @material-ui/icons, or any icon library. Reference icons by their filename in the public directory.
8. **Web Audio API only.** All sound effects must use the Web Audio API. Never use `<audio>` elements, never use Howler.js, never use any audio library. The SoundManager component wraps the Web Audio API directly.

## External Skills

- **ui-ux-pro-max** — Use for component states, spacing scale, accessibility patterns, design token enforcement, and component spec standards.
- **anti-slop** — Run anti-slop audit on every generated component file after each build step. Reject code that triggers AI slop patterns (verbose comments, unnecessary abstractions, speculative code, dead code).

## Instructions

1. Read `architecture.md` to understand the component tree, dependency graph, and build order.
2. Read `adam-os-spec/AdamOS_MasterBuildPrompt_v1.0.txt` for the full component specifications and behavior requirements.
3. Read `adam-os-spec/AdamOS_ArtBible_v1.0.pdf` for the 9x chrome pixel specification, color tokens, and typography rules.
4. Read `tailwind.config.ts` to confirm available tokens. Never add tokens not in this file.
5. Consult `ui-ux-pro-max` for component state patterns, accessibility requirements, and spacing scale validation.
6. Build the WindowManager component first — it manages window lifecycle, z-ordering, focus, and is the dependency for all window components.
7. Build the Window component — the reusable 9x chrome shell with title bar, minimize/maximize/close buttons, and resize handles.
8. Build the Desktop component — the background layer with wallpaper, desktop icons, and right-click context menu.
9. Build the Taskbar component — the bottom bar with start button, running window buttons, system tray, and clock.
10. Build all content window components: AboutWindow, ProjectsWindow, CVWindow, ContactWindow, and any other window content from the spec.
11. Build the BootSequence, StartMenu, LanguageToggle, and SoundManager components.
12. Build mobile adaptation components: responsive layout wrappers, touch-friendly window controls, and mobile-specific UI adaptations per the spec.
13. After each component file is written, run `anti-slop` audit. Fix any violations before proceeding to the next component.

## When to Use

- During the build phase, after architecture.md has been produced by `plan-architecture`.
- When a component needs to be rebuilt due to spec changes or compliance violations.
- When adding a new component that has been added to the Component Inventory in the spec.

## When NOT to Use

- Do not use this skill to generate visual assets (PNG/WebP files). Use `generate-pixel-assets` instead.
- Do not use this skill to write text copy or i18n dictionaries. Use `write-copy` instead.
- Do not use this skill to implement animations. Use `animate-motion` instead.
- Do not use this skill to plan architecture. Use `plan-architecture` instead.

## Outputs

- **React components** in `src/components/` — all Window, Desktop, Taskbar, WindowManager, BootSequence, StartMenu, LanguageToggle, SoundManager, and content window components.
- **Styles** in `src/styles/` or co-located with components — Tailwind utility classes following the locked config.

## Safety Caps

- **Tailwind config is immutable.** Never modify `tailwind.config.ts` during the build. If a value is missing, escalate rather than adding it.
- **No icon libraries.** Never install or import from lucide-react, @material-ui/icons, heroicons, or any icon package.
- **No audio libraries.** Never install or import from howler, tone.js, or any audio package. Use Web Audio API only.
- **anti-slop is mandatory.** Every component file must pass anti-slop audit before it is considered complete.
- **8px grid is non-negotiable.** Any spacing value that is not a multiple of 8px is a build violation.
