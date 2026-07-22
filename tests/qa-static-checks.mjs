import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

const [adminLoginHtml, studentLoginHtml, adminLoginJs, studentLoginJs] = await Promise.all([
  read('admin-login.html'),
  read('student-login.html'),
  read('js/admin-login.js'),
  read('js/student-login.js'),
]);

for (const [name, html, script] of [
  ['admin', adminLoginHtml, adminLoginJs],
  ['student', studentLoginHtml, studentLoginJs],
]) {
  assert.match(html, /id="username"[^>]*required[^>]*aria-describedby="usernameError"/,
    `${name} username must expose required/error semantics`);
  assert.match(html, /id="password"[^>]*required[^>]*aria-describedby="passwordError"/,
    `${name} password must expose required/error semantics`);
  assert.match(html, /id="globalError"[^>]*role="alert"/,
    `${name} global authentication error must be announced`);
  assert.match(script, /setAttribute\('aria-invalid', 'true'\)/,
    `${name} invalid inputs must expose aria-invalid`);
  assert.match(script, /\.focus\(\);/,
    `${name} invalid submission must focus the first invalid field`);
}

const mobileNav = await read('js/mobile-nav.js');
assert.match(mobileNav, /ensureLogoutButton\(\)/, 'protected pages must receive a shared logout control');
assert.match(mobileNav, /window\.handleAdminLogout : window\.handleLogout/,
  'shared logout control must use the role-specific handler');

const solver = await read('js/student-test-solve.js');
assert.match(solver, /async function validateAttempt\(\)/,
  'solver must validate attempt ownership/status before loading questions');
assert.match(solver, /attempt\.test_id !== testId/,
  'solver must reject mismatched attempt and test ids');
assert.match(solver, /maxlength="5"/, 'graded SPR input must be capped at five characters');
assert.match(solver, /alt="Question illustration for this prompt"/,
  'graded questions must not render meaningful images with empty alt text');

const questionBank = await read('js/student-question-bank.js');
const questionBankCss = await read('css/student-question-bank.css');
assert.match(questionBank, /test_attempts\?status=eq\.submitted&select=test_id/,
  'Question Bank must include only tests already submitted by the student');
assert.match(questionBank, /finish_practice_session/,
  'exiting Question Bank must close the active session');
assert.match(questionBank, /Question illustration for this prompt/,
  'Question Bank must render question images with an accessible name');
assert.match(questionBank, /Answer: \$\{window\.escapeHtml/,
  'Question Bank feedback must identify the correct answer');
assert.match(questionBankCss, /\.btn:disabled\s*\{/,
  'Question Bank must visibly distinguish disabled actions');

const createStudent = await read('supabase/functions/create-student/index.ts');
assert.match(createStudent, /body\.assign_existing_tests === true/,
  'student creation must opt in to assigning existing tests');

const builderHtml = await read('admin-test-builder.html');
const builderJs = await read('js/admin-test-builder.js');
assert.ok(!builderHtml.includes('id="qTopic"'), 'builder must not render the removed Topic field');
assert.ok(!builderJs.includes("getElementById('qTopic')"), 'builder must not load or collect Topic');
assert.ok(!/\btopic\s*:/.test(builderJs), 'builder must omit Topic from question persistence payloads');
assert.ok(builderHtml.includes('id="qExplanation"'), 'builder must render qExplanation');
assert.ok(builderJs.includes("getElementById('qExplanation')"), 'builder must load and collect qExplanation');
assert.ok(builderHtml.includes('id="qAnswerTypeField"'), 'builder must wrap the Answer type field for module visibility');
assert.match(builderJs, /MODULE_CONFIG\[key\]\?\.section === 'rw'/,
  'builder must derive R&W behavior from MODULE_CONFIG');
assert.match(builderJs, /answer_type:answerType[\s\S]*answer_text:answerType === 'spr'/,
  'builder serialization must use its module-coerced answer type');
assert.ok(builderHtml.includes('id="mathToolbar"'), 'builder must expose the math snippet toolbar');
assert.ok(builderHtml.includes('id="stemMathPreview"'), 'builder must expose the live stem math preview');

const mathRender = await read('js/math-render.js');
assert.match(mathRender, /throwOnError: false/, 'shared math rendering must not throw on malformed LaTeX');
assert.match(mathRender, /trust: false/, 'shared math rendering must keep KaTeX trust disabled');
for (const renderer of [
  'js/admin-question-bank.js',
  'js/student-test-solve.js',
  'js/student-practice.js',
  'js/student-question-bank.js',
  'js/student-test-results.js',
]) {
  assert.match(await read(renderer), /renderMathIn/, `${renderer} must render injected math content`);
}

const migration = await read('migrations/008-security-and-practice-hardening.sql');
for (const requiredFragment of [
  'student_has_test_access',
  'test_attempt_access_guard',
  'questions_spr_answer_text_valid',
  "a.status = 'submitted'",
  'finish_practice_session',
]) {
  assert.ok(migration.includes(requiredFragment), `migration 008 is missing ${requiredFragment}`);
}

const htmlFiles = (await readdir(root)).filter((name) => name.endsWith('.html'));
for (const htmlFile of htmlFiles) {
  const html = await read(htmlFile);
  if (/data-auth-role=/.test(html)) {
    assert.match(html, /js\/auth-guard\.js/, `${htmlFile} must load the role guard`);
    if (/class="[^"]*(?:sidebar|nav-sidebar)/.test(html)) {
      assert.match(html, /js\/mobile-nav\.js/, `${htmlFile} must load shared portal navigation`);
    }
  }
  for (const match of html.matchAll(/(?:href|src)="([^"#]+)"/g)) {
    const reference = match[1].split('?')[0];
    if (!reference || /^(?:https?:|data:|mailto:|tel:)/.test(reference)) continue;
    await assert.doesNotReject(access(new URL(reference, root)),
      `${htmlFile} references missing local file ${reference}`);
  }
}

console.log('QA static regression checks passed.');
