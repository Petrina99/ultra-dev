---
name: erd-writing
description: Generates an entity-relationship diagram (ERD) from a live database. Auto-triggers on database / schema / migration / ERD / diagram / table / relation / foreign-key keywords. Asks the user before introspecting; supports Postgres, SQLite, and SQL Server. Outputs erd.md (Mermaid for LLM context) and erd.html (rendered diagram for browser viewing) into the active feature directory.
---

# erd-writing

Run the bundled `erd.mjs` (next to this SKILL.md) to introspect a relational database and drop a rendered ERD into `docs/ultra-dev/<slug>/`.

## Bundle layout

Resolved via `${CLAUDE_SKILL_DIR}` (set by Claude Code at invocation time):

```
${CLAUDE_SKILL_DIR}/
  SKILL.md
  erd.mjs            # entrypoint
  template.html      # browser-openable Mermaid page
  queries/
    postgres.mjs     # introspector — needs `pg`
    sqlite.mjs       # introspector — needs `better-sqlite3`
    sqlserver.mjs    # introspector — needs `mssql`
```

## Triggers

Auto-triggers on: db, database, schema, migration, ERD, erd, diagram, table, tables, relation, relations, foreign key, FK.

Also runs:

- When invoked explicitly via the Skill tool by name (`erd-writing`).
- From the `executing-plan` aux menu (letter `e`).
- When the user opts in after a `db`-tagged task during `executing-plan`.

## Process

### 1. Confirm intent

Render verbatim:

```
Generate ERD for the current schema? (yes / no)
```

- `no` → stop. Do not import drivers, do not prompt further.
- `yes` → continue.

### 2. Resolve target slug

- Chained from `executing-plan`: slug already in scope.
- Standalone: list `docs/ultra-dev/*/` and prompt for a pick.
- If no slug applies, ask for an output directory path.

### 3. Gather connection info

Ask:

```
DB engine? (postgres / sqlite / sqlserver)
```

Then, by engine:

- `postgres`  → ask for the connection string. Suggest `$DATABASE_URL` if it is set in env. Ask for schema name (default: `public`).
- `sqlite`    → ask for the `.db` / `.sqlite` file path. Skip the schema question.
- `sqlserver` → ask for the connection string (mention `TrustServerCertificate=true` is often needed locally). Ask for schema name (default: `dbo`).

If the host in the connection string is not `localhost` / `127.0.0.1` / `::1`, render a single second confirmation:

```
Host <hostname> is not local. Connect anyway? (yes / no)
```

Stop on `no`.

### 4. Run the script

Invoke via Bash, resolving the script through the skill-dir variable so it works regardless of the user's CWD:

```
node "${CLAUDE_SKILL_DIR}/erd.mjs" --db <engine> --conn "<conn>" --out docs/ultra-dev/<slug> [--schema <schema>] [--title "<title>"]
```

Title default: `<Feature title> — DB ERD` if a `spec.md` exists for the slug and exposes a feature title; else `Database ERD`.

### 5. Handle missing dependency

The script exits with code `2` and prints `Missing dependency. Run: npm install <pkg>` if the engine driver is not installed.

When that happens, surface the message verbatim and ask:

```
Driver missing. Install <pkg> now? (yes / no)
```

- `yes` → run `npm install <pkg>`. Re-run the script.
- `no` → stop. Leave nothing on disk.

### 6. Confirm artifacts

The script writes:

- `docs/ultra-dev/<slug>/erd.md`   — Mermaid code block, intended for LLM context.
- `docs/ultra-dev/<slug>/erd.html` — self-contained page (Mermaid via CDN); open in a browser to view.

After success, render:

```
ERD written:
  docs/ultra-dev/<slug>/erd.md
  docs/ultra-dev/<slug>/erd.html
Open the .html file in a browser to view it.
```

## Conventions

- Never echo the full connection string in chat. Mask the password:
  `postgres://user:****@host:5432/db`.
- Never write the connection string to disk — pass it as a CLI argument only.
- Output paths are always inside `docs/ultra-dev/<slug>/` unless the user overrides in step 2.
- Both `erd.md` and `erd.html` are safe to commit — they hold schema metadata only, not data.
- The bundled `template.html` ships Mermaid via CDN. Offline viewers will not render the diagram; the Mermaid source under `<details>` is still readable.

## Do not

- Do not skip the verbatim `yes` in step 1.
- Do not skip the second confirmation when the host is non-local.
- Do not connect to more than one database per run.
- Do not auto-install the driver without the verbatim `yes` in step 5.

## Checklist

- [ ] Step 1 confirmation captured.
- [ ] Slug or output dir resolved.
- [ ] Engine + connection string + (optional) schema gathered.
- [ ] Non-local host re-confirmed if applicable.
- [ ] Script invoked; missing-driver flow handled.
- [ ] Artifact paths reported back to the user.
