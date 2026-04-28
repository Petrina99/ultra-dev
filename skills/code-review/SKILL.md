---
name: code-review
description: Reviews the current branch diff against the base branch, lists issues by severity (Blocker / Major / Minor / Nit), auto-fixes trivial issues (formatting, unused imports, dead code, comment typos), and flags everything else for the user. Auto-triggers on review / diff / PR / code-review / "review this" keywords. Works standalone on any branch in any repo; if a `docs/ultra-dev/<slug>/` directory maps to the current branch, additionally reads its `spec.md` and `plan.md` as extra context.
---

# code-review

Standalone code review skill. Diffs the current branch against its base, reports issues by severity, applies trivial auto-fixes, and leaves everything else for the user.

## Triggers

Auto-fires on user prompts containing review keywords:

- "review", "review this", "review my changes"
- "code review", "code-review"
- "diff review", "review the diff"
- "PR review", "review the PR"

Also runs via explicit `Skill` tool invocation by name.

## Scope

- Standalone. Runs in any repo, on any branch. Does **not** require `docs/ultra-dev/<slug>/`.
- Hybrid context: if a feature directory maps to the current branch, additionally read its `spec.md` and `plan.md` as extra review context.

### Hybrid context resolution

1. List `docs/ultra-dev/*/` directories.
2. Pick the **most-recently-modified** directory (mtime of the directory itself).
3. If the slug embeds in the current branch name, prefer that match; otherwise fall back to most-recently-modified.
4. If no `docs/ultra-dev/*/` exists, skip context loading and proceed standalone.

When a match is found, read `spec.md` and `plan.md` from that directory before reviewing. Use them to judge whether the diff matches stated intent — flag mismatches.

## Process

### 1. Detect base branch

```bash
git symbolic-ref refs/remotes/origin/HEAD --short 2>/dev/null | sed 's|^origin/||'
```

Fallback order:

1. `main` if `git show-ref --verify --quiet refs/heads/main` succeeds.
2. `master` if `main` is absent.
3. If neither exists, ask the user: `which branch should I diff against?` Stop until answered.

### 2. Compute diff

Review **both** committed and uncommitted changes:

```bash
# committed changes on this branch since it diverged from base
git diff <base>...HEAD

# uncommitted (unstaged + staged) working-tree changes
git diff HEAD
```

List changed files:

```bash
git diff --name-only <base>...HEAD
git diff --name-only HEAD
```

### 3. Read changed files

Read changed files in full when the diff hunk alone is not enough to judge correctness (e.g., to see surrounding function, imports, type definitions). Don't review blind from hunks.

### 4. Apply trivial auto-fixes

Before producing the report, apply auto-fixes directly via `Edit`. Trivial-only scope:

- Formatting (whitespace, indentation, trailing newline) — only if a project formatter or linter would do the same.
- Unused imports.
- Obviously-dead code (unreachable blocks, never-called local functions with no exports/refs).
- Simple typos in **comments** and docstrings.

Do **not** auto-fix anything that changes program behavior. When in doubt, flag instead of fix.

### 5. Produce the report

Group issues by severity. Use these buckets exactly:

- **Blocker** — bugs, security issues, data loss, broken builds, missing critical handling.
- **Major** — design problems, incorrect logic in non-critical paths, significant maintainability hits.
- **Minor** — style violations, suboptimal patterns, missing edge-case handling that's unlikely to fire.
- **Nit** — naming nitpicks, comment polish, stylistic preferences.

Each issue line:

```
<path>:<line> — <description>
  fix: <suggested change>
```

End the report with two sections:

- **Auto-fixed** — bullet list of files + what was changed. State that fixes are left in the working tree, unstaged, for user review.
- **Flagged** — count by severity.

## Checklist

Run through this on every review:

- [ ] Base branch detected (or user asked).
- [ ] Both `git diff <base>...HEAD` and `git diff HEAD` inspected.
- [ ] Changed files read in full where context required.
- [ ] Hybrid context loaded if a `docs/ultra-dev/<slug>/` matches.
- [ ] Issues grouped under Blocker / Major / Minor / Nit.
- [ ] Each issue has `file:line`, description, suggested fix.
- [ ] Trivial auto-fixes applied via `Edit` and listed under **Auto-fixed**.
- [ ] No behavior-changing fix was applied automatically.
- [ ] No `git commit`, `git push`, or `git add` run by the skill.
- [ ] Report emitted to the user.

## Hard rules

- **Never** auto-fix anything that changes program behavior. If unsure, flag it.
- **Never** commit or push. Leave auto-fixes in the working tree, unstaged, for the user to review and stage themselves.
- **Never** require ultra-dev artifacts. The skill must complete on a plain repo with no `docs/ultra-dev/` at all.
- **Never** skip the diff against the base — a review without a diff is not a review.

## Example invocation

User: "review my changes"

1. Detect base = `main`.
2. Run `git diff main...HEAD` and `git diff HEAD`.
3. Resolve hybrid context: most-recently-modified `docs/ultra-dev/*/` is `docs/ultra-dev/auth-rework/` — read its `spec.md` and `plan.md`.
4. Read each changed file in full.
5. Auto-fix: remove unused import in `src/api/users.ts`, fix typo `recieve` → `receive` in comment in `src/db/migrate.ts`.
6. Emit report:

```
Auto-fixed
- src/api/users.ts: removed unused import `lodash`
- src/db/migrate.ts: typo in comment (recieve → receive)

Blocker
- src/auth/token.ts:42 — JWT signed with HS256 but verification accepts `none` algorithm.
  fix: pin verification to HS256 explicitly.

Major
- src/api/users.ts:88 — N+1 query inside loop over `users`.
  fix: batch with a single `WHERE id IN (...)` query.

Minor
- src/api/users.ts:120 — magic number `3600`; should be a named constant.
  fix: extract `const SESSION_TTL_SECONDS = 3600;`.

Nit
- src/db/migrate.ts:15 — variable `tmp` could be `pendingMigrations`.

Flagged: 1 Blocker, 1 Major, 1 Minor, 1 Nit. Auto-fixes left unstaged for your review.
```
