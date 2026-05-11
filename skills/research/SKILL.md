---
name: research
description: Researches libraries, frameworks, services, APIs, and SDKs for an upcoming feature. Pulls live docs via the user-installed `context7` MCP server, writes a terse `research.md` to the active feature directory, and prints a short chat summary. Does NOT auto-trigger from generic prompts; runs only when the user invokes it directly or accepts the research offer at the start of `brainstorm`.
---

# research

Produce a terse, version-pinned research document for an upcoming feature. One run = one `docs/ultra-dev/<slug>/research.md`. No code, no implementation work — just the shortlist of tools the implementer needs, with the links to keep going.

## Prompting

Fixed-choice prompts (slug pick, overwrite/append, hand-off) MUST be issued via the `AskUserQuestion` tool. Free-form prompts (research target list) stay plain text.

## Triggers

- Auto-trigger: **none**. Silent on generic feature/change/build prompts.
- Run conditions:
  1. Explicit invocation via the Skill tool by the literal name `research`.
  2. Chained from `brainstorm` after the user answered `yes` to "research libraries/services first?".

If neither condition holds, do not run.

## Required tooling

This skill depends on the **`context7`** MCP server. It is **not bundled** with `ultra-dev-plugin` — the user must install it themselves (separate `context7` plugin, or a project `.mcp.json` entry pointing at `npx -y @upstash/context7-mcp`). See the README's "Optional: context7 for research" section.

Tools used (exact tool names depend on how the user installed context7 — match by suffix `__resolve-library-id` and `__query-docs`):

- `*__resolve-library-id` — turn a name (e.g. `react`, `stripe`) into a context7 library ID.
- `*__query-docs` — pull current docs for that ID.

If neither tool is available in the current session, stop with:

```
Error: context7 MCP server not available. Install the context7 plugin (or add `npx -y @upstash/context7-mcp` to a project `.mcp.json`) and restart Claude Code. See the README for details.
```

Do not fall back to web search or guess from training data — the whole point is current, version-accurate info.

## Process

### 1. Resolve target slug

- **Chained from brainstorm:** slug already in scope. Reuse it.
- **Standalone invocation:** list directories matching `docs/ultra-dev/*/` and ask via `AskUserQuestion` (question = `Pick a feature directory.`, header = `Feature`, options = one per existing slug, up to 4 directly; if more, show the 3 most-recently-modified plus `Other` for free-form slug input).

  If `docs/ultra-dev/` is empty, ask the user (plain text) for a slug, then create `docs/ultra-dev/<slug>/`.

### 2. Gather research targets

Ask the user, in one message:

```
What should I research? List the libraries / frameworks / services / APIs you want covered.
You can also say "suggest" — I'll propose a shortlist based on the feature goal.
```

On `suggest`: read any existing `spec.md` / `plan.md` / brainstorm context in the session, then propose 3-6 candidates as a numbered list. Wait for the user to confirm or edit the list before continuing.

### 3. Pull docs via context7

For each target:

1. Call `resolve-library-id` with the target name. If multiple matches, prefer the one whose description matches the feature context; if ambiguous, ask the user to pick.
2. Call the docs query tool with the resolved ID. Pull only what is needed to answer: current stable version, what it does, install / quickstart, key API surface for our use case, pricing (if commercial), license, official docs URLs.
3. If a target is not in context7, note it and fall back to **one** `WebFetch` against the official site. Do not crawl. Do not guess.

Keep notes terse. The doc is LLM context, not a tutorial.

### 4. Write `docs/ultra-dev/<slug>/research.md`

Copy the skeleton from `templates/research.md` (repo root) and fill it. If the template is missing (vendored install), write the same structure inline.

Required sections, in order:

1. `# Research: <Topic>`
2. `## Overview` — 2-4 sentences. What and why, anchored to the feature.
3. `## Recommendations at a glance` — single table: Item / Version / Role.
4. `## <Item>` — one block per researched item. Each block contains:
   - Bulleted header: Version, What it does, Why we picked it, Pricing (if applicable), License (if applicable).
   - `### Description` — 2-5 sentences.
   - `### Implementation notes` — 2-4 bullets.
   - `### Links` — Docs, Quickstart, API reference, Source, Changelog, Pricing (drop rows that don't apply).
5. `## Open questions` — bullets, or empty.

Rules:

- **Version pins are mandatory.** Use the current stable version reported by context7. If a range is intentional (e.g. peer-dep), say so on the line.
- **One line, one fact.** No marketing copy. No "powerful, flexible, modern". Cut every adjective that doesn't change a decision.
- **Pricing only when it exists.** OSS libraries omit the row entirely — no "Free" filler.
- **Links must be real.** Every URL in the doc came from context7 or an official site fetched in step 3. If you don't have a URL, omit the bullet — never invent one.

### 5. Self-review pass

Run inline. No subagent.

- Placeholder scan: no `<...>`, `TBD`, `TODO`, "etc.", "and more".
- Every item has a version pin.
- Every link resolves to a domain that matches the item (e.g. Stripe links go to `stripe.com` / `docs.stripe.com`, not a blog aggregator).
- Doc is terse — if a section reads like a blog post, cut it.

Fix issues by editing the file.

### 6. Chat summary

After the file is written, print a short summary to chat — this is the part the user reads instead of opening the file. Format:

```
Research written: docs/ultra-dev/<slug>/research.md

Picks:
  - <name> <version> — <one-line role>
  - <name> <version> — <one-line role>
  ...

<Optional 1-2 sentences on key trade-off or constraint surfaced during research.>
```

Keep it under ~10 lines. The file holds the detail.

### 7. Hand-off prompt

If chained from `brainstorm`, return control to brainstorm — it owns the next step. Do not invoke other skills.

If standalone, end via `AskUserQuestion`:

- Question: `Research complete. Continue with brainstorm or spec-writing?`
- Header: `Next step`
- Options: `Brainstorm`, `Spec-writing`, `Stop here`.

Behavior:

- `Brainstorm` → invoke `brainstorm`.
- `Spec-writing` → invoke `spec-writing`.
- `Stop here` → stop.

## Conventions

- One `research.md` per feature directory. Re-running the skill **overwrites** the file after confirming via `AskUserQuestion`:

  - Question: `research.md already exists for <slug>. Overwrite, append, or cancel?`
  - Header: `Overwrite?`
  - Options: `Overwrite`, `Append`, `Cancel`.

  On `Append`: add new `## <Item>` blocks; do not duplicate existing ones; update the "Recommendations at a glance" table.
- Never paste full doc pages into the file. Link to them.
- Never write API keys or auth tokens, even in examples.
- The file is safe to commit — it holds only public docs metadata.

## Do not

- Do not skip context7 in favour of web search or training-data recall.
- Do not invent versions, links, or pricing.
- Do not write code, config, or migration steps. That belongs in `plan.md`.
- Do not auto-trigger from generic prompts.

## Checklist

- [ ] Slug resolved.
- [ ] Targets gathered (or `suggest` list confirmed).
- [ ] context7 used for every target that exists there; one official-site fetch otherwise.
- [ ] `docs/ultra-dev/<slug>/research.md` written from `templates/research.md`.
- [ ] Every item has a pinned version and at least one official link.
- [ ] Self-review pass complete.
- [ ] Chat summary printed.
- [ ] Hand-off handled (return to brainstorm, or standalone end-prompt).
