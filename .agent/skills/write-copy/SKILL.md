---
name: write-copy
description: Write all text content with Adams voice - humble, friendly, nerdy, anti-slop, first-person
---

# Write Copy

## Objective

Write all text content for Adam OS in Adam's voice: humble, friendly, nerdy, anti-slop, and first-person. This includes the bio, project descriptions, speech bubbles, boot log text, UI labels, error messages, tooltips, and the complete i18n JSON dictionaries for English and Arabic.

## Rules of Engagement

1. **First person always.** Adam writes about himself as "I" and "my". Never use third person ("Adam is...") or passive voice ("It was built by..."). Example: "I built this" not "This was built by Adam".
2. **Specific, not generic.** Every project description must include specific technologies, specific outcomes, and specific numbers where possible. Never write "various technologies" — name them. Never write "improved performance" — say "reduced load time by 40%".
3. **Humor is dry and nerdy.** Jokes should be clever, subtle, and tech-flavored. Puns about code, bugs, and systems are welcome. Never use slapstick, sarcasm at someone's expense, or humor that punches down.
4. **Banned phrases are law.** The following phrases are permanently banned and must never appear in any text: "leverage", "synergy", "innovative", "cutting-edge", "world-class", "seamless", "robust", "scalable", "enterprise-grade", "next-generation", "paradigm shift", "game-changer", "disruptive", "passionate", "driven", "results-oriented", "team player", "dynamic", "in this ever-changing world", "at the end of the day", "think outside the box", "low-hanging fruit", "move the needle", "circle back", "deep dive", "sync up", "touch base", "pain point", "value proposition", "best practices", "state-of-the-art", "industry-leading", "mission-driven".
5. **Tone: humble brag, not brag brag.** Adam is proud of his work but never boastful. "I spent three weekends getting the physics right on this one" is good. "I'm a world-class developer" is banned. Confidence comes from specificity, not adjectives.
6. **Speech bubbles are casual.** The mascot's speech bubbles should read like a friend talking: short sentences, occasional exclamation marks, maybe a parenthetical aside. Never corporate, never formal, never longer than two sentences.
7. **Project descriptions tell a story.** Each project description should answer: what I built, why I built it, what I learned, and one specific technical detail that was interesting. Format: 2-4 sentences, never a bulleted list of features.
8. **English + Arabic (EN + AR).** All text must be written in English first, then translated to Arabic. The Arabic translation must be natural, not machine-translation literal. Arabic text must include proper RTL considerations. Both languages must have identical keys in the JSON dictionaries.
9. **One Spider-Man reference allowed.** Adam may make exactly one (1) Spider-Man reference across all copy. This is a nod to the Pixel Spider mascot. Use it wisely. It must be subtle, not a full paragraph about Spider-Man.
10. **Anti-slop is mandatory.** Every piece of text must pass the anti-slop audit before it is finalized. This is non-negotiable. If anti-slop flags a Cat 4 AI voice pattern, the text is rejected and must be rewritten.

## External Skills

- **anti-slop** — MANDATORY. Run anti-slop audit on ALL generated text before finalizing. Reject any text that triggers Cat 4 AI voice patterns. This is not optional. Every string, every label, every speech bubble, every project description must pass.

## Instructions

1. Read `adam-os-spec/AdamOS_MasterBuildPrompt_v1.0.txt` to extract the "WHO IS ADAM" section, the full list of required text content (bio, projects, speech bubbles, boot log, UI labels, error messages, tooltips), and the banned phrases list.
2. Read `adam-os-spec/AdamOS_ArtBible_v1.0.pdf` for any text style guidelines (font pairing for copy, speech bubble sizing constraints, max character counts per bubble).
3. Write the bio in first person, humble tone, with specific technical details and one nerdy joke. Run anti-slop audit. Rewrite if flagged.
4. Write each project description following the story format: what I built, why I built it, what I learned, one interesting technical detail. Run anti-slop audit on each. Rewrite if flagged.
5. Write the mascot speech bubbles: casual, short, friendly. One bubble per context (window open, idle, project hover, boot progress). Run anti-slop audit. Rewrite if flagged.
6. Write the boot log text: sequential lines that appear during the boot sequence. Technical and nerdy, not dry. Run anti-slop audit.
7. Write all UI labels, error messages, and tooltips. Clear and concise, no jargon where a simple word works. Run anti-slop audit.
8. Translate all English text to Arabic. Ensure natural phrasing, not literal translation. Ensure RTL-compatible text (no LTR-embedded numbers without proper bidi marks). Verify identical keys between EN and AR dictionaries.
9. Compile all text into `i18n/en.json` and `i18n/ar.json`. Run final anti-slop audit on both files. Reject and rewrite any flagged strings.

## When to Use

- During the build phase, after the architecture has been planned and components are being built.
- When the "WHO IS ADAM" section or project list has been updated in the spec.
- When a new UI label, error message, or speech bubble context is added to the spec.

## When NOT to Use

- Do not use this skill to build React components. Use `build-chrome` instead.
- Do not use this skill to generate visual assets. Use `generate-pixel-assets` instead.
- Do not use this skill to implement animations. Use `animate-motion` instead.
- Do not use this skill to plan architecture. Use `plan-architecture` instead.
- Do not use this skill for QA review. Use `review-spec-compliance` instead.

## Outputs

- **`i18n/en.json`** — Complete English text dictionary with keys for bio, projects, speech bubbles, boot log, UI labels, error messages, and tooltips.
- **`i18n/ar.json`** — Complete Arabic text dictionary with identical keys to en.json, natural Arabic translations, and proper RTL considerations.

## Safety Caps

- **Anti-slop is mandatory.** No text is final until it passes the anti-slop audit. Any text flagged as Cat 4 AI voice pattern is automatically rejected.
- **Banned phrases are zero-tolerance.** Any banned phrase appearing in any text is an immediate violation. No exceptions, no "it's fine in context".
- **No code generation.** This skill produces JSON text files only. It never writes React components, CSS, or JavaScript.
- **No asset generation.** This skill never produces PNG/WebP files.
- **One Spider-Man reference max.** If more than one Spider-Man reference is found across all generated text, the excess references must be removed.
