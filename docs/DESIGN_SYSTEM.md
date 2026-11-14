# Design System

Source of truth: CSS variables at the top of `src/app/globals.css`. Use `rgb(var(--c-…))` (or the
Tailwind classes mapped to them). Never hard-code a hex color in a component.

## Themes
| Token | Spider Night (default, `.theme-dark`) | Windows 98 (`[data-theme='classic']`) | Use |
|---|---|---|---|
| `--c-base` | 11 11 16 | 0 128 128 (teal) | Desktop background |
| `--c-panel` / `--c-panel2` | dark panels | 192 192 192 silver | Window bodies, bars |
| `--c-spidey` | 33 44 244 cobalt | 0 0 128 navy | Accent, selection, primary buttons |
| `--c-text` / `--c-text-dim` | white / light gray | black / near-black | Text |
| `--c-green` `--c-red` `--c-yellow` | | | Success / error / warning |
| `--title-active` / `--title-inactive` | gradients | gradients | Window title bars |

Every UI change must be checked in **both** themes.

## Look
- Windows 98 chrome: beveled borders (light top-left, dark bottom-right), title bar gradient,
  pixel-crisp edges (`image-rendering: pixelated` for pixel art).
- Icons: only `src/lib/pixel-icons.ts` glyphs (they follow theme colors).
- Fonts: system pixel/UI fonts as set in `layout.tsx`; Arabic uses Reem Kufi (titles) + IBM Plex Sans Arabic.
- Spacing on an 8 px grid (4 px for tight chrome).

## Behavior rules
- Mobile-first: works by touch at 360 px; no sideways scroll; tap targets ≥ 40 px.
- RTL: mirror layouts with logical properties (`ms-`, `me-`, `start`, `end`), not left/right.
- Respect `prefers-reduced-motion` for every animation.
- Every async action has a loading state and an error state (e.g. GitHub.exe offline).
- Sounds are short, optional, and respect the global mute.
