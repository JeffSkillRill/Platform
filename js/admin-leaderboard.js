(function () {
  let profiles = [];
  let tests = [];
  let attempts = [];

  function bestRows() {
    const filter = document.getElementById('testFilter').value;
    const source = filter === 'overall'
      ? attempts
      : attempts.filter((attempt) => attempt.test_id === filter);
    const best = new Map();
    source.forEach((attempt) => {
      const previous = best.get(attempt.student_id);
      if (!previous || Number(attempt.total_score || 0) > Number(previous.total_score || 0)) {
        best.set(attempt.student_id, attempt);
      }
    });
    return [...best.values()].sort((a, b) =>
      Number(b.total_score || 0) - Number(a.total_score || 0) ||
      Number(b.correct_count || 0) - Number(a.correct_count || 0)
    );
  }

  function render() {
    const body = document.getElementById('rows');
    const rows = bestRows();
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="7" class="empty">No submitted tests yet.</td></tr>';
      return;
    }

    body.innerHTML = rows.map((attempt, index) => {
      const user = profiles.find((profile) => profile.id === attempt.student_id) || {};
      const test = tests.find((item) => item.id === attempt.test_id) || {};
      return `<tr>
        <td><span class="rank">#${index + 1}</span></td>
        <td><div class="student">${window.escapeHtml(user.full_name || 'Student')}</div><div class="sub">@${window.escapeHtml(user.username || 'unknown')}</div></td>
        <td>${window.escapeHtml(test.name || 'Untitled test')}</td>
        <td><span class="score">${window.escapeHtml(attempt.total_score || '—')}</span></td>
        <td>${window.escapeHtml(attempt.correct_count ?? '—')}/${window.escapeHtml(attempt.total_questions ?? '—')}</td>
        <td>${window.escapeHtml(window.formatTime(attempt.time_taken))}</td>
        <td>${window.escapeHtml(window.formatDate(attempt.submitted_at))}</td>
      </tr>`;
    }).join('');
  }

  async function load() {
    try {
      [profiles, tests, attempts] = await Promise.all([
        window.satRest('leaderboard_profiles?select=id,full_name,username'),
        window.satRest('tests?select=id,name,status'),
        window.satRest('leaderboard_attempts?select=*&order=submitted_at.desc'),
      ]);
      document.getElementById('testFilter').innerHTML =
        '<option value="overall">Overall best score</option>' +
        tests.map((test) => `<option value="${window.escapeHtml(test.id)}">${window.escapeHtml(test.name)}</option>`).join('');
      document.getElementById('testFilter').addEventListener('change', render);
      render();
    } catch (err) {
      console.error(err);
      document.getElementById('rows').innerHTML = '<tr><td colspan="7" class="empty">Could not load leaderboard data.</td></tr>';
    }
  }

  async function init() {
    const context = await window.SAT_AUTH_READY;
    if (!context) return;
    await load();
  }

  init();
}());
