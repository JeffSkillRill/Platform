(function () {
  let context = null;

  function latestAttempt(testId, attempts) {
    return attempts
      .filter((attempt) => attempt.test_id === testId)
      .sort((a, b) => new Date(b.submitted_at || b.started_at) - new Date(a.submitted_at || a.started_at))[0];
  }

  async function load() {
    const classRows = await window.satRpc('get_my_classes');
    const list = document.getElementById('classList');
    if (!classRows.length) {
      list.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><strong>No classes yet</strong><br><span>Once your teacher adds you, your class will appear here.</span></div>';
      return;
    }

    const classIds = classRows.map((row) => row.class_id);
    const classFilter = classIds.map((id) => `"${id}"`).join(',');
    const [assignments, attempts] = await Promise.all([
      window.satRest(`test_assignments?class_id=in.(${classFilter})&select=class_id,test_id,due_at,tests(id,name)`),
      window.satRest(`test_attempts?student_id=eq.${encodeURIComponent(context.profile.id)}&select=id,test_id,status,total_score,submitted_at,started_at`),
    ]);

    list.innerHTML = classRows.map((klass) => {
      const assigned = assignments.filter((row) => row.class_id === klass.class_id);
      return `
        <article class="card class-card">
          <h2>${window.escapeHtml(klass.name)}</h2>
          <p>${window.escapeHtml(klass.description || 'Class materials and assignments will appear here.')}</p>
          <div class="class-meta">
            <span class="tag blue">${window.escapeHtml(klass.teacher_name)}</span>
            <span class="tag green">${klass.member_count} classmates</span>
          </div>
          <div class="assigned-tests">
            <strong>Assigned tests</strong>
            ${assigned.length ? assigned.map((assignment) => {
              const attempt = latestAttempt(assignment.test_id, attempts);
              const status = attempt?.status === 'submitted' ? `Score ${attempt.total_score}` : attempt ? 'In progress' : 'Not started';
              const href = attempt?.status === 'submitted'
                ? `student-test-results.html?attemptId=${encodeURIComponent(attempt.id)}`
                : `student-tests.html`;
              return `<a class="assigned-test" href="${href}"><div><strong>${window.escapeHtml(assignment.tests?.name || 'Practice paper')}</strong><span>${assignment.due_at ? `Due ${window.formatShortDate(assignment.due_at)}` : 'No due date'}</span></div><span class="tag ${attempt?.status === 'submitted' ? 'green' : attempt ? 'yellow' : 'blue'}">${window.escapeHtml(status)}</span></a>`;
            }).join('') : '<div class="empty-state" style="padding:1.25rem;margin-top:.75rem;">No class tests assigned yet.</div>'}
          </div>
        </article>`;
    }).join('');
  }

  async function init() {
    context = await window.SAT_AUTH_READY;
    if (!context) return;
    window.satSetSidebarUser(context.profile, { name: ['classStudentName'], avatar: ['classAvatar'] });
    try {
      await load();
    } catch (err) {
      console.error(err);
      document.getElementById('classList').innerHTML = '<div class="empty-state" style="grid-column:1/-1;">Run migration 004 to enable Classes.</div>';
    }
  }

  init();
}());
