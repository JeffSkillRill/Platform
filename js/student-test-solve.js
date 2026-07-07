    // ============================================================
    // PASTE YOUR SUPABASE CREDENTIALS HERE
    // ============================================================
    const SUPABASE_URL     = 'https://lsbpskmzffmaztczlokh.supabase.co';       // e.g. https://xyzxyz.supabase.co
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxzYnBza216ZmZtYXp0Y3psb2toIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2OTc5NzMsImV4cCI6MjA5ODI3Mzk3M30.zRtly7a6XPKoU6BaZ2eftQxxOTFSUkw1wQ8A6-H1-tI'; // starts with eyJ...

    const db = {
      async getWhere(table, col, op, val, extra='') {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${col}=${op}.${encodeURIComponent(val)}${extra}&select=*`, {
          headers:{ 'apikey':SUPABASE_ANON_KEY,'Authorization':`Bearer ${SUPABASE_ANON_KEY}` }
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      },
      async insert(table, data) {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
          method:'POST',
          headers:{ 'apikey':SUPABASE_ANON_KEY,'Authorization':`Bearer ${SUPABASE_ANON_KEY}`,'Content-Type':'application/json','Prefer':'return=representation' },
          body:JSON.stringify(data)
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      }
    };

    // ================================================================
    // REAL SAT MODULE STRUCTURE
    // Module 1: R&W — 27 questions — 32 minutes
    // Module 2: R&W — 27 questions — 32 minutes
    // [10 minute break]
    // Module 3: Math — 22 questions — 35 minutes
    // Module 4: Math — 22 questions — 35 minutes
    // ================================================================
    const BREAK_AFTER_MODULE = 1;   // break happens after module index 1 (0-based = after RW mod 2)
    const BREAK_DURATION     = 600; // 10 minutes in seconds
    const LETTERS = ['A','B','C','D'];

    // State
    const session  = JSON.parse(localStorage.getItem('sat_user') || '{}');
    const params   = new URLSearchParams(window.location.search);
    const testId   = params.get('testId');
    const testName = params.get('testName') || 'SAT Practice Test';
    if (!session.id || !testId) window.location.href = 'student-tests.html';

    let allQuestions  = [];   // all questions from DB
    let modules       = [];   // [ [q,q,...], [q,q,...], [q,q,...], [q,q,...] ]
    let answers       = {};   // { questionId: chosenIndex }
    let flagged       = {};   // { questionId: true }
    let currentMod    = 0;    // 0-based module index
    let currentQIdx   = 0;    // question index within current module
    let timerSecs     = 0;
    let timerInterval = null;
    let breakInterval = null;
    let breakSecs     = BREAK_DURATION;
    let startTime     = Date.now();
    let modStartTimes = {};   // { modIndex: timestamp }
    const progressKey = `sat_test_progress_${session.id || 'guest'}_${testId || 'unknown'}`;

    function readSavedProgress() {
      try {
        const saved = JSON.parse(localStorage.getItem(progressKey) || 'null');
        return saved && saved.testId === testId ? saved : null;
      } catch (err) {
        return null;
      }
    }

    function saveProgress() {
      if (!session.id || !testId || !allQuestions.length) return;
      localStorage.setItem(progressKey, JSON.stringify({
        testId,
        testName,
        answers,
        flagged,
        currentMod,
        currentQIdx,
        timerSecs,
        startTime,
        savedAt: Date.now()
      }));
    }

    function clearSavedProgress() {
      localStorage.removeItem(progressKey);
    }

    window.addEventListener('beforeunload', saveProgress);

    // ---- Load test from Supabase ----
    async function loadTest() {
      document.getElementById('barTestName').textContent = testName;
      try {
        const qs = await loadQuestionsForSolving();
        if (!qs.length) {
          document.getElementById('questionArea').innerHTML =
            `<div style="text-align:center;padding:4rem;color:var(--text-faint);">This test has no questions yet.</div>`;
          return;
        }
        allQuestions = qs.map(q => {
          const safeQuestion = {
            ...q,
            choices: typeof q.choices === 'string' ? JSON.parse(q.choices) : q.choices
          };
          delete safeQuestion.correct;
          delete safeQuestion.explanation;
          return safeQuestion;
        });

        buildModules();
        renderStepper();
        const saved = readSavedProgress();
        if (saved) {
          answers = saved.answers || {};
          flagged = saved.flagged || {};
          startTime = saved.startTime || Date.now();
          const savedMod = Math.min(Math.max(Number(saved.currentMod) || 0, 0), modules.length - 1);
          startModule(savedMod, {
            questionIndex: Number(saved.currentQIdx) || 0,
            timerSecs: Number(saved.timerSecs) || undefined,
            restoring: true
          });
        } else {
          startModule(0);
        }

      } catch(err) {
        document.getElementById('questionArea').innerHTML =
          `<div style="text-align:center;padding:4rem;color:var(--red);">Failed to load. Check Supabase credentials.</div>`;
        console.error(err);
      }
    }

    async function loadQuestionsForSolving() {
      try {
        // Secure v2 exposes this view without correct answers.
        return await db.getWhere('student_questions','test_id','eq',testId,'&order=order_num.asc');
      } catch (err) {
        // Legacy fallback for the current prototype schema.
        return db.getWhere('questions','test_id','eq',testId,'&order=order_num.asc');
      }
    }

    // ---- Split questions into 4 modules using module_key from DB ----
    function buildModules() {
      // Questions now have module_key: 'rw1' | 'rw2' | 'math1' | 'math2'
      // Group by module_key, then order: rw1 → rw2 → math1 → math2
      const grouped = { rw1:[], rw2:[], math1:[], math2:[] };
      allQuestions.forEach(q => {
        const key = q.module_key || inferModuleKey(q);
        if (grouped[key]) grouped[key].push(q);
      });

      modules = [grouped.rw1, grouped.rw2, grouped.math1, grouped.math2]
        .filter(m => m.length > 0);
    }

    // Fallback for older tests that don't have module_key:
    // split by section into equal halves
    function inferModuleKey(q) {
      const rwQs   = allQuestions.filter(x => x.section === 'rw');
      const mathQs = allQuestions.filter(x => x.section === 'math');
      if (q.section === 'rw') {
        return rwQs.indexOf(q) < Math.ceil(rwQs.length / 2) ? 'rw1' : 'rw2';
      } else {
        return mathQs.indexOf(q) < Math.ceil(mathQs.length / 2) ? 'math1' : 'math2';
      }
    }

    // ---- Exact module definitions matching real Digital SAT ----
    // modules[] index → exact SAT module properties
    const SAT_MODULE_DEFS = [
      { label:'Module 1', sectionLabel:'Reading & Writing', section:'rw',   minutes:32, questions:27, badgeClass:'' },
      { label:'Module 2', sectionLabel:'Reading & Writing', section:'rw',   minutes:32, questions:27, badgeClass:'' },
      { label:'Module 3', sectionLabel:'Math',              section:'math',  minutes:35, questions:22, badgeClass:'math' },
      { label:'Module 4', sectionLabel:'Math',              section:'math',  minutes:35, questions:22, badgeClass:'math' },
    ];

    function getModDef(modIdx) {
      // Map local module index to SAT_MODULE_DEFS
      // If test has fewer modules (e.g. math-only), offset accordingly
      const hasRW   = allQuestions.some(q => q.section === 'rw');
      const hasMath = allQuestions.some(q => q.section === 'math');

      if (hasRW && hasMath) {
        // Full test: mod 0=RW1, 1=RW2, 2=Math1, 3=Math2
        return SAT_MODULE_DEFS[modIdx] || SAT_MODULE_DEFS[0];
      } else if (!hasRW && hasMath) {
        // Math-only test: mod 0=Math1, 1=Math2
        return SAT_MODULE_DEFS[2 + modIdx] || SAT_MODULE_DEFS[2];
      } else {
        // RW-only test: mod 0=RW1, 1=RW2
        return SAT_MODULE_DEFS[modIdx] || SAT_MODULE_DEFS[0];
      }
    }

    // ---- Render stepper ----
    function renderStepper() {
      const stepper = document.getElementById('moduleStepper');
      stepper.innerHTML = modules.map((m, i) => {
        const def    = getModDef(i);
        const status = i < currentMod ? 'done' : i === currentMod ? 'active' : '';
        const lineClass = i < currentMod ? 'done' : '';
        const sep = i < modules.length - 1
          ? `<div class="step-line ${lineClass}"></div>`
          : '';

        // Insert break indicator after module 1 (between RW and Math)
        const breakBadge = (i === 1 && modules.length > 2)
          ? `<div style="display:flex;align-items:center;gap:4px;"><div class="step-line ${lineClass}"></div><div style="font-size:0.6rem;font-weight:700;color:var(--amber);background:var(--amber-light);padding:2px 7px;border-radius:99px;white-space:nowrap;">10 min break</div></div>`
          : sep;

        return `
          <div class="step ${status}">
            <div class="step-dot">${i < currentMod ? '✓' : i+1}</div>
            <span>${def.sectionLabel} ${def.label}</span>
          </div>
          ${i < modules.length-1 ? breakBadge : ''}`;
      }).join('');
    }

    // ---- Start a module ----
    function startModule(modIdx, options = {}) {
      clearInterval(timerInterval);
      currentMod  = modIdx;
      currentQIdx = Number.isInteger(options.questionIndex) ? options.questionIndex : 0;
      if (!options.restoring) modStartTimes[modIdx] = Date.now();

      const def = getModDef(modIdx);
      timerSecs = options.timerSecs !== undefined
        ? Math.max(1, Number(options.timerSecs))
        : def.minutes * 60;

      const modQs = modules[modIdx] || [];
      currentQIdx = Math.min(Math.max(currentQIdx, 0), Math.max(modQs.length - 1, 0));

      // Update top bar
      const badge = document.getElementById('barModuleBadge');
      badge.textContent  = `${def.sectionLabel} — ${def.label}`;
      badge.className    = `bar-module-badge ${def.badgeClass}`;

      renderStepper();
      startTimer();
      renderGrid();
      renderQuestion();
      saveProgress();
    }

    // ---- Timer ----
    function startTimer() {
      updateTimerDisplay();
      timerInterval = setInterval(() => {
        timerSecs--;
        updateTimerDisplay();
        saveProgress();
        if (timerSecs <= 0) {
          clearInterval(timerInterval);
          showTimeUp();
        }
      }, 1000);
    }

    function updateTimerDisplay() {
      const m   = Math.floor(Math.abs(timerSecs) / 60);
      const s   = Math.abs(timerSecs) % 60;
      const el  = document.getElementById('timerNum');
      el.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
      el.className   = 'timer-num';
      if (timerSecs <= 300) el.classList.add('warn');
      if (timerSecs <= 60)  el.classList.add('danger');
    }

    function showTimeUp() {
      const def = getModDef(currentMod);
      document.getElementById('timeupDesc').textContent =
        `Time for ${def.sectionLabel} ${def.label} has ended.`;
      document.getElementById('timeupScreen').classList.add('open');
    }

    // ---- End module modal ----
    function openEndModal() {
      const modQs     = modules[currentMod] || [];
      const answered  = modQs.filter(q => answers[q.id] !== undefined).length;
      const unanswered = modQs.length - answered;
      const nFlagged  = modQs.filter(q => flagged[q.id]).length;
      const def       = getModDef(currentMod);
      const isLast    = currentMod === modules.length - 1;
      const nextIsBreak = (currentMod === 1 && modules.length > 2);

      document.getElementById('endModalTitle').textContent =
        isLast ? 'Submit the test?' : `End ${def.label}?`;

      document.getElementById('endModalStats').innerHTML = `
        <div class="mstat"><div class="mstat-val">${answered}</div><div class="mstat-lbl">Answered</div></div>
        <div class="mstat"><div class="mstat-val">${unanswered}</div><div class="mstat-lbl">Unanswered</div></div>
        <div class="mstat"><div class="mstat-val">${nFlagged}</div><div class="mstat-lbl">Flagged</div></div>`;

      const warnEl = document.getElementById('endModalWarn');
      if (unanswered > 0) {
        warnEl.style.display = 'block';
        warnEl.textContent = `⚠ ${unanswered} question${unanswered>1?'s are':' is'} unanswered. You cannot return to this module.`;
      } else {
        warnEl.style.display = 'none';
      }

      document.getElementById('endModalDesc').textContent = isLast
        ? 'Once submitted, you cannot change your answers.'
        : nextIsBreak
          ? 'After this module you will have a 10-minute break before Math begins.'
          : `You will move on to ${getModDef(currentMod+1).sectionLabel} ${getModDef(currentMod+1).label}.`;

      document.getElementById('endModalConfirmBtn').textContent = isLast
        ? 'Submit test'
        : nextIsBreak
          ? 'Go to break →'
          : 'Next module →';

      document.getElementById('endModal').classList.add('open');
    }

    function closeEndModal() {
      document.getElementById('endModal').classList.remove('open');
    }

    function confirmEndModule(fromTimeUp = false) {
      clearInterval(timerInterval);
      closeEndModal();
      document.getElementById('timeupScreen').classList.remove('open');

      const isLast      = currentMod === modules.length - 1;
      const nextIsBreak = (currentMod === 1 && modules.length > 2);

      if (isLast) {
        submitTest();
      } else if (nextIsBreak) {
        startBreak();
      } else {
        startModule(currentMod + 1);
      }
    }

    // ---- Break ----
    function startBreak() {
      breakSecs = BREAK_DURATION;
      document.getElementById('breakScreen').classList.add('open');
      document.getElementById('breakNextBtn').disabled = true;
      updateBreakDisplay();

      breakInterval = setInterval(() => {
        breakSecs--;
        updateBreakDisplay();
        if (breakSecs <= 0) {
          clearInterval(breakInterval);
          document.getElementById('breakNextBtn').disabled = false;
        }
      }, 1000);
    }

    function updateBreakDisplay() {
      const m   = Math.floor(breakSecs / 60);
      const s   = breakSecs % 60;
      document.getElementById('breakTimerNum').textContent =
        `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;

      // Update ring: full circle when full, shrinks as time passes
      const circ = 351.86;
      const pct  = breakSecs / BREAK_DURATION;
      document.getElementById('breakRing').style.strokeDashoffset =
        circ * (1 - pct);

      if (breakSecs <= 60)
        document.getElementById('breakNextBtn').disabled = false;
    }

    function endBreak() {
      clearInterval(breakInterval);
      document.getElementById('breakScreen').classList.remove('open');
      startModule(currentMod + 1);
    }

    // ---- Render question grid ----
    function renderGrid() {
      const modQs = modules[currentMod] || [];
      const def   = getModDef(currentMod);
      document.getElementById('gridLabel').textContent =
        `${def.sectionLabel} — ${def.label}`;

      document.getElementById('qGrid').innerHTML = modQs.map((q, i) => {
        let cls = '';
        if (i === currentQIdx)  cls = 'current';
        else if (flagged[q.id]) cls = 'flagged';
        else if (answers[q.id] !== undefined) cls = 'answered';
        return `<div class="q-dot ${cls}" onclick="goTo(${i})" title="Q${i+1}">${i+1}</div>`;
      }).join('');

      // Update progress
      const totalAnswered = Object.keys(answers).length;
      const totalQs       = allQuestions.length;
      document.getElementById('progressFill').style.width =
        totalQs ? (totalAnswered/totalQs*100)+'%' : '0%';
    }

    // ---- Render current question ----
    function renderQuestion() {
      const modQs = modules[currentMod] || [];
      const q     = modQs[currentQIdx];
      if (!q) return;

      const chosen    = answers[q.id];
      const isFlagged = flagged[q.id];
      const isLast    = currentQIdx === modQs.length - 1;
      const isLastMod = currentMod === modules.length - 1;

      // Global question number across all modules
      let globalNum = currentQIdx + 1;
      for (let m = 0; m < currentMod; m++) globalNum += (modules[m]||[]).length;

      const imgHtml = q.image_url
        ? `<img class="q-image" src="${q.image_url}" alt=""/>`
        : '';

      const choicesHtml = q.choices.map((c, i) => `
        <div class="choice ${chosen===i?'selected':''}" onclick="selectAnswer(${i})">
          <div class="choice-letter">${LETTERS[i]}</div>
          <div class="choice-text">${c}</div>
        </div>`).join('');

      const nextBtn = isLast
        ? `<button class="btn-next-module" onclick="openEndModal()">
            ${isLastMod ? 'Submit test' : 'End module →'}
           </button>`
        : `<button class="btn-nav" onclick="goTo(${currentQIdx+1})">
            Next
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
           </button>`;

      document.getElementById('questionArea').innerHTML = `
        <div class="q-header">
          <div class="q-counter">Question ${currentQIdx+1} of ${modQs.length}</div>
          <button class="q-flag-btn ${isFlagged?'active':''}" onclick="toggleFlag()">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 21V5a2 2 0 012-2h13.586a1 1 0 01.707 1.707L16 8l3.293 3.293A1 1 0 0119 13H5v8"/></svg>
            ${isFlagged ? 'Flagged' : 'Flag for review'}
          </button>
        </div>
        ${imgHtml}
        <div class="q-stem">${q.stem}</div>
        <div class="choices">${choicesHtml}</div>
        <div class="q-nav">
          <button class="btn-nav" onclick="goTo(${currentQIdx-1})" ${currentQIdx===0?'disabled':''}>
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
            Previous
          </button>
          ${nextBtn}
        </div>`;

      renderGrid();
    }

    function selectAnswer(idx) {
      const q = (modules[currentMod]||[])[currentQIdx];
      if (!q) return;
      answers[q.id] = idx;
      renderQuestion();
      saveProgress();
    }

    function toggleFlag() {
      const q = (modules[currentMod]||[])[currentQIdx];
      if (!q) return;
      flagged[q.id] = !flagged[q.id];
      renderQuestion();
      saveProgress();
    }

    function goTo(idx) {
      const modQs = modules[currentMod] || [];
      if (idx < 0 || idx >= modQs.length) return;
      currentQIdx = idx;
      renderQuestion();
      saveProgress();
    }

    // ---- Submit test ----
    async function submitTest() {
      clearInterval(timerInterval);
      const timeTaken = Math.floor((Date.now() - startTime) / 1000);

      const finalAnswers = {};
      allQuestions.forEach(q => {
        finalAnswers[q.id] = answers[q.id] !== undefined ? answers[q.id] : null;
      });

      try {
        const [submission] = await db.insert('submissions', {
          student_id: session.id,
          test_id:    testId,
          answers:    finalAnswers,
          time_taken: timeTaken
        });

        clearSavedProgress();
        localStorage.setItem('sat_last_result', JSON.stringify({
          submissionId: submission?.id || null,
          testId, testName, questions: allQuestions,
          answers: finalAnswers, timeTaken
        }));

        window.location.href = 'student-test-results.html';

      } catch(err) {
        alert('Submission failed. Check your connection and try again.');
        console.error(err);
      }
    }

    loadTest();
