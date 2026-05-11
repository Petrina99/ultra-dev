# Changelog

All notable changes to `ultra-dev-plugin` are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [SemVer](https://semver.org/).

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
