---
name: animate-motion
description: Implement Framer Motion animations and CSS keyframes with locked timing values
---

# Animate Motion

## Objective

Implement all Framer Motion animations and CSS keyframe animations for Adam OS: window drag/resize, CV download theater sequence, mascot swing/crawl animations, boot sequence staging, cursor trails, halftone drift, icon hover effects, and all interactive transitions. Every timing value must come from the locked animation timings table in the Master Build Prompt.

## Rules of Engagement

1. **Timing values are locked.** Use only the animation timings defined in the Master Build Prompt. Never invent a `duration`, `delay`, `stagger`, or `easing` value. If a timing is not specified, use the nearest defined value.
2. **Framer Motion for React animations.** All component enter/exit, layout, and gesture animations use Framer Motion (`framer-motion`). Never use React Spring, GSAP, or other animation libraries.
3. **CSS keyframes for pixel loops.** Sprite-based animations (mascot walk cycle, icon hover pixel shifts, scanline effects) use CSS `@keyframes` with `animation:`. This keeps pixel art frame-switching off the JavaScript thread.
4. **16ms per frame minimum.** No animation step may be shorter than 16ms (≈60fps). If a computed step would be faster, clamp to 16ms. This prevents sub-frame jank.
5. **prefers-reduced-motion is mandatory.** Every animation must respect `prefers-reduced-motion: reduce`. In reduced-motion mode: disable all decorative animations, reduce functional animations to instant state changes, keep focus indicators visible. Never remove focus outlines in reduced-motion mode.
6. **Window open: stagger children.** When a window opens, its content children animate in with a stagger. The stagger delay is locked in the timings table. Never hardcode a stagger value.
7. **Window close: exit before unmount.** When a window closes, the exit animation must complete before the component unmounts. Use Framer Motion's `AnimatePresence` with `mode="wait"` or appropriate mode.
8. **Boot sequence: strict staging.** The boot sequence animations must follow the exact staging order in the Master Build Prompt: BIOS text → logo reveal → loading bar → desktop appear. Each stage waits for the previous stage to complete.
9. **Mascot swing: spring physics.** The mascot swing animation uses Framer Motion spring transition with the locked stiffness and damping values. Never use a linear or ease timing for the swing.
10. **CV download theater: orchestrated sequence.** The CV download theater is a multi-step animation sequence with locked timings for each step. The sequence must complete in the specified total duration. No step may overlap or start early.
11. **No layout thrashing.** Animations must not cause layout recalculations. Use `transform` and `opacity` only for animated properties. Never animate `width`, `height`, `top`, `left`, `margin`, or `padding` directly — use `transform: translate()` and `transform: scale()` instead.

## External Skills

- **ui-ux-pro-max** — Use for animation UX patterns, interaction states, reduced-motion best practices, and animation accessibility guidelines.

## Instructions

1. Read `architecture.md` to understand which components need animations and their dependencies.
2. Read `adam-os-spec/AdamOS_MasterBuildPrompt_v1.0.txt` to extract the full animation timings table and animation behavior specifications.
3. Read `adam-os-spec/AdamOS_ArtBible_v1.0.pdf` for pixel animation rules (mascot frame timing, sprite sheet layout, CSS keyframe patterns).
4. Consult `ui-ux-pro-max` for animation UX best practices, reduced-motion patterns, and animation accessibility requirements.
5. Implement window open/close animations using Framer Motion `AnimatePresence` with locked durations and easings from the timings table.
6. Implement window drag/resize using Framer Motion drag constraints with locked spring physics values.
7. Implement the boot sequence staging animation with strict stage ordering and locked timings per stage.
8. Implement mascot animations (swing, crawl) using Framer Motion spring transitions with locked stiffness/damping. Implement mascot expression transitions with CSS keyframes for pixel frame switching.
9. Implement the CV download theater sequence with locked per-step timings and total duration. Use `AnimatePresence` to orchestrate the multi-step sequence.
10. Implement cursor trails, halftone drift, icon hover effects, and scanline animations using CSS `@keyframes`. Add `prefers-reduced-motion` media queries to disable all decorative animations.
11. Verify all animations respect `prefers-reduced-motion: reduce`. Ensure no animation causes layout thrashing. Verify all timing values match the locked timings table.

## When to Use

- During the build phase, after React components have been built by `build-chrome`.
- When animation timings have been updated in the spec and animations need to be adjusted.
- When a new animated interaction is added to the spec.

## When NOT to Use

- Do not use this skill to build React components. Use `build-chrome` instead.
- Do not use this skill to generate visual assets. Use `generate-pixel-assets` instead.
- Do not use this skill to write text copy. Use `write-copy` instead.
- Do not use this skill to plan architecture. Use `plan-architecture` instead.
- Do not use this skill for QA review. Use `review-spec-compliance` instead.

## Outputs

- **Framer Motion animations** co-located with React components in `src/components/` — `AnimatePresence`, `motion.div`, spring transitions, and gesture animations.
- **CSS keyframes** in `src/styles/animations.css` — sprite frame switching, scanlines, halftone drift, cursor trails, and all pixel-loop animations.
- **Reduced-motion overrides** in `src/styles/reduced-motion.css` — `prefers-reduced-motion` media queries that disable decorative animations and preserve functional ones.

## Safety Caps

- **16ms per frame minimum.** No animation step shorter than 16ms. Clamp any computed value below 16ms up to 16ms.
- **Locked timings only.** Any animation using a duration, delay, stagger, or easing not in the Master Build Prompt timings table is a violation.
- **No layout properties.** Animating `width`, `height`, `top`, `left`, `margin`, or `padding` is a violation. Use `transform` and `opacity` only.
- **prefers-reduced-motion is non-negotiable.** Any animation that does not respect reduced-motion is a violation.
- **Framer Motion only for React.** No other animation libraries may be imported.
