---
name: project-docs
description: Generates professional end-user or developer project documentation as a PDF with table of contents, working internal/external links, and image placeholders. Does NOT auto-trigger and is NOT chained from other skills — runs only when the user invokes `/project-docs` explicitly. Scans the repo (routes, entry points, public APIs, CLI commands, config) and writes Markdown + a rendered PDF into `docs/user-guide/` or `docs/dev-guide/`. Image folder is auto-gitignored.
---

# project-docs

Produce a polished PDF manual for a project — either an **end-user guide** (how to use the app) or a **developer guide** (architecture, APIs, deployment).

## Bundle layout

Resolved via `${CLAUDE_SKILL_DIR}` at invocation:

```
${CLAUDE_SKILL_DIR}/
  SKILL.md
  generate-pdf.mjs         # entrypoint — markdown → HTML → PDF via puppeteer
  template.html            # styled HTML shell, TOC slot, anchored headings
  templates/
    user-guide.md          # scaffold for end-user docs
    dev-guide.md           # scaffold for developer docs
```

## Invocation

Slash-command only. Runs when the user types `/project-docs` (or invokes the skill explicitly by name via the Skill tool). Never auto-triggers from keywords. Never chained from other skills (`brainstorm`, `spec-writing`, `executing-plan`, `doc-writing`, etc.) — those skills must not call into `project-docs`.

Standalone scope. Does not require ultra-dev artifacts. Works in any repo on any branch.

## Process

### 1. Pick doc type

Render verbatim:

```
Which documentation to generate?
  [u] User guide — for end users (features, workflows, screenshots)
  [d] Developer guide — technical (architecture, APIs, setup, deploy)
  [b] Both
  [cancel]
```

Stop on `cancel`. On `b`, run the user-guide flow first, then the dev-guide flow.

### 2. Scan the repo

Skip nothing structural. Collect:

- **Manifest**: `package.json` / `pyproject.toml` / `Cargo.toml` / `go.mod` / `*.csproj` — name, version, entry, scripts, deps.
- **README**: top-level `README.md` (or `README`, `README.rst`) — title, tagline, install/usage snippets.
- **Framework**: detect from manifests + dir layout. Examples: Next.js (`app/` or `pages/`), Vite (`vite.config.*`), Express (`app.listen` in source), FastAPI / Django / Flask (Python), Spring (`@SpringBootApplication`), Rails (`config.ru`), Electron (`main` entry + electron dep), CLI (`bin` in manifest).
- **Routes / entry points**:
  - Web: route files (`app/**/page.*`, `pages/**`, `routes/**`, decorators like `@app.route`, `@RestController`).
  - CLI: `bin/` scripts, `commander`/`yargs`/`click`/`typer` registrations.
  - API: OpenAPI / Swagger files, GraphQL schemas, gRPC `.proto`.
- **Public API surface**: exported symbols from `index.*`, public classes/functions in source root.
- **Config**: env-var references (`process.env.*`, `os.environ`, `Environment::var`), config files (`*.env.example`, `config/*`), feature flags.
- **Build / run scripts**: package-manager scripts, `Makefile`, `Dockerfile`, `docker-compose.yml`, CI workflow files.
- **DB / migrations**: presence of `prisma/`, `migrations/`, `db/`, ORM models.
- **Ultra-dev context** (optional): if `docs/ultra-dev/*/spec.md` exists, read the most recent for feature intent.

Cap reads — sample 1–2 representative files per category. Do not read `node_modules/`, `dist/`, `build/`, `.next/`, `tmp/`, `vendor/`.

### 3. Prepare output directory and gitignore

By doc type:

- User guide → `docs/user-guide/`
- Developer guide → `docs/dev-guide/`

Create the directory plus `docs/<type>/assets/` for images. Then update `.gitignore` at repo root:

- If `.gitignore` is missing, create it.
- Ensure these lines exist (append if absent, do not duplicate):
  ```
  docs/user-guide/assets/
  docs/dev-guide/assets/
  ```
- The markdown source and the rendered PDF are committed; only `assets/` is ignored.

### 4. Prompt for images

Render verbatim, substituting `<type>`:

```
Image folder ready: docs/<type>/assets/
Drop these in before re-rendering (all optional):
  - logo.png            — header logo, appears on cover + page header
  - cover.png           — full cover image (optional alternative to logo)
  - screenshot-*.png    — referenced inline in the doc as placeholders
Press enter to continue. The doc will render with placeholder boxes for any missing image.
```

Do not block on user reply beyond a single acknowledgement. Missing images render as a gray placeholder box with the filename — generation never fails on a missing image.

### 5. Draft the Markdown

Start from the matching scaffold:

- User guide → copy `${CLAUDE_SKILL_DIR}/templates/user-guide.md` → `docs/user-guide/user-guide.md`.
- Developer guide → copy `${CLAUDE_SKILL_DIR}/templates/dev-guide.md` → `docs/dev-guide/dev-guide.md`.

Replace placeholders in the scaffold with content drawn from the scan:

- `{{PROJECT_NAME}}`, `{{VERSION}}`, `{{TAGLINE}}` — from manifest + README.
- `{{DATE}}` — today.
- `{{FEATURES}}` — derived from routes / commands / API surface. One subsection per feature for user guide; one subsection per module for dev guide.
- `{{INSTALL}}`, `{{RUN}}`, `{{CONFIG}}`, `{{DEPLOY}}` — from scripts, env-vars, Dockerfile, CI.

Heading rules:

- `# Title` once at the top (cover).
- `## Section` for top-level sections (appear in TOC).
- `### Subsection` for features / endpoints (also in TOC).
- Use stable, lowercase, hyphenated slugs in any explicit anchor (e.g. `<a id="getting-started"></a>`). The renderer auto-slugs headings, so inline `[link](#section-name)` works as long as the target heading exists.

Image refs always use the `assets/` relative path:

```
![Logo](assets/logo.png)
![Dashboard screenshot](assets/screenshot-dashboard.png)
```

External links use absolute URLs and remain clickable in the PDF.

### 6. Render PDF

Invoke the renderer through `${CLAUDE_SKILL_DIR}`:

```
node "${CLAUDE_SKILL_DIR}/generate-pdf.mjs" \
  --input  docs/<type>/<type>.md \
  --output docs/<type>/<type>.pdf \
  --title  "<Project Name> — <User Guide|Developer Guide>" \
  --assets docs/<type>/assets
```

The script:

1. Reads the markdown, slugifies headings, builds a TOC from `##` and `###`.
2. Injects the body + TOC into `template.html`.
3. Launches Puppeteer headless, prints to A4 with header/footer, `printBackground: true`.
4. Internal `#slug` links resolve to PDF anchors. External `http(s)://` links stay clickable.
5. Missing image refs are replaced inline with a gray placeholder box bearing the filename.

### 7. Handle missing dependency

If `puppeteer` or `markdown-it` is not installed, the script exits with code `2` and prints:

```
Missing dependency. Run: npm install <pkg>
```

When that happens, surface the message verbatim and ask:

```
Driver missing. Install <pkg> now? (yes / no)
```

- `yes` → run `npm install <pkg>` then re-run the script.
- `no` → stop. Leave the markdown on disk so the user can finish manually.

### 8. Report

After success render:

```
Docs written:
  docs/<type>/<type>.md
  docs/<type>/<type>.pdf
Assets folder (gitignored):
  docs/<type>/assets/
Re-run this skill any time after adding screenshots — markdown is preserved, PDF is regenerated.
```

If the user picked `b` in step 1, repeat from step 3 for the second type and report both at the end.

## Conventions

- Markdown is the source of truth. The PDF is regenerated; never hand-edit the PDF.
- Image placeholders must always degrade gracefully — missing files never block rendering.
- The `assets/` folder is always gitignored; the `.md` and `.pdf` are always committable.
- Re-running the skill overwrites the markdown only if the user confirms. Default: append a note that the file already exists and ask before clobbering.
- Never embed secrets from `.env` / config files into generated docs. Reference variable names only.

## Do not

- Do not scan `node_modules/`, `dist/`, `build/`, `.next/`, `tmp/`, `vendor/`, or any path already in `.gitignore`.
- Do not auto-install `puppeteer` without the verbatim `yes` in step 7.
- Do not write images to disk — the user supplies them. Only create the empty `assets/` folder.
- Do not commit on the user's behalf. Leave staging to the user or `doc-writing`.

## Checklist

- [ ] Doc type captured (`u` / `d` / `b`).
- [ ] Repo scanned; framework + routes + entry points identified.
- [ ] Output dir + `assets/` created; `.gitignore` updated.
- [ ] Image-folder prompt shown.
- [ ] Markdown drafted from scaffold with scan results.
- [ ] PDF rendered; missing-dep flow handled.
- [ ] Artifact paths reported.
