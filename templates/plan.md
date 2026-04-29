# Plan: <Feature title>

Spec: ./spec.md

<!--
Template owned by the `spec-to-plan` skill.
Task line format (em-dash `—`, not hyphen):
  N. [tag(s)] action — needs: X,Y
Use `needs: —` for a task with no prerequisites.
Tags are an open taxonomy (frontend, backend, db, infra, third-party, test, docs, config, skill, ...).
-->

## Tasks

1. [tag] action — needs: —
2. [tag] action — needs: 1
3. [tag,tag] action — needs: 1,2

## Dependencies

- Parallel batch A: tasks 1, 4 (no shared files)
- Sequential after A: task 2 (depends on 1)
- Sequential after batch A: task 3 (depends on 1, 2)

## Verification

- [ ] <smoke test or command>
- [ ] <manual check>
- [ ] <command output to inspect>
