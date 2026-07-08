(function () {
  let context = null;
  let tests = [];
  let questions = [];
  let attempts = [];

  function questionStats(testId) {
    const qs = questions.filter((q) => q.test_id === testId);
    return {
      total: qs.length,
      rw: qs.filter((q) => q.section === 'rw').length,
      math: qs.filter((q) => q.section === 'math').length,
    };
  }

  function latestAttempt(testId, status) {
    return attempts
      .filter((attempt) => attempt.test_id === testId && (!status || attempt.status === status))
      .sort((a, b) => new Date(b.submitted_at || b.started_at) - new Date(a.submitted_at || a.started_at))[0];
  }

  function estimatedMinutes(test, stats) {
    return (stats.rw ? Number(test.rw_minutes || 64) : 0) +
      (stats.math ? Number(test.math_minutes || 70) : 0) +
      (stats.rw && stats.math ? Number(test.break_minutes || 10) : 0);
  }

  async function startTest(testId) {
    const test = tests.find((item) => item.id === testId);
    const submitted = latestAttempt(testId, 'submitted');
    if (submitted) {
      window.location.href = `student-test-results.html?attemptId=${encodeURIComponent(submitted.id)}`;
      return;
    }

    const inProgress = latestAttempt(testId, 'in_progress');
    let attempt = inProgress;
    if (!attempt) {
      const inserted = await window.satInsert('test_attempts', {
        student_id: context.profile.id,
        test_id: testId,
        status: 'in_progress',
      });
      attempt = inserted[0];
      attempts.unshift(attempt);
    }

    window.location.href = `student-test-solve.html?testId=${encodeURIComponent(testId)}&attemptId=${encodeURIComponent(attempt.id)}&testName=${encodeURIComponent(test?.name || 'SAT Practice Test')}`;
  }

  function openResult(testId) {
    const submitted = latestAttempt(testId, 'submitted');
    if (!submitted) return;
    window.location.href = `student-test-results.html?attemptId=${encodeURIComponent(submitted.id)}`;
  }

  function render() {
    const list = document.getElementById('testList');
    if (!tests.length) {
      list.innerHTML = `
        <div class="empty-state">
          <svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          <p>No tests available yet.<br>Your instructor has not assigned any published tests.</p>
        </div>`;
      return;
    }

    list.innerHTML = tests.map((test) => {
      const stats = questionStats(test.id);
      const submitted = latestAttempt(test.id, 'submitted');
      const inProgress = latestAttempt(test.id, 'in_progress');
      const date = window.formatDate(test.created_at);
      const minutes = estimatedMinutes(test, stats);
      const mainLabel = submitted ? 'Review' : inProgress ? 'Resume' : 'Start';

      return `
        <div class="test-card">
          <div class="test-icon">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          </div>
          <div class="test-info">
            <div class="test-name">${window.escapeHtml(test.name)}</div>
            <div class="test-meta">
              <span>${stats.total} questions</span>
              ${stats.rw ? `<span>R&amp;W: ${stats.rw}</span>` : ''}
              ${stats.math ? `<span>Math: ${stats.math}</span>` : ''}
              <span>~${minutes} min</span>
              <span>${window.escapeHtml(date)}</span>
            </div>
          </div>
          <div class="test-actions">
            <button class="btn-start" data-start-id="${window.escapeHtml(test.id)}">${mainLabel}</button>
            ${submitted ? `<button class="btn-secondary" data-result-id="${window.escapeHtml(test.id)}">Results</button>` : ''}
            <a class="btn-secondary" href="student-leaderboard.html?testId=${encodeURIComponent(test.id)}">Leaderboard</a>
          </div>
        </div>`;
    }).join('');

    list.querySelectorAll('[data-start-id]').forEach((button) => {
      button.addEventListener('click', async () => {
        button.disabled = true;
        button.textContent = 'Opening...';
        try {
          await startTest(button.dataset.startId);
        } catch (err) {
          console.error(err);
          button.disabled = false;
          button.textContent = 'Start';
          alert('Could not start this test. Please try again.');
        }
      });
    });

    list.querySelectorAll('[data-result-id]').forEach((button) => {
      button.addEventListener('click', () => openResult(button.dataset.resultId));
    });
  }

  async function loadTests() {
    try {
      [tests, questions, attempts] = await Promise.all([
        window.satRest('tests?status=eq.published&select=id,name,status,created_at,rw_minutes,math_minutes,break_minutes&order=created_at.desc'),
        window.satRest('student_questions?select=test_id,section,module_key'),
        window.satRest(`test_attempts?student_id=eq.${encodeURIComponent(context.profile.id)}&select=id,test_id,status,started_at,submitted_at,total_score&order=started_at.desc`),
      ]);
      render();
    } catch (err) {
      console.error(err);
      document.getElementById('testList').innerHTML =
        '<div class="empty-state"><p>Failed to load tests. Check Supabase policies and assignments.</p></div>';
    }
  }

  async function init() {
    context = await window.SAT_AUTH_READY;
    if (!context) return;
    window.satSetSidebarUser(context.profile, {
      name: ['sName'],
      avatar: ['sAvatar'],
    });
    await loadTests();
  }

  init();
}());
