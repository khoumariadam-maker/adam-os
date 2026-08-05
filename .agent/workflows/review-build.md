---
description: Run QA compliance review on the current build
---

# Review Build

## Steps

1. Run the `review-spec-compliance` skill: Read all generated files, run banned phrases check, run anti-slop audit on all code, run color contrast audit, run performance budget check, run mobile UX compliance, run Art Bible compliance, run copyright guardrails, run accessibility check. Produce compliance-report.md.

## Inputs

- All generated project files
- `adam-os-spec/AdamOS_MasterBuildPrompt_v1.0.txt`
- `adam-os-spec/AdamOS_ArtBible_v1.0.pdf`
- External skills: `anti-slop`, `ui-ux-pro-max`

## Outputs

- `compliance-report.md`
