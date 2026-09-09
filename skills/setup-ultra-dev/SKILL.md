---
name: setup-ultra-dev
description: One-time project setup for ultra-dev — writes a managed routing block into the project's CLAUDE.md so Claude knows which work goes through the brainstorm → spec → plan → execute chain, and records whether test-writing / doc-writing run automatically after a plan and whether i-have-adhd output mode is on. Slash-only (`/setup-ultra-dev`), never auto-triggers. Re-run any time to change the settings.
disable-model-invocation: true
argument-hint: "nothing, or one setting to change: routing | tests | docs | adhd"
---

# setup-ultra-dev

Configure `ultra-dev-plugin` for **this** project. Four batched questions, one managed block written to `CLAUDE.md`, nothing else touched.

The block is the config surface: it lives in `CLAUDE.md`, so it is loaded into context every session in this repo and the settings survive restarts, `/clear`, and compaction without any hook or state file.

## Hard rules

- Never write outside the `<!-- ultra-dev:start -->` / `<!-- ultra-dev:end -->` markers. Everything else in `CLAUDE.md` is the user's and stays byte-for-byte identical.
- One `AskUserQuestion` call, four questions. No follow-up round trips.
- Prompt presentation: `header` ≤ 12 characters, every option carries a one-line `description`, recommended option first with ` (Recommended)` in its label.
- Do not scaffold `docs/ultra-dev/`, do not create branches, do not run any other ultra-dev skill — except `i-have-adhd`, and only when the user turns it on.
- Do not edit `CLAUDE.md` files outside the project root (`~/.claude/CLAUDE.md` is global and off limits).

## Process

### 1. Locate the target file

In order:

1. `CLAUDE.md` at the repo root → use it.
2. No root `CLAUDE.md`, but `.claude/CLAUDE.md` exists → use that.
3. Neither → create `CLAUDE.md` at the repo root.

Read it. If it already contains `<!-- ultra-dev:start -->`, this is a **re-run**: parse the current settings out of the block and show them on one line before asking, e.g.

```
Current: routing=features, tests=ask, docs=ask, adhd=off
```

### 2. Ask — one batched call

If the skill was invoked with an argument naming one setting (`routing`, `tests`, `docs`, `adhd`), ask only that question and carry the other three over from the existing block unchanged. Otherwise issue a single `AskUserQuestion` call with these four questions. Each option's `description` carries the trade-off. On a re-run, list the current value's option first so the default is one keypress away.

| # | Header | Question | Options |
| --- | --- | --- | --- |
| 1 | `Routing` | `Which work routes through the ultra-dev chain?` | `Features & multi-file changes (Recommended)` (design discussion, new behavior, anything worth reviewing) · `Everything but one-liners` (also refactors and non-trivial bug fixes) · `Only when I invoke it` (no routing guidance; skills run on explicit request) |
| 2 | `Tests` | `Run test-writing after a plan finishes?` | `Ask me each time (Recommended)` (the aux menu, as today) · `Automatically` (runs without asking, every plan) · `Never` (skip it in the menu) |
| 3 | `Docs` | `Run doc-writing after a plan finishes?` | `Ask me each time` · `Automatically` · `Never` |
| 4 | `ADHD mode` | `Turn on i-have-adhd output style?` | `Off` · `This session only` (not written to CLAUDE.md) · `Always on in this project` (persisted; stays on until explicitly turned off) |

### 3. Render the block

Read `${CLAUDE_PLUGIN_ROOT}/templates/claude-md-block.md` and substitute the placeholders. If the template is missing (vendored install), write the same structure inline.

**The settings line** — `<!-- ultra-dev:settings routing=… tests=… docs=… adhd=… -->`, second line of the block. It is the machine-readable copy of the answers: `executing-plan` and the SessionStart banner read it instead of parsing prose. Always emit all four keys, from this vocabulary:

| Key | Values |
| --- | --- |
| `routing` | `features` · `all` · `manual` |
| `tests` | `ask` · `auto` · `never` |
| `docs` | `ask` · `auto` · `never` |
| `adhd` | `on` · `off` |

`adhd=on` only for `Always on in this project`. `This session only` is not persisted, so it writes `adhd=off`.

**`__ROUTING__`** — by answer 1:

- *Features & multi-file changes:*
  > For features, multi-file changes, new behavior, and anything you'd want reviewed before merge, drive the work through the **ultra-dev plugin**: `brainstorm` → `spec-writing` → `spec-to-plan` → `executing-plan`.
  >
  > For typo fixes, one-liners, single-function tweaks, mechanical renames, formatting, and obvious bug fixes with one clear cause, implement directly.
- *Everything but one-liners:*
  > Route all work through the **ultra-dev plugin** (`brainstorm` → `spec-writing` → `spec-to-plan` → `executing-plan`) — features, refactors, and non-trivial bug fixes alike.
  >
  > Only typos, formatting, and true one-liners bypass the chain.
- *Only when I invoke it:*
  > The **ultra-dev plugin** skills run only when invoked explicitly. Do not route work into `brainstorm` on your own.

**`__TESTS__`** / **`__DOCS__`** — by answers 2 and 3, for `test-writing` / `doc-writing` respectively:

- *Ask me each time:* `offer it in the end-of-plan aux menu (default).`
- *Automatically:* `run <skill> automatically once the plan verifies clean — no aux-menu prompt for it.`
- *Never:* `do not run <skill> and do not offer it in the aux menu.`

**`__ADHD__`** — by answer 4:

- *Off* or *This session only:* empty string. Delete the placeholder line so the block ends after the Docs bullet.
- *Always on in this project:* insert

  ```markdown

  ### Output style

  ADHD output mode is **on**. Load the `i-have-adhd` skill (ultra-dev-plugin) at the
  start of every session and shape every response by it. "stop adhd mode" / "normal
  mode" turns it off for the current session only — to turn it off for good, re-run
  `/setup-ultra-dev` and pick `Off`.
  ```

### 4. Write

- **Marker block present** → replace everything from `<!-- ultra-dev:start -->` through `<!-- ultra-dev:end -->` with the rendered block. Same position in the file.
- **No marker block** → append to the end of the file, preceded by a blank line and `---` if the file does not already end with one.
- **File did not exist** → create it with `# <Project name>` as the first line, blank line, then the block.

Verify after writing: the file still contains everything it had before (diff the non-block region), and exactly one `ultra-dev:start` marker exists.

### 5. Turn on ADHD mode now, if asked

If answer 4 was `This session only` or `Always on in this project`, invoke `i-have-adhd` via the Skill tool immediately, so it applies from the next response. On `Off`, do nothing — if the block previously enabled it, note in the summary that it is now off for future sessions and that the current session still has it until restart.

### 6. Report

Five lines, no more:

```
ultra-dev configured in CLAUDE.md.
Routing: <answer>
Tests after plan: <answer>   Docs after plan: <answer>
ADHD mode: <answer>
Change any of it: /setup-ultra-dev
```

## Session banner

With a block present, the plugin's `SessionStart` hook (`hooks/ultra-dev-banner.js`) echoes one line at the top of every session in that repo:

```
ULTRA-DEV — routing=features · tests=auto · docs=ask · adhd=on
```

With `adhd=on` it adds the line that re-arms the output style, so the mode is visible rather than silently inherited. No block means no output. Nothing to configure — the hook ships with the plugin.

## Re-running

Idempotent. Running it twice with the same answers leaves the file unchanged; running it with different answers rewrites only the managed block. It is the intended way to flip a setting — including turning ADHD mode off permanently.

## Checklist

- [ ] Target `CLAUDE.md` located (root → `.claude/` → create).
- [ ] Existing settings echoed on a re-run.
- [ ] Exactly one `AskUserQuestion` call, four questions.
- [ ] Block rendered from `${CLAUDE_PLUGIN_ROOT}/templates/claude-md-block.md`, all three placeholders substituted or removed.
- [ ] Content outside the markers unchanged.
- [ ] `i-have-adhd` invoked iff the user turned it on.
- [ ] Five-line summary printed.
