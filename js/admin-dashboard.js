(function () {
  let context = null;
  let students = [];
  let tests = [];
  let attempts = [];

  function studentBestRows() {
    const best = new Map();
    attempts.forEach((attempt) => {
      const previous = best.get(attempt.student_id);
      if (!previous || Number(attempt.total_score || 0) > Number(previous.total_score || 0)) {
        best.set(attempt.student_id, attempt);
      }
    });
    return best;
  }

  function scoreTier(score) {
    if (!score) return 'none';
    if (score >= 1300) return 'green';
    if (score >= 1100) return 'amber';
    return 'red';
  }

  function colorFor(index) {
    return ['#6D28D9', '#0891B2', '#3adbba', '#059669', '#DC2626', '#D97706', '#7C3AED', '#B45309'][index % 8];
  }

  function setAdminInfo(profile) {
    const avatar = document.querySelector('.admin-avatar');
    const name = document.querySelector('.admin-name');
    if (avatar) avatar.textContent = window.initialsFor(profile.full_name, 'AD');
    if (name) name.textContent = profile.full_name || 'Admin';
  }

  function renderGreeting(profile) {
    const hour = new Date().getHours();
    const part = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
    const firstName = String(profile.full_name || 'Admin').split(' ')[0];
    window.satSetText('greetingHead', `Good ${part}, ${firstName}`);
    window.satSetText(
      'dateSubtitle',
      `${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} - class overview.`
    );
  }

  function renderNavBadges() {
    const badges = document.querySelectorAll('.nav-badge');
    if (badges[0]) badges[0].textContent = students.length;
    if (badges[1]) badges[1].textContent = tests.length;
  }

  function renderStats() {
    const cards = document.querySelectorAll('.stat-card');
    const published = tests.filter((test) => test.status === 'published').length;
    const drafts = tests.filter((test) => test.status === 'draft').length;
    const scored = attempts.filter((attempt) => Number(attempt.total_score) > 0);
    const average = scored.length
      ? Math.round(scored.reduce((sum, item) => sum + Number(item.total_score || 0), 0) / scored.length)
      : 0;
    const top = scored.sort((a, b) => Number(b.total_score || 0) - Number(a.total_score || 0))[0];
    const topStudent = students.find((student) => student.id === top?.student_id);

    const values = [
      [students.length, `${students.filter((s) => new Date(s.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).length} added this month`],
      [published, `${drafts} in draft`],
      [average || '—', scored.length ? 'across submitted attempts' : 'No submitted attempts yet'],
      [top?.total_score || '—', topStudent?.full_name || 'No scorer yet'],
    ];

    cards.forEach((card, index) => {
      const valueEl = card.querySelector('.stat-value');
      const subEl = card.querySelector('.stat-sub');
      if (valueEl) valueEl.textContent = values[index][0];
      if (subEl) subEl.textContent = values[index][1];
    });
  }

  function renderPulse() {
    const pulseRow = document.getElementById('pulseRow');
    const best = studentBestRows();
    const rows = students.slice(0, 12);
    if (!rows.length) {
      pulseRow.innerHTML = '<div style="color:rgba(255,255,255,0.45);font-size:0.85rem;">No students yet.</div>';
      return;
    }

    pulseRow.innerHTML = rows.map((student, index) => {
      const attempt = best.get(student.id);
      const score = attempt?.total_score || null;
      const color = colorFor(index);
      return `
        <div class="student-pulse" title="${window.escapeHtml(student.full_name)} - ${score || 'No tests yet'}">
          <div class="pulse-avatar-wrap">
            <div class="pulse-ring ${scoreTier(score)}"></div>
            <div class="pulse-av" style="background:${color}22;color:${color};">
              ${window.escapeHtml(window.initialsFor(student.full_name))}
            </div>
          </div>
          <div class="pulse-name">${window.escapeHtml(String(student.full_name || 'Student').split(' ')[0])}</div>
          <div class="pulse-score">${window.escapeHtml(score || '—')}</div>
        </div>`;
    }).join('');
  }

  function renderTable(list) {
    const tbody = document.getElementById('studentTableBody');
    const best = studentBestRows();
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="color:var(--text-faint);font-size:0.85rem;padding:1rem;">No students found.</td></tr>';
      return;
    }

    tbody.innerHTML = list.map((student, index) => {
      const attempt = best.get(student.id);
      const count = attempts.filter((item) => item.student_id === student.id).length;
      const color = colorFor(index);
      return `
        <tr>
          <td>
            <div class="student-cell">
              <div class="tbl-avatar" style="background:${color}22;color:${color};">
                ${window.escapeHtml(window.initialsFor(student.full_name))}
              </div>
              <div>
                <div class="tbl-name">${window.escapeHtml(student.full_name)}</div>
                <div class="tbl-username">@${window.escapeHtml(student.username)}</div>
              </div>
            </div>
          </td>
          <td><span class="score-pill ${scoreTier(attempt?.total_score)}">${window.escapeHtml(attempt?.total_score || 'No tests')}</span></td>
          <td><span class="tests-done">${count} done</span></td>
          <td style="color:var(--text-faint);font-size:0.78rem;">${window.escapeHtml(window.formatShortDate(student.created_at))}</td>
          <td>
            <a class="row-action" title="View students" href="admin-students.html">
              <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
              </svg>
            </a>
          </td>
        </tr>`;
    }).join('');
  }

  function filterStudents(query) {
    const q = String(query || '').toLowerCase();
    const filtered = students.filter((student) =>
      String(student.full_name || '').toLowerCase().includes(q) ||
      String(student.username || '').toLowerCase().includes(q)
    );
    renderTable(filtered);
  }

  function renderActivity() {
    const feed = document.getElementById('activityFeed');
    const recentAttempts = attempts.slice(0, 4).map((attempt) => {
      const student = students.find((item) => item.id === attempt.student_id) || {};
      const test = tests.find((item) => item.id === attempt.test_id) || {};
      return {
        icon: 'green',
        text: `<strong>${window.escapeHtml(student.full_name || 'Student')}</strong> completed <strong>${window.escapeHtml(test.name || 'a test')}</strong> - scored <strong>${window.escapeHtml(attempt.total_score || '—')}</strong>`,
        time: window.formatDate(attempt.submitted_at),
      };
    });
    const recentStudents = students.slice(0, 2).map((student) => ({
      icon: 'teal',
      text: `<strong>${window.escapeHtml(student.full_name)}</strong> joined the platform`,
      time: window.formatDate(student.created_at),
    }));
    const recentTests = tests.slice(0, 2).map((test) => ({
      icon: 'amber',
      text: `<strong>${window.escapeHtml(test.name)}</strong> is ${window.escapeHtml(test.status)}`,
      time: window.formatDate(test.created_at),
    }));
    const rows = [...recentAttempts, ...recentStudents, ...recentTests].slice(0, 6);

    if (!rows.length) {
      feed.innerHTML = '<div style="padding:1rem;color:var(--text-faint);font-size:0.85rem;">No activity yet.</div>';
      return;
    }

    const iconSvg = {
      green: '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
      teal: '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>',
      amber: '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>',
    };

    feed.innerHTML = rows.map((item) => `
      <div class="activity-item">
        <div class="act-icon ${item.icon}">${iconSvg[item.icon]}</div>
        <div class="act-body">
          <div class="act-text">${item.text}</div>
          <div class="act-time">${window.escapeHtml(item.time)}</div>
        </div>
      </div>`).join('');
  }

  async function createStudentAuthUser(fullName, username, password) {
    const session = await window.satGetSession();
    let response;
    try {
      response = await fetch(`${window.SAT_SUPABASE_URL}/functions/v1/create-student`, {
        method: 'POST',
        headers: {
          apikey: window.SAT_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ full_name: fullName, username, password }),
      });
    } catch (err) {
      throw new Error('Student creation is not ready yet. Deploy the create-student Edge Function, or create this student manually in Supabase Auth and profiles.');
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Student creation function is not deployed yet.');
    return payload;
  }

  async function addStudent() {
    const name = document.getElementById('newStudentName').value.trim();
    const username = document.getElementById('newStudentUser').value.trim().toLowerCase().replace(/\s+/g, '');
    const password = document.getElementById('newStudentPass').value.trim();
    if (!name || !username || password.length < 6) {
      alert('Please enter a name, username, and a password with at least 6 characters.');
      return;
    }
    try {
      await createStudentAuthUser(name, username, password);
      closeModal('addStudent');
      await loadDashboard();
      alert(`Student "${name}" created. Share the temporary password now.`);
    } catch (err) {
      console.error(err);
      alert(err.message || 'Could not create student.');
    }
  }

  async function createTest() {
    const name = document.getElementById('newTestName').value.trim();
    if (!name) {
      alert('Please enter a test name.');
      return;
    }
    try {
      const [created] = await window.satInsert('tests', {
        name,
        status: 'draft',
        created_by: context.profile.id,
      });
      closeModal('newTest');
      window.location.href = `admin-test-builder.html?id=${encodeURIComponent(created.id)}`;
    } catch (err) {
      console.error(err);
      alert('Could not create the test.');
    }
  }

  function openModal(id) {
    const el = document.getElementById(`modal-${id}`);
    if (el) el.style.display = 'flex';
  }

  function closeModal(id) {
    const el = document.getElementById(`modal-${id}`);
    if (el) el.style.display = 'none';
  }

  async function loadDashboard() {
    [students, tests, attempts] = await Promise.all([
      window.satRest('profiles?role=eq.student&is_active=eq.true&select=id,full_name,username,created_at&order=created_at.desc'),
      window.satRest('tests?select=id,name,status,created_at&order=created_at.desc'),
      window.satRest('leaderboard_attempts?select=*&order=submitted_at.desc'),
    ]);
    renderNavBadges();
    renderStats();
    renderPulse();
    renderTable(students);
    renderActivity();
  }

  async function init() {
    context = await window.SAT_AUTH_READY;
    if (!context) return;
    setAdminInfo(context.profile);
    renderGreeting(context.profile);
    document.querySelectorAll('[id^="modal-"]').forEach((modal) => {
      modal.addEventListener('click', (event) => {
        if (event.target === modal) closeModal(modal.id.replace('modal-', ''));
      });
    });
    try {
      await loadDashboard();
    } catch (err) {
      console.error(err);
      document.getElementById('pulseRow').innerHTML =
        '<div style="color:rgba(255,255,255,0.45);font-size:0.85rem;">Could not load dashboard data.</div>';
    }
  }

  window.filterStudents = filterStudents;
  window.openModal = openModal;
  window.closeModal = closeModal;
  window.addStudent = addStudent;
  window.createTest = createTest;
  window.handleLogout = window.handleAdminLogout;

  init();
}());
