# Changelog

All notable changes to `ultra-dev-plugin` are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [SemVer](https://semver.org/).

## [1.14.1] — 2026-09-09

### Fixed

- `i-have-adhd`: `disable-model-invocation` removed. 1.14.0 documented the skill as slash-only, but three parts of the plugin need to load it themselves — `setup-ultra-dev` step 5 ("turn it on now"), the `### Output style` line the managed block writes into `CLAUDE.md`, and the `ADHD MODE ON` banner — and every one of them failed with *cannot be used with Skill tool due to disable-model-invocation*. Persisted `adhd=on` now actually arms itself at session start.

## [1.14.0] — 2026-09-09

### Added

- `executing-plan`: resume support. A run that stops mid-plan — session ended, context compacted, failure escalated — is picked up by the next invocation instead of restarting: step 2b reads `plan.md` checkboxes, the newest `notes.md` failure entry, and `git log`/`git status` from the run's recorded base, reports `Resuming <slug>: 4 of 9 tasks done…`, and continues from the first unchecked task. Stale marks, dirty trees, and leftover worktrees are surfaced, never auto-resolved.
- `executing-plan`: the baseline checkpoint is now written to `notes.md` under a new `## Run log` section (base commit, branch, worktree) instead of being held in context, which does not survive a compaction. `templates/notes.md` gained the section.

### Fixed

- `project-docs`, `user-manual-writing`: both descriptions claimed "does NOT auto-trigger", but neither set `disable-model-invocation`, so the model could still fire them and their descriptions sat in context every turn. Flag added — behavior now matches the documentation.

### Changed

- Every skill description rewritten as a context pointer: trigger branches kept, restated identity and body detail cut. Always-loaded description text dropped from ~3.6k to ~2.0k characters (~900 → ~500 tokens per turn, in every session where the plugin is installed).

## [1.13.0] — 2026-09-09

### Added

- `hooks/`: first hook in the plugin — a `SessionStart` hook (`ultra-dev-banner.js`) that reads the `<!-- ultra-dev:settings … -->` line from the project's `CLAUDE.md` and echoes one banner line (`ULTRA-DEV — routing=… · tests=… · docs=… · adhd=…`). With `adhd=on` it also re-arms the `i-have-adhd` output style, so a persisted mode is visible instead of silently inherited. Silent in repos with no managed block; skipped entirely when `node` is absent. Self-check: `node hooks/ultra-dev-banner.js --self-check`.
- `setup-ultra-dev`: the managed block now carries a machine-readable settings line (`routing` · `tests` · `docs` · `adhd`) as its second line, so the banner hook and `executing-plan` read keys instead of parsing prose.
- Slash-only skills gained `argument-hint` frontmatter, shown in the `/` menu: `/setup-ultra-dev <setting>`, `/i-have-adhd off`, `/project-docs user|dev|both`, `/user-manual-writing <slug>`. Each skill now honors that argument and skips the prompt it answers.

### Changed

- All skills that prompt: added one shared presentation rule to their prompting contract — `header` ≤ 12 characters (it renders as a chip), every option carries a one-line `description`, recommended option first with `(Recommended)` in its label. `erd-writing`'s `Non-local host` / `Install driver` headers were over the limit and are now `Remote host` / `Driver`.
- `executing-plan`: reads the `ultra-dev:settings` line rather than the block's prose when deciding which aux skills to auto-run or hide.

## [1.12.0] — 2026-09-09

### Added

- `setup-ultra-dev`: new aux skill — per-project setup, slash-only (`/setup-ultra-dev`). One batched `AskUserQuestion` (routing scope, `test-writing` after a plan, `doc-writing` after a plan, `i-have-adhd` mode) written as a marker-delimited managed block in the project's `CLAUDE.md`, so the settings reload every session without a hook or state file. Idempotent: re-running rewrites only the block, and is the way to flip a setting or turn ADHD mode off permanently. Block skeleton lives at `templates/claude-md-block.md`.

### Changed

- `executing-plan`: the end-of-plan aux step now reads the `setup-ultra-dev` block in `CLAUDE.md` first — an aux skill pinned to *automatically* runs without a prompt, one pinned to *never* is dropped from the menu, and anything unpinned still goes through the menu as before. No block means unchanged behavior.

## [1.11.0] — 2026-09-09

### Added

- `i-have-adhd`: new aux skill — an output-style flag rather than a workflow. `/i-have-adhd` turns on ADHD-shaped output for the rest of the session: next action first, multi-step work numbered, state restated every turn, tangents deferred, time estimates in concrete units, wins stated as what now works, no preamble/recap/closer. Documented overrides for explain requests, destructive actions, debug spirals, ambiguity, and harness constraints. Leaves the brainstorm → spec → plan → execute chain, its gates, and its written artifacts untouched. Slash-only (`disable-model-invocation`); off via "stop adhd mode" or "normal mode".

## [1.10.0] — 2026-08-21

### Fixed

- `spec-writing`, `spec-to-plan`, `research`, `executing-plan`: template lookups pointed at `templates/<file>.md` "(repo root)" — the *user's* repo, which never contains them — so every run silently fell through to the "template missing, write inline" path and `templates/{spec,plan,notes,research}.md` were dead files. Now resolved via `${CLAUDE_PLUGIN_ROOT}/templates/`, matching the fix already applied to `smoke-tests.html`.

### Changed

- `brainstorm`: clarifying questions are batched (up to 4 per `AskUserQuestion` call, hard ceiling of 2 calls) instead of asked one at a time, the research offer rides in the first batch instead of its own prompt, and the design is presented in full and approved with a single prompt instead of section by section. Budget for the whole skill is now ≤ 4 blocking prompts, down from 8–14.
- `executing-plan`: the `Customize` entry flow issues 2 batched `AskUserQuestion` calls instead of 6 sequential ones.
- `user-manual-writing`: replaced "open every annotated PNG and eyeball it" with a harness-enforced check plus a one-or-two-per-chapter spot check. `annotate.ts` now **throws** (was `console.warn`) when a marker resolves to ≠ 1 element, has no bounding box, or falls outside the viewport, so a green run already proves markers are unique, visible, and in frame. Reading every screenshot into context was the single most expensive thing the skill did.
- `user-manual-writing`: prose + capture now run chapter by chapter (render once at the end) rather than whole-manual-in-one-context; `outline.md`'s feature→section map scopes re-shoots on updates.

## [1.9.0] — 2026-07-01

### Added

- `user-manual-writing`: new aux skill — builds or updates a branded end-user PDF manual under `docs/user-manual/<slug>/`. Drives the running app through Playwright to capture real, numbered/annotated screenshots (bundled `annotate.ts` fixture, mandatory post-capture visual check), applies a project brand (logo, accent color, optional legal/confidentiality notice via `manual.config.json`), and optionally protects the rendered PDF (author metadata + AES-256, via bundled `protect-pdf.py`). Reuses `project-docs`'s `generate-pdf.mjs` renderer for the render step. Slash-only (`/user-manual-writing`); never auto-triggers, never chained from another skill.
- `project-docs`: `generate-pdf.mjs` and `template.html` gained optional `--logo`, `--accent`, `--footer-note` flags (cover logo image, CSS accent color override, footer note line) — backward compatible, defaults unchanged. Added so `user-manual-writing` can reuse the same renderer instead of duplicating a Puppeteer pipeline.

## [1.8.3] — 2026-06-10

### Added

- `executing-plan`: entry prompt now offers a third option, `Defaults, stay on current branch` — all defaults with `branch=current`, skipping the customize flow. The main/master refusal in setup still applies.

## [1.6.1] — 2026-05-11

### Changed

- All skills (`brainstorm`, `spec-writing`, `spec-to-plan`, `executing-plan`, `research`, `code-review`, `test-writing`, `doc-writing`, `erd-writing`) now route fixed-choice prompts through the harness `AskUserQuestion` tool, so users pick answers with arrow keys instead of typing. Free-form prompts (branch names, connection strings, change notes) stay plain text; `Other` covers edge cases.

## [1.6.0] — 2026-05-11

### Added

- `project-docs`: new aux skill — generates professional end-user or developer documentation as Markdown + PDF. Scans repo (manifest, README, framework, routes, CLI, config) and renders via Puppeteer with auto-built TOC, anchored headings, working internal/external links, and image placeholders that degrade gracefully when files are missing. Output: `docs/user-guide/` or `docs/dev-guide/`; `assets/` subfolder auto-added to `.gitignore`. Slash-only invocation (`/project-docs`); never auto-triggers and is never chained from other skills.

## [1.5.1] — 2026-05-05

### Added

- `executing-plan`: after each task completes successfully, prepend `[x] ` to the matching numbered line in `plan.md`. Edit is in-place; bundled into the per-task commit when `commits=per-task`.

## [1.5.0] — 2026-05-05

### Added

- `executing-plan`: new `commit-format=simple|numbered` entry-prompt option. `simple` → `<type> - <name>`. `numbered` → `T<N> - <type> - <name>` (range / list for batch / single). Default `simple`.
- `executing-plan`: explicit commit-message format spec mapping `commits` × `commit-format` to a subject template; `<type>` resolves from the task's first plan tag, `<name>` from the task title (or feature slug for batch / single).

### Changed

- `executing-plan`: commits made by the skill no longer include `Co-Authored-By:` trailers or `Generated with Claude Code` footers. Plain commit message only — overrides the harness default.
- README: documents the new `commit-format` option and the no-attribution rule.

## [1.4.0] — prior

- Drop bundled context7; document user install of the `context7` MCP server for the `research` skill.

## [1.1.0] — prior

- Templates (`spec.md`, `plan.md`, `notes.md`, `research.md`) under `templates/`.
- `erd-writing` aux skill (Postgres / SQLite / SQL Server introspection → `erd.md` + `erd.html`).
