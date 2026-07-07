    // ---- Greeting ----
    const hour = new Date().getHours();
    const part = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
    document.getElementById('greetingHead').textContent = `Good ${part}, Jeff 👋`;
    document.getElementById('dateSubtitle').textContent =
      new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' }) + ' — class overview.';

    // ---- Sample student data ----
    // BACKEND CONNECTION POINT: replace this with fetch('/api/admin/students')
    const students = [
      { name:'Muhammadali K.', username:'student01', score:1450, tests:6, joined:'Jun 1',  color:'#6D28D9', tier:'green' },
      { name:'Zulfiya T.',     username:'student02', score:1390, tests:5, joined:'Jun 1',  color:'#0891B2', tier:'green' },
      { name:'Abdujafar R.',   username:'student03', score:1320, tests:4, joined:'Jun 3',  color:'#3adbba', tier:'green' },
      { name:'Feruz S.',       username:'student04', score:1280, tests:4, joined:'Jun 3',  color:'#059669', tier:'amber' },
      { name:'Nilufar B.',     username:'student05', score:1250, tests:3, joined:'Jun 5',  color:'#DC2626', tier:'amber' },
      { name:'Jasur O.',       username:'student06', score:1210, tests:3, joined:'Jun 5',  color:'#D97706', tier:'amber' },
      { name:'Kamola Y.',      username:'student07', score:1180, tests:2, joined:'Jun 8',  color:'#7C3AED', tier:'amber' },
      { name:'Bobur N.',       username:'student08', score:1090, tests:2, joined:'Jun 8',  color:'#B45309', tier:'red'   },
      { name:'Sarvinoz A.',    username:'student09', score:null, tests:0, joined:'Jun 20', color:'#64748B', tier:'none'  },
      { name:'Dilnoza M.',     username:'student10', score:null, tests:0, joined:'Jun 22', color:'#475569', tier:'none'  },
    ];

    // ---- Build pulse strip ----
    const pulseRow = document.getElementById('pulseRow');
    students.forEach(s => {
      pulseRow.innerHTML += `
        <div class="student-pulse" title="${s.name} — ${s.score ? s.score : 'No tests yet'}">
          <div class="pulse-avatar-wrap">
            <div class="pulse-ring ${s.tier}"></div>
            <div class="pulse-av" style="background:${s.color}22;color:${s.color};">
              ${s.name.split(' ').map(n=>n[0]).join('').slice(0,2)}
            </div>
          </div>
          <div class="pulse-name">${s.name.split(' ')[0]}</div>
          <div class="pulse-score">${s.score ?? '—'}</div>
        </div>`;
    });

    // ---- Build student table ----
    function renderTable(list) {
      const tbody = document.getElementById('studentTableBody');
      const tierMap = { green:'green', amber:'amber', red:'red', none:'none' };
      tbody.innerHTML = list.map(s => `
        <tr>
          <td>
            <div class="student-cell">
              <div class="tbl-avatar" style="background:${s.color}22;color:${s.color};">
                ${s.name.split(' ').map(n=>n[0]).join('').slice(0,2)}
              </div>
              <div>
                <div class="tbl-name">${s.name}</div>
                <div class="tbl-username">@${s.username}</div>
              </div>
            </div>
          </td>
          <td><span class="score-pill ${tierMap[s.tier]}">${s.score ?? 'No tests'}</span></td>
          <td><span class="tests-done">${s.tests} done</span></td>
          <td style="color:var(--text-faint);font-size:0.78rem;">${s.joined}</td>
          <td>
            <button class="row-action" title="View student">
              <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
              </svg>
            </button>
          </td>
        </tr>`).join('');
    }

    renderTable(students);

    function filterStudents(q) {
      const filtered = students.filter(s =>
        s.name.toLowerCase().includes(q.toLowerCase()) ||
        s.username.toLowerCase().includes(q.toLowerCase())
      );
      renderTable(filtered);
    }

    // ---- Activity feed ----
    const activities = [
      { icon:'green',  label:'completed', text:'<strong>Muhammadali K.</strong> completed SAT Test 6 — scored <strong>1450</strong>', time:'2 hours ago' },
      { icon:'teal',   label:'new',       text:'<strong>Sarvinoz A.</strong> joined the platform', time:'5 hours ago' },
      { icon:'amber',  label:'test',      text:'<strong>SAT Practice Test 6</strong> was published', time:'Yesterday' },
      { icon:'green',  label:'completed', text:'<strong>Zulfiya T.</strong> completed SAT Test 6 — scored <strong>1390</strong>', time:'Yesterday' },
      { icon:'teal',   label:'new',       text:'<strong>Dilnoza M.</strong> joined the platform', time:'Jun 22' },
      { icon:'green',  label:'completed', text:'<strong>Feruz S.</strong> completed SAT Test 5 — scored <strong>1280</strong>', time:'Jun 20' },
    ];

    const iconSvg = {
      green: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
      teal:  `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>`,
      amber: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>`,
    };

    const feed = document.getElementById('activityFeed');
    activities.forEach(a => {
      feed.innerHTML += `
        <div class="activity-item">
          <div class="act-icon ${a.icon}">${iconSvg[a.icon]}</div>
          <div class="act-body">
            <div class="act-text">${a.text}</div>
            <div class="act-time">${a.time}</div>
          </div>
        </div>`;
    });

    // ---- Modals ----
    function openModal(id) {
      const el = document.getElementById('modal-' + id);
      el.style.display = 'flex';
    }
    function closeModal(id) {
      document.getElementById('modal-' + id).style.display = 'none';
    }
    // Close on backdrop click
    document.querySelectorAll('[id^="modal-"]').forEach(m => {
      m.addEventListener('click', e => { if (e.target === m) closeModal(m.id.replace('modal-','')); });
    });

    function addStudent() {
      const name = document.getElementById('newStudentName').value.trim();
      const user = document.getElementById('newStudentUser').value.trim();
      const pass = document.getElementById('newStudentPass').value.trim();
      if (!name || !user || !pass) { alert('Please fill in all fields.'); return; }
      /* BACKEND CONNECTION POINT:
       * await fetch('/api/admin/students', {
       *   method: 'POST',
       *   headers: { 'Content-Type':'application/json', 'Authorization':'Bearer '+adminToken },
       *   body: JSON.stringify({ name, username: user, password: pass })
       * });
       */
      alert(`Student "${name}" created! Username: ${user}`);
      closeModal('addStudent');
    }

    function createTest() {
      const name = document.getElementById('newTestName').value.trim();
      if (!name) { alert('Please enter a test name.'); return; }
      /* BACKEND CONNECTION POINT:
       * const res = await fetch('/api/admin/tests', {
       *   method: 'POST',
       *   headers: { 'Content-Type':'application/json', 'Authorization':'Bearer '+adminToken },
       *   body: JSON.stringify({ name, assign: document.getElementById('newTestAssign').value })
       * });
       * const data = await res.json();
       * window.location.href = 'admin-test-builder.html?id=' + data.testId;
       */
      localStorage.setItem('sat_draft_test', JSON.stringify({ name, questions: [], status: 'draft' }));
      window.location.href = 'admin-test-builder.html';
    }

    function handleLogout() {
      if (confirm('Sign out?')) {
        /* localStorage.removeItem('adminToken'); window.location.href = 'admin-login.html'; */
        alert('Signed out.');
      }
    }
