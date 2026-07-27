#!/usr/bin/env node
//
// Validate question import files before they are pasted into the builder.
//
//   node tools/validate-import.mjs import-rw1.json
//   node tools/validate-import.mjs import-*.json
//
// Runs the exact rules the Import modal runs, so a file that passes here
// will import cleanly. Intended to be run in a loop by whatever produced
// the JSON — fix, re-run, repeat until it exits 0.
//
// Exit codes:  0 = every file valid   1 = at least one file has errors
//
// Files are validated independently, so per-module files are each checked
// against that module's own cap. Pass --combined to validate a set of
// files as one batch instead, which is what you want when several files
// contribute questions to the same module.

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

const require = createRequire(import.meta.url);
const { parseAndValidate, MODULES } = require('../js/question-import.js');

const args = process.argv.slice(2);
const combined = args.includes('--combined');
const paths = args.filter((arg) => !arg.startsWith('--'));

if (paths.length === 0) {
  console.error('Usage: node tools/validate-import.mjs <file.json> [more.json ...] [--combined]');
  process.exit(2);
}

// Output is routinely piped or captured by whatever is driving the fix
// loop, so only colourise when a human is actually watching.
const colour = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code) => (colour ? `\x1b[${code}m` : '');
const RED = paint(31);
const YELLOW = paint(33);
const GREEN = paint(32);
const DIM = paint(2);
const OFF = paint(0);

function report(label, result) {
  const counts = Object.entries(result.byModule)
    .filter(([, n]) => n > 0)
    .map(([key, n]) => `${key}:${n}`)
    .join(' ');

  if (result.ok) {
    console.log(`${GREEN}PASS${OFF} ${label} ${DIM}${result.questions.length} question(s)  ${counts}${OFF}`);
  } else {
    console.log(`${RED}FAIL${OFF} ${label} ${DIM}${result.errors.length} error(s)${OFF}`);
    for (const error of result.errors) console.log(`       ${RED}·${OFF} ${error}`);
  }
  for (const warning of result.warnings) {
    console.log(`       ${YELLOW}!${OFF} ${warning}`);
  }
}

let failed = 0;
const batch = [];

for (const path of paths) {
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch (err) {
    console.log(`${RED}FAIL${OFF} ${basename(path)} ${DIM}${err.code === 'ENOENT' ? 'file not found' : err.message}${OFF}`);
    failed += 1;
    continue;
  }

  if (combined) {
    const parsed = parseAndValidate(text);
    // A parse failure has no questions to contribute, so report it now
    // rather than letting it vanish into the combined batch.
    if (!parsed.ok && parsed.questions.length === 0) {
      report(basename(path), parsed);
      failed += 1;
      continue;
    }
    batch.push(...parsed.questions.map((q) => ({ ...q, answer_type: q.answerType, answer_text: q.answerText, image_url: q.image })));
    continue;
  }

  const result = parseAndValidate(text);
  report(basename(path), result);
  if (!result.ok) failed += 1;
}

if (combined && batch.length) {
  const result = parseAndValidate(batch);
  report(`${paths.length} file(s) combined`, result);
  if (!result.ok) failed += 1;
}

console.log('');
if (failed) {
  console.log(`${RED}${failed} file(s) failed.${OFF} Fix the errors above and run again.`);
  process.exit(1);
}

// Caps are the constraint most likely to be discovered late, so state
// the remaining headroom rather than leaving it to be counted by hand.
if (!combined && paths.length > 1) {
  console.log(`${DIM}Module caps: ${Object.entries(MODULES).map(([k, m]) => `${k} ${m.cap}`).join(', ')}${OFF}`);
}
console.log(`${GREEN}All files valid.${OFF} Paste into the builder's Import modal.`);
