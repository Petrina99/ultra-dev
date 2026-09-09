# Notes: <Feature title>

<!--
Template owned by the `executing-plan` skill (run log, failure log) and `doc-writing` skill (shipped notes).
Append-only. Newest entry on top under each section. Never rewrite or delete prior entries.
-->

## Run log

<!--
Appended by `executing-plan` at the start of every run — one line, so a later
session (or one whose context was compacted) can find the run's base commit.

<ISO timestamp> — run started · base <sha> · branch <name> · worktree <path or none>
-->

## Failure log

<!--
Appended by `executing-plan` after a task fails 3 times.
Entry format:

## <ISO timestamp> — Task <N> failed
Error: <one-line excerpt>
Retries: 3
Resolution: stopped — user intervention required
-->

## Shipped notes

<!--
Appended by `doc-writing` (or by hand) once work lands.
Free-form: what shipped, follow-ups, deferred items, links to PRs / commits.
-->
