// ================================================================
// Bulk question import — parser + validator
// ================================================================
// Turns extractor output (Codex, OCR, hand-written JSON) into the
// in-memory question shape used by admin-test-builder.js:
//
//   { id, module, difficulty, stem, image, choices[4],
//     correct, answerType, answerText, explanation }
//
// Deliberately forgiving on input (snake_case or camelCase keys,
// letter or index answers, module aliases) and strict on output —
// anything that would fail at publish time is reported here instead,
// with the question's position so it can be fixed at the source.
//
// Runs in the browser (window.satQuestionImport) and in node
// (module.exports) so the same rules can be unit-tested headlessly.
// ================================================================

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.satQuestionImport = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Mirrors MODULE_CONFIG in admin-test-builder.js. Caps come from the
  // real digital SAT module lengths and are enforced by the builder UI
  // and by the (test_id, module_key, order_num) unique key in Postgres.
  const MODULES = {
    rw1:   { label: 'R&W — Module 1',  section: 'rw',   cap: 27 },
    rw2:   { label: 'R&W — Module 2',  section: 'rw',   cap: 27 },
    math1: { label: 'Math — Module 3', section: 'math', cap: 22 },
    math2: { label: 'Math — Module 4', section: 'math', cap: 22 },
  };

  const DIFFICULTIES = ['easy', 'medium', 'hard'];
  const LETTERS = ['A', 'B', 'C', 'D'];

  // Extractors are inconsistent about module naming, so accept the
  // spellings they actually emit rather than making a human fix them.
  const MODULE_ALIASES = {
    rw1: 'rw1', rw2: 'rw2', math1: 'math1', math2: 'math2',
    'rw-1': 'rw1', 'rw-2': 'rw2', 'math-1': 'math1', 'math-2': 'math2',
    'rw_1': 'rw1', 'rw_2': 'rw2', 'math_1': 'math1', 'math_2': 'math2',
    'reading1': 'rw1', 'reading2': 'rw2',
    'module1': 'rw1', 'module2': 'rw2', 'module3': 'math1', 'module4': 'math2',
    'm1': 'rw1', 'm2': 'rw2', 'm3': 'math1', 'm4': 'math2',
    '1': 'rw1', '2': 'rw2', '3': 'math1', '4': 'math2',
  };

  function uuid() {
    const c = typeof globalThis !== 'undefined' ? globalThis.crypto : null;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
      const r = Math.random() * 16 | 0;
      return (ch === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  // First non-undefined value among several possible key spellings.
  function pick(obj, ...keys) {
    for (const key of keys) {
      if (obj && obj[key] !== undefined && obj[key] !== null) return obj[key];
    }
    return undefined;
  }

  function str(value) {
    return value === undefined || value === null ? '' : String(value);
  }

  // Math delimiter check, matching how KaTeX auto-render actually scans.
  //
  // Critically, auto-render treats EVERY "$" as a delimiter — it does not
  // honour a backslash escape outside math mode. So "Costs \$5 then $2x=1$"
  // opens math at the escaped dollar and closes it at the real one,
  // swallowing the prose between them. A backslash-escaped dollar is only
  // valid *inside* math mode, where it is a genuine KaTeX command:
  //
  //   broken:  Costs \$5 then $2x=1$      renders "5 then " as math
  //   correct: Costs $\$5$ then $2x=1$    two math spans, as intended
  //
  // Returns null when the text is fine, otherwise a short reason.
  function mathDelimiterProblem(value) {
    const text = str(value);
    let inMath = false;
    let escapedOutsideMath = false;
    let i = 0;

    while (i < text.length) {
      if (text[i] !== '$') { i += 1; continue; }
      const escaped = i > 0 && text[i - 1] === '\\';

      if (inMath) {
        // Inside math, "\$" is a KaTeX command for a literal dollar sign
        // and auto-render correctly skips over it.
        if (escaped) { i += 1; continue; }
        i += text[i + 1] === '$' ? 2 : 1;
        inMath = false;
      } else {
        // Outside math, auto-render does NOT skip the escape — it opens a
        // math span here, swallowing prose up to the next "$".
        if (escaped) escapedOutsideMath = true;
        i += text[i + 1] === '$' ? 2 : 1;
        inMath = true;
      }
    }

    // The escaped-dollar message is the more actionable of the two when
    // both apply, which is the usual case for a stray "\$".
    if (escapedOutsideMath) {
      return 'a \\$ outside math mode — KaTeX reads it as an opening delimiter. Write $\\$5$ or "5 dollars" instead';
    }
    if (inMath) return 'unclosed $ math delimiter';
    return null;
  }

  // Grid-in answers are graded by string match server-side, so each
  // accepted form must fit what the student can physically enter:
  // at most 5 characters, decimal or fraction, no algebra.
  function isValidSprToken(value) {
    const token = str(value).trim();
    if (!token || token.length > 5) return false;
    if (/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(token)) return true;
    const fraction = token.match(/^(-?\d+)\/(\d+)$/);
    return Boolean(fraction && Number(fraction[2]) !== 0);
  }

  function normalizeModule(value) {
    const key = str(value).trim().toLowerCase().replace(/\s+/g, '');
    return MODULE_ALIASES[key] || null;
  }

  // Accepts 0-3, "0"-"3", "A"-"D", or "B)" style answer keys.
  function normalizeCorrect(value) {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value === 'number' && Number.isInteger(value)) return value;
    const token = str(value).trim().toUpperCase().replace(/[).\]]+$/, '');
    if (/^[0-3]$/.test(token)) return Number(token);
    const letter = LETTERS.indexOf(token);
    return letter >= 0 ? letter : null;
  }

  function normalizeDifficulty(value) {
    const token = str(value).trim().toLowerCase();
    return DIFFICULTIES.includes(token) ? token : null;
  }

  // Choices may arrive as an array, or as an object keyed by letter
  // ({A: "...", B: "..."}), which is what most PDF extractors produce.
  function normalizeChoices(value) {
    if (Array.isArray(value)) return value.map((c) => str(c).trim());
    if (value && typeof value === 'object') {
      const keys = Object.keys(value);
      const letterKeys = LETTERS.filter((l) => keys.some((k) => k.trim().toUpperCase() === l));
      if (letterKeys.length) {
        return LETTERS.map((letter) => {
          const match = keys.find((k) => k.trim().toUpperCase() === letter);
          return match ? str(value[match]).trim() : '';
        });
      }
    }
    return null;
  }

  // Strips the "A) " / "B. " prefix extractors leave on choice text —
  // the builder renders its own letters, so leaving these in shows "A) A) ...".
  function stripChoicePrefix(text) {
    return str(text).replace(/^\s*\(?[A-Da-d][).\]]\s+/, '').trim();
  }

  function parseInput(input) {
    if (typeof input !== 'string') return { data: input, error: null };
    const trimmed = input.trim();
    if (!trimmed) return { data: null, error: 'Nothing pasted.' };
    try {
      return { data: JSON.parse(trimmed), error: null };
    } catch (err) {
      // Point at the offending line — a 98-question paste is not
      // something anyone wants to eyeball for a stray comma.
      const position = /position (\d+)/.exec(err.message);
      let hint = '';
      if (position) {
        const upto = trimmed.slice(0, Number(position[1]));
        hint = ` (around line ${upto.split('\n').length})`;
      }
      return { data: null, error: `Could not read JSON${hint}: ${err.message}` };
    }
  }

  /**
   * Validate and convert an import payload.
   *
   * @param {string|object} input JSON text, an array of questions, or
   *   an object with a `questions` array and optional `test_name`.
   * @param {object} [options]
   * @param {object} [options.existingCounts] Current per-module question
   *   counts, so cap checks account for what is already in the builder.
   * @returns {{ok: boolean, testName: string|null, questions: object[],
   *   byModule: object, errors: string[], warnings: string[]}}
   */
  function parseAndValidate(input, options) {
    const opts = options || {};
    const existingCounts = opts.existingCounts || {};
    const errors = [];
    const warnings = [];

    const { data, error } = parseInput(input);
    if (error) return { ok: false, testName: null, questions: [], byModule: {}, errors: [error], warnings };

    let rows = null;
    let testName = null;
    if (Array.isArray(data)) {
      rows = data;
    } else if (data && typeof data === 'object') {
      testName = pick(data, 'test_name', 'testName', 'name') || null;
      const list = pick(data, 'questions', 'items', 'rows');
      if (Array.isArray(list)) rows = list;
    }

    if (!rows) {
      return {
        ok: false, testName: null, questions: [], byModule: {},
        errors: ['Expected an array of questions, or an object with a "questions" array.'],
        warnings,
      };
    }
    if (rows.length === 0) {
      return { ok: false, testName, questions: [], byModule: {}, errors: ['No questions found in the payload.'], warnings };
    }

    const questions = [];
    const counts = { rw1: 0, rw2: 0, math1: 0, math2: 0 };

    rows.forEach((raw, index) => {
      // 1-based, and reported per module below, so the number matches
      // what the person sees in their source file.
      const at = `Question ${index + 1}`;
      if (!raw || typeof raw !== 'object') {
        errors.push(`${at}: not an object.`);
        return;
      }

      const moduleKey = normalizeModule(pick(raw, 'module', 'module_key', 'moduleKey'));
      if (!moduleKey) {
        errors.push(`${at}: unknown module "${str(pick(raw, 'module', 'module_key', 'moduleKey'))}". Use rw1, rw2, math1 or math2.`);
        return;
      }
      const cfg = MODULES[moduleKey];
      const where = `${at} (${cfg.label})`;

      const stem = str(pick(raw, 'stem', 'question', 'text', 'prompt')).trim();
      if (!stem) {
        errors.push(`${where}: stem is empty.`);
        return;
      }
      const stemMath = mathDelimiterProblem(stem);
      if (stemMath) {
        errors.push(`${where}: ${stemMath} in the stem.`);
      }

      const rawDifficulty = pick(raw, 'difficulty', 'level');
      let difficulty = normalizeDifficulty(rawDifficulty);
      if (!difficulty) {
        if (rawDifficulty !== undefined) {
          warnings.push(`${where}: difficulty "${str(rawDifficulty)}" not recognised — defaulted to medium.`);
        }
        difficulty = 'medium';
      }

      // R&W has no grid-ins on the real test, and the builder hides the
      // control there, so force mcq rather than importing a dead field.
      const requestedType = str(pick(raw, 'answer_type', 'answerType', 'type')).trim().toLowerCase();
      let answerType = requestedType === 'spr' ? 'spr' : 'mcq';
      if (answerType === 'spr' && cfg.section === 'rw') {
        warnings.push(`${where}: grid-in answers are not available in R&W — imported as multiple choice.`);
        answerType = 'mcq';
      }

      let choices = ['', '', '', ''];
      let correct = null;
      let answerText = '';

      if (answerType === 'spr') {
        answerText = str(pick(raw, 'answer_text', 'answerText', 'answer')).trim();
        if (!answerText) {
          errors.push(`${where}: grid-in question has no accepted answers.`);
        } else {
          const tokens = answerText.split(',').map((t) => t.trim());
          const bad = tokens.filter((t) => !isValidSprToken(t));
          if (bad.length) {
            errors.push(`${where}: invalid grid-in answer(s) ${bad.map((b) => `"${b}"`).join(', ')}. Each must be a number or fraction of 5 characters or fewer.`);
          } else {
            answerText = tokens.join(',');
          }
        }
      } else {
        const parsed = normalizeChoices(pick(raw, 'choices', 'options', 'answers'));
        if (!parsed) {
          errors.push(`${where}: choices missing. Provide an array of 4, or an object keyed A-D.`);
          return;
        }
        choices = parsed.map(stripChoicePrefix);
        if (choices.length !== 4) {
          errors.push(`${where}: expected 4 choices, got ${choices.length}.`);
        }
        const blank = choices
          .map((c, i) => (c ? null : LETTERS[i]))
          .filter(Boolean);
        if (blank.length) {
          errors.push(`${where}: choice ${blank.join(', ')} is empty.`);
        }
        choices.forEach((choice, i) => {
          const choiceMath = mathDelimiterProblem(choice);
          if (choiceMath) {
            errors.push(`${where}: ${choiceMath} in choice ${LETTERS[i]}.`);
          }
        });

        correct = normalizeCorrect(pick(raw, 'correct', 'correct_answer', 'correctAnswer', 'answer', 'key'));
        if (correct === null) {
          errors.push(`${where}: no correct answer. Use 0-3 or A-D.`);
        } else if (correct < 0 || correct > 3) {
          errors.push(`${where}: correct answer ${correct} is out of range (0-3).`);
          correct = null;
        }
      }

      // When answers are solved by a model rather than read off an answer
      // key, the ones it was unsure about are the ones worth a human's
      // time. Surfaced as a warning so they are named in the report, then
      // dropped — the flag is a review aid, not question content.
      const confidence = str(pick(raw, 'confidence', 'certainty')).trim().toLowerCase();
      if (confidence === 'low') {
        warnings.push(`${where}: flagged low confidence — verify the answer before publishing.`);
      }

      const explanation = str(pick(raw, 'explanation', 'rationale')).trim();
      const explanationMath = explanation && mathDelimiterProblem(explanation);
      if (explanationMath) {
        errors.push(`${where}: ${explanationMath} in the explanation.`);
      }

      const image = str(pick(raw, 'image_url', 'imageUrl', 'image')).trim() || null;
      if (image && !/^https?:\/\//i.test(image) && !image.startsWith('data:')) {
        errors.push(`${where}: image_url "${image}" is not a URL. Upload the figure first, then use the returned public URL.`);
      }

      counts[moduleKey] += 1;
      questions.push({
        id: uuid(),
        module: moduleKey,
        difficulty,
        stem,
        image,
        choices,
        correct,
        answerType,
        answerText,
        explanation,
      });
    });

    // Cap check runs last so it reports the true overflow rather than
    // tripping on rows that were going to be rejected anyway.
    Object.keys(MODULES).forEach((key) => {
      const existing = Number(existingCounts[key]) || 0;
      const total = existing + counts[key];
      if (total > MODULES[key].cap) {
        errors.push(
          `${MODULES[key].label}: ${total} questions exceeds the ${MODULES[key].cap} cap` +
          (existing ? ` (${existing} already in the builder + ${counts[key]} imported).` : '.')
        );
      }
    });

    return {
      ok: errors.length === 0,
      testName,
      questions,
      byModule: counts,
      errors,
      warnings,
    };
  }

  return {
    MODULES,
    parseAndValidate,
    mathDelimiterProblem,
    // Exposed for tests and for reuse by the figure-upload tooling.
    _internals: {
      normalizeModule,
      normalizeCorrect,
      normalizeChoices,
      stripChoicePrefix,
      isValidSprToken,
      mathDelimiterProblem,
    },
  };
}));
