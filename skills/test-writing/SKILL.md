---
name: test-writing
description: Post-hoc test generator. Auto-triggers on test, tests, testing, coverage, spec, unit test, integration test keywords. Reads files changed since the branch base, proposes a checklist of tests, and generates them on user confirmation. POST-HOC ONLY — no TDD enforcement, no failing-test-first workflow.
---

# test-writing

Generate tests for code that already exists. POST-HOC ONLY. Never write a failing test first, never gate implementation on a test, never use red/green/refactor language. The user has explicitly chosen post-hoc testing for this plugin.

## Prompting

Fixed-choice prompts (framework pick when ambiguous, test-selection menu) MUST be issued via the `AskUserQuestion` tool. The selection menu uses `multiSelect = true` with one option per proposed test; `Other` accepts free-form indices for users who prefer that.

## Triggers

- Auto-trigger on keywords: "add tests", "write tests", "test this", "missing tests", "coverage", "unit test", "integration test", "spec".
- Explicit invocation by name via the Skill tool.
- Dispatched from the end-of-execute aux-skill prompt in `executing-plan`.

## Scope

Standalone. Works on any branch in any repo. No ultra-dev artifacts required. Do not refuse to run because `docs/ultra-dev/<slug>/` is missing.

## Hybrid context resolution

If a feature directory under `docs/ultra-dev/` maps to the current branch, load it as extra context.

Resolution rule: most-recently-modified `docs/ultra-dev/*/` directory. If present, read its `spec.md` and `plan.md`. Use them to inform test cases — every acceptance-criteria checkbox in `spec.md` is a candidate test case, every `[verify]`-tagged plan task is a candidate test case.

If no feature directory exists, skip this step silently and proceed standalone.

## Process

### 1. Detect test framework

Scan project config files to identify the framework. Stop at the first confident match.

- `package.json` → look for `jest`, `vitest`, `mocha`, `ava`, `node:test` in `dependencies`/`devDependencies` and the `"test"` script.
- `pyproject.toml`, `setup.cfg`, `pytest.ini`, `tox.ini` → `pytest`, `unittest`.
- `go.mod` present → `go test` (standard library + table-driven convention).
- `Cargo.toml` → `cargo test`.
- `Gemfile` → `rspec`, `minitest`.
- `composer.json` → `phpunit`, `pest`.
- `*.csproj`, `*.sln` → `xunit`, `nunit`, `mstest`.
- `build.gradle`, `pom.xml` → `junit`.

Also note existing test directory layout (`tests/`, `test/`, `__tests__/`, `spec/`, `*_test.go` siblings, `*.test.ts` siblings, etc.) and the assertion style already in use. Mirror it.

If detection is ambiguous, ask once via `AskUserQuestion` (question = `Which test framework should I target?`, header = `Framework`, options = up to 4 detected candidates; `Other` for free-form).

### 2. Detect base branch and changed files

Detect the base branch:

- Prefer `git symbolic-ref refs/remotes/origin/HEAD` (strip `origin/`).
- Fallback: `main` if it exists, else `master`, else `develop`.

Collect changed files:

```
git diff --name-only <base>...HEAD
git diff --name-only HEAD          # uncommitted tracked
git ls-files --others --exclude-standard   # untracked
```

Filter out: existing test files, generated files, lockfiles, vendored code, docs, build artifacts. Keep only source files in languages matching the detected framework.

### 3. Identify untested public surfaces

For each changed source file, read it and list public surfaces with no corresponding test:

- Exported functions / methods / classes.
- Public HTTP routes, CLI commands, event handlers.
- Branches and edge cases visible in control flow (null/empty inputs, error paths, boundary values).

Cross-check against existing test files in the conventional location to avoid duplicating coverage.

## 4. Propose tests

Print a numbered checklist. One line per test. Format:

```
N. <test-file-path> :: <test-name> — <one-line intent>
```

Group by source file. Keep intents action-oriented ("returns 404 when user missing", "rejects negative quantities", not "tests user lookup").

End with a confirmation prompt:

- **≤ 4 proposed tests**: use `AskUserQuestion` (multiSelect = true, header = `Tests`, question = `Which tests should I generate?`, options = one per proposed test, label = `<N>. <test-name>`, description = the intent line). Empty selection = generate none.
- **> 4 proposed tests**: print the numbered list to chat, then use `AskUserQuestion` (header = `Tests`, question = `Which tests should I generate?`, options = `All`, `None`, `Pick by number` → `Other` lets the user type comma/space-separated indices like `1,3,5`).

### 5. Wait for confirmation

Do not generate anything until the user replies. Map the answer:

- `All` (or every option ticked in the multiSelect form) — generate every proposed test.
- `None` (or empty multiSelect) — abort, generate nothing, exit cleanly.
- `Pick by number` / `Other` with indices (e.g. `1,3,5` or `2 4`) — generate only those.

If `Other` is empty or unparseable, re-ask once with the same prompt.

### 6. Generate selected tests

For each selected item:

- Use the project's existing test framework, file naming, and assertion style. Match existing imports, setup helpers, fixtures, and matchers.
- Place the test file in the conventional location. Examples:
  - `__tests__/foo.test.ts` next to `foo.ts` if that is the existing pattern.
  - `tests/test_foo.py` mirroring `src/foo.py` for pytest layout.
  - `foo_test.go` next to `foo.go` for Go.
- If a test file for the source already exists, append cases to it rather than creating a parallel file.
- Write only the tests the user selected. Do not silently add extras.

### 7. Report

After writing, print:

- Files created or modified, one per line.
- The exact command the user can run, e.g. `npm test`, `pytest tests/test_foo.py`, `go test ./...`.

Do not run the tests yourself. Do not commit. Do not stage.

## Hard rules

- POST-HOC ONLY. No TDD scaffolding. No "write failing test first". No red/green/refactor. No test-driven phrasing in messages or generated comments.
- Never run the tests in this skill — only generate them.
- Never commit, stage, or push.
- Never refuse to run on absence of ultra-dev artifacts.
- Never invent untested behavior — propose tests only for code that exists in the changed files.
- Never duplicate an existing test case.
