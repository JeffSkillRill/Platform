(function () {
  const LETTERS = window.SAT_LETTERS || ['A', 'B', 'C', 'D'];
  let context = null;
  let mistakes = [];
  let practiceEvents = [];
  let currentIndex = 0;
  let selected = null;
  let selectedText = '';
  let feedback = null;

  function filteredMistakes() {
    const section = document.getElementById('sectionFilter')?.value || 'all';
    const topic = document.getElementById('topicFilter')?.value || 'all';
    return mistakes.filter((q) =>
      (section === 'all' || q.section === section) &&
      (topic === 'all' || (q.topic || 'General') === topic)
    );
  }

  function lastEventsByQuestion() {
    const map = new Map();
    [...practiceEvents]
      .sort((a, b) => new Date(b.answered_at) - new Date(a.answered_at))
      .forEach((event) => {
        if (!map.has(event.question_id)) map.set(event.question_id, event);
      });
    return map;
  }

  function updateProgress() {
    const latest = lastEventsByQuestion();
    const cleared = mistakes.filter((q) => latest.get(q.question_id)?.is_correct).length;
    window.satSetText('progressLine', `You've cleared ${cleared} of ${mistakes.length} mistakes`);
  }

  function populateFilters() {
    const sectionFilter = document.getElementById('sectionFilter');
    const topicFilter = document.getElementById('topicFilter');
    const sections = Array.from(new Set(mistakes.map((q) => q.section))).filter(Boolean);
    const topics = Array.from(new Set(mistakes.map((q) => q.topic || 'General'))).sort();

    sectionFilter.innerHTML = '<option value="all">All sections</option>' +
      sections.map((section) => `<option value="${window.escapeHtml(section)}">${section === 'rw' ? 'Reading & Writing' : 'Math'}</option>`).join('');
    topicFilter.innerHTML = '<option value="all">All topics</option>' +
      topics.map((topic) => `<option value="${window.escapeHtml(topic)}">${window.escapeHtml(topic)}</option>`).join('');
  }

  function sanitizeSpr(value) {
    return String(value || '').replace(/[^0-9./-]/g, '').replace(/(?!^)-/g, '').slice(0, 5);
  }

  function currentQuestion() {
    const list = filteredMistakes();
    if (currentIndex >= list.length) currentIndex = Math.max(0, list.length - 1);
    return list[currentIndex] || null;
  }

  function renderChoices(q) {
    if ((q.answer_type || 'mcq') === 'spr') {
      return `<input class="spr-input" id="sprPracticeInput" type="text" inputmode="decimal" maxlength="5" value="${window.escapeHtml(selectedText)}" placeholder="Enter answer" />`;
    }

    const choices = window.parseJson(q.choices, []);
    return choices.map((choice, index) => `
      <button class="choice ${selected === index ? 'selected' : ''}" type="button" data-choice="${index}">
        <span class="letter">${LETTERS[index]}</span>
        <span>${window.escapeHtml(choice)}</span>
      </button>`).join('');
  }

  function renderFeedback(q) {
    if (!feedback) return '';
    const isSpr = (q.answer_type || 'mcq') === 'spr';
    const correctText = isSpr
      ? feedback.answer_text
      : feedback.correct !== null && feedback.correct !== undefined
        ? `Choice ${LETTERS[feedback.correct]}`
        : '—';
    return `
      <div class="feedback ${feedback.is_correct ? 'correct' : 'wrong'}">
        <strong>${feedback.is_correct ? 'Correct' : 'Not quite'}</strong>
        <div>Answer: ${window.escapeHtml(correctText || '—')}</div>
        ${feedback.explanation ? `<div>${window.escapeHtml(feedback.explanation)}</div>` : ''}
      </div>`;
  }

  function render() {
    const card = document.getElementById('practiceCard');
    const list = filteredMistakes();
    const q = currentQuestion();
    updateProgress();

    if (!mistakes.length) {
      card.innerHTML = '<div class="empty-state">No missed questions yet. Submit a test first, then your practice set will appear here.</div>';
      return;
    }
    if (!q) {
      card.innerHTML = '<div class="empty-state">No questions match these filters.</div>';
      return;
    }

    const imageUrl = window.safeImageUrl(q.image_url);
    card.innerHTML = `
      <div class="q-meta">
        <span class="pill">${q.section === 'math' ? 'Math' : 'Reading & Writing'}</span>
        <span class="pill">${window.escapeHtml(q.topic || 'General')}</span>
        <span class="pill">${window.escapeHtml(q.difficulty || 'medium')}</span>
        <span class="pill">${currentIndex + 1} / ${list.length}</span>
      </div>
      ${imageUrl ? `<img class="q-image" src="${window.escapeHtml(imageUrl)}" alt="Question image">` : ''}
      <div class="q-stem">${window.escapeHtml(q.stem)}</div>
      <div id="answerArea">${renderChoices(q)}</div>
      ${renderFeedback(q)}
      <div class="practice-actions">
        <button class="btn btn-secondary" id="prevBtn" type="button" ${currentIndex === 0 ? 'disabled' : ''}>Previous</button>
        <div>
          <button class="btn btn-primary" id="checkBtn" type="button" ${feedback ? 'disabled' : ''}>Check</button>
          <button class="btn btn-secondary" id="nextBtn" type="button">${currentIndex >= list.length - 1 ? 'Restart' : 'Next'}</button>
        </div>
      </div>`;

    window.renderMathIn?.(card);

    card.querySelectorAll('[data-choice]').forEach((button) => {
      button.addEventListener('click', () => {
        if (feedback) return;
        selected = Number(button.dataset.choice);
        render();
      });
    });
    const sprInput = document.getElementById('sprPracticeInput');
    if (sprInput) {
      sprInput.addEventListener('input', () => {
        selectedText = sanitizeSpr(sprInput.value);
        if (sprInput.value !== selectedText) sprInput.value = selectedText;
      });
    }
    document.getElementById('prevBtn')?.addEventListener('click', () => move(-1));
    document.getElementById('nextBtn')?.addEventListener('click', () => move(1));
    document.getElementById('checkBtn')?.addEventListener('click', checkAnswer);
  }

  function resetAnswerState() {
    selected = null;
    selectedText = '';
    feedback = null;
  }

  function move(delta) {
    const list = filteredMistakes();
    if (!list.length) return;
    currentIndex = (currentIndex + delta + list.length) % list.length;
    resetAnswerState();
    render();
  }

  async function checkAnswer() {
    const q = currentQuestion();
    if (!q || feedback) return;
    const isSpr = (q.answer_type || 'mcq') === 'spr';
    if (isSpr && !selectedText.trim()) return alert('Enter an answer first.');
    if (!isSpr && selected === null) return alert('Choose an answer first.');

    const button = document.getElementById('checkBtn');
    window.satSetButtonLoading(button, true, 'Checking answer');
    try {
      const result = await window.satRpc('check_practice_answer', {
        p_question_id: q.question_id,
        p_chosen: isSpr ? null : selected,
        p_chosen_text: isSpr ? selectedText : null,
      });
      feedback = Array.isArray(result) ? result[0] : result;
      practiceEvents.unshift({
        question_id: q.question_id,
        is_correct: Boolean(feedback?.is_correct),
        answered_at: new Date().toISOString(),
      });
      render();
    } catch (err) {
      console.error(err);
      alert('Could not check your answer. Please check your connection and try again.');
    } finally {
      window.satSetButtonLoading(button, false);
    }
  }

  async function load() {
    const [mistakeRows, eventRows] = await Promise.all([
      window.satRpc('get_mistake_questions'),
      window.satRest('practice_events?select=question_id,is_correct,answered_at&order=answered_at.desc'),
    ]);
    mistakes = (mistakeRows || []).map((row) => ({
      ...row,
      choices: window.parseJson(row.choices, []),
    }));
    practiceEvents = eventRows || [];
    populateFilters();
    render();
  }

  async function init() {
    context = await window.SAT_AUTH_READY;
    if (!context) return;
    window.satSetSidebarUser(context.profile, {
      name: ['practiceName'],
      avatar: ['practiceAvatar'],
    });
    document.getElementById('sectionFilter')?.addEventListener('change', () => { currentIndex = 0; resetAnswerState(); render(); });
    document.getElementById('topicFilter')?.addEventListener('change', () => { currentIndex = 0; resetAnswerState(); render(); });
    try {
      await load();
    } catch (err) {
      console.error(err);
      document.getElementById('practiceCard').innerHTML = '<div class="empty-state">Practice is unavailable. Run migration 002 and submit at least one test.</div>';
    }
  }

  init();
}());
