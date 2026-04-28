---
name: doc-writing
description: Generate documentation artifacts (changelog, README, inline code docs, ultra-dev notes) for recent changes. Auto-triggers on docs, documentation, changelog, readme, docstring, or jsdoc keywords. Asks the user which artifacts to produce and generates only the selected ones.
---

# doc-writing

Post-hoc documentation generator. Runs against recent changes on the current branch and produces only the artifacts the user explicitly selects.

## When this skill runs

- Auto-triggers on keywords: `docs`, `documentation`, `changelog`, `readme`, `docstring`, `jsdoc`, `update changelog`, `write docs`.
- Also runs via explicit Skill-tool invocation by name.
- Standalone scope: works on any branch in any repo. No spec or plan required.

## Hybrid context resolution

Before prompting the user, attempt to associate the current branch with a feature directory:

1. List `docs/ultra-dev/*/` directories.
2. Pick the most-recently-modified one as the candidate slug.
3. If found, read `docs/ultra-dev/<slug>/spec.md` and `docs/ultra-dev/<slug>/plan.md` to source the feature description, scope bullets, and task list. Use this as additional context when drafting artifacts.
4. If no `docs/ultra-dev/*/` directories exist, skip this step. The skill still runs.

Never require ultra-dev artifacts. Their absence must not block the skill.

## Detect base branch and recent changes

1. Determine the base branch: prefer `main`, fall back to `master`, then to the upstream tracking branch.
2. Compute the change set:
   - `git diff --name-only <base>...HEAD` for committed changes since divergence.
   - `git diff --name-only HEAD` plus `git status --short` for uncommitted changes.
   - `git log <base>..HEAD --oneline` for commit messages relevant to the changelog draft.
3. Read the changed files needed for the selected artifacts (do not pre-read everything).

## Artifact menu

After context resolution and change detection, render this menu verbatim:

```
Which docs to generate?
  [c] CHANGELOG entry
  [r] README updates (install/usage/feature sections)
  [i] Inline code docs (docstrings/JSDoc on new public API)
  [n] notes.md entry under docs/ultra-dev/<slug>/ (if applicable)
  [all] / [none]
```

Parse user input as:

- A single letter: `c`, `r`, `i`, `n`.
- A comma list: `c,r`, `r,i,n`, etc.
- `all` selects every applicable artifact. If no `<slug>` was resolved, drop `n` from the `all` set and tell the user why.
- `none` exits the skill without writing anything.

Reject unknown letters and re-prompt. Never assume — ask if input is ambiguous.

## Per-artifact generation rules

Generate only items the user selected. Do not touch unselected artifacts.

### [c] CHANGELOG entry

1. Detect an existing changelog file by checking, in order: `CHANGELOG.md`, `CHANGELOG`, `HISTORY.md`, `HISTORY`, `CHANGES.md`.
2. If one exists:
   - Determine the appropriate version/date section (top `Unreleased` block if Keep-a-Changelog style, else a new dated section at the top).
   - Append the entry summarizing the change set, grouped by Added / Changed / Fixed / Removed when style fits.
   - Match the file's existing formatting conventions (heading depth, bullet style, date format).
3. If none exists, ask the user: "No changelog file found. Create `CHANGELOG.md` (Keep-a-Changelog format)? (yes/no)". Create only on `yes`.

### [r] README updates

1. Read the existing `README.md` (or `README`, `README.rst`).
2. Identify which sections need edits based on the change set: install steps, usage examples, feature list, configuration, API reference.
3. Propose a unified diff or section-by-section description of the proposed edits.
4. Apply the edits only after the user confirms. On `changes: ...` style feedback, revise and re-confirm.

### [i] Inline code docs

1. Identify new public functions, classes, methods, exported symbols, or modules added since `<base>`. Use the diff plus AST/syntax cues from the file extension to scope to public API only.
2. Detect the project's docstring/comment style by sampling existing public symbols (Python: Google / NumPy / reST docstrings; JS/TS: JSDoc; Rust: `///` doc comments; Go: leading comment lines; etc.).
3. Add concise docs to each new public symbol: one-line summary, params, return, raises/errors where relevant. Match the detected style exactly.
4. Do not modify private symbols or existing documented public symbols unless their signature changed.

### [n] notes.md entry

1. Only available when a `<slug>` was resolved in the hybrid context step. Skip with a message if not.
2. Append a dated section to `docs/ultra-dev/<slug>/notes.md` (create the file if missing). Format:

   ```
   ## YYYY-MM-DD — shipped
   <one-paragraph summary of what landed, drawn from spec/plan + diff>
   ```

3. Do not overwrite earlier entries (failure logs, prior shipped notes). Append only.

## Constraints

- Generate only the artifacts the user selected. No unsolicited extras.
- Do not commit. Leave staging to the user or a downstream skill.
- Do not require ultra-dev artifacts; the skill works in any repo on any branch.
- Self-review after writing: re-read each generated artifact, fix obvious issues, then report what was produced and where.

## Final output

Report the artifacts generated, their file paths, and any items declined or skipped (e.g., `n` skipped because no `<slug>` mapping found).
