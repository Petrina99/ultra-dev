#!/usr/bin/env node
// generate-pdf.mjs — markdown -> HTML (with TOC + anchors) -> PDF via Puppeteer.
// Internal #slug links resolve to PDF anchors; external links stay clickable;
// missing image files render as a gray placeholder box bearing the filename.

import { readFile, writeFile, access } from "node:fs/promises";
import { constants as FS } from "node:fs";
import { resolve, dirname, basename, join, isAbsolute, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { exit, argv } from "node:process";

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
      out[key] = val;
    }
  }
  return out;
}

function die(msg, code = 1) {
  console.error(msg);
  exit(code);
}

async function loadOptionalDep(name, install) {
  try {
    return await import(name);
  } catch (err) {
    if (err && (err.code === "ERR_MODULE_NOT_FOUND" || /Cannot find package/.test(String(err.message)))) {
      console.error(`Missing dependency. Run: npm install ${install}`);
      exit(2);
    }
    throw err;
  }
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function uniqueSlug(base, used) {
  let s = base || "section";
  let n = 1;
  while (used.has(s)) {
    n += 1;
    s = `${base}-${n}`;
  }
  used.add(s);
  return s;
}

function buildToc(tokens, md) {
  const items = [];
  const used = new Set();
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type !== "heading_open") continue;
    const level = Number(t.tag.slice(1));
    if (level < 2 || level > 3) continue;
    const inline = tokens[i + 1];
    const text = inline && inline.type === "inline" ? inline.content : "";
    const slug = uniqueSlug(slugify(text), used);
    t.attrSet("id", slug);
    items.push({ level, text, slug });
  }
  if (!items.length) return "";
  let html = `<nav class="toc" aria-label="Table of contents"><h2>Table of contents</h2><ul>`;
  let openL2 = false;
  let openSub = false;
  for (const it of items) {
    if (it.level === 2) {
      if (openSub) { html += "</ul>"; openSub = false; }
      if (openL2) html += "</li>";
      html += `<li class="toc-l2"><a href="#${it.slug}">${escapeHtml(it.text)}</a>`;
      openL2 = true;
    } else if (it.level === 3) {
      if (!openSub) { html += "<ul>"; openSub = true; }
      html += `<li class="toc-l3"><a href="#${it.slug}">${escapeHtml(it.text)}</a></li>`;
    }
  }
  if (openSub) html += "</ul>";
  if (openL2) html += "</li>";
  html += "</ul></nav>";
  return html;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function fileExists(p) {
  try {
    await access(p, FS.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function rewriteImages(html, assetsDir) {
  const re = /<img\b([^>]*?)\bsrc=["']([^"']+)["']([^>]*)>/gi;
  const parts = [];
  let last = 0;
  let m;
  const tasks = [];
  while ((m = re.exec(html)) !== null) {
    parts.push({ start: m.index, end: m.index + m[0].length, pre: m[1], src: m[2], post: m[3], full: m[0] });
  }
  for (const p of parts) {
    let src = p.src;
    let absPath = null;
    if (/^https?:\/\//i.test(src) || /^data:/i.test(src)) {
      tasks.push({ ...p, replacement: p.full });
      continue;
    }
    if (isAbsolute(src)) absPath = src;
    else absPath = resolve(assetsDir, "..", src);
    const exists = await fileExists(absPath);
    if (exists) {
      const url = pathToFileURL(absPath).href;
      const replacement = `<img${p.pre}src="${url}"${p.post}>`;
      tasks.push({ ...p, replacement });
    } else {
      const label = basename(src);
      const ph = `<span class="img-placeholder" role="img" aria-label="Missing image: ${escapeHtml(label)}">Missing image: ${escapeHtml(label)}</span>`;
      tasks.push({ ...p, replacement: ph });
    }
  }
  let out = "";
  let cursor = 0;
  for (const t of tasks) {
    out += html.slice(cursor, t.start) + t.replacement;
    cursor = t.end;
  }
  out += html.slice(cursor);
  return out;
}

async function main() {
  const args = parseArgs(argv);
  const input = args.input;
  const output = args.output;
  const title = args.title || "Documentation";
  const assets = args.assets || "assets";
  const accent = args.accent || "#2b5fa6";
  const footerNote = args["footer-note"] || "";
  if (!input || !output) {
    die("Usage: generate-pdf.mjs --input <md> --output <pdf> [--title <s>] [--assets <dir>] [--logo <path>] [--accent <hex>] [--footer-note <s>]");
  }
  const inputPath = resolve(input);
  const outputPath = resolve(output);
  const assetsDir = resolve(assets);

  let logoHtml = "";
  if (args.logo) {
    const logoPath = resolve(args.logo);
    if (await fileExists(logoPath)) {
      logoHtml = `<img class="cover-logo" src="${pathToFileURL(logoPath).href}" alt="Logo">`;
    } else {
      console.error(`Logo not found, skipping: ${logoPath}`);
    }
  }

  const md = await readFile(inputPath, "utf8").catch((e) => die(`Cannot read input: ${e.message}`));

  const MarkdownIt = (await loadOptionalDep("markdown-it", "markdown-it")).default;
  const mdr = new MarkdownIt({ html: true, linkify: true, typographer: true });

  const env = {};
  const tokens = mdr.parse(md, env);
  const toc = buildToc(tokens, mdr);
  const body = mdr.renderer.render(tokens, mdr.options, env);

  const templatePath = join(__dirname, "template.html");
  let template = await readFile(templatePath, "utf8");
  template = template
    .replaceAll("{{TITLE}}", escapeHtml(title))
    .replaceAll("{{ACCENT}}", escapeHtml(accent))
    .replace("{{LOGO}}", logoHtml)
    .replace("{{TOC}}", toc)
    .replace("{{BODY}}", body)
    .replaceAll("{{DATE}}", new Date().toISOString().slice(0, 10));

  template = await rewriteImages(template, assetsDir);

  const puppeteer = (await loadOptionalDep("puppeteer", "puppeteer")).default;
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.setContent(template, { waitUntil: "load" });
    await page.emulateMediaType("print");
    await page.pdf({
      path: outputPath,
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      margin: { top: "22mm", bottom: "22mm", left: "18mm", right: "18mm" },
      headerTemplate: `<div style="font-size:9px;width:100%;padding:0 14mm;color:#888;display:flex;justify-content:space-between;"><span>${escapeHtml(title)}</span><span class="date"></span></div>`,
      footerTemplate: `<div style="font-size:9px;width:100%;padding:0 14mm;color:#888;display:flex;justify-content:space-between;"><span>${escapeHtml(footerNote)}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
    });
  } finally {
    await browser.close();
  }
  console.log(`Wrote ${relative(process.cwd(), outputPath)}`);
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  exit(1);
});
