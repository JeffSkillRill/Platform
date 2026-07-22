(function () {
  const LETTERS = window.SAT_LETTERS || ['A', 'B', 'C', 'D'];
  let context = null;
  let questions = [];
  let stats = null;
  let selectedDifficulties = new Set(['easy', 'medium', 'hard']);
  let selectedTopics = new Set();
  let session = null;
  let sessionQuestions = [];
  let currentIndex = 0;
  let selected = null;
  let selectedText = '';
  let feedback = null;
  let questionStartedAt = Date.now();

  function groupedTopics(section) {
    const map = new Map();
    questions.filter((q) => q.section === section).forEach((q) => {
      const topic = q.topic || 'General';
      map.set(topic, (map.get(topic) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }

  function filteredQuestions(topic = null) {
    return questions.filter((q) =>
      selectedDifficulties.has(q.difficulty || 'medium') &&
      (!topic || (q.topic || 'General') === topic) &&
      (!selectedTopics.size || selectedTopics.has(q.topic || 'General'))
    );
  }

  function renderSetup() {
    const app = document.getElementById('bankApp');
    const available = questions.length;
    const answered = stats?.answered || 0;
    const correct = stats?.correct || 0;
    app.innerHTML = `
      <div class="stats-row">
        <div class="stat-box"><div class="stat-box-label">Progress</div><div class="stat-box-value">${available ? Math.round((answered / available) * 100) : 0}%</div><div>${answered} of ${available} answered</div></div>
        <div class="stat-box"><div class="stat-box-label">Accuracy</div><div class="stat-box-value">${answered ? Math.round((correct / answered) * 100) : 0}%</div><div>${correct} correct answers</div></div>
      </div>
      <div class="bank-layout">
        <section class="card">
          <h2>General Filters</h2>
          <div class="filter-group">
            ${['easy', 'medium', 'hard'].map((diff) => `<button class="filter-chip ${selectedDifficulties.has(diff) ? 'active' : ''}" data-diff="${diff}">${diff}</button>`).join('')}
          </div>
        </section>
        <section class="card">
          <h2>Browse by Subject</h2>
          ${['math', 'rw'].map((section) => `
            <details open>
              <summary>${section === 'math' ? 'Math' : 'Reading & Writing'} (${questions.filter((q) => q.section === section).length})</summary>
              ${groupedTopics(section).map(([topic, count]) => `
                <div class="topic-row">
                  <label><input type="checkbox" data-topic="${window.escapeHtml(topic)}" ${selectedTopics.has(topic) ? 'checked' : ''}> ${window.escapeHtml(topic)} <span class="tag blue">${count}</span></label>
                  <button class="btn btn-secondary" data-play-topic="${window.escapeHtml(topic)}">Play</button>
                </div>`).join('')}
            </details>`).join('')}
        </section>
      </div>
      <div class="sticky-start"><button class="btn btn-primary" id="startSessionBtn" ${filteredQuestions().length ? '' : 'disabled'}>Start Session</button></div>`;
    app.querySelectorAll('[data-diff]').forEach((button) => {
      button.addEventListener('click', () => {
        const diff = button.dataset.diff;
        if (selectedDifficulties.has(diff)) selectedDifficulties.delete(diff);
        else selectedDifficulties.add(diff);
        if (!selectedDifficulties.size) selectedDifficulties.add(diff);
        renderSetup();
      });
    });
    app.querySelectorAll('[data-topic]').forEach((input) => {
      input.addEventListener('change', () => {
        if (input.checked) selectedTopics.add(input.dataset.topic);
        else selectedTopics.delete(input.dataset.topic);
      });
    });
    app.querySelectorAll('[data-play-topic]').forEach((button) => {
      button.addEventListener('click', () => startSession(button.dataset.playTopic, button));
    });
    document.getElementById('startSessionBtn').addEventListener('click', (event) => startSession(null, event.currentTarget));
  }

  async function startSession(topic = null, button = null) {
    const pool = filteredQuestions(topic).sort(() => Math.random() - 0.5).slice(0, 10);
    if (!pool.length) return alert('No questions match these filters.');
    window.satSetButtonLoading(button, true, 'Starting session');
    try {
      const inserted = await window.satInsert('practice_sessions', {
        student_id: context.profile.id,
        filters: { difficulties: Array.from(selectedDifficulties), topics: Array.from(selectedTopics), topic },
        question_ids: pool.map((q) => q.id),
      });
      session = inserted[0];
      sessionQuestions = pool;
      currentIndex = 0;
      selected = null;
      selectedText = '';
      feedback = null;
      questionStartedAt = Date.now();
      renderQuestion();
    } finally {
      window.satSetButtonLoading(button, false);
    }
  }

  function currentQuestion() {
    return sessionQuestions[currentIndex];
  }

  function renderQuestion() {
    const q = currentQuestion();
    const choices = window.parseJson(q.choices, []);
    const isSpr = (q.answer_type || 'mcq') === 'spr';
    const imageUrl = window.safeImageUrl(q.image_url);
    const correctText = feedback
      ? isSpr
        ? feedback.answer_text
        : feedback.correct !== null && feedback.correct !== undefined
          ? `Choice ${LETTERS[feedback.correct]}`
          : '—'
      : '';
    const bankApp = document.getElementById('bankApp');
    bankApp.innerHTML = `
      <section class="card session-card">
        <div class="tag blue">Question ${currentIndex + 1} of ${sessionQuestions.length}</div>
        ${imageUrl ? `<img class="q-image" src="${window.escapeHtml(imageUrl)}" alt="Question illustration for this prompt">` : ''}
        <div class="q-stem" style="margin:1rem 0;line-height:1.7;">${window.escapeHtml(q.stem)}</div>
        ${isSpr ? `<input id="bankSprInput" maxlength="5" inputmode="decimal" placeholder="Enter answer">` : choices.map((choice, index) => `
          <button class="choice ${selected === index ? 'selected' : ''}" data-choice="${index}"><strong>${LETTERS[index]}</strong><span>${window.escapeHtml(choice)}</span></button>`).join('')}
        ${feedback ? `<div class="feedback ${feedback.is_correct ? 'correct' : 'wrong'}"><strong>${feedback.is_correct ? 'Correct' : 'Not quite'}</strong><div>Answer: ${window.escapeHtml(correctText || '—')}</div>${feedback.explanation ? `<div>${window.escapeHtml(feedback.explanation)}</div>` : ''}</div>` : ''}
        <div style="display:flex;justify-content:space-between;gap:.75rem;margin-top:1rem;">
          <button class="btn btn-secondary" id="backToBankBtn">Exit</button>
          ${feedback ? `<button class="btn btn-primary" id="nextBankBtn">${currentIndex === sessionQuestions.length - 1 ? 'Summary' : 'Next'}</button>` : '<button class="btn btn-primary" id="checkBankBtn">Check</button>'}
        </div>
      </section>`;
    window.renderMathIn?.(bankApp);
    document.querySelectorAll('[data-choice]').forEach((button) => button.addEventListener('click', () => { selected = Number(button.dataset.choice); renderQuestion(); }));
    document.getElementById('bankSprInput')?.addEventListener('input', (event) => { selectedText = event.target.value.replace(/[^0-9./-]/g, '').replace(/(?!^)-/g, '').slice(0, 5); event.target.value = selectedText; });
    document.getElementById('backToBankBtn').addEventListener('click', exitSession);
    document.getElementById('checkBankBtn')?.addEventListener('click', checkAnswer);
    document.getElementById('nextBankBtn')?.addEventListener('click', nextQuestion);
  }

  async function exitSession() {
    if (!session?.id) return renderSetup();
    const button = document.getElementById('backToBankBtn');
    window.satSetButtonLoading(button, true, 'Exiting session');
    try {
      await window.satRpc('finish_practice_session', { p_session_id: session.id });
      session = null;
      sessionQuestions = [];
      renderSetup();
    } catch (error) {
      console.error(error);
      alert('Could not close the session. Please check your connection and try again.');
    } finally {
      window.satSetButtonLoading(button, false);
    }
  }

  async function checkAnswer() {
    const q = currentQuestion();
    const isSpr = (q.answer_type || 'mcq') === 'spr';
    if (!isSpr && selected === null) return alert('Choose an answer first.');
    if (isSpr && !selectedText.trim()) return alert('Enter an answer first.');
    const elapsed = Math.floor((Date.now() - questionStartedAt) / 1000);
    const button = document.getElementById('checkBankBtn');
    window.satSetButtonLoading(button, true, 'Checking answer');
    try {
      const result = await window.satRpc('check_practice_answer', {
        p_session_id: session.id,
        p_question_id: q.id,
        p_chosen: isSpr ? null : selected,
        p_chosen_text: isSpr ? selectedText : null,
        p_time_spent: elapsed,
      });
      feedback = Array.isArray(result) ? result[0] : result;
      renderQuestion();
    } finally {
      window.satSetButtonLoading(button, false);
    }
  }

  function nextQuestion() {
    if (currentIndex >= sessionQuestions.length - 1) return renderSummary();
    currentIndex += 1;
    selected = null;
    selectedText = '';
    feedback = null;
    questionStartedAt = Date.now();
    renderQuestion();
  }

  function renderSummary() {
    window.satRest(`practice_sessions?id=eq.${encodeURIComponent(session.id)}&select=*`).then((rows) => {
      const row = rows[0] || session;
      document.getElementById('bankApp').innerHTML = `
        <section class="card session-card">
          <h2>Session summary</h2>
          <div class="stats-row">
            <div class="stat-box"><div class="stat-box-label">Score</div><div class="stat-box-value">${row.correct}/${sessionQuestions.length}</div></div>
            <div class="stat-box"><div class="stat-box-label">Accuracy</div><div class="stat-box-value">${Math.round((row.correct / sessionQuestions.length) * 100)}%</div></div>
          </div>
          <button class="btn btn-primary" id="newBankSessionBtn">New session</button>
        </section>`;
      document.getElementById('newBankSessionBtn').addEventListener('click', () => load());
    });
  }

  async function load() {
    const [statRows, questionRows, submittedAttempts] = await Promise.all([
      window.satRpc('get_bank_stats'),
      window.satRest('student_questions?select=id,test_id,section,module_key,difficulty,topic,stem,image_url,choices,answer_type,order_num'),
      window.satRest('test_attempts?status=eq.submitted&select=test_id'),
    ]);
    stats = Array.isArray(statRows) ? statRows[0] : statRows;
    const submittedTestIds = new Set((submittedAttempts || []).map((attempt) => attempt.test_id));
    questions = (questionRows || []).filter((question) => submittedTestIds.has(question.test_id));
    renderSetup();
  }

  async function init() {
    context = await window.SAT_AUTH_READY;
    if (!context) return;
    window.satSetSidebarUser(context.profile, { name: ['bankName'], avatar: ['bankAvatar'] });
    try {
      await load();
    } catch (err) {
      console.error(err);
      document.getElementById('bankApp').innerHTML = '<div class="empty-state">Run migration 005 to enable Question Bank.</div>';
    }
  }

  init();
}());
