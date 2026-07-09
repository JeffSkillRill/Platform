(function () {
  const BREAK_AFTER_MODULE_KEY = 'rw2';
  const LETTERS = window.SAT_LETTERS || ['A', 'B', 'C', 'D'];
  const MODULE_CONFIG = window.SAT_MODULE_CONFIG || {};
  const MODULE_ORDER = window.SAT_MODULE_ORDER || ['rw1', 'rw2', 'math1', 'math2'];

  let context = null;
  let test = null;
  let testId = null;
  let attemptId = null;
  let progressKey = '';
  let allQuestions = [];
  let modules = [];
  let answers = {};
  let flagged = {};
  let currentMod = 0;
  let currentQIdx = 0;
  let timerInterval = null;
  let breakInterval = null;
  let breakSecs = 0;
  let moduleStartedAt = null;
  let moduleDeadlineAt = null;
  let elapsedWorkSecs = 0;
  let lastProgressSave = 0;
  let isSubmitting = false;
  let eliminated = {};
  let eliminatorOn = false;
  let timerHidden = localStorage.getItem('sat_timer_hidden') === 'true';
  let zoomLevel = Math.min(2, Math.max(0, Number(localStorage.getItem('sat_text_zoom') || 0)));
  let questionTimes = {};
  let questionEnteredAt = Date.now();
  let calculatorLoaded = false;
  let calculatorDrag = null;

  const params = new URLSearchParams(window.location.search);

  function activeModule() {
    return modules[currentMod] || { key: 'rw1', questions: [] };
  }

  function activeModuleConfig() {
    const mod = activeModule();
    return MODULE_CONFIG[mod.key] || {
      label: 'Module',
      sectionLabel: mod.key.startsWith('math') ? 'Math' : 'Reading & Writing',
      section: mod.key.startsWith('math') ? 'math' : 'rw',
      minutes: 32,
      badgeClass: mod.key.startsWith('math') ? 'math' : '',
    };
  }

  function isSpr(question) {
    return (question?.answer_type || 'mcq') === 'spr';
  }

  function isAnswered(question) {
    const value = answers[question.id];
    if (isSpr(question)) return typeof value === 'string' && value.trim() !== '';
    return value !== undefined && value !== null;
  }

  function modalOrPanelOpen() {
    return Boolean(
      document.querySelector('.overlay.open') ||
      document.getElementById('referenceModal')?.classList.contains('open') ||
      document.getElementById('calculatorPanel')?.classList.contains('open')
    );
  }

  function currentQuestion() {
    return activeModule().questions?.[currentQIdx] || null;
  }

  function recordQuestionTime() {
    const q = currentQuestion();
    if (!q || !questionEnteredAt) return;
    const elapsed = Math.floor((Date.now() - questionEnteredAt) / 1000);
    if (elapsed > 0) {
      questionTimes[q.id] = Math.min(300, Math.max(0, Number(questionTimes[q.id]) || 0) + Math.min(elapsed, 300));
    }
    questionEnteredAt = Date.now();
  }

  function getEliminations(questionId) {
    if (!eliminated[questionId] || typeof eliminated[questionId] !== 'object') {
      eliminated[questionId] = {};
    }
    return eliminated[questionId];
  }

  function isEliminated(questionId, index) {
    return Boolean(getEliminations(questionId)[index]);
  }

  function setMathToolsVisible() {
    const cfg = activeModuleConfig();
    const isMath = cfg.section === 'math';
    document.getElementById('testBar')?.classList.toggle('math-active', isMath);
    if (!isMath) {
      closeCalculator();
      closeReference();
    }
  }

  function applyZoom() {
    const area = document.getElementById('questionArea');
    if (area) {
      area.classList.remove('zoom-0', 'zoom-1', 'zoom-2');
      area.classList.add(`zoom-${zoomLevel}`);
    }
    const labels = ['Text', 'Text+', 'Text++'];
    window.satSetText('zoomBtn', labels[zoomLevel] || 'Text');
  }

  function moduleDurationSecs(moduleKey) {
    const cfg = MODULE_CONFIG[moduleKey] || {};
    const section = cfg.section || (moduleKey.startsWith('math') ? 'math' : 'rw');
    const presentInSection = modules.filter((mod) => {
      const item = MODULE_CONFIG[mod.key] || {};
      return (item.section || (mod.key.startsWith('math') ? 'math' : 'rw')) === section;
    }).length || 1;
    const sectionMinutes = section === 'math'
      ? Number(test?.math_minutes || 70)
      : Number(test?.rw_minutes || 64);
    return Math.round((sectionMinutes / presentInSection) * 60);
  }

  function readSavedProgress() {
    try {
      const saved = JSON.parse(localStorage.getItem(progressKey) || 'null');
      return saved && saved.testId === testId && saved.attemptId === attemptId ? saved : null;
    } catch (err) {
      return null;
    }
  }

  function saveProgress(force = false) {
    if (!context || !testId || !attemptId || !allQuestions.length) return;
    const now = Date.now();
    if (!force && now - lastProgressSave < 5000) return;
    lastProgressSave = now;
    localStorage.setItem(progressKey, JSON.stringify({
      testId,
      attemptId,
      answers,
      flagged,
      eliminated,
      questionTimes,
      currentMod,
      currentQIdx,
      moduleStartedAt,
      moduleDeadlineAt,
      elapsedWorkSecs,
      savedAt: now,
    }));
  }

  function clearSavedProgress() {
    localStorage.removeItem(progressKey);
  }

  function parseChoices(question) {
    return {
      ...question,
      choices: window.parseJson(question.choices, []),
    };
  }

  async function loadTest() {
    const testRows = await window.satRest(`tests?id=eq.${encodeURIComponent(testId)}&select=id,name,rw_minutes,math_minutes,break_minutes`);
    test = testRows[0];
    if (!test) throw new Error('Test not found.');
    window.satSetText('barTestName', test.name || 'SAT Practice Test');

    const questions = await window.satRest(`student_questions?test_id=eq.${encodeURIComponent(testId)}&select=*&order=order_num.asc`);
    allQuestions = questions.map(parseChoices);
    if (!allQuestions.length) {
      document.getElementById('questionArea').innerHTML =
        '<div style="text-align:center;padding:4rem;color:var(--text-faint);">This test has no questions yet.</div>';
      return;
    }

    buildModules();
    renderStepper();

    const saved = readSavedProgress();
    if (saved) {
      answers = saved.answers || {};
      flagged = saved.flagged || {};
      eliminated = saved.eliminated || {};
      questionTimes = saved.questionTimes || {};
      elapsedWorkSecs = Number(saved.elapsedWorkSecs) || 0;
      startModule(Math.min(Math.max(Number(saved.currentMod) || 0, 0), modules.length - 1), {
        questionIndex: Number(saved.currentQIdx) || 0,
        moduleStartedAt: Number(saved.moduleStartedAt) || null,
        moduleDeadlineAt: Number(saved.moduleDeadlineAt) || null,
        restoring: true,
      });
    } else {
      startModule(0);
    }
  }

  function buildModules() {
    modules = MODULE_ORDER.map((key) => ({
      key,
      questions: allQuestions.filter((q) => (q.module_key || inferModuleKey(q)) === key),
    })).filter((mod) => mod.questions.length > 0);
  }

  function inferModuleKey(question) {
    const sectionQuestions = allQuestions.filter((item) => item.section === question.section);
    const index = sectionQuestions.indexOf(question);
    if (question.section === 'math') {
      return index < Math.ceil(sectionQuestions.length / 2) ? 'math1' : 'math2';
    }
    return index < Math.ceil(sectionQuestions.length / 2) ? 'rw1' : 'rw2';
  }

  function renderStepper() {
    const stepper = document.getElementById('moduleStepper');
    stepper.innerHTML = modules.map((mod, index) => {
      const cfg = MODULE_CONFIG[mod.key] || activeModuleConfig();
      const status = index < currentMod ? 'done' : index === currentMod ? 'active' : '';
      const lineClass = index < currentMod ? 'done' : '';
      const hasBreak = mod.key === BREAK_AFTER_MODULE_KEY && modules.some((item) => item.key.startsWith('math'));
      const separator = index < modules.length - 1
        ? hasBreak
          ? `<div style="display:flex;align-items:center;gap:4px;"><div class="step-line ${lineClass}"></div><div style="font-size:0.6rem;font-weight:700;color:var(--amber);background:var(--amber-light);padding:2px 7px;border-radius:99px;white-space:nowrap;">${Number(test?.break_minutes || 10)} min break</div></div>`
          : `<div class="step-line ${lineClass}"></div>`
        : '';
      return `
        <div class="step ${status}">
          <div class="step-dot">${index < currentMod ? '✓' : index + 1}</div>
          <span>${window.escapeHtml(cfg.sectionLabel)} ${window.escapeHtml(cfg.label)}</span>
        </div>
        ${separator}`;
    }).join('');
  }

  function startModule(modIdx, options = {}) {
    clearInterval(timerInterval);
    currentMod = modIdx;
    currentQIdx = Number.isInteger(options.questionIndex) ? options.questionIndex : 0;

    const mod = activeModule();
    const cfg = activeModuleConfig();
    const duration = moduleDurationSecs(mod.key);
    const now = Date.now();
    moduleStartedAt = options.restoring && options.moduleStartedAt ? options.moduleStartedAt : now;
    moduleDeadlineAt = options.restoring && options.moduleDeadlineAt ? options.moduleDeadlineAt : now + duration * 1000;

    const modQs = mod.questions || [];
    currentQIdx = Math.min(Math.max(currentQIdx, 0), Math.max(modQs.length - 1, 0));

    const badge = document.getElementById('barModuleBadge');
    badge.textContent = `${cfg.sectionLabel} — ${cfg.label}`;
    badge.className = `bar-module-badge ${cfg.badgeClass || ''}`;

    setMathToolsVisible();
    applyZoom();
    renderStepper();
    startTimer();
    renderGrid();
    renderQuestion();
    questionEnteredAt = Date.now();
    saveProgress(true);
  }

  function finishCurrentModuleTime() {
    if (!moduleStartedAt) return;
    const duration = moduleDurationSecs(activeModule().key);
    const elapsed = Math.min(duration, Math.max(0, Math.floor((Date.now() - moduleStartedAt) / 1000)));
    elapsedWorkSecs += elapsed;
    moduleStartedAt = null;
    moduleDeadlineAt = null;
  }

  function remainingSecs() {
    return Math.max(0, Math.ceil((moduleDeadlineAt - Date.now()) / 1000));
  }

  function startTimer() {
    updateTimerDisplay();
    timerInterval = setInterval(() => {
      updateTimerDisplay();
      saveProgress(false);
      if (remainingSecs() <= 0) {
        clearInterval(timerInterval);
        showTimeUp();
      }
    }, 1000);
  }

  function updateTimerDisplay() {
    const total = remainingSecs();
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    const el = document.getElementById('timerNum');
    const btn = document.getElementById('timerToggleBtn');
    const forceVisible = total <= 300;
    el.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    el.className = 'timer-num';
    if (total <= 300) el.classList.add('warn');
    if (total <= 60) el.classList.add('danger');
    if (timerHidden && !forceVisible) el.classList.add('hidden');
    if (btn) {
      btn.textContent = timerHidden && !forceVisible ? 'Show' : 'Hide';
      btn.title = timerHidden && !forceVisible ? 'Show timer' : 'Hide timer';
      btn.setAttribute('aria-label', btn.title);
      btn.disabled = forceVisible;
    }
  }

  function toggleTimerVisibility() {
    const total = remainingSecs();
    if (total <= 300) {
      timerHidden = false;
    } else {
      timerHidden = !timerHidden;
    }
    localStorage.setItem('sat_timer_hidden', timerHidden ? 'true' : 'false');
    updateTimerDisplay();
  }

  function showTimeUp() {
    const cfg = activeModuleConfig();
    document.getElementById('timeupDesc').textContent =
      `Time for ${cfg.sectionLabel} ${cfg.label} has ended.`;
    document.getElementById('timeupScreen').classList.add('open');
  }

  function openEndModal() {
    recordQuestionTime();
    const modQs = activeModule().questions || [];
    const answered = modQs.filter(isAnswered).length;
    const unanswered = modQs.length - answered;
    const flaggedCount = modQs.filter((q) => flagged[q.id]).length;
    const cfg = activeModuleConfig();
    const isLast = currentMod === modules.length - 1;
    const nextIsBreak = shouldBreakAfterCurrentModule();

    document.getElementById('endModalTitle').textContent = isLast ? 'Submit the test?' : `End ${cfg.label}?`;
    document.getElementById('endModalStats').innerHTML = `
      <div class="mstat"><div class="mstat-val">${answered}</div><div class="mstat-lbl">Answered</div></div>
      <div class="mstat"><div class="mstat-val">${unanswered}</div><div class="mstat-lbl">Unanswered</div></div>
      <div class="mstat"><div class="mstat-val">${flaggedCount}</div><div class="mstat-lbl">Flagged</div></div>`;

    const warnEl = document.getElementById('endModalWarn');
    if (unanswered > 0) {
      warnEl.style.display = 'block';
      warnEl.textContent = `${unanswered} question${unanswered > 1 ? 's are' : ' is'} unanswered. You cannot return to this module.`;
    } else {
      warnEl.style.display = 'none';
    }

    document.getElementById('endModalDesc').textContent = isLast
      ? 'Once submitted, you cannot change your answers.'
      : nextIsBreak
        ? `After this module you will have a ${Number(test?.break_minutes || 10)}-minute break before Math begins.`
        : `You will move on to ${nextModuleLabel()}.`;

    document.getElementById('endModalConfirmBtn').textContent = isLast
      ? 'Submit test'
      : nextIsBreak
        ? 'Go to break'
        : 'Next module';

    document.getElementById('endModal').classList.add('open');
  }

  function closeEndModal() {
    document.getElementById('endModal').classList.remove('open');
  }

  function nextModuleLabel() {
    const next = modules[currentMod + 1];
    const cfg = MODULE_CONFIG[next?.key] || {};
    return `${cfg.sectionLabel || 'Next section'} ${cfg.label || ''}`.trim();
  }

  function shouldBreakAfterCurrentModule() {
    return activeModule().key === BREAK_AFTER_MODULE_KEY && modules.some((mod) => mod.key.startsWith('math'));
  }

  function confirmEndModule() {
    if (isSubmitting) return;
    recordQuestionTime();
    clearInterval(timerInterval);
    closeEndModal();
    document.getElementById('timeupScreen').classList.remove('open');

    if (currentMod === modules.length - 1) {
      submitTest();
      return;
    }

    finishCurrentModuleTime();
    saveProgress(true);

    if (shouldBreakAfterCurrentModule()) {
      startBreak();
    } else {
      startModule(currentMod + 1);
    }
  }

  function startBreak() {
    breakSecs = Number(test?.break_minutes || 10) * 60;
    document.getElementById('breakScreen').classList.add('open');
    document.getElementById('breakNextBtn').disabled = true;
    updateBreakDisplay();

    breakInterval = setInterval(() => {
      breakSecs = Math.max(0, breakSecs - 1);
      updateBreakDisplay();
      if (breakSecs <= 0) {
        clearInterval(breakInterval);
        document.getElementById('breakNextBtn').disabled = false;
      }
    }, 1000);
  }

  function updateBreakDisplay() {
    const minutes = Math.floor(breakSecs / 60);
    const seconds = breakSecs % 60;
    document.getElementById('breakTimerNum').textContent =
      `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    const circ = 351.86;
    const total = Math.max(1, Number(test?.break_minutes || 10) * 60);
    document.getElementById('breakRing').style.strokeDashoffset = circ * (1 - breakSecs / total);
  }

  function endBreak() {
    clearInterval(breakInterval);
    document.getElementById('breakScreen').classList.remove('open');
    startModule(currentMod + 1);
  }

  function renderGrid() {
    const modQs = activeModule().questions || [];
    const cfg = activeModuleConfig();
    document.getElementById('gridLabel').textContent = `${cfg.sectionLabel} — ${cfg.label}`;

    document.getElementById('qGrid').innerHTML = modQs.map((q, index) => {
      let cls = '';
      if (index === currentQIdx) cls = 'current';
      else if (flagged[q.id]) cls = 'flagged';
      else if (isAnswered(q)) cls = 'answered';
      return `<div class="q-dot ${cls}" onclick="goTo(${index})" title="Q${index + 1}">${index + 1}</div>`;
    }).join('');

    const totalAnswered = allQuestions.filter(isAnswered).length;
    document.getElementById('progressFill').style.width =
      allQuestions.length ? `${(totalAnswered / allQuestions.length) * 100}%` : '0%';
  }

  function sprPreviewHtml(value) {
    const cleaned = sanitizeSprValue(value || '');
    const chars = cleaned ? cleaned.split('') : [];
    const slots = Array.from({ length: 6 }, (_, index) => chars[index] || '');
    return `Entry preview: ${slots.map((char) => `<span class="spr-slot">${window.escapeHtml(char || ' ')}</span>`).join('')}`;
  }

  function sanitizeSprValue(value) {
    return String(value || '')
      .replace(/[^0-9./-]/g, '')
      .replace(/(?!^)-/g, '')
      .slice(0, 6);
  }

  function buildAnswerInput(q, chosen) {
    if (isSpr(q)) {
      const value = sanitizeSprValue(chosen || '');
      return `
        <div class="spr-card">
          <label class="spr-label" for="sprInput">Enter your answer</label>
          <input
            class="spr-input"
            id="sprInput"
            type="text"
            inputmode="decimal"
            maxlength="6"
            autocomplete="off"
            value="${window.escapeHtml(value)}"
            oninput="handleSprInput(this.value)"
            placeholder="e.g. 3/4"
          />
          <div class="spr-preview" id="sprPreview">${sprPreviewHtml(value)}</div>
        </div>`;
    }

    const choices = Array.isArray(q.choices) ? q.choices : [];
    const choicesHtml = choices.map((choice, index) => {
      const selected = Number(chosen) === index;
      const removed = isEliminated(q.id, index);
      return `
        <div class="choice ${selected ? 'selected' : ''} ${removed ? 'eliminated' : ''}" onclick="${eliminatorOn ? `toggleElimination(${index})` : `selectAnswer(${index})`}">
          <div class="choice-letter">${LETTERS[index]}</div>
          <div class="choice-text">${window.escapeHtml(choice)}</div>
          <button class="choice-strike" type="button" onclick="event.stopPropagation();toggleElimination(${index})" aria-label="Eliminate choice ${LETTERS[index]}">/</button>
        </div>`;
    }).join('');

    return `<div class="choices ${eliminatorOn ? 'eliminator-on' : ''}">${choicesHtml}</div>`;
  }

  function renderQuestion() {
    const modQs = activeModule().questions || [];
    const q = modQs[currentQIdx];
    if (!q) return;

    const chosen = answers[q.id];
    const isFlagged = flagged[q.id];
    const isLast = currentQIdx === modQs.length - 1;
    const isLastMod = currentMod === modules.length - 1;
    const imageUrl = window.safeImageUrl(q.image_url);
    const imageHtml = imageUrl ? `<img class="q-image" src="${window.escapeHtml(imageUrl)}" alt=""/>` : '';
    const answerHtml = buildAnswerInput(q, chosen);
    const eliminateHtml = isSpr(q)
      ? ''
      : `<button class="eliminate-btn ${eliminatorOn ? 'active' : ''}" type="button" onclick="toggleEliminator()" title="Toggle answer eliminator">ABC̶</button>`;

    const nextButton = isLast
      ? `<button class="btn-next-module" onclick="openEndModal()">${isLastMod ? 'Submit test' : 'End module'}</button>`
      : `<button class="btn-nav" onclick="goTo(${currentQIdx + 1})">
          Next
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
        </button>`;

    document.getElementById('questionArea').innerHTML = `
      <div class="q-header">
        <div class="q-counter">Question ${currentQIdx + 1} of ${modQs.length}</div>
        <div class="q-header-actions">
          ${eliminateHtml}
          <button class="q-flag-btn ${isFlagged ? 'active' : ''}" onclick="toggleFlag()">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 21V5a2 2 0 012-2h13.586a1 1 0 01.707 1.707L16 8l3.293 3.293A1 1 0 0119 13H5v8"/></svg>
            ${isFlagged ? 'Flagged' : 'Flag for review'}
          </button>
        </div>
      </div>
      ${imageHtml}
      <div class="q-stem">${window.escapeHtml(q.stem)}</div>
      ${answerHtml}
      <div class="q-nav">
        <button class="btn-nav" onclick="goTo(${currentQIdx - 1})" ${currentQIdx === 0 ? 'disabled' : ''}>
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
          Previous
        </button>
        ${nextButton}
      </div>`;

    renderGrid();
  }

  function selectAnswer(index) {
    const q = activeModule().questions[currentQIdx];
    if (!q || isSpr(q)) return;
    if (isEliminated(q.id, index)) {
      getEliminations(q.id)[index] = false;
    }
    answers[q.id] = index;
    renderQuestion();
    saveProgress(true);
  }

  function toggleEliminator() {
    const q = currentQuestion();
    if (!q || isSpr(q)) return;
    eliminatorOn = !eliminatorOn;
    renderQuestion();
  }

  function toggleElimination(index) {
    const q = currentQuestion();
    if (!q || isSpr(q)) return;
    const map = getEliminations(q.id);
    map[index] = !map[index];
    if (map[index] && answers[q.id] === index) {
      delete answers[q.id];
    }
    renderQuestion();
    saveProgress(true);
  }

  function handleSprInput(value) {
    const q = currentQuestion();
    if (!q || !isSpr(q)) return;
    const cleaned = sanitizeSprValue(value);
    answers[q.id] = cleaned;
    const input = document.getElementById('sprInput');
    const preview = document.getElementById('sprPreview');
    if (input && input.value !== cleaned) input.value = cleaned;
    if (preview) preview.innerHTML = sprPreviewHtml(cleaned);
    renderGrid();
    saveProgress(true);
  }

  function toggleFlag() {
    const q = activeModule().questions[currentQIdx];
    if (!q) return;
    flagged[q.id] = !flagged[q.id];
    renderQuestion();
    saveProgress(true);
  }

  function goTo(index) {
    const modQs = activeModule().questions || [];
    if (index < 0 || index >= modQs.length) return;
    recordQuestionTime();
    currentQIdx = index;
    document.getElementById('qGridPanel')?.classList.remove('mobile-open');
    renderQuestion();
    saveProgress(true);
  }

  async function submitTest() {
    if (isSubmitting) return;
    isSubmitting = true;
    recordQuestionTime();
    clearInterval(timerInterval);
    finishCurrentModuleTime();

    const finalAnswers = {};
    allQuestions.forEach((q) => {
      finalAnswers[q.id] = answers[q.id] !== undefined ? answers[q.id] : null;
    });

    try {
      const submission = await window.satRpc('submit_attempt', {
        p_attempt_id: attemptId,
        p_answers: finalAnswers,
        p_time_taken: elapsedWorkSecs,
        p_question_times: questionTimes,
      });
      clearSavedProgress();
      const submitted = Array.isArray(submission) ? submission[0] : submission;
      window.location.href = `student-test-results.html?attemptId=${encodeURIComponent(submitted.id || attemptId)}`;
    } catch (err) {
      console.error(err);
      isSubmitting = false;
      alert('Submission failed. Check your connection and try again.');
    }
  }

  function openCalculator() {
    if (activeModuleConfig().section !== 'math') return;
    const panel = document.getElementById('calculatorPanel');
    const body = document.getElementById('calculatorBody');
    if (!panel || !body) return;
    panel.classList.add('open');
    panel.classList.remove('collapsed');
    if (!calculatorLoaded) {
      body.innerHTML = '<iframe title="Desmos graphing calculator" src="https://www.desmos.com/calculator" loading="lazy"></iframe>';
      calculatorLoaded = true;
    }
  }

  function closeCalculator() {
    document.getElementById('calculatorPanel')?.classList.remove('open');
  }

  function toggleCalculatorCollapse() {
    document.getElementById('calculatorPanel')?.classList.toggle('collapsed');
  }

  function beginCalculatorDrag(event) {
    const panel = document.getElementById('calculatorPanel');
    if (!panel || !panel.classList.contains('open')) return;
    if (event.target.closest('button')) return;
    const rect = panel.getBoundingClientRect();
    calculatorDrag = {
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };
    document.addEventListener('mousemove', dragCalculator);
    document.addEventListener('mouseup', endCalculatorDrag);
  }

  function dragCalculator(event) {
    if (!calculatorDrag) return;
    const panel = document.getElementById('calculatorPanel');
    if (!panel) return;
    const width = panel.offsetWidth;
    const height = panel.offsetHeight;
    const left = Math.min(window.innerWidth - width - 8, Math.max(8, event.clientX - calculatorDrag.offsetX));
    const top = Math.min(window.innerHeight - height - 8, Math.max(58, event.clientY - calculatorDrag.offsetY));
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
  }

  function endCalculatorDrag() {
    calculatorDrag = null;
    document.removeEventListener('mousemove', dragCalculator);
    document.removeEventListener('mouseup', endCalculatorDrag);
  }

  function openReference() {
    if (activeModuleConfig().section !== 'math') return;
    document.getElementById('referenceModal')?.classList.add('open');
  }

  function closeReference() {
    document.getElementById('referenceModal')?.classList.remove('open');
  }

  function cycleZoom() {
    zoomLevel = (zoomLevel + 1) % 3;
    localStorage.setItem('sat_text_zoom', String(zoomLevel));
    applyZoom();
  }

  function toggleShortcuts() {
    document.getElementById('shortcutPopover')?.classList.toggle('open');
  }

  function toggleQuestionGrid() {
    document.getElementById('qGridPanel')?.classList.toggle('mobile-open');
  }

  function handleShortcut(event) {
    const tag = event.target?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || modalOrPanelOpen()) return;
    const key = event.key.toLowerCase();
    const q = currentQuestion();
    if (!q) return;

    if (key === 'arrowleft') {
      event.preventDefault();
      goTo(currentQIdx - 1);
      return;
    }
    if (key === 'arrowright') {
      event.preventDefault();
      if (currentQIdx < activeModule().questions.length - 1) goTo(currentQIdx + 1);
      return;
    }
    if (key === 'f') {
      event.preventDefault();
      toggleFlag();
      return;
    }
    if (!isSpr(q)) {
      const map = { '1': 0, '2': 1, '3': 2, '4': 3, a: 0, b: 1, c: 2, d: 3 };
      if (Object.prototype.hasOwnProperty.call(map, key)) {
        event.preventDefault();
        selectAnswer(map[key]);
      }
    }
  }

  function setupToolEvents() {
    document.getElementById('timerToggleBtn')?.addEventListener('click', toggleTimerVisibility);
    document.getElementById('calculatorBtn')?.addEventListener('click', openCalculator);
    document.getElementById('referenceBtn')?.addEventListener('click', openReference);
    document.getElementById('zoomBtn')?.addEventListener('click', cycleZoom);
    document.getElementById('gridToggleBtn')?.addEventListener('click', toggleQuestionGrid);
    document.getElementById('shortcutsBtn')?.addEventListener('click', toggleShortcuts);
    document.getElementById('calculatorCloseBtn')?.addEventListener('click', closeCalculator);
    document.getElementById('calculatorCollapseBtn')?.addEventListener('click', toggleCalculatorCollapse);
    document.getElementById('calculatorHandle')?.addEventListener('mousedown', beginCalculatorDrag);
    document.getElementById('referenceCloseBtn')?.addEventListener('click', closeReference);
    document.addEventListener('keydown', handleShortcut);
  }

  async function init() {
    context = await window.SAT_AUTH_READY;
    if (!context) return;
    testId = params.get('testId');
    attemptId = params.get('attemptId');
    if (!testId || !attemptId) {
      window.location.href = 'student-tests.html';
      return;
    }
    progressKey = `sat_test_progress_${context.profile.id}_${testId}_${attemptId}`;

    setupToolEvents();
    applyZoom();
    updateTimerDisplay();
    window.addEventListener('beforeunload', () => saveProgress(true));

    try {
      await loadTest();
    } catch (err) {
      console.error(err);
      document.getElementById('questionArea').innerHTML =
        '<div style="text-align:center;padding:4rem;color:var(--red);">Failed to load. Check Supabase policies and assignments.</div>';
    }
  }

  window.openEndModal = openEndModal;
  window.closeEndModal = closeEndModal;
  window.confirmEndModule = confirmEndModule;
  window.endBreak = endBreak;
  window.selectAnswer = selectAnswer;
  window.toggleEliminator = toggleEliminator;
  window.toggleElimination = toggleElimination;
  window.handleSprInput = handleSprInput;
  window.toggleFlag = toggleFlag;
  window.goTo = goTo;
  window.closeReference = closeReference;

  init();
}());
