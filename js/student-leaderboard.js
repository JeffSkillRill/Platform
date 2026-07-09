(function () {
  let profiles = [];
  let tests = [];
  let attempts = [];
  let currentProfile = null;

  function bestRows() {
    const filter = document.getElementById('testFilter').value;
    const period = document.getElementById('periodFilter')?.value || 'all';
    const now = new Date();
    const periodStart = new Date(now);
    if (period === 'week') periodStart.setDate(now.getDate() - 7);
    if (period === 'month') periodStart.setMonth(now.getMonth() - 1);
    const periodFiltered = period === 'all'
      ? attempts
      : attempts.filter((attempt) => new Date(attempt.submitted_at) >= periodStart);
    const source = filter === 'overall'
      ? periodFiltered
      : periodFiltered.filter((attempt) => attempt.test_id === filter);
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

  function renderPodium(rows) {
    const podium = document.getElementById('podium');
    if (!podium) return;
    const top = rows.slice(0, 3);
    if (!top.length) {
      podium.innerHTML = '';
      return;
    }
    podium.innerHTML = top.map((attempt, index) => {
      const user = profiles.find((profile) => profile.id === attempt.student_id) || {};
      return `
        <div class="podium-card">
          <div class="podium-rank">#${index + 1}</div>
          <div class="podium-name">${window.escapeHtml(user.full_name || 'Student')}</div>
          <div class="podium-score">${window.escapeHtml(attempt.total_score || '—')}</div>
        </div>`;
    }).join('');
  }

  function render() {
    const body = document.getElementById('rows');
    const rows = bestRows();
    renderPodium(rows);
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="6" class="empty">No submitted tests yet.</td></tr>';
      return;
    }

    body.innerHTML = rows.map((attempt, index) => {
      const user = profiles.find((profile) => profile.id === attempt.student_id) || {};
      const test = tests.find((item) => item.id === attempt.test_id) || {};
      const isMe = attempt.student_id === currentProfile.id;
      return `<tr class="${isMe ? 'me' : ''}">
        <td><span class="rank">#${index + 1}</span></td>
        <td><div class="name">${window.escapeHtml(user.full_name || 'Student')}${isMe ? '<span class="tag">You</span>' : ''}</div><div class="sub">@${window.escapeHtml(user.username || 'student')}</div></td>
        <td>${window.escapeHtml(test.name || 'Untitled test')}</td>
        <td><span class="score">${window.escapeHtml(attempt.total_score || '—')}</span></td>
        <td>${window.escapeHtml(attempt.correct_count ?? '—')}/${window.escapeHtml(attempt.total_questions ?? '—')}</td>
        <td>${window.escapeHtml(window.formatDate(attempt.submitted_at))}</td>
      </tr>`;
    }).join('');
  }

  async function load(context) {
    try {
      [profiles, tests, attempts] = await Promise.all([
        window.satRest('leaderboard_profiles?select=id,full_name,username'),
        window.satRest('tests?select=id,name,status'),
        window.satRest('leaderboard_attempts?select=*&order=submitted_at.desc'),
      ]);
      const requestedTestId = new URLSearchParams(window.location.search).get('testId');
      document.getElementById('testFilter').innerHTML =
        '<option value="overall">Overall best score</option>' +
        tests.map((test) => `<option value="${window.escapeHtml(test.id)}">${window.escapeHtml(test.name)}</option>`).join('');
      if (requestedTestId && tests.some((test) => test.id === requestedTestId)) {
        document.getElementById('testFilter').value = requestedTestId;
      }
      document.getElementById('testFilter').addEventListener('change', render);
      document.getElementById('periodFilter').addEventListener('change', render);
      render();
    } catch (err) {
      console.error(err);
      document.getElementById('rows').innerHTML = '<tr><td colspan="6" class="empty">Could not load leaderboard data.</td></tr>';
    }
  }

  async function init() {
    const context = await window.SAT_AUTH_READY;
    if (!context) return;
    currentProfile = context.profile;
    window.satSetText('studentName', context.profile.full_name || 'Student');
    await load(context);
  }

  init();
}());
