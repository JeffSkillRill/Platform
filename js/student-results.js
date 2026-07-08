(function () {
  let tests = [];
  let rows = [];

  function testById(id) {
    return tests.find((test) => test.id === id) || {};
  }

  function openReview(id) {
    window.location.href = `student-test-results.html?attemptId=${encodeURIComponent(id)}`;
  }

  function render() {
    const body = document.getElementById('rows');
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="6" class="empty">No submitted tests yet.</td></tr>';
      return;
    }

    body.innerHTML = rows.map((attempt) => {
      const test = testById(attempt.test_id);
      return `<tr>
        <td><div class="test">${window.escapeHtml(test.name || 'Untitled test')}</div><div class="sub">${window.escapeHtml(attempt.id)}</div></td>
        <td><span class="score">${window.escapeHtml(attempt.total_score || '—')}</span></td>
        <td>${window.escapeHtml(attempt.correct_count ?? '—')}/${window.escapeHtml(attempt.total_questions ?? '—')}</td>
        <td>${window.escapeHtml(window.formatTime(attempt.time_taken))}</td>
        <td>${window.escapeHtml(window.formatDate(attempt.submitted_at))}</td>
        <td><button class="btn" data-review-id="${window.escapeHtml(attempt.id)}">Review</button></td>
      </tr>`;
    }).join('');

    body.querySelectorAll('[data-review-id]').forEach((button) => {
      button.addEventListener('click', () => openReview(button.dataset.reviewId));
    });
  }

  async function load(context) {
    try {
      [tests, rows] = await Promise.all([
        window.satRest('tests?select=id,name'),
        window.satRest(`test_attempts?student_id=eq.${encodeURIComponent(context.profile.id)}&status=eq.submitted&select=id,test_id,time_taken,correct_count,total_questions,total_score,submitted_at&order=submitted_at.desc`),
      ]);
      render();
    } catch (err) {
      console.error(err);
      document.getElementById('rows').innerHTML = '<tr><td colspan="6" class="empty">Could not load results from Supabase.</td></tr>';
    }
  }

  async function init() {
    const context = await window.SAT_AUTH_READY;
    if (!context) return;
    window.satSetText('studentName', context.profile.full_name || 'Student');
    await load(context);
  }

  init();
}());
