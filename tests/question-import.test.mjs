// Unit tests for the bulk question importer.
//
// Run:  node tests/question-import.test.mjs
//
// The importer is the one place where extractor output meets the
// publish path, so every rule that would otherwise fail at publish
// time is asserted here against both good and deliberately malformed
// input.

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parseAndValidate, MODULES } = require('../js/question-import.js');

let checks = 0;
function check(label, fn) {
  fn();
  checks += 1;
  console.log(`  ok  ${label}`);
}

const mcq = (over = {}) => ({
  module: 'rw1',
  difficulty: 'easy',
  stem: 'Which choice completes the text?',
  choices: ['alpha', 'beta', 'gamma', 'delta'],
  correct: 1,
  ...over,
});

console.log('question-import');

// ---------------------------------------------------------------- happy path

check('accepts a mixed batch of MCQ, grid-in and figure questions', () => {
  const result = parseAndValidate({
    test_name: 'SAT Practice Test B',
    questions: [
      mcq(),
      {
        module: 'math1',
        difficulty: 'hard',
        stem: 'If $3x + 7 = 22$, what is $x$?',
        answer_type: 'spr',
        answer_text: '5',
      },
      {
        module: 'math2',
        stem: 'Which equation models the scatterplot?',
        image_url: 'https://example.supabase.co/storage/v1/object/public/question-images/p004-fig1.png',
        choices: ['$y = 2x$', '$y = x$', '$y = -x$', '$y = 0$'],
        correct: 'A',
      },
    ],
  });

  assert.deepEqual(result.errors, []);
  assert.equal(result.ok, true);
  assert.equal(result.testName, 'SAT Practice Test B');
  assert.equal(result.questions.length, 3);
  assert.deepEqual(result.byModule, { rw1: 1, rw2: 0, math1: 1, math2: 1 });

  const [first, spr, figure] = result.questions;
  assert.equal(first.module, 'rw1');
  assert.equal(first.correct, 1);
  assert.equal(first.answerType, 'mcq');
  assert.equal(spr.answerType, 'spr');
  assert.equal(spr.answerText, '5');
  assert.equal(spr.difficulty, 'hard');
  assert.equal(figure.correct, 0);
  assert.match(figure.image, /^https:\/\//);
  // Every row needs a client-side uuid: publish matches on it so a
  // retry after a partial failure updates instead of duplicating.
  result.questions.forEach((q) => {
    assert.match(q.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });
});

check('accepts a bare array without a wrapper object', () => {
  const result = parseAndValidate([mcq(), mcq({ module: 'rw2' })]);
  assert.equal(result.ok, true);
  assert.equal(result.testName, null);
  assert.equal(result.questions.length, 2);
});

check('accepts a JSON string', () => {
  const result = parseAndValidate(JSON.stringify({ questions: [mcq()] }));
  assert.equal(result.ok, true);
  assert.equal(result.questions.length, 1);
});

// ---------------------------------------------------------------- forgiving input

check('resolves letter answer keys and trailing punctuation', () => {
  for (const [input, expected] of [['A', 0], ['b', 1], ['C)', 2], ['D.', 3], ['2', 2], [3, 3]]) {
    const result = parseAndValidate([mcq({ correct: input })]);
    assert.equal(result.ok, true, `"${input}" should resolve`);
    assert.equal(result.questions[0].correct, expected, `"${input}" -> ${expected}`);
  }
});

check('accepts choices keyed by letter instead of an array', () => {
  const result = parseAndValidate([
    mcq({ choices: { A: 'alpha', B: 'beta', C: 'gamma', D: 'delta' } }),
  ]);
  assert.equal(result.ok, true);
  assert.deepEqual(result.questions[0].choices, ['alpha', 'beta', 'gamma', 'delta']);
});

check('strips A) / B. prefixes the extractor leaves on choice text', () => {
  const result = parseAndValidate([
    mcq({ choices: ['A) alpha', 'B. beta', '(C) gamma', 'D] delta'] }),
  ]);
  assert.equal(result.ok, true);
  assert.deepEqual(result.questions[0].choices, ['alpha', 'beta', 'gamma', 'delta']);
});

check('resolves module aliases', () => {
  for (const [alias, expected] of [
    ['module3', 'math1'], ['m4', 'math2'], ['1', 'rw1'],
    ['RW-2', 'rw2'], ['math_1', 'math1'], ['Math1', 'math1'],
  ]) {
    const result = parseAndValidate([mcq({ module: alias })]);
    assert.equal(result.ok, true, `"${alias}" should resolve`);
    assert.equal(result.questions[0].module, expected, `"${alias}" -> ${expected}`);
  }
});

check('accepts camelCase and snake_case keys alike', () => {
  const result = parseAndValidate([{
    module: 'math1',
    stem: 'Grid in the value.',
    answerType: 'spr',
    answerText: '3/4, 0.75, .75',
    imageUrl: 'https://example.com/fig.png',
  }]);
  assert.equal(result.ok, true);
  assert.equal(result.questions[0].answerType, 'spr');
  // Whitespace around the separators is normalised away, since the
  // stored string is compared against student input server-side.
  assert.equal(result.questions[0].answerText, '3/4,0.75,.75');
  assert.equal(result.questions[0].image, 'https://example.com/fig.png');
});

check('defaults an unrecognised difficulty to medium with a warning', () => {
  const result = parseAndValidate([mcq({ difficulty: 'very hard' })]);
  assert.equal(result.ok, true);
  assert.equal(result.questions[0].difficulty, 'medium');
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /defaulted to medium/);
});

check('defaults a missing difficulty to medium silently', () => {
  const result = parseAndValidate([mcq({ difficulty: undefined })]);
  assert.equal(result.ok, true);
  assert.equal(result.questions[0].difficulty, 'medium');
  assert.deepEqual(result.warnings, []);
});

// ---------------------------------------------------------------- rejections

check('rejects unclosed $ delimiters in stem, choice and explanation', () => {
  const stem = parseAndValidate([mcq({ stem: 'What is $x + 1?' })]);
  assert.equal(stem.ok, false);
  assert.match(stem.errors[0], /unclosed \$ math delimiter in the stem/);

  const choice = parseAndValidate([mcq({ choices: ['$x$', '$y', 'z', 'w'] })]);
  assert.equal(choice.ok, false);
  assert.match(choice.errors[0], /choice B/);

  const explanation = parseAndValidate([mcq({ explanation: 'Because $x is odd.' })]);
  assert.equal(explanation.ok, false);
  assert.match(explanation.errors[0], /explanation/);
});

// KaTeX auto-render does not honour a backslash escape when it is looking
// for an OPENING delimiter — only when looking for a closing one. So "\$"
// is valid inside math mode and broken outside it. These cases were
// verified against the real renderer, not assumed.
check('rejects a \\$ outside math mode', () => {
  const alone = parseAndValidate([mcq({ stem: 'The item costs \\$5 before tax.' })]);
  assert.equal(alone.ok, false);
  assert.match(alone.errors[0], /outside math mode/);

  // The nastiest case: the escaped dollar opens a span that swallows the
  // prose up to the next real one.
  const swallows = parseAndValidate([mcq({ stem: 'Costs \\$5, so solve $2x = 10$.' })]);
  assert.equal(swallows.ok, false);
  assert.match(swallows.errors[0], /outside math mode/);
});

check('allows \\$ inside math mode, which is how money should be written', () => {
  const money = parseAndValidate([mcq({ stem: 'The item costs $\\$5$ before tax.' })]);
  assert.equal(money.ok, true);

  const mixed = parseAndValidate([mcq({ stem: 'Costs $\\$5$, so solve $2x = 10$.' })]);
  assert.equal(mixed.ok, true);

  const inside = parseAndValidate([mcq({ stem: 'Let $a \\$ b$ denote the operation.' })]);
  assert.equal(inside.ok, true);
});

check('accepts display math and multiple inline spans', () => {
  assert.equal(parseAndValidate([mcq({ stem: 'Given $$a + b$$ and $c$, solve.' })]).ok, true);
  assert.equal(parseAndValidate([mcq({ stem: 'Three $a$ $b$ $c$ spans.' })]).ok, true);
  assert.equal(parseAndValidate([mcq({ stem: 'Unclosed display $$a + b' })]).ok, false);
});

check('rejects empty and miscounted choices', () => {
  const blank = parseAndValidate([mcq({ choices: ['alpha', '', 'gamma', 'delta'] })]);
  assert.equal(blank.ok, false);
  assert.match(blank.errors[0], /choice B is empty/);

  const three = parseAndValidate([mcq({ choices: ['a', 'b', 'c'] })]);
  assert.equal(three.ok, false);
  assert.match(three.errors[0], /expected 4 choices, got 3/);
});

check('rejects a missing or out-of-range answer key', () => {
  const missing = parseAndValidate([mcq({ correct: undefined })]);
  assert.equal(missing.ok, false);
  assert.match(missing.errors[0], /no correct answer/);

  const high = parseAndValidate([mcq({ correct: 7 })]);
  assert.equal(high.ok, false);
  assert.match(high.errors[0], /out of range/);

  const bogus = parseAndValidate([mcq({ correct: 'E' })]);
  assert.equal(bogus.ok, false);
  assert.match(bogus.errors[0], /no correct answer/);
});

check('rejects grid-in answers a student could not type', () => {
  for (const bad of ['x=5', '5 units', '12.3456', 'twelve', '3/0']) {
    const result = parseAndValidate([{
      module: 'math1', stem: 'Grid in.', answer_type: 'spr', answer_text: bad,
    }]);
    assert.equal(result.ok, false, `"${bad}" should be rejected`);
    assert.match(result.errors[0], /invalid grid-in answer/);
  }
});

check('accepts valid grid-in answer forms', () => {
  for (const good of ['5', '-3', '.75', '0.75', '3/4', '3/4,0.75,.75', '-1/2']) {
    const result = parseAndValidate([{
      module: 'math2', stem: 'Grid in.', answer_type: 'spr', answer_text: good,
    }]);
    assert.equal(result.ok, true, `"${good}" should be accepted: ${result.errors[0] || ''}`);
  }
});

check('rejects a grid-in with no answer at all', () => {
  const result = parseAndValidate([{
    module: 'math1', stem: 'Grid in.', answer_type: 'spr', answer_text: '',
  }]);
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /no accepted answers/);
});

check('downgrades grid-ins in R&W to multiple choice with a warning', () => {
  const result = parseAndValidate([mcq({ module: 'rw1', answer_type: 'spr' })]);
  assert.equal(result.ok, true);
  assert.equal(result.questions[0].answerType, 'mcq');
  assert.match(result.warnings[0], /not available in R&W/);
});

check('flags low-confidence answers for review without blocking the import', () => {
  const result = parseAndValidate([
    mcq(),
    mcq({ confidence: 'low' }),
    mcq({ confidence: 'high' }),
  ]);
  assert.equal(result.ok, true);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /^Question 2 \(R&W — Module 1\): flagged low confidence/);
  // The flag is a review aid — it must never reach the database.
  result.questions.forEach((q) => {
    assert.equal('confidence' in q, false);
    assert.equal('certainty' in q, false);
  });
});

check('rejects an unknown module', () => {
  const result = parseAndValidate([mcq({ module: 'rw5' })]);
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /unknown module "rw5"/);
});

check('rejects an empty stem', () => {
  const result = parseAndValidate([mcq({ stem: '   ' })]);
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /stem is empty/);
});

check('rejects an image_url that was never uploaded', () => {
  const result = parseAndValidate([mcq({ image_url: 'p004-fig1.png' })]);
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /is not a URL/);
});

check('reports the position of each bad question', () => {
  const result = parseAndValidate([mcq(), mcq({ stem: '' }), mcq({ correct: 9 })]);
  assert.equal(result.ok, false);
  assert.equal(result.errors.length, 2);
  assert.match(result.errors[0], /^Question 2/);
  assert.match(result.errors[1], /^Question 3 \(R&W — Module 1\)/);
});

// ---------------------------------------------------------------- caps

check('rejects a batch that exceeds a module cap', () => {
  const rows = Array.from({ length: MODULES.rw1.cap + 1 }, () => mcq());
  const result = parseAndValidate(rows);
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /28 questions exceeds the 27 cap/);
});

check('counts questions already in the builder toward the cap', () => {
  const rows = Array.from({ length: 3 }, () => mcq());

  const overflows = parseAndValidate(rows, { existingCounts: { rw1: 25 } });
  assert.equal(overflows.ok, false);
  assert.match(overflows.errors[0], /28 questions exceeds the 27 cap \(25 already in the builder \+ 3 imported\)/);

  // Replace mode passes no existing counts, so the same batch fits.
  const fits = parseAndValidate(rows, { existingCounts: {} });
  assert.equal(fits.ok, true);
});

check('fills every module to capacity without complaint', () => {
  const rows = [
    ...Array.from({ length: 27 }, () => mcq({ module: 'rw1' })),
    ...Array.from({ length: 27 }, () => mcq({ module: 'rw2' })),
    ...Array.from({ length: 22 }, () => mcq({ module: 'math1' })),
    ...Array.from({ length: 22 }, () => mcq({ module: 'math2' })),
  ];
  const result = parseAndValidate(rows);
  assert.deepEqual(result.errors, []);
  assert.equal(result.questions.length, 98);
  assert.deepEqual(result.byModule, { rw1: 27, rw2: 27, math1: 22, math2: 22 });
});

// ---------------------------------------------------------------- malformed payloads

check('reports a line number for malformed JSON', () => {
  const broken = '{\n  "questions": [\n    {"module": "rw1",},\n  ]\n}';
  const result = parseAndValidate(broken);
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /Could not read JSON/);
  assert.match(result.errors[0], /line \d+/);
});

check('rejects payloads that are not question lists', () => {
  for (const input of ['', '   ', '{"foo": 1}', '"a string"', '42']) {
    const result = parseAndValidate(input);
    assert.equal(result.ok, false, `${JSON.stringify(input)} should be rejected`);
    assert.equal(result.questions.length, 0);
    assert.ok(result.errors.length > 0);
  }
});

check('rejects an empty question list', () => {
  const result = parseAndValidate({ questions: [] });
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /No questions found/);
});

check('rejects non-object rows without throwing', () => {
  const result = parseAndValidate([mcq(), 'nonsense', null, 42]);
  assert.equal(result.ok, false);
  assert.equal(result.errors.length, 3);
  result.errors.forEach((e) => assert.match(e, /not an object/));
});

console.log(`\nquestion-import: ${checks} checks passed.`);
