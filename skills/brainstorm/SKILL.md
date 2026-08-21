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
- **Batch questions.** `AskUserQuestion` takes up to 4 questions per call — always fill the call. Never ask one question per turn; every extra call is a full round trip the user waits on. Budget for the whole skill: **≤ 4 blocking prompts** (clarifiers, approach, design approval, hand-off).
- **Prompting**: every fixed-choice prompt in this skill (clarifiers, approach pick, approve/changes, hand-off) MUST be issued via the `AskUserQuestion` tool so the user picks with arrow keys. Use `Other` for free-text (e.g. `changes: ...`). Only fall back to plain-text prompts when the answer is genuinely free-form (slug name override, long descriptions).

## Process

Run these steps in order. Do not skip.

### 1. Context discovery

Before asking anything, scan the project:

- List top-level files and directories.
- Read `README*`, `CLAUDE.md`, `AGENTS.md`, `package.json` / `pyproject.toml` / equivalent if present.
- If the repo is a git repo, read the last 10 commit subjects for tone and active areas. If not a git repo, skip silently.
- Note the tech stack, framework conventions, existing module boundaries, naming style.

Do not summarise the repo back to the user unless asked. Use the context to ask sharper questions.

### 2. Clarifying questions — batched

**One `AskUserQuestion` call, 4 questions.** Pick the 4 most load-bearing unknowns from: purpose / user, success criteria, hard constraints (perf, deps, compat), scope boundary, integration points, failure modes, and whether to research libraries first. Drop any whose answer is already obvious from step 1 — fewer than 4 is fine, more than one call is not.

Each question gets 2-4 labelled options with a one-line `description` so trade-offs are visible; the tool auto-adds `Other` for free-text.

A **second** call is allowed only when an answer invalidates the premise of the design (not merely to fill in detail). Hard ceiling: 2 clarifier calls.

Include the research question in the first batch:

- Question: `Research libraries / frameworks / services for this topic first?`
- Header: `Research`
- Options: `Yes`, `No`

Skip it if the user already triggered `research` earlier in the session. On `Yes`, after the batch returns:

1. Derive a preliminary slug from the user's initial topic using the same rule as step 5 (kebab-case, ≤4 words, collision suffix).
2. Create `docs/ultra-dev/<slug>/` if it does not yet exist. Show the slug on one line: `Slug: <slug>  (dir: docs/ultra-dev/<slug>/)`.
3. Invoke the `research` skill via the Skill tool with that slug in scope.
4. When `research` returns, continue to step 3. `docs/ultra-dev/<slug>/research.md` is additional context for the approach proposals.
5. At step 5, **reuse the slug derived here** — do not re-derive. If the approved goal diverges from the initial topic, ask the user before renaming the directory.

### 3. Propose 2–3 approaches

Present approaches side by side. For each:

- **Name** — one short label.
- **Sketch** — 2–4 sentences.
- **Trade-offs** — pros, cons, risk, mitigation.

End with a recommendation and one-sentence rationale. Then ask via `AskUserQuestion`: question = `Which approach?`, header = `Approach`, options = one per proposed approach (label = name, description = one-line trade-off). `Other` lets the user steer free-form.

### 4. Present the whole design, approve once

Present the chosen approach as one message, sectioned (typical: Goal, Scope in/out, Key decisions, Architecture sketch, Open questions). Sections are headings in that one message — **not** separate prompts.

Then ask **once** via `AskUserQuestion`: question = `Approve this design?`, header = `Approve`, options = `Approve`, `Request changes` (description: `Name the sections to change via Other`).

On a change request, revise only the named sections, re-present the full design, and re-ask the same single question. Do not approve section by section — that was up to 5 blocking round trips for one decision the user makes holistically anyway.

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

End the skill via `AskUserQuestion`:

- Question: `Brainstorm complete. Ready to write spec?`
- Header: `Write spec`
- Options: `Yes — write spec`, `No — stop here`, `Request changes` (description: `Provide notes via Other`).

Then:

- On `Yes` — invoke `spec-writing` via the Skill tool. Pass the slug and approved design as context.
- On `No` — stop. Leave the empty `docs/ultra-dev/<slug>/` in place. The conversation context remains the source of truth; if the user re-invokes `spec-writing` later in the same session it can read from there.
- On `Other` / change notes — revise the design (loop back to step 4 for the affected sections), then re-ask the hand-off prompt.

## Checklist

Before issuing the hand-off prompt, verify:

- [ ] Project context was scanned.
- [ ] Clarifying questions were batched (≤ 2 `AskUserQuestion` calls, up to 4 questions each).
- [ ] 2–3 approaches with trade-offs were presented.
- [ ] Design was presented in full in one message and approved with one prompt.
- [ ] Total blocking prompts for the run ≤ 4.
- [ ] Slug is kebab-case, ≤ 4 words, collision-resolved.
- [ ] `docs/ultra-dev/<slug>/` exists and is empty.
- [ ] No spec.md, plan.md, or code was written.

## Anti-pattern: "this is too simple to design"

Every request goes through the process. A toggle, a copy change, a one-line config — all of them. The design can be three sentences. Skipping the design is where unexamined assumptions waste the most time. Present and get approval, however short.
