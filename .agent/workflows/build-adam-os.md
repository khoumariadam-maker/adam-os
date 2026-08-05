---
description: Full build pipeline - plan architecture then build chrome then generate assets then animate motion then write copy then review compliance
---

# Build Adam OS

## Steps

1. Run the `plan-architecture` skill: Read both spec documents (Master Build Prompt + Art Bible), consult ui-ux-pro-max for component spec patterns and UX flow best practices, map the Component Inventory to a dependency graph, identify parallel-safe vs sequential work, produce architecture.md with component tree, state flow, build order, and parallel work groups.

2. Run the `build-chrome` skill: Read architecture.md, consult ui-ux-pro-max for component states and accessibility, build all React components (WindowManager, Window, Desktop, Taskbar, StartMenu, BootSequence, content windows, LanguageToggle, SoundManager, mobile adaptations). Run anti-slop audit on each file.

3. Run the `generate-pixel-assets` skill: Read the Art Bible, consult pixel-art-sprites for palette design and sprite patterns, generate 8 mascot frames at 256x256, 20 icons at 64x64, wallpapers, decorative assets. Validate against palette rules.

4. Run the `animate-motion` skill: Read animation timings from Master Build Prompt, consult ui-ux-pro-max for animation UX, implement all Framer Motion animations (window open/close, boot sequence, mascot swing/crawl, CV download theater, icon hover, halftone drift, prefers-reduced-motion).

5. Run the `write-copy` skill: Read WHO IS ADAM section, write bio, project descriptions, speech bubbles, boot text, UI labels, Arabic translations. Run anti-slop audit on all text. Save i18n/en.json and i18n/ar.json.

6. Run the `review-spec-compliance` skill: Read all generated files, run banned phrases check, run anti-slop audit on all code, run color contrast audit, run performance budget check, run mobile UX compliance, run Art Bible compliance, run copyright guardrails, run accessibility check. Produce compliance-report.md.

## Inputs

- `adam-os-spec/AdamOS_MasterBuildPrompt_v1.0.txt`
- `adam-os-spec/AdamOS_ArtBible_v1.0.pdf`
- External skills: `ui-ux-pro-max`, `anti-slop`, `pixel-art-sprites`

## Outputs

- `architecture.md`, React components in `src/components/`, assets in `public/`, `i18n/en.json`, `i18n/ar.json`, `compliance-report.md`
