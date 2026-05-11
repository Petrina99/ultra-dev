---
name: executing-plan
description: Execute a written `docs/ultra-dev/<slug>/plan.md` end to end with configurable branch, worktree, subagent dispatch, and commit-granularity options. Does NOT auto-trigger; runs only when chained from `spec-to-plan` or invoked explicitly via the Skill tool by name.
---

# executing-plan

Execute the plan at `docs/ultra-dev/<slug>/plan.md`. Drive batches, commits, and aux skills. Stop on three failures.

## Prompting

All fixed-choice prompts in this skill (slug pick, entry-prompt overrides, ERD-after-db, failure menu, aux menu, worktree menu) MUST be issued via the `AskUserQuestion` tool. The user picks via arrow keys; `Other` accepts free-text. Free-form prompts (branch name) stay plain text.

## Triggers

- Chained from `spec-to-plan` after the user answers `yes` to "ready to execute?".
- Explicit invocation via the Skill tool by name (`executing-plan`).
- **Never auto-triggers from keywords or descriptions.** Do not list trigger phrases in the description.

## Conventions (verbatim)

- **Slug rule:** kebab-case, max 4 words, lowercase. Collision suffix `-2`, `-3`, ... pick the lowest free integer.
- **Per-feature dir:** `docs/ultra-dev/<slug>/` contains `spec.md`, `plan.md`, and `notes.md`. `notes.md` is the failure / doc log; create it on first append by copying `templates/notes.md` from the repo root (fall back to a bare `# Notes: <Feature title>` header if the template is missing).

## Process

### 1. Resolve the slug

- If chained from `spec-to-plan`: the slug is already in scope. Use it.
- Otherwise: list `docs/ultra-dev/*/` directories and ask via `AskUserQuestion` (question = `Pick a feature directory.`, header = `Feature`, options = one per existing slug; up to 4 directly, else 3 most-recently-modified + `Other`). Do not invent a slug.

### 2. Plan precondition

Require `docs/ultra-dev/<slug>/plan.md`. If absent:

> No plan found at `docs/ultra-dev/<slug>/plan.md`. Run `spec-to-plan` first (it requires `spec.md`).

Stop. Do not proceed.

### 3. Entry prompt (single combined)

Parse the plan. Count tasks (`N.` lines under `## Tasks`) and batches (entries under `## Dependencies`). Determine the smart default for `branch`: if the current branch is `main` or `master`, default is `new`; otherwise `current`.

Print the loaded plan summary:

```
Plan loaded: docs/ultra-dev/<slug>/plan.md
<N> tasks, <M> batches.

Defaults:
  branch        = <new|current>  # smart: force `new` if current is main/master; else `current`
  worktree      = no
  subagents     = yes (where deps allow)
  commits       = per-task
  commit-format = simple
```

Then ask via `AskUserQuestion`:

- Question: `Accept defaults?`
- Header: `Run config`
- Options: `Accept all defaults`, `Customize`.

On `Accept all defaults` → use defaults as-is.

On `Customize` → issue 5 sequential `AskUserQuestion` calls, one per setting. Skip a setting if its current value already matches the only sensible choice. Use these option sets exactly:

| Setting | Header | Options |
|---|---|---|
| branch | `Branch` | `new`, `current` |
| worktree | `Worktree` | `no`, `yes` |
| subagents | `Subagents` | `yes`, `no` |
| commits | `Commits` | `per-task`, `per-batch`, `single` |
| commit-format | `Commit fmt` | `simple`, `numbered` |

After collecting overrides, echo the final config back to the user before step 4.

### 4. Setup

- **Branch:**
  - `branch=new` → prompt for branch name, then `git checkout -b <name>`.
  - `branch=current` AND current is `main` or `master` → refuse: warn the user and force `branch=new`, re-prompt for a name.
  - `branch=current` otherwise → stay on current branch.
- **Worktree:**
  - `worktree=yes` → create a sibling worktree at `../<repo-name>-<slug>` (`git worktree add ../<repo-name>-<slug> <branch>`) and switch the working directory to it for the rest of the run.
  - `worktree=no` → continue in the current working directory.
- **Baseline checkpoint:** record the current `HEAD` ref so you can diff and reason about the run later.

### 5. Run loop

Parse the `## Dependencies` section of `plan.md` to derive batches. Each line such as `Parallel batch A: 1, 2, 3` defines one batch; serial entries (single task or `needs: <prev>` chains) become size-1 batches.

For each batch in order:

1. **Batch size > 1 AND `subagents=yes`:** dispatch via the `superpowers:subagent-driven-development` skill. One subagent per task. Pass each subagent its full task text from the plan plus scene-setting context (slug, spec link, plan link, branch, worktree path). Subagents run parallel-safe.
2. **Batch size = 1 OR `subagents=no`:** execute every task in the batch serially in the main loop. Do not spawn parallel subagents yourself when `subagents=no`.

**After each task completes successfully:**

- **Mark the task done in `plan.md`:** prepend `[x] ` immediately after the task number on the matching line under `## Tasks`. Example: `3. [feat] add login form — needs: 1` becomes `3. [x] [feat] add login form — needs: 1`. Edit the file in place; do not rewrite untouched lines. If `commits=per-task`, include this edit in the task's commit.
- If `commits=per-task`: stage that task's changes and commit using the format spec below.
- If the task's tag list contains `db`: ask once via `AskUserQuestion` (question = `Generate / refresh ERD now? Can also run later from aux menu.`, header = `ERD now?`, options = `No — later`, `Yes — run erd-writing`). On `Yes`, invoke `erd-writing` via the Skill tool, passing the slug. On `No`, continue.

**After each batch completes successfully:**

- If `commits=per-batch`: stage and commit the whole batch's changes using the format spec below.

**After all batches complete successfully:**

- If `commits=single`: stage and commit everything as one final commit using the format spec below.

#### Commit message format

Resolve `<type>` from the task's first plan tag (`feat`, `fix`, `chore`, `refactor`, `db`, `test`, `docs`, etc.). Resolve `<name>` from the task's title in `plan.md` (lowercase, trim trailing punctuation). For batch / single commits, use the feature slug as `<name>` and the dominant tag (or `feat`) as `<type>`.

| `commits` × `commit-format` | Subject |
|---|---|
| per-task / simple | `<type> - <name>` |
| per-task / numbered | `T<N> - <type> - <name>` |
| per-batch / simple | `<type> - <feature-slug>` |
| per-batch / numbered | `T<a>-T<b> - <type> - <feature-slug>` (range covers tasks in batch; comma-separate if non-contiguous) |
| single / simple | `<type> - <feature-slug>` |
| single / numbered | `T1-T<N> - <type> - <feature-slug>` |

Body: optional, only when the "why" isn't obvious from subject + diff.

**Do NOT append `Co-Authored-By:` trailers, `Generated with Claude Code` footers, or any other attribution.** Plain commit message only. This overrides the harness default.

### 6. Failure handling

On task failure (test failure, compile error, runtime error, anything that prevents the task from being marked done):

1. **Debug step:** read the error output, locate the likely cause (file, line, symbol), attempt a fix.
2. **Retry the task:** re-run the same step from the top.
3. **Up to 3 attempts total** (initial run + 2 retries, or any equivalent count to 3).
4. **On the 3rd failure:** stop the plan. Append an entry to `docs/ultra-dev/<slug>/notes.md` under the `## Failure log` section (create the file from `templates/notes.md` if missing):

```
## <ISO timestamp> — Task <N> failed
Error: <one-line excerpt>
Retries: 3
Resolution: stopped — user intervention required
```

5. Ask via `AskUserQuestion`:

- Question: `Task <N> failed after 3 attempts. How do you want to proceed?`
- Header: `Failure`
- Options: `Skip task — continue`, `Retry with help`, `Abort plan`.

Honour the choice. On `Abort plan`, stop the run loop entirely. Do not reset state.

### 7. End-of-plan aux menu

After all batches complete (or after the user picks `Skip task` for the last failing task and the loop drains), ask via `AskUserQuestion` (multiSelect = true):

- Question: `Plan executed. Run aux skills?`
- Header: `Aux skills`
- multiSelect: `true`
- Options: `code-review`, `test-writing`, `doc-writing`, `erd-writing`. (No `none`/`all` option needed — multiSelect lets the user pick zero or all.)

Dispatch each chosen aux skill **in sequence (never in parallel)** via the Skill tool by name, in the canonical order `code-review` → `test-writing` → `doc-writing` → `erd-writing`. Wait for each to complete before starting the next. If the user picked none, skip to step 8. Do not invoke aux skills mid-run except for the inline ERD prompt after a `db`-tagged task.

### 8. Worktree cleanup

If `worktree=yes`, after the aux menu (whatever the user picked), ask via `AskUserQuestion`:

- Question: `Final step: merge / PR / skip?`
- Header: `Worktree`
- Options: `Merge into base`, `Create PR`, `Skip — leave worktree`.

- `Merge into base` → merge the worktree branch into its base, then `git worktree remove ../<repo-name>-<slug>`.
- `Create PR` → push and create a PR (use `gh pr create` if available), then `git worktree remove ../<repo-name>-<slug>`.
- `Skip — leave worktree` → leave the worktree intact for the user. Do not remove it.

If `worktree=no`, skip this step entirely.

## Checklist

- [ ] Did not auto-trigger.
- [ ] Slug resolved (chain context or directory list).
- [ ] `plan.md` exists; refused if absent.
- [ ] Rendered the entry prompt with smart defaults.
- [ ] Parsed `ok` or `key=value` overrides.
- [ ] Branch handled (refused `current` on main/master; created new otherwise).
- [ ] Worktree created if requested.
- [ ] Baseline `HEAD` recorded.
- [ ] Batches derived from `## Dependencies`.
- [ ] Subagents dispatched only for size>1 batches when `subagents=yes`.
- [ ] Serial fallback when `subagents=no` (no self-spawned parallelism).
- [ ] Commits granularity matches user choice.
- [ ] Commit subject matches `commit-format` spec; no `Co-Authored-By` / Claude attribution trailers.
- [ ] Each completed task marked `[x]` in `plan.md`.
- [ ] Failures retried up to 3, logged to `notes.md`, escalated.
- [ ] Aux menu rendered after the run; selected skills dispatched in sequence.
- [ ] Worktree merge/PR/skip step rendered when `worktree=yes`; worktree removed only on `[m]` or `[p]`.

## Do not

- Do not auto-trigger.
- Do not skip the entry prompt, even if defaults look obvious.
- Do not spawn parallel subagents yourself when `subagents=no`.
- Do not invoke `code-review`, `test-writing`, or `doc-writing` mid-run; they belong to the end-of-plan aux menu only. (`erd-writing` may run mid-run, but only via the explicit prompt after a `db`-tagged task.)
- Do not reference `commands/` or slash commands.
- Do not validate task tags.
- Do not remove the worktree on `[s]`.
- Do not add `Co-Authored-By`, `Generated with Claude Code`, or any other attribution trailer to commits made by this skill.
