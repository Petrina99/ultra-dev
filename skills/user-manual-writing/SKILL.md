---
name: user-manual-writing
description: Build or update a branded end-user PDF manual under docs/user-manual/<slug>/ — prose + real annotated screenshots (Playwright) of the running app + brand/logo + optional legal notice + optional AES-256 protected PDF. Slash-only, never auto-triggers. Standalone from the core ultra-dev chain.
---

# user-manual-writing

Produce a **new** end-user manual or **update an existing one** under `docs/user-manual/`. Heavier than `project-docs`: this skill drives a running instance of the app through Playwright to capture real, numbered/annotated screenshots, applies a project brand (logo, accent color, legal notice), and can protect the rendered PDF (author metadata + AES-256).

## Relationship to `project-docs`

- [`project-docs`](../project-docs/SKILL.md) — fast, zero-config, scan-the-repo-and-scaffold guide. No live app, no screenshots, no encryption.
- `user-manual-writing` (this skill) — slower, opinionated, needs the app running. Real annotated screenshots, brand system, optional protected PDF.

Both share the same renderer: `${CLAUDE_SKILL_DIR}/../project-docs/generate-pdf.mjs` (markdown → HTML → PDF via Puppeteer, with TOC + anchors + image placeholders). This skill passes it the extra `--logo` / `--accent` / `--footer-note` flags that renderer supports.

## When to use

- Drafting prose/screenshots for a new manual (new `docs/user-manual/<slug>/`).
- Re-shooting screenshots after a UI change; rebuilding the PDF.
- Adding a chapter to an existing manual.

## When NOT to use

- Quick generic guide with no live screenshots → [`project-docs`](../project-docs/SKILL.md).
- In-app domain PDF generation (reports, invoices, labels) — out of scope for both doc skills.
- Application code changes — this skill only touches `docs/user-manual/`, an e2e screenshot harness under the target project's own e2e directory, and the two files it renders/protects with.

## Bundle layout

Resolved via `${CLAUDE_SKILL_DIR}` at invocation:

```
${CLAUDE_SKILL_DIR}/
  SKILL.md
  protect-pdf.py           # optional PDF protection — author metadata + AES-256 (PyMuPDF)
  templates/
    manual.config.json     # brand/app/protect config scaffold
    outline.md              # per-manual internal outline scaffold
    manual.md                # prose scaffold (house style, legal-notice slot, glossary)
    annotate.ts               # generic Playwright marker/legend screenshot helper
    auth.setup.ts              # generic per-role login -> storageState helper
```

## Prompting

Fixed-choice prompts (new-vs-existing manual, missing-dependency installs, protect on/off) MUST go through `AskUserQuestion`. Free-form values (brand name, base URL, legal notice text, owner password, slug) stay plain text.

## Triggers

Slash-only: runs when the user invokes `/user-manual-writing` or via the Skill tool by name. Never auto-triggers on keywords — it needs a running app, Playwright, and (optionally) Python + PyMuPDF, too heavy/stateful to fire opportunistically. Not chained from `brainstorm`, `spec-writing`, `spec-to-plan`, `executing-plan`, or `project-docs`.

## Process

### 1. Resolve config

Look for `docs/user-manual/manual.config.json`. If missing, copy `templates/manual.config.json` and fill it in by asking (plain text, one at a time):

- Brand name.
- Path to a horizontal logo image (PNG, no white border) — copy it to `docs/user-manual/<slug>/assets/logo.png` per manual.
- Accent color hex (default `#2b5fa6`).
- Legal/confidentiality notice text — leave blank to skip the confidentiality section entirely.
- App base URL used for screenshots (e.g. `http://localhost:3000`).
- Protect the PDF? If yes, ask whether to supply an owner password now or let `protect-pdf.py` generate one.

### 2. Pick the manual slug

List `docs/user-manual/*/` directories. Ask via `AskUserQuestion` whether to update an existing one or create a new one (kebab-case, max 4 words — same slug rule as the rest of the plugin).

### 3. Read before work

- `docs/user-manual/README.md` if present — authoritative "why/what" (standard of delivery, roles, maintenance loop). Create a short one on the very first manual in a repo.
- `docs/user-manual/<slug>/outline.md` — chapters, shot list, marker spec, feature→section map. **Internal only** — never quote it in shipped prose, never bundle it into the PDF.
- An existing `<slug>.md` in the same repo, if any, as a prose-style reference for consistency.

### 4. Prerequisites for capture

- Confirm the app responds at `config.app.baseUrl` (simple GET).
- If the manual covers role-gated screens, resolve credentials (see step 4a) — never invent them, never let them leak into shipped prose (see Conventions).
- If `config.protect.enabled`: confirm `pymupdf` is installed (`python -c "import fitz"`); offer `pip install pymupdf` on confirmed `yes`.

### 4a. Credentials for role-gated screens

Screenshots of authenticated screens need a login, but credentials must never land in a tracked file or in chat history beyond the moment of entry.

1. Ask, per role that needs screenshots, for username + password (plain text prompt — the harness has no other input channel). Do not echo the password back in any later message.
2. Write them into a **local, gitignored** env file in the target project's e2e dir, e.g. `e2e/user-manual/.env`:
   ```
   BACK_OFFICE_USERNAME=...
   BACK_OFFICE_PASSWORD=...
   ```
   Env var name = role name, uppercased, non-alphanumerics → `_`. Add `e2e/user-manual/.env` and `e2e/user-manual/.auth/` to `.gitignore` if not already covered.
3. Copy `templates/auth.setup.ts` into the harness (e.g. `e2e/user-manual/auth.setup.ts`) and adjust its login-form selectors to the target app's actual login page. Run it once per role — it logs in and saves Playwright `storageState` to `e2e/user-manual/.auth/<role>.json` (also gitignored).
4. Screenshot specs reuse the saved session instead of logging in per shot: `test.use({ storageState: "e2e/user-manual/.auth/<role>.json" })` on the relevant project/describe block. Re-run step 3 for a role only when its session expires or credentials change.

### 5. Work one chapter at a time

Steps 5–7 run **per chapter**, not per manual: draft that chapter's prose → capture its shots → spot-check → move on. Render (step 8) once at the end over the whole `.md`.

A whole manual's prose plus every screenshot in one pass is what makes this skill crawl. `outline.md`'s chapter list is the work queue; on an update, its feature→section map scopes which chapters and which screenshot specs actually need re-running — do not re-shoot the manual because one screen changed.

### 5a. Prose (house style)

- Heading hierarchy: `#` cover → `##` chapter → `###` section. Steps are numbered, written in the **imperative**, each with its expected result.
- Callouts as blockquote: `> **Note:**` / `> **Important:**` / `> **Tip:**` / `> **Role:**`.
- If `config.brand.legalNotice` is set, a confidentiality/legal blockquote sits immediately after the intro (template has the slot). If blank, drop the block entirely — don't ship an empty one.
- Glossary at the end.
- **No internal notes in shipped prose** — maintenance triggers, marker specs, TODOs live only in `outline.md`.
- Image ref immediately after the step it illustrates: `![Description](assets/<feature>-<NN>-<description>.png)`. Annotated images get a **numbered legend list** immediately below, numbers matching the drawn markers.

### 6. Screenshots (Playwright)

- If the target project has no manual-screenshot harness yet, create one under its own e2e directory (ask where — most projects already have an `e2e/` root) and copy `templates/annotate.ts` in as a fixture. Centralize marker locator lists in one `selectors.ts`-style file in that harness; don't scatter locators across specs.
- Plain screenshot: `shot(page, outPath)`. Annotated: `shotAnnotated(page, outPath, markers, color?)` from the copied `annotate.ts`. `Marker = {target, n, label, type?: click|dblclick|scroll, place?: tl|tr|bl|br}`.
- Selectors must be robust and **unambiguous**: `getByRole`/`getByText`/`getByPlaceholder`/`aria-label` — never CSS/utility classes.
- **Uniqueness gotcha:** a loose selector (`getByText(/regex/).first()`, bare text match) can resolve to a *hidden or duplicate* element sharing the same label as your real target — classic case is a collapsed sidebar nav-link sharing text with a form field label. Fix by narrowing: exact text + a discriminator (e.g. a required-field marker like `*`), scope to the form/dialog, or switch to `getByRole`/`getByPlaceholder`.
- **The harness enforces this, not your eyes.** `shotAnnotated` **throws** when a marker resolves to ≠ 1 element, has no bounding box, or falls outside the viewport. A green run therefore already proves every marker is unique, visible, and fully in frame. When it throws, fix the selector or the viewport — never `.first()` your way past it.
- **After capture, open at most one or two PNGs per chapter** as a spot-check on framing and legend order. Do **not** read every screenshot into context: each one is a full image payload, and a 30-shot manual read shot-by-shot is the single most expensive thing this skill can do. Read a specific PNG beyond the spot-check only when something concrete points at it (a throw you just fixed, a user complaint about one figure).
- Off-screen/clipped fixes: raise the viewport before the shot for below-the-fold elements (e.g. `page.setViewportSize({width:1440,height:1200})`), then restore it; use `scrollIntoViewIfNeeded()` (the `scroll` marker type) for near-fold elements; raise viewport height for tall forms/detail panes that clip.
- Run screenshots via the target project's own test runner/command, scoped to the manual's spec/tag.

### 7. Brand

- `assets/logo.png` must exist per manual slug dir. If missing, warn and stop — don't silently substitute a shared fallback logo run after run. Verify the cover after each render (logo visible, correctly placed).
- Legend/marker color follows `config.brand.accentColor` (passed as `shotAnnotated`'s `color` argument and as the renderer's `--accent`).

### 8. Render + protect

Render via the shared renderer:

```
node "${CLAUDE_SKILL_DIR}/../project-docs/generate-pdf.mjs" \
  --input  docs/user-manual/<slug>/<slug>.md \
  --output docs/user-manual/<slug>/<slug>.pdf \
  --title  "<brand name> — <manual title>" \
  --assets docs/user-manual/<slug>/assets \
  --logo   docs/user-manual/<slug>/assets/logo.png \
  --accent <config.brand.accentColor> \
  --footer-note "<short confidentiality line, if any>"
```

If `config.protect.enabled`, protect it:

```
python "${CLAUDE_SKILL_DIR}/protect-pdf.py" \
  --input docs/user-manual/<slug>/<slug>.pdf \
  --author "<config.brand.name>" \
  [--owner-password <pw>]
```

Verify (PyMuPDF): `needs_pass == 0`, `metadata['author']` matches the brand name, `metadata['encryption']` contains `AES`, permissions are print-allowed / copy-denied / modify-denied unless the user asked for `--allow-copy`/`--allow-modify`.

### 9. Windows PowerShell UTF-8 BOM gotcha

If the target project builds under Windows PowerShell 5.1, the manual `.md` and any shared build CSS must stay **UTF-8 with BOM**, or non-ASCII characters (diacritics, curly quotes) corrupt on build. The Edit tool writes BOM-less — after editing such a file on Windows, restore the BOM:

```
[System.IO.File]::WriteAllText($f, [System.IO.File]::ReadAllText($f,[Text.UTF8Encoding]::new($false)), [Text.UTF8Encoding]::new($true))
```

### 10. Maintenance loop

UI change → refresh prose per `outline.md`'s feature→section map → re-run the affected screenshot spec → re-render (step 8) → commit (`.md` + `assets/*.png` + `.pdf`).

## Definition of done

1. Full prose covering every mapped feature.
2. Annotated screenshots with matching legends.
3. Brand applied (logo + accent) on cover/render.
4. Legal/confidentiality section present if `config.brand.legalNotice` is set.
5. PDF protected (author + AES-256, opens without a password) if `config.protect.enabled`; otherwise a plain rendered PDF.

## Conventions

- Markdown is the source of truth. The PDF is regenerated — never hand-edited.
- Never put real credentials or connection strings in shipped `<slug>.md`. `outline.md` and `manual.config.json` may reference role *names* but never actual usernames/passwords — those live only in the gitignored `.env` (step 4a).
- Never echo a password back in chat once entered. Never write credentials into `manual.config.json`, `outline.md`, commit messages, or the shipped manual.
- Screenshots and the PDF are committed for reproducibility. Renderer output isn't always byte-stable across identical inputs — check `git diff --stat` before committing a rebuild; don't recommit a byte-changed-but-content-identical PDF as noise.

## Do not

- Do not invent test credentials — ask the user.
- Do not write credentials anywhere except the gitignored `.env` (step 4a) — not into config, outline, prose, or commits.
- Do not auto-install Playwright browsers or `pymupdf` without an explicit `yes`.
- Do not read every screenshot into context — spot-check one or two per chapter (step 6).
- Do not bypass an `annotate.ts` throw with `.first()` or by dropping the marker — fix the selector or the viewport.
- Do not ship a manual with a missing logo — stop and ask instead of falling back silently.
- Do not chain into or from `project-docs` — pick one per invocation.

## Checklist

- [ ] Config resolved (`manual.config.json` created or loaded).
- [ ] Slug picked (existing or new).
- [ ] `outline.md` and any prior `<slug>.md` read for context.
- [ ] App reachable; credentials sourced from the user, not invented.
- [ ] Worked chapter by chapter, not whole-manual-at-once.
- [ ] Prose follows house style; legal section present only if configured.
- [ ] Screenshots captured; harness throw-free; one or two spot-checked per chapter.
- [ ] Logo present per manual; brand accent applied.
- [ ] PDF rendered; protected + verified if `config.protect.enabled`.
- [ ] Artifact paths reported; commit left to the user.
