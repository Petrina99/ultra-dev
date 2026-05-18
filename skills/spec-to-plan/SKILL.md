---
name: spec-to-plan
description: Reads an existing spec.md and produces docs/ultra-dev/<slug>/plan.md with Tasks, Dependencies, and Verification sections. Does NOT auto-trigger; runs only when chained from spec-writing or invoked explicitly via the Skill tool by name.
---

# spec-to-plan

Turn a written spec into an executable plan. Input: `docs/ultra-dev/<slug>/spec.md`. Output: `docs/ultra-dev/<slug>/plan.md`.

## Prompting

Fixed-choice prompts in this skill (slug pick, chain prompt) MUST use the `AskUserQuestion` tool so the user picks with arrow keys. `Other` covers free-text (e.g. `changes: ...`).

## Triggers

- Chained from `spec-writing` after the user answers `yes` to "ready to write plan?".
- Explicit invocation via the Skill tool by name (`spec-to-plan`).
- **Do not auto-trigger on keywords.** No description-based matching beyond the explicit invocation path.

## Process

### 1. Resolve slug

- If chained from `spec-writing`: the slug is already in scope. Use it.
- Else: list directories under `docs/ultra-dev/*/` and ask via `AskUserQuestion`:
  - Question: `Pick a feature directory.`
  - Header: `Feature`
  - Options: one per existing slug (label = slug). If more than 4 exist, show the 3 most-recently-modified; user can type a slug via `Other`.
- Slug rule (for reference, do not regenerate here): kebab-case, max 4 words, lowercase, with collision suffix `-2`, `-3`, ... assigned by `brainstorm`.

### 2. Require spec

- Verify `docs/ultra-dev/<slug>/spec.md` exists.
- If absent, error and stop:
  ```
  no spec found at docs/ultra-dev/<slug>/spec.md. Run brainstorm and spec-writing first.
  ```
- Do not create a stub. Do not guess.

### 3. Read spec, derive plan

Read `spec.md` end-to-end. Map every acceptance-criteria item to at least one task.

Copy the skeleton from `templates/plan.md` (repo root) into `docs/ultra-dev/<slug>/plan.md`, then replace `<Feature title>` and the example task / dependency / interface / verification lines with the real content. Strip the HTML comment block after filling. Sections, in this exact order — same as the template:

1. `# Plan: <Feature title>` header + `Spec: ./spec.md` link
2. `## Tasks`
3. `## Dependencies`
4. `## Interfaces`
5. `## Verification`

If `templates/plan.md` is missing, fall back to writing the same five sections inline.

#### Task format (exact)

```
N. [tag(s)] action — needs: X,Y — verify: <command>
```

- `N` is a 1-based integer.
- `[tag(s)]` is one or more open tags in brackets, comma-separated. Example tags: `frontend`, `backend`, `db`, `infra`, `third-party`, `test`, `docs`, `config`, `skill`. Tags are open — do not validate or restrict the taxonomy.
- `action` is an imperative phrase describing the task.
- `needs: —` when the task has no dependency. Otherwise `needs: 1,3` listing prerequisite task numbers.
- `verify:` is REQUIRED. Concrete shell command (`pnpm tsc --noEmit`, `pytest tests/foo.py`, `npm run lint -- src/foo.ts`, `cargo check -p foo`, etc.). Must exit non-zero on failure. If no automatable check exists, write `verify: manual: <one-line check>` — but prefer an automatable check whenever possible.
- The dash separator before `needs:` and before `verify:` is the em-dash `—`, not a hyphen.
- **Scope cap:** each task should describe ≤ ~150 LOC of expected change. If a task implies more, split it.

#### Dependencies section

State explicit batches so `executing-plan` can dispatch parallel work without re-parsing intent. Use plain language:

- "Parallel batch A: tasks N, M (no shared files AND no shared types/interfaces)"
- "Sequential after A: task K"
- "Parallel batch B after A: tasks P, Q (no shared files AND no shared types/interfaces)"

A task belongs to a parallel batch only if **all** hold:
- shares no edited files with other batch members, AND
- shares no produced symbols (functions, types, schemas, routes) with other batch members — i.e. neither task creates or renames a symbol the other consumes.

Otherwise serialize. When in doubt, serialize — parallel drift is the #1 source of bugs in executed plans.

#### Interfaces section

List every cross-task symbol with its exact final name and signature: functions, types, classes, DB columns, routes, env vars, CLI flags. Tasks downstream must use these names verbatim — this is the contract that prevents rename drift between subagents.

Example:
- `validateInput(input: string): Result` — created in task 2, used by tasks 4, 7
- `users.created_at timestamptz NOT NULL` — created in task 1, queried in task 5
- `GET /api/foo` returns `{ id, name }` — created in task 3, consumed in task 6

If a symbol is purely internal to one task, omit it.

#### Verification section

Checkbox list. Each item is a concrete way to confirm the plan is done — smoke test command, file existence check, manual inspection, or end-to-end scenario. No vague "looks good" entries.

### 4. Self-review

After writing the plan, walk the file and check:

- [ ] Every acceptance criterion in `spec.md` is covered by at least one task.
- [ ] No placeholders (`<TODO>`, `<fill in>`, `XXX`, `...`) remain.
- [ ] Type and name consistency: if task 5 references `validateInput()`, task 3 must be the one that creates it under that exact name, and `## Interfaces` must list `validateInput` with its exact signature.
- [ ] Every cross-task symbol appears in `## Interfaces` with exact name + signature.
- [ ] Every `needs:` reference points to an existing earlier task number.
- [ ] Every task has at least one tag.
- [ ] Every task has a `verify:` command (automatable preferred, `manual:` only as fallback).
- [ ] No task implies > ~150 LOC of change. Split if so.
- [ ] `Dependencies` section accounts for every task; parallel batches share no files AND no produced symbols.
- [ ] `Verification` section has at least one concrete check per acceptance-criteria cluster.

Fix issues inline. Do not defer.

### 5. Chain prompt

After self-review passes, ask via `AskUserQuestion`:

- Question: `Plan written at docs/ultra-dev/<slug>/plan.md. Ready to execute?`
- Header: `Execute`
- Options: `Yes — execute`, `No — stop`, `Request changes` (description: `Provide change notes via Other`).

Behavior:

- `Yes` — invoke `executing-plan` via the Skill tool.
- `No` — stop. Artifact remains on disk.
- `Other` / change notes — apply the requested revisions to `plan.md`, re-run step 4 (self-review), then re-ask.

## Checklist

- [ ] Slug resolved (chain context or directory pick).
- [ ] `docs/ultra-dev/<slug>/spec.md` confirmed present.
- [ ] `plan.md` written with header `# Plan: <title>` and `Spec: ./spec.md` link.
- [ ] `## Tasks` populated, every task in `N. [tags] action — needs: X,Y — verify: <command>` form.
- [ ] `## Dependencies` lists explicit batches; parallel batches share no files AND no produced symbols.
- [ ] `## Interfaces` declares every cross-task symbol with exact name + signature.
- [ ] `## Verification` is a checkbox list of concrete checks.
- [ ] Self-review pass clean.
- [ ] Chain prompt asked.

## Conventions

- Per-feature directory: `docs/ultra-dev/<slug>/`.
- Slug: kebab-case, max 4 words, lowercase, collision suffix `-2`, `-3`, ... (set by `brainstorm`, not regenerated here).
- Plan file path: `docs/ultra-dev/<slug>/plan.md`.
- Plan template sections, in order: header + spec link, `## Tasks`, `## Dependencies`, `## Verification`. No extra top-level sections.
- Task format: `N. [tag(s)] action — needs: X,Y` (em-dash, `needs: —` for none).
- Tags: open taxonomy, never validated.
