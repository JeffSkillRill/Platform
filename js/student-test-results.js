(function () {
  const LETTERS = window.SAT_LETTERS || ['A', 'B', 'C', 'D'];
  let reviewRows = [];
  let attempt = null;
  let test = null;
  let activeFilter = 'all';

  function getAttemptId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('attemptId') || window.parseJson(localStorage.getItem('sat_last_result'), {}).attemptId;
  }

  function getStatus(row) {
    if (row.chosen === null || row.chosen === undefined) return 'skipped';
    return row.is_correct ? 'correct' : 'wrong';
  }

  function setFilter(filter, button) {
    activeFilter = filter;
    document.querySelectorAll('.filter-btn').forEach((item) => item.classList.remove('active'));
    if (button) button.classList.add('active');
    renderList();
  }

  function renderSummary() {
    const correct = reviewRows.filter((row) => row.is_correct).length;
    const skipped = reviewRows.filter((row) => row.chosen === null || row.chosen === undefined).length;
    const wrong = Math.max(0, reviewRows.length - correct - skipped);
    const title = test?.name || 'Test Results';

    window.satSetText('topbarName', title);
    window.satSetText('summaryTitle', title);
    window.satSetText(
      'summarySub',
      `${reviewRows.length} questions · Completed ${window.formatDate(attempt?.submitted_at)}`
    );

    document.getElementById('timeBadge').innerHTML = `
      <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path stroke-linecap="round" d="M12 6v6l4 2"/></svg>
      Time: ${window.escapeHtml(window.formatTime(attempt?.time_taken || 0))}`;

    document.getElementById('summaryStats').innerHTML = `
      <div class="sum-stat"><div class="sum-stat-val correct">${correct}</div><div class="sum-stat-lbl">Correct</div></div>
      <div class="sum-stat"><div class="sum-stat-val wrong">${wrong}</div><div class="sum-stat-lbl">Wrong</div></div>
      <div class="sum-stat"><div class="sum-stat-val skipped">${skipped}</div><div class="sum-stat-lbl">Skipped</div></div>
      <div class="sum-stat"><div class="sum-stat-val" style="color:#fff;">${window.escapeHtml(attempt?.total_score || '—')}</div><div class="sum-stat-lbl">Score</div></div>`;
  }

  function renderList() {
    const list = document.getElementById('questionList');
    const filtered = reviewRows.filter((row) => activeFilter === 'all' || getStatus(row) === activeFilter);
    if (!filtered.length) {
      list.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--text-faint);">No questions in this category.</div>';
      return;
    }

    const groups = [
      ['rw', 'Reading & Writing'],
      ['math', 'Math'],
    ];
    let html = '';
    groups.forEach(([section, label]) => {
      const rows = filtered.filter((row) => row.section === section);
      if (!rows.length) return;
      html += `<div class="section-divider"><div class="section-divider-line"></div><div class="section-divider-label">${label}</div><div class="section-divider-line"></div></div>`;
      html += rows.map((row) => buildCard(row, reviewRows.indexOf(row) + 1)).join('');
    });
    list.innerHTML = html;
  }

  function buildCard(row, globalNum) {
    const status = getStatus(row);
    const chosen = row.chosen;
    const choices = window.parseJson(row.choices, []);
    const imageUrl = window.safeImageUrl(row.image_url);
    const imgHtml = imageUrl ? `<img class="q-image" src="${window.escapeHtml(imageUrl)}" alt="Question image"/>` : '';
    const labelMap = { correct: 'Correct', wrong: 'Wrong', skipped: 'Skipped' };

    const choicesHtml = choices.map((choice, index) => {
      const isCorrect = index === row.correct;
      const isChosen = index === chosen;
      let rowClass = 'neutral';
      if (isCorrect) rowClass = 'was-correct';
      else if (isChosen && !isCorrect) rowClass = 'was-wrong';

      let tags = '';
      if (isCorrect) tags += '<span class="tag correct-tag">Correct answer</span>';
      if (isChosen && !isCorrect) tags += '<span class="tag wrong-tag">Your answer</span>';
      if (isChosen && isCorrect) tags += '<span class="tag correct-tag">Your answer</span>';

      return `
        <div class="answer-row ${rowClass}">
          <div class="ans-letter">${LETTERS[index]}</div>
          <div class="ans-text">${window.escapeHtml(choice)}${tags}</div>
        </div>`;
    }).join('');

    return `
      <div class="q-review ${status}" id="card-${window.escapeHtml(row.question_id)}">
        <div class="q-review-head" onclick="toggleCard('${window.escapeHtml(row.question_id)}')">
          <div class="q-num-badge ${status}">${globalNum}</div>
          <div class="q-stem-preview">${window.escapeHtml(row.stem)}</div>
          <div class="result-tag ${status}">${labelMap[status]}</div>
          <svg class="expand-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
        </div>
        <div class="q-review-body">
          ${imgHtml}
          <div class="q-full-stem">${window.escapeHtml(row.stem)}</div>
          ${choicesHtml}
          ${row.explanation ? `<div class="explanation">${window.escapeHtml(row.explanation)}</div>` : ''}
        </div>
      </div>`;
  }

  function toggleCard(questionId) {
    const card = document.getElementById(`card-${questionId}`);
    if (card) card.classList.toggle('open');
  }

  async function load() {
    const attemptId = getAttemptId();
    if (!attemptId) {
      document.querySelector('.content').innerHTML =
        '<div style="text-align:center;padding:4rem;color:var(--text-faint);">No results found. Please open a submitted test first.</div>';
      return;
    }

    const attemptRows = await window.satRest(`test_attempts?id=eq.${encodeURIComponent(attemptId)}&status=eq.submitted&select=id,test_id,time_taken,total_score,submitted_at`);
    attempt = attemptRows[0];
    if (!attempt) throw new Error('Submitted attempt not found.');

    const [testRows, review] = await Promise.all([
      window.satRest(`tests?id=eq.${encodeURIComponent(attempt.test_id)}&select=id,name`),
      window.satRpc('get_attempt_review', { p_attempt_id: attemptId }),
    ]);
    test = testRows[0] || {};
    reviewRows = (review || []).map((row) => ({
      ...row,
      choices: window.parseJson(row.choices, []),
    }));
    renderSummary();
    renderList();
  }

  async function init() {
    const context = await window.SAT_AUTH_READY;
    if (!context) return;
    try {
      await load();
    } catch (err) {
      console.error(err);
      document.querySelector('.content').innerHTML =
        '<div style="text-align:center;padding:4rem;color:var(--text-faint);">Review is unavailable for this submitted attempt.</div>';
    }
  }

  window.setFilter = setFilter;
  window.toggleCard = toggleCard;
  init();
}());
