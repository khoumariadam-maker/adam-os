---
name: plan-architecture
description: Design the full component tree, state architecture, and build sequence for Adam OS
---

# Plan Architecture

## Objective

Design the complete component tree, state management architecture, window manager architecture, and coordinate the build sequence for Adam OS. Produce an `architecture.md` document that serves as the single source of truth for all subsequent build personas.

## Rules of Engagement

1. **Read the specs first.** Always read both `adam-os-spec/AdamOS_MasterBuildPrompt_v1.0.txt` and `adam-os-spec/AdamOS_ArtBible_v1.0.pdf` in full before making any architectural decision. No freelancing.
2. **Map every component from the spec.** The Component Inventory in the Master Build Prompt is the authoritative list. Every component in the inventory must appear in the architecture. No components may be omitted.
3. **Never introduce components not in the spec.** If a component is not listed in the Master Build Prompt's Component Inventory, it does not exist in the architecture. Do not add "helper" components, "wrapper" components, or any component not explicitly specified.
4. **Respect the dependency graph.** Components that depend on other components must be built after their dependencies. Document the dependency order explicitly.
5. **Identify parallel-safe work.** Components with no cross-dependencies can be built simultaneously. Group these into parallel work sets to maximize build efficiency.
6. **Consult ui-ux-pro-max before finalizing.** Validate component spec patterns, UX flow best practices, and design system token structure with the external skill before writing the architecture document.

## External Skills

- **ui-ux-pro-max** — Use for design system tokens, UX flow validation, component spec standards, accessibility patterns, and spacing scale reference.

## Instructions

1. Read `adam-os-spec/AdamOS_MasterBuildPrompt_v1.0.txt` in full.
2. Read `adam-os-spec/AdamOS_ArtBible_v1.0.pdf` in full.
3. Extract the Component Inventory from the Master Build Prompt. List every component with its props, state requirements, and parent-child relationships.
4. Build the dependency graph: for each component, identify which other components it imports, renders, or shares state with.
5. Determine the build order: topological sort the dependency graph so that no component is built before its dependencies.
6. Identify parallel work groups: group components that share no dependencies and can be built simultaneously.
7. Map the state architecture: identify shared state (window manager state, language state, sound state), local state, and derived state. Document the state flow.
8. Define the window manager architecture: window z-ordering, focus management, drag/resize boundaries, minimize/maximize behavior, taskbar integration.
9. Consult `ui-ux-pro-max` for component spec pattern validation and UX flow best practices. Incorporate feedback.
10. Write `architecture.md` with sections: Component Tree, Dependency Graph, Build Order, Parallel Work Groups, State Architecture, Window Manager Architecture, and Integration Points.

## When to Use

- At the start of the Adam OS build, before any code or assets are generated.
- When the spec documents have been updated and the architecture needs to be revised.
- When a new component is added to the Component Inventory in the spec.

## When NOT to Use

- Do not use this skill to write code. It produces architecture documents only.
- Do not use this skill to generate visual assets.
- Do not use this skill to write text copy.
- Do not use this skill after the architecture is finalized and the build is in progress, unless the spec has changed.

## Outputs

- **`architecture.md`** — Single source of truth document containing the full component tree, dependency graph, build order, parallel work groups, state architecture, window manager architecture, and integration points.

## Safety Caps

- **Read-only.** This skill never writes code, never generates assets, and never writes text copy. It produces architecture documentation only.
- **No speculative components.** Every component in the architecture must trace back to the Component Inventory in the Master Build Prompt.
- **No code generation.** The architecture document describes structure and relationships; it does not contain implementation code.
