#!/usr/bin/env node
// ultra-dev — SessionStart banner.
//
// Reads the managed block that /setup-ultra-dev writes into the project's
// CLAUDE.md and echoes the active settings. Silent when the project has no
// block, so repos that never ran setup see nothing.
//
// Self-check: node hooks/ultra-dev-banner.js --self-check

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const SETTINGS_RE = /<!--\s*ultra-dev:settings\s+([^>]*?)-->/;

function parseSettings(text) {
  const m = text && text.match(SETTINGS_RE);
  if (!m) return null;
  const out = {};
  for (const pair of m[1].trim().split(/\s+/)) {
    const i = pair.indexOf('=');
    if (i > 0) out[pair.slice(0, i)] = pair.slice(i + 1);
  }
  return out;
}

function banner(s) {
  const line =
    `ULTRA-DEV — routing=${s.routing || '?'} · tests=${s.tests || 'ask'}` +
    ` · docs=${s.docs || 'ask'} · adhd=${s.adhd || 'off'}`;
  if (s.adhd !== 'on') return line;
  return (
    line +
    '\n\nADHD MODE ON — load the `i-have-adhd` skill (ultra-dev-plugin) and shape every' +
    ' response by it for the whole session: next action first, numbered steps, state' +
    ' restated each turn, no preamble and no closer. Turn it off with "stop adhd mode"' +
    ' or /i-have-adhd off.'
  );
}

function readFirst(paths) {
  for (const p of paths) {
    try {
      return fs.readFileSync(p, 'utf8');
    } catch (e) {
      /* next candidate */
    }
  }
  return null;
}

if (process.argv[2] === '--self-check') {
  assert.strictEqual(parseSettings('# no block here'), null);
  assert.strictEqual(parseSettings(null), null);
  const s = parseSettings(
    'x\n<!-- ultra-dev:settings routing=features tests=auto docs=ask adhd=on -->\ny'
  );
  assert.deepStrictEqual(s, { routing: 'features', tests: 'auto', docs: 'ask', adhd: 'on' });
  assert.ok(banner(s).includes('ADHD MODE ON'));
  assert.ok(banner({ routing: 'features', adhd: 'off' }).includes('adhd=off'));
  assert.ok(!banner({ routing: 'features', adhd: 'off' }).includes('ADHD MODE ON'));
  console.log('self-check ok');
  process.exit(0);
}

const cwd = process.cwd();
const settings = parseSettings(
  readFirst([path.join(cwd, 'CLAUDE.md'), path.join(cwd, '.claude', 'CLAUDE.md')])
);
if (!settings) process.exit(0);
process.stdout.write(banner(settings));
