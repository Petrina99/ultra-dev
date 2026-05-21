# Plan: <Feature title>

Spec: ./spec.md

<!--
Template owned by the `spec-to-plan` skill.
Task line format (em-dash `—`, not hyphen):
  N. [tag(s)] action — needs: X,Y — verify: <command>
Use `needs: —` for a task with no prerequisites.
`verify:` is REQUIRED. Concrete shell command that proves the task done (typecheck, lint, build, unit test, smoke run). Use `verify: manual: <one-line check>` only when no automatable check exists.
Tags are an open taxonomy (frontend, backend, db, infra, third-party, test, docs, config, skill, ...).
Keep each task under ~150 LOC of expected change. Split larger tasks.
-->

## Tasks

1. [tag] action — needs: — — verify: <command>
2. [tag] action — needs: 1 — verify: <command>
3. [tag,tag] action — needs: 1,2 — verify: <command>

## Dependencies

- Parallel batch A: tasks 1, 4 (no shared files AND no shared types/interfaces)
- Sequential after A: task 2 (depends on 1)
- Sequential after batch A: task 3 (depends on 1, 2)

## Interfaces

<!--
Declare every cross-task symbol (function, class, type, route, table, env var) here with its exact final name and signature. Tasks downstream MUST use these names verbatim. Prevents rename drift across parallel subagents.
-->

- `validateInput(input: string): Result` — created in task N, used by tasks M, K
- `users` table columns: `id uuid, email text, created_at timestamptz` — created in task N
- `GET /api/foo` — created in task N, consumed in task M

## Verification

- [ ] <smoke test or command>
- [ ] <manual check>
- [ ] <command output to inspect>

## Smoke Tests

<!--
Manual smoke tests for developers. Each test = title + numbered steps + expected result.
Cover the golden path AND the obvious failure modes the feature must handle.
Be specific: real inputs, real URLs/routes, real button labels. No "verify it works" vibes.
-->

### 1. <Short scenario title>

**Goal:** <what this test proves>

**Steps:**
1. <action — concrete: click X, enter Y, run Z>
2. <action>
3. <action>

**Expected:** <observable result — text on screen, status code, log line, file written>

### 2. <Next scenario title>

**Goal:** <...>

**Steps:**
1. <...>
2. <...>

**Expected:** <...>
