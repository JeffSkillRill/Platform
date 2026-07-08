(function () {
  function createTest() {
    localStorage.setItem('sat_draft_test_new', JSON.stringify({
      name: '',
      moduleQuestions: { rw1: [], rw2: [], math1: [], math2: [] },
    }));
    window.location.href = 'admin-test-builder.html';
  }

  async function load() {
    try {
      const [tests, questions] = await Promise.all([
        window.satRest('tests?select=*&order=created_at.desc'),
        window.satRest('admin_questions?select=test_id,section'),
      ]);
      window.satSetText('totalTests', tests.length);
      window.satSetText('publishedTests', tests.filter((test) => test.status === 'published').length);
      window.satSetText('totalQuestions', questions.length);

      const rows = document.getElementById('testRows');
      if (!tests.length) {
        rows.innerHTML = '<tr><td colspan="5" class="empty">No tests yet.</td></tr>';
        return;
      }

      rows.innerHTML = tests.map((test) => {
        const count = questions.filter((question) => question.test_id === test.id).length;
        return `<tr>
          <td><div class="name">${window.escapeHtml(test.name)}</div><div class="sub">${window.escapeHtml(test.id)}</div></td>
          <td><span class="badge ${window.escapeHtml(test.status)}">${window.escapeHtml(test.status)}</span></td>
          <td>${count}</td>
          <td>${window.escapeHtml(window.formatDate(test.created_at))}</td>
          <td><a class="btn btn-soft" href="admin-test-builder.html?id=${encodeURIComponent(test.id)}">Open builder</a></td>
        </tr>`;
      }).join('');
    } catch (err) {
      console.error(err);
      document.getElementById('testRows').innerHTML =
        '<tr><td colspan="5" class="empty">Could not load tests from Supabase.</td></tr>';
    }
  }

  async function init() {
    const context = await window.SAT_AUTH_READY;
    if (!context) return;
    await load();
  }

  window.createTest = createTest;
  init();
}());
