---
name: spec-writing
description: Produces `docs/ultra-dev/<slug>/spec.md` from a brainstorming conversation or existing context. Does NOT auto-trigger from generic prompts; runs only when chained from `brainstorm` or invoked explicitly via the Skill tool by name.
---

# spec-writing

Convert a brainstorming conversation (or equivalent context already in the session) into a single `spec.md` artifact under `docs/ultra-dev/<slug>/`. One feature per run. No code, no implementation detail.

## Triggers

- Auto-trigger: **none**. This skill is silent on generic feature/change/UI/build prompts.
- Run conditions:
  1. Chained from `brainstorm` after the user answered `yes` to "ready to write spec?".
  2. Explicit invocation via the Skill tool by the literal name `spec-writing`.

If neither condition holds, do not run.

## Process

### 1. Resolve slug

- **Chained from brainstorm:** the slug is already in scope. `brainstorm` created `docs/ultra-dev/<slug>/`. Reuse it. Do not re-derive.
- **Standalone invocation:** list directories matching `docs/ultra-dev/*/` and prompt the user to pick one:

  ```text
  Pick a feature directory:
    1. <slug-a>
    2. <slug-b>
    ...
  ```

  If `docs/ultra-dev/` contains no feature directories, stop with:

  ```text
  Error: no ultra-dev features found. Run brainstorm first.
  ```

**Slug rule (inherited from brainstorm, repeated for standalone use):** kebab-case, max 4 words, lowercase. Collision suffix `-2`, `-3`, ... picking the lowest free suffix. spec-writing inherits the slug from brainstorm; when standalone, it picks an existing slug — it does not invent new ones.

### 2. Write `docs/ultra-dev/<slug>/spec.md`

Copy the skeleton from `templates/spec.md` (repo root) into `docs/ultra-dev/<slug>/spec.md`, then fill every `<...>` placeholder. Strip the HTML comment block after filling. Five sections, in this exact order — same as the template:

1. `# <Feature title>`
2. `## Goal`
3. `## Scope` (with `**In:**` and `**Out:**` bullet lists)
4. `## Acceptance criteria`
5. `## Architecture sketch`
6. `## Open questions`

If `templates/spec.md` is missing (vendored install, pruned tree), fall back to writing the same six headings inline.

Rules:

- `# <Feature title>` is a human-readable title, not the slug.
- `## Goal`: 1-3 sentences, what + why. No implementation steps.
- `## Scope`: explicit `**In:**` and `**Out:**` bullet lists. "Out" is as important as "In".
- `## Acceptance criteria`: GitHub-style checkbox list (`- [ ]`). Each item must be a testable outcome — something a reader can later mark done by running or observing the system. No vague items.
- `## Architecture sketch`: components, data flow, integration points, layout if relevant. Prose or bullets. Code blocks for directory layouts are fine; **no executable code, no API signatures**.
- `## Open questions`: bullets. If none, leave the section heading with no bullets. **Unresolved questions block the plan stage** — flag this to the user when re-asking the chain prompt.

### 3. Self-review pass

Run inline after the file is written. No subagent dispatch, no separate review skill.

Checks:

- **Placeholder scan:** no `TBD`, `TODO`, `<...>`, "handle edge cases", "etc.", "and more", "various". Replace each with concrete content or remove.
- **Internal consistency:** the architecture sketch describes the same feature surface that Goal + Scope + Acceptance criteria describe. No orphan components, no acceptance criteria that the architecture cannot satisfy.
- **Scope check:** the spec covers a single coherent feature, not a multi-system bundle. If it spans more than one feature, split or narrow before continuing.
- **Ambiguity check:** each requirement is readable exactly one way. Reword anything a second reader could parse two ways.

Fix issues inline by editing the file. Do not produce a separate review report.

### 4. Chain prompt

After self-review, ask the user verbatim:

```text
Spec written at `docs/ultra-dev/<slug>/spec.md`. Ready to write plan? (`yes` / `no` / `changes: ...`)
```

If the spec still has bullets under `## Open questions`, append a one-line warning before the prompt:

```text
Note: open questions remain — these block the plan stage until resolved.
```

Handle the response:

- `yes` → invoke `spec-to-plan` via the Skill tool. Pass the slug in scope. Stop this skill.
- `no` → stop. Leave `spec.md` on disk untouched.
- `changes: <description>` → revise `spec.md` per the description, re-run the self-review pass, re-ask the chain prompt.

## Checklist

- [ ] Slug resolved (inherited from brainstorm, or picked from existing `docs/ultra-dev/*/`).
- [ ] `docs/ultra-dev/<slug>/spec.md` written with all five sections in order.
- [ ] Self-review pass complete: no placeholders, internally consistent, single-feature scope, unambiguous.
- [ ] Chain prompt asked verbatim; response handled.

## Conventions

- Per-feature directory: `docs/ultra-dev/<slug>/` containing `spec.md`, `plan.md`, optional `notes.md`.
- Slug: kebab-case, max 4 words, lowercase; collision suffix `-2`, `-3`, ... (lowest free).
- One feature per spec. One spec per run.
