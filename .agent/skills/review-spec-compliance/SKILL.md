---
name: review-spec-compliance
description: Self-review pass checking banned phrases, WCAG contrast, performance budget, mobile UX, and full spec adherence
---

# Review Spec Compliance

## Objective

Run a comprehensive self-review pass on the Adam OS build, checking: banned phrases in all text, WCAG AA color contrast compliance, performance budget adherence, mobile UX rules, Art Bible compliance, copyright guardrails, accessibility compliance, anti-slop audit on all code, and full spec adherence. Produce a `compliance-report.md` that lists every violation with file, line, and suggested fix.

## Rules of Engagement

1. **The spec is law.** Read both spec documents in full before starting the review. Any deviation from the spec is a violation, regardless of whether it "looks better" or "seems fine".
2. **Every file must be reviewed.** No file in the project is exempt from review. This includes React components, CSS files, JSON files, assets, and configuration files.
3. **Flag with specificity.** Every violation must include: the file path, the line number (or line range), the rule violated, the current value, the expected value, and a suggested fix. No vague flags like "contrast issue somewhere".
4. **WCAG AA is the floor.** All text-background color combinations must meet WCAG AA contrast ratio: 4.5:1 for normal text, 3:1 for large text. Use the locked palette colors from the Art Bible. Calculate actual ratios; do not eyeball.
5. **Performance budget is non-negotiable.** The performance budget from the Master Build Prompt defines maximum bundle size, maximum time to interactive, maximum number of assets, and maximum animation frame budget. Any exceedance is a violation.
6. **Mobile UX rules are strict.** Touch targets must be at least 44x44px. No hover-only interactions. Windows must be draggable and resizable via touch. The taskbar must be accessible on small screens. Text must be readable without zooming.
7. **Art Bible compliance is pixel-level.** Verify every visual asset against the Art Bible: palette compliance, outline weight, pixel resolution, naming convention, and animation frame consistency.
8. **Copyright guardrails.** No third-party assets without proper licensing. No copied code without attribution. No trademarked names or logos used without permission. Verify all dependencies have compatible licenses.
9. **Read-only review.** This skill never modifies any file. It only produces violation reports. Fixes are suggested but never applied.
10. **All 7 anti-slop categories are checked.** Run the full anti-slop audit covering all 7 categories on every code file and every text file. Report violations by category.

## External Skills

- **ui-ux-pro-max** — Use for accessibility compliance checking (WCAG contrast, focus management, ARIA attributes), component state coverage verification, and design system token adherence validation.
- **anti-slop** — Run full anti-slop audit on all code files and all text files. All 7 categories must be checked. Report violations grouped by category with file and line references.

## Instructions

1. Read `adam-os-spec/AdamOS_MasterBuildPrompt_v1.0.txt` in full to extract all compliance requirements: banned phrases list, performance budget, mobile UX rules, accessibility requirements, and spec constraints.
2. Read `adam-os-spec/AdamOS_ArtBible_v1.0.pdf` in full to extract palette rules, asset specifications, naming conventions, and pixel art constraints.
3. Scan all files in the project. Build a file inventory: React components, CSS files, JSON text files, assets, configuration files.
4. Run the banned phrases check: scan all text content (i18n JSON, component inline text, alt attributes, aria-labels) for any banned phrase. Flag each occurrence with file, line, and the banned phrase found.
5. Run the WCAG AA contrast audit: for every text-background color combination in the UI, calculate the contrast ratio. Flag any combination below 4.5:1 (normal text) or 3:1 (large text). Use `ui-ux-pro-max` for contrast calculation validation.
6. Run the performance budget check: measure bundle size, count assets, estimate time to interactive, check animation frame budget. Flag any exceedance with current value vs. budget limit.
7. Run the mobile UX compliance check: verify touch target sizes, hover-only interactions, touch accessibility, taskbar visibility, text readability. Flag any violations.
8. Run the Art Bible compliance check: verify every asset against palette rules, pixel resolution, outline weight, naming convention, and mascot anatomy consistency. Flag any violations.
9. Run the copyright guardrails check: verify asset licensing, code attribution, dependency licenses, trademark usage. Flag any violations.
10. Run the full anti-slop audit: execute anti-slop on all code files and all text files, covering all 7 categories. Collect all violations grouped by category.
11. Compile `compliance-report.md` with sections: Summary (total violations by category), Banned Phrases, WCAG Contrast, Performance Budget, Mobile UX, Art Bible Compliance, Copyright Guardrails, Anti-Slop Audit (by category), and Suggested Fixes. Include file paths, line numbers, current values, expected values, and fix suggestions for every violation.

## When to Use

- At the end of the build, after all components, assets, animations, and copy have been produced.
- After any significant change to the codebase to verify compliance is maintained.
- When the spec documents have been updated to check if the existing build still complies.

## When NOT to Use

- Do not use this skill to fix violations. It produces reports only. Fixes must be applied by the appropriate persona (Chrome Builder, Pixel Artist, Motion Engineer, or Copywriter).
- Do not use this skill to plan architecture. Use `plan-architecture` instead.
- Do not use this skill to build components. Use `build-chrome` instead.
- Do not use this skill to generate assets. Use `generate-pixel-assets` instead.
- Do not use this skill to write copy. Use `write-copy` instead.
- Do not use this skill to implement animations. Use `animate-motion` instead.

## Outputs

- **`compliance-report.md`** — Comprehensive violation report with sections for each compliance category. Every violation includes file path, line number, rule violated, current value, expected value, and suggested fix. Includes a summary with total violation count by category.

## Safety Caps

- **Read-only.** This skill never modifies any file in the project. It only reads files and produces a report.
- **All 7 anti-slop categories are checked.** The anti-slop audit must cover all 7 categories: (1) verbose boilerplate comments, (2) unnecessary abstractions, (3) speculative/dead code, (4) AI voice patterns in text, (5) redundant type annotations, (6) over-engineered patterns, (7) generic placeholder content. No category may be skipped.
- **No auto-fix.** This skill never applies fixes, even if the fix is trivial. It only suggests fixes in the report.
- **Spec deviations are always violations.** There is no "close enough" threshold for spec compliance. If the implementation does not match the spec exactly, it is a violation.
