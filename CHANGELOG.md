# Changelog

All notable changes to `ultra-dev-plugin` are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [SemVer](https://semver.org/).

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
