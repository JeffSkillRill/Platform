    // ============================================================
    // PASTE YOUR SUPABASE CREDENTIALS HERE
    // Go to: supabase.com → your project → Settings → API
    // ============================================================
    const SUPABASE_URL     = 'https://lsbpskmzffmaztczlokh.supabase.co';       // e.g. https://xyzxyz.supabase.co
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxzYnBza216ZmZtYXp0Y3psb2toIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2OTc5NzMsImV4cCI6MjA5ODI3Mzk3M30.zRtly7a6XPKoU6BaZ2eftQxxOTFSUkw1wQ8A6-H1-tI'; // starts with eyJ...

    // Supabase helper functions
    const db = {
      async getAll(table) {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
          headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      },
      async getWhere(table, column, operator, value) {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${column}=${operator}.${encodeURIComponent(value)}&select=*`, {
          headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      },
      async insert(table, data) {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json', 'Prefer': 'return=representation'
          },
          body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      },
      async delete(table, id) {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
          method: 'DELETE',
          headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
        });
        if (!res.ok) throw new Error(await res.text());
        return true;
      }
    };

    // ---- Connection check on load ----
    async function checkConnection() {
      if (SUPABASE_URL === 'YOUR_SUPABASE_URL') {
        document.getElementById('studentTableBody').innerHTML =
          `<tr class="empty-row"><td colspan="5" style="color:#d97706;">
            ⚠️ Supabase not connected yet. Open this file and paste your URL and ANON KEY at the top of the script.
          </td></tr>`;
        document.getElementById('totalCount').textContent = '—';
        document.getElementById('newThisWeek').textContent = '—';
        return false;
      }
      return true;
    }

    let allStudents = [];
    let deleteTargetId = null;

    // ---- Load session ----
    const session = JSON.parse(localStorage.getItem('sat_user') || '{}');
    if (session.name) {
      const initials = session.name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase();
      document.getElementById('adminAvatar').textContent = initials;
      document.getElementById('adminName').textContent = session.name;
    }

    // ---- Load all students from Supabase ----
    async function loadStudents() {
      const connected = await checkConnection();
      if (!connected) return;
      try {
        // Fetch all users where role = student, ordered by creation date
        const data = await db.getWhere('users', 'role', 'eq', 'student');
        // Sort newest first
        allStudents = data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        renderTable(allStudents);
        updateStats(allStudents);
      } catch (err) {
        document.getElementById('studentTableBody').innerHTML =
          `<tr class="empty-row"><td colspan="5">Failed to load students. Check your Supabase credentials.</td></tr>`;
      }
    }

    // ---- Update stats strip ----
    function updateStats(students) {
      document.getElementById('totalCount').textContent = students.length;
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const newCount = students.filter(s => new Date(s.created_at) > weekAgo).length;
      document.getElementById('newThisWeek').textContent = newCount;
    }

    // ---- Render table ----
    function renderTable(students) {
      const tbody = document.getElementById('studentTableBody');
      if (students.length === 0) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="5">No students yet. Click "Add student" to get started.</td></tr>`;
        return;
      }

      // Avatar colors cycle
      const colors = ['#6D28D9','#0891B2','#3adbba','#059669','#DC2626','#D97706','#7C3AED','#B45309'];

      tbody.innerHTML = students.map((s, i) => {
        const initials = s.full_name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase();
        const color    = colors[i % colors.length];
        const date     = new Date(s.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
        return `
          <tr>
            <td>
              <div class="student-cell">
                <div class="tbl-avatar" style="background:${color}22;color:${color};">${initials}</div>
                <div>
                  <div class="tbl-name">${s.full_name}</div>
                </div>
              </div>
            </td>
            <td><span class="tbl-username" style="font-size:0.84rem;color:var(--text);">@${s.username}</span></td>
            <td><span style="font-family:monospace;font-size:0.84rem;background:var(--teal-light);padding:2px 8px;border-radius:5px;color:var(--text-muted);">${s.password}</span></td>
            <td><span class="tbl-date">${date}</span></td>
            <td>
              <button class="btn btn-danger" onclick="openDeleteModal('${s.id}', '${s.full_name.replace(/'/g,"\\'")}')">
                Remove
              </button>
            </td>
          </tr>`;
      }).join('');
    }

    // ---- Filter table by search ----
    function filterTable(query) {
      const q = query.toLowerCase();
      const filtered = allStudents.filter(s =>
        s.full_name.toLowerCase().includes(q) ||
        s.username.toLowerCase().includes(q)
      );
      renderTable(filtered);
    }

    // ---- Add student modal ----
    function openAddModal() {
      document.getElementById('addModal').classList.add('open');
      document.getElementById('addForm').style.display = 'block';
      document.getElementById('addSuccess').style.display = 'none';
      document.getElementById('addError').classList.remove('visible');
      document.getElementById('inputName').value = '';
      document.getElementById('inputUsername').value = '';
      document.getElementById('inputPassword').value = '';
      setTimeout(() => document.getElementById('inputName').focus(), 100);
    }

    function closeAddModal() {
      document.getElementById('addModal').classList.remove('open');
    }

    function addAnother() {
      document.getElementById('addForm').style.display = 'block';
      document.getElementById('addSuccess').style.display = 'none';
      document.getElementById('addError').classList.remove('visible');
      document.getElementById('inputName').value = '';
      document.getElementById('inputUsername').value = '';
      document.getElementById('inputPassword').value = '';
      document.getElementById('inputName').focus();
    }

    // ---- Add student to Supabase ----
    async function addStudent() {
      const name     = document.getElementById('inputName').value.trim();
      const username = document.getElementById('inputUsername').value.trim().toLowerCase().replace(/\s+/g,'');
      const password = document.getElementById('inputPassword').value.trim();
      const errorEl  = document.getElementById('addError');
      const btn      = document.getElementById('addSubmitBtn');

      // Validate
      errorEl.classList.remove('visible');
      if (!name)     { showModalError('Full name is required.'); return; }
      if (!username) { showModalError('Username is required.'); return; }
      if (username.length < 3) { showModalError('Username must be at least 3 characters.'); return; }
      if (!password) { showModalError('Password is required.'); return; }
      if (password.length < 4) { showModalError('Password must be at least 4 characters.'); return; }

      btn.disabled = true;
      btn.textContent = 'Creating…';

      try {
        // Check if username already exists
        const existing = await db.getWhere('users', 'username', 'eq', username);
        if (existing.length > 0) {
          showModalError(`Username "@${username}" is already taken. Choose a different one.`);
          return;
        }

        // Insert new student into Supabase
        await db.insert('users', {
          full_name: name,
          username:  username,
          password:  password,
          role:      'student',
        });

        // Show credentials screen
        document.getElementById('createdUsername').textContent = username;
        document.getElementById('createdPassword').textContent = password;
        document.getElementById('addForm').style.display = 'none';
        document.getElementById('addSuccess').style.display = 'block';

        // Refresh table
        await loadStudents();

      } catch (err) {
        showModalError('Something went wrong. Please try again.');
        console.error(err);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Create account';
      }
    }

    function showModalError(msg) {
      const el = document.getElementById('addError');
      el.textContent = msg;
      el.classList.add('visible');
      document.getElementById('addSubmitBtn').disabled = false;
      document.getElementById('addSubmitBtn').textContent = 'Create account';
    }

    // ---- Delete modal ----
    function openDeleteModal(id, name) {
      deleteTargetId = id;
      document.getElementById('deleteStudentName').textContent = name;
      document.getElementById('deleteModal').classList.add('open');
    }

    function closeDeleteModal() {
      document.getElementById('deleteModal').classList.remove('open');
      deleteTargetId = null;
    }

    async function confirmDelete() {
      if (!deleteTargetId) return;
      try {
        await db.delete('users', deleteTargetId);
        closeDeleteModal();
        showToast('Student removed.');
        await loadStudents();
      } catch (err) {
        showToast('Failed to remove student.');
        console.error(err);
      }
    }

    // ---- Close modals on backdrop click ----
    document.getElementById('addModal').addEventListener('click', e => { if (e.target.id === 'addModal') closeAddModal(); });
    document.getElementById('deleteModal').addEventListener('click', e => { if (e.target.id === 'deleteModal') closeDeleteModal(); });

    // ---- Toast ----
    function showToast(msg) {
      const t = document.getElementById('toast');
      document.getElementById('toastMsg').textContent = msg;
      t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), 2800);
    }

    // ---- Init ----
    loadStudents();
