---
name: generate-pixel-assets
description: Generate mascot frames, icons, and wallpapers following the Art Bible pixel resolution and palette rules
---

# Generate Pixel Assets

## Objective

Generate all visual assets for Adam OS: 8 mascot animation frames, 20 custom 64x64 icons, wallpapers, and decorative assets. Every asset must follow the Art Bible pixel resolution and locked 10-token palette. Assets must render crisply with `image-rendering: pixelated` at display size.

## Rules of Engagement

1. **Mascot frames are 256x256.** Each of the 8 mascot animation frames must be exactly 256x256 pixels. No anti-aliasing, no sub-pixel rendering. Clean pixel art only.
2. **Icons are 64x64.** Every custom icon must be exactly 64x64 pixels. No SVG icons, no icon fonts. Pure pixel art at native resolution.
3. **Wallpapers follow the Art Bible.** Wallpaper dimensions, tile patterns, and color usage must match the Art Bible specification exactly. Wallpapers must be seamless when tiled.
4. **Outlines are 1px black.** All pixel art assets must have 1px black outlines on every distinct shape, following the Pixel Spider specification for outline weight and placement.
5. **Pixel Spider spec is law.** The Pixel Spider (Adam's mascot) has a fixed anatomy: 8 legs, 2 eyes, body segments, and web patterns. Every frame must maintain anatomical consistency. The spider never gains or loses limbs between frames.
6. **Motion law: 2px per frame max.** No limb or body part may move more than 2 pixels between consecutive animation frames. This ensures smooth, natural movement without jitter.
7. **9 expressions required.** The mascot must have pixel art for 9 distinct expressions: neutral, happy, sad, surprised, thinking, waving, working, excited, and sleepy. Each expression must be clearly readable at 64x64 display size.
8. **Locked 10-token palette.** Only the 10 colors defined in the Art Bible palette may be used. No dithering with out-of-palette colors. No gradients that introduce intermediate colors. If a shade is needed that is not in the palette, use the nearest palette color.
9. **Naming convention is strict.** Mascot frames: `mascot-frame-{01-08}.png`. Icons: `icon-{name}.png` where name is lowercase-kebab-case. Wallpapers: `wallpaper-{name}.png`. Decorative assets: `deco-{name}.png`. No spaces, no uppercase in filenames.

## External Skills

- **pixel-art-sprites** — Use for sprite animation patterns, palette design, tileset creation, sub-pixel animation techniques, and pixel-perfect validation. This skill understands pixel art constraints and can generate frames that respect the 2px motion law and locked palette.

## Instructions

1. Read `adam-os-spec/AdamOS_ArtBible_v1.0.pdf` in full. Extract the 10-token palette, mascot anatomy spec, icon list, wallpaper specs, and all pixel art rules.
2. Read `adam-os-spec/AdamOS_MasterBuildPrompt_v1.0.txt` for the full list of required icons (each window and feature needs a specific icon) and wallpaper requirements.
3. Consult `pixel-art-sprites` for palette validation and sprite animation pattern best practices.
4. Generate the 8 mascot animation frames at 256x256. Validate each frame: anatomy consistency, 2px motion law, 1px outlines, palette compliance. Save as `mascot-frame-01.png` through `mascot-frame-08.png`.
5. Generate the 9 mascot expression sprites at 64x64. Validate each: expression readability, outline weight, palette compliance. Save as `mascot-expr-{expression}.png`.
6. Generate the 20 custom icons at 64x64. Each icon must be clearly readable at display size, use 1px black outlines, and use only the locked palette. Save as `icon-{name}.png`.
7. Generate wallpapers per the Art Bible specification: dimensions, tile pattern, color usage. Validate seamless tiling. Save as `wallpaper-{name}.png`.
8. Generate any decorative assets (halftone patterns, scanlines, CRT effects) per the Art Bible. Save as `deco-{name}.png`.
9. Run final validation: every asset against the palette, every mascot frame against the anatomy spec and motion law, every icon against the size requirement. Fix any violations.

## When to Use

- During the build phase, after the architecture has been planned.
- When the Art Bible has been updated and assets need to be regenerated.
- When new icons or mascot expressions are added to the spec.

## When NOT to Use

- Do not use this skill to build React components. Use `build-chrome` instead.
- Do not use this skill to write text copy. Use `write-copy` instead.
- Do not use this skill to implement animations. Use `animate-motion` instead.
- Do not use this skill to plan architecture. Use `plan-architecture` instead.
- Do not use this skill for QA review. Use `review-spec-compliance` instead.

## Outputs

- **Mascot frames** in `public/` — `mascot-frame-01.png` through `mascot-frame-08.png` (256x256 each).
- **Mascot expressions** in `public/` — `mascot-expr-{expression}.png` (64x64 each, 9 expressions).
- **Icons** in `public/` — `icon-{name}.png` (64x64 each, 20 icons).
- **Wallpapers** in `public/` — `wallpaper-{name}.png`.
- **Decorative assets** in `public/` — `deco-{name}.png`.

## Safety Caps

- **50 assets max per generation run.** Never generate more than 50 assets in a single invocation to prevent runaway generation.
- **Locked palette.** Any pixel that uses a color not in the 10-token palette is a generation violation. Reject and regenerate.
- **No anti-aliasing.** Pixel art assets must never use anti-aliasing, sub-pixel rendering, or alpha-blended edges on shapes. Every pixel is either fully opaque or fully transparent.
- **No code generation.** This skill produces PNG/WebP files only. It never writes React components, CSS, or JavaScript.
