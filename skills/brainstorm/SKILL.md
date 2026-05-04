---
name: brainstorm
description: Use before any creative work — designing a feature, planning a change, building a component, adding functionality, modifying behavior, scoping a UI, or shaping new build work. Explores intent, constraints, and trade-offs, derives a topic slug, and ends by offering to hand off to spec-writing.
---

# Brainstorm

Turn a raw idea into an approved design. Stop at the design — do NOT write spec.md, plan.md, or code. Hand off to `spec-writing` only on explicit user `yes`.

## Triggers

Auto-fire on prompts that mention: feature, change, build, component, functionality, behavior, UI, screen, flow, redesign, refactor idea, "let's design...", "I want to add...", "what if we...".

## Hard rules

- No code. No file scaffolding. No spec.md. No plan.md.
- Do not invoke any other skill until the user types `yes` at the final prompt.
- Every brainstorm produces a design, even for "trivial" requests. The design may be three sentences; it must still be presented and approved.
- One question at a time. Multiple choice preferred (a/b/c) so the user can answer in one keystroke.

## Process

Run these steps in order. Do not skip.

### 1. Context discovery

Before asking anything, scan the project:

- List top-level files and directories.
- Read `README*`, `CLAUDE.md`, `AGENTS.md`, `package.json` / `pyproject.toml` / equivalent if present.
- If the repo is a git repo, read the last 10 commit subjects for tone and active areas. If not a git repo, skip silently.
- Note the tech stack, framework conventions, existing module boundaries, naming style.

Do not summarise the repo back to the user unless asked. Use the context to ask sharper questions.

### 1b. Offer research

Before clarifying questions, ask the user verbatim:

```
Research libraries / frameworks / services for this topic first? (yes / no)
```

- `no` → continue to step 2.
- `yes`:
  1. Derive a preliminary slug from the user's initial topic using the same rule as step 5 (kebab-case, ≤4 words, collision suffix).
  2. Create `docs/ultra-dev/<slug>/` if it does not yet exist. Show the slug on one line: `Slug: <slug>  (dir: docs/ultra-dev/<slug>/)`.
  3. Invoke the `research` skill via the Skill tool with that slug in scope.
  4. When `research` returns, resume at step 2. The research output (and the file at `docs/ultra-dev/<slug>/research.md`) is additional context for clarifying questions and approach proposals.
  5. At step 5, **reuse the slug derived here** — do not re-derive. If the approved goal diverges from the initial topic, ask the user before renaming the directory.

Skip this step entirely if the user already triggered `research` earlier in the session — do not re-ask.

### 2. Clarifying questions — one at a time

Loop:

1. Ask the single most load-bearing open question. Format:
   ```
   Q: <question>
     a) <option>
     b) <option>
     c) <option>  (or "other: ...")
   ```
2. Wait for the answer.
3. Pick the next question based on the answer.

Cover, in roughly this priority order: purpose / user, success criteria, hard constraints (perf, deps, compat), scope boundary, integration points, failure modes. Stop when the next question would have an obvious answer.

### 3. Propose 2–3 approaches

Present approaches side by side. For each:

- **Name** — one short label.
- **Sketch** — 2–4 sentences.
- **Trade-offs** — pros, cons, risk, mitigation.

End with a recommendation and one-sentence rationale. Ask the user to pick or steer.

### 4. Present design in sections, approve per section

Break the chosen approach into sections scaled to complexity (typical: Goal, Scope in/out, Key decisions, Architecture sketch, Open questions). For each section:

1. Present the section.
2. Ask: `Approve <section>? (yes / changes: ...)`
3. On `changes: ...` revise that section and re-ask. Do not advance until the user approves.

Keep sections short. Do not pad.

### 5. Slug derivation

Derive the feature slug from the approved design's goal:

- Lowercase, kebab-case, ASCII only.
- Max 4 words. Drop filler ("a", "the", "for", "of", "to") before counting.
- Example: "Add dark-mode toggle to settings" → `dark-mode-toggle`.

Collision rule: if `docs/ultra-dev/<slug>/` already exists, suffix `-2`, `-3`, … and pick the lowest free suffix. Example: `dark-mode-toggle` taken → try `dark-mode-toggle-2`.

Show the chosen slug to the user in one line:
```
Slug: <slug>  (dir: docs/ultra-dev/<slug>/)
```

### 6. Create the feature directory

Create `docs/ultra-dev/<slug>/` as an empty directory. Do not write any files into it. `spec-writing` owns `spec.md`; `spec-to-plan` owns `plan.md`; `executing-plan` owns `notes.md`.

### 7. Hand-off prompt

End the skill with this exact prompt:

```
Brainstorm complete. Ready to write spec? (yes / no / changes: ...)
```

Then:

- On `yes` — invoke `spec-writing` via the Skill tool. Pass the slug and approved design as context.
- On `no` — stop. Leave the empty `docs/ultra-dev/<slug>/` in place. The conversation context remains the source of truth; if the user re-invokes `spec-writing` later in the same session it can read from there.
- On `changes: ...` — revise the design (loop back to step 4 for the affected sections), then re-ask the hand-off prompt.

## Checklist

Before issuing the hand-off prompt, verify:

- [ ] Project context was scanned.
- [ ] Clarifying questions were asked one at a time.
- [ ] 2–3 approaches with trade-offs were presented.
- [ ] Design was presented in sections, each approved.
- [ ] Slug is kebab-case, ≤ 4 words, collision-resolved.
- [ ] `docs/ultra-dev/<slug>/` exists and is empty.
- [ ] No spec.md, plan.md, or code was written.

## Anti-pattern: "this is too simple to design"

Every request goes through the process. A toggle, a copy change, a one-line config — all of them. The design can be three sentences. Skipping the design is where unexamined assumptions waste the most time. Present and get approval, however short.
