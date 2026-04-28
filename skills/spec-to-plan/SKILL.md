---
name: spec-to-plan
description: Reads an existing spec.md and produces docs/ultra-dev/<slug>/plan.md with Tasks, Dependencies, and Verification sections. Does NOT auto-trigger; runs only when chained from spec-writing or invoked explicitly via the Skill tool by name.
---

# spec-to-plan

Turn a written spec into an executable plan. Input: `docs/ultra-dev/<slug>/spec.md`. Output: `docs/ultra-dev/<slug>/plan.md`.

## Triggers

- Chained from `spec-writing` after the user answers `yes` to "ready to write plan?".
- Explicit invocation via the Skill tool by name (`spec-to-plan`).
- **Do not auto-trigger on keywords.** No description-based matching beyond the explicit invocation path.

## Process

### 1. Resolve slug

- If chained from `spec-writing`: the slug is already in scope. Use it.
- Else: list directories under `docs/ultra-dev/*/` and prompt the user to pick one. Example:
  ```
  Existing features:
    1. user-auth
    2. payment-flow
    3. core-skill-flow
  Pick a slug (number or name):
  ```
- Slug rule (for reference, do not regenerate here): kebab-case, max 4 words, lowercase, with collision suffix `-2`, `-3`, ... assigned by `brainstorm`.

### 2. Require spec

- Verify `docs/ultra-dev/<slug>/spec.md` exists.
- If absent, error and stop:
  ```
  no spec found at docs/ultra-dev/<slug>/spec.md. Run brainstorm and spec-writing first.
  ```
- Do not create a stub. Do not guess.

### 3. Read spec, derive plan

Read `spec.md` end-to-end. Map every acceptance-criteria item to at least one task. Use this 4-section template verbatim:

```markdown
# Plan: <Feature title>

Spec: ./spec.md

## Tasks

1. [tag(s)] action — needs: —
2. [tag(s)] action — needs: 1
3. [tag(s)] action — needs: 1,2

## Dependencies

- Parallel batch A: tasks 1, 4 (no shared files)
- Sequential after A: task 2 (depends on 1)
- Sequential after batch A: task 3 (depends on 1, 2)

## Verification

- [ ] <smoke test or command>
- [ ] <manual check>
- [ ] <command output to inspect>
```

#### Task format (exact)

```
N. [tag(s)] action — needs: X,Y
```

- `N` is a 1-based integer.
- `[tag(s)]` is one or more open tags in brackets, comma-separated. Example tags: `frontend`, `backend`, `db`, `infra`, `third-party`, `test`, `docs`, `config`, `skill`. Tags are open — do not validate or restrict the taxonomy.
- `action` is an imperative phrase describing the task.
- `needs: —` when the task has no dependency. Otherwise `needs: 1,3` listing prerequisite task numbers.
- The dash separator before `needs:` is the em-dash `—`, not a hyphen.

#### Dependencies section

State explicit batches so `executing-plan` can dispatch parallel work without re-parsing intent. Use plain language:

- "Parallel batch A: tasks N, M (no shared files)"
- "Sequential after A: task K"
- "Parallel batch B after A: tasks P, Q (no shared files)"

A task belongs to a parallel batch only if it shares no edited files with other batch members. Otherwise serialize.

#### Verification section

Checkbox list. Each item is a concrete way to confirm the plan is done — smoke test command, file existence check, manual inspection, or end-to-end scenario. No vague "looks good" entries.

### 4. Self-review

After writing the plan, walk the file and check:

- [ ] Every acceptance criterion in `spec.md` is covered by at least one task.
- [ ] No placeholders (`<TODO>`, `<fill in>`, `XXX`, `...`) remain.
- [ ] Type and name consistency: if task 5 references `validateInput()`, task 3 must be the one that creates it under that exact name.
- [ ] Every `needs:` reference points to an existing earlier task number.
- [ ] Every task has at least one tag.
- [ ] `Dependencies` section accounts for every task.
- [ ] `Verification` section has at least one concrete check per acceptance-criteria cluster.

Fix issues inline. Do not defer.

### 5. Chain prompt

After self-review passes, ask the user verbatim:

```
Plan written at docs/ultra-dev/<slug>/plan.md. Ready to execute? (yes / no / changes: ...)
```

Behavior:

- `yes` — invoke `executing-plan` via the Skill tool.
- `no` — stop. Artifact remains on disk.
- `changes: <text>` — apply the requested revisions to `plan.md`, re-run step 4 (self-review), then re-ask.

## Checklist

- [ ] Slug resolved (chain context or directory pick).
- [ ] `docs/ultra-dev/<slug>/spec.md` confirmed present.
- [ ] `plan.md` written with header `# Plan: <title>` and `Spec: ./spec.md` link.
- [ ] `## Tasks` populated, every task in `N. [tags] action — needs: X,Y` form.
- [ ] `## Dependencies` lists explicit batches.
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
