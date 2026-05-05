---
name: executing-plan
description: Execute a written `docs/ultra-dev/<slug>/plan.md` end to end with configurable branch, worktree, subagent dispatch, and commit-granularity options. Does NOT auto-trigger; runs only when chained from `spec-to-plan` or invoked explicitly via the Skill tool by name.
---

# executing-plan

Execute the plan at `docs/ultra-dev/<slug>/plan.md`. Drive batches, commits, and aux skills. Stop on three failures.

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
- Otherwise: list `docs/ultra-dev/*/` directories and prompt the user to pick one. Do not invent a slug.

### 2. Plan precondition

Require `docs/ultra-dev/<slug>/plan.md`. If absent:

> No plan found at `docs/ultra-dev/<slug>/plan.md`. Run `spec-to-plan` first (it requires `spec.md`).

Stop. Do not proceed.

### 3. Entry prompt (single combined)

Parse the plan. Count tasks (`N.` lines under `## Tasks`) and batches (entries under `## Dependencies`). Determine the smart default for `branch`: if the current branch is `main` or `master`, default is `new`; otherwise `current`.

Render exactly:

```
Plan loaded: docs/ultra-dev/<slug>/plan.md
<N> tasks, <M> batches.

Defaults:
  branch        = <new|current>  # smart: force `new` if current is main/master; else `current`
  worktree      = no
  subagents     = yes (where deps allow)
  commits       = per-task
  commit-format = simple

Reply `ok` to accept, or override with space-separated key=value:
  branch=new|current
  worktree=yes|no
  subagents=yes|no
  commits=per-task|per-batch|single
  commit-format=simple|numbered
```

Parse the user's reply:

- `ok` → use defaults.
- One or more space-separated `key=value` tokens → override the named keys; unspecified keys keep their default. Example: `worktree=yes commits=per-batch`.
- Unknown keys / values → reject and re-render the prompt.

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

- If `commits=per-task`: stage that task's changes and commit using the format spec below.
- If the task's tag list contains `db`: prompt once `Generate / refresh ERD now? (yes / no — defaults to no, can run later from the aux menu)`. On `yes`, invoke `erd-writing` via the Skill tool, passing the slug. On `no`, continue.

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

5. Ask the user how to proceed:

> Task <N> failed after 3 attempts. How do you want to proceed?
>   [s] skip this task and continue   [r] retry with your help   [a] abort the plan

Parse a single letter. Honour the choice. On `a`, stop the run loop entirely. Do not reset state.

### 7. End-of-plan aux menu

After all batches complete (or after the user picks `s` for the last failing task and the loop drains), render exactly:

```
Plan executed. Run aux skills?
  [r] code-review  [t] test-writing  [d] doc-writing  [e] erd-writing  [n] none / [all]
```

Parse responses:

- A single letter `r`, `t`, `d`, `e`, or `n`.
- The literal string `all` → run `r`, `t`, `d`, `e` in that order.
- The literal string `none` → equivalent to `n`.
- Multi-letter responses such as `rt`, `rde`, or `rd` → run each named skill in the given order.

Dispatch each chosen aux skill **in sequence (never in parallel)** via the Skill tool by name: `code-review`, `test-writing`, `doc-writing`, `erd-writing`. Wait for each to complete before starting the next. Do not invoke aux skills mid-run except for the inline ERD prompt after a `db`-tagged task.

### 8. Worktree cleanup

If `worktree=yes`, after the aux menu (whatever the user picked, including `n`), render exactly:

```
Final step: merge / PR / skip?
  [m] merge into base branch   [p] create PR   [s] skip (leave worktree)
```

- `[m]` → merge the worktree branch into its base, then `git worktree remove ../<repo-name>-<slug>`.
- `[p]` → push and create a PR (use `gh pr create` if available), then `git worktree remove ../<repo-name>-<slug>`.
- `[s]` → leave the worktree intact for the user. Do not remove it.

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
