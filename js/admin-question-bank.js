(function () {
  async function load() {
    const rows = await window.satRest('admin_questions?select=id,stem,section,topic,difficulty,answer_type&order=created_at.desc');
    const tbody = document.getElementById('questionRows');
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty">No questions yet. Add questions in the test builder.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map((q) => `<tr>
      <td>${window.escapeHtml(String(q.stem || '').slice(0, 100))}</td>
      <td>${window.escapeHtml(q.section || '—')}</td>
      <td>${window.escapeHtml(q.topic || 'General')}</td>
      <td><span class="tag yellow">${window.escapeHtml(q.difficulty || 'medium')}</span></td>
      <td><span class="tag blue">${window.escapeHtml((q.answer_type || 'mcq').toUpperCase())}</span></td>
    </tr>`).join('');
    window.renderMathIn?.(tbody);
  }

  async function init() {
    const context = await window.SAT_AUTH_READY;
    if (!context) return;
    try { await load(); } catch (err) {
      console.error(err);
      document.getElementById('questionRows').innerHTML = '<tr><td colspan="5" class="empty">Could not load question bank.</td></tr>';
    }
  }
  init();
}());
