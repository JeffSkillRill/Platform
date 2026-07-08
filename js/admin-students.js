(function () {
  let context = null;
  let allStudents = [];
  let deleteTargetId = null;

  function updateStats(students) {
    window.satSetText('totalCount', students.length);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const newCount = students.filter((student) => new Date(student.created_at) > weekAgo).length;
    window.satSetText('newThisWeek', newCount);
  }

  function renderTable(students) {
    const tbody = document.getElementById('studentTableBody');
    if (!students.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="4">No students yet. Click "Add student" to get started.</td></tr>';
      return;
    }

    const colors = ['#6D28D9', '#0891B2', '#3adbba', '#059669', '#DC2626', '#D97706', '#7C3AED', '#B45309'];
    tbody.innerHTML = students.map((student, index) => {
      const color = colors[index % colors.length];
      const initials = window.initialsFor(student.full_name);
      return `
        <tr>
          <td>
            <div class="student-cell">
              <div class="tbl-avatar" style="background:${color}22;color:${color};">${window.escapeHtml(initials)}</div>
              <div>
                <div class="tbl-name">${window.escapeHtml(student.full_name)}</div>
              </div>
            </div>
          </td>
          <td><span class="tbl-username" style="font-size:0.84rem;color:var(--text);">@${window.escapeHtml(student.username)}</span></td>
          <td><span class="tbl-date">${window.escapeHtml(window.formatDate(student.created_at))}</span></td>
          <td>
            <button class="btn btn-danger" data-remove-id="${window.escapeHtml(student.id)}" data-remove-name="${window.escapeHtml(student.full_name)}">
              Deactivate
            </button>
          </td>
        </tr>`;
    }).join('');

    tbody.querySelectorAll('[data-remove-id]').forEach((button) => {
      button.addEventListener('click', () => openDeleteModal(button.dataset.removeId, button.dataset.removeName));
    });
  }

  function filterTable(query) {
    const q = String(query || '').toLowerCase();
    const filtered = allStudents.filter((student) =>
      String(student.full_name || '').toLowerCase().includes(q) ||
      String(student.username || '').toLowerCase().includes(q)
    );
    renderTable(filtered);
  }

  async function loadStudents() {
    try {
      const rows = await window.satRest('profiles?role=eq.student&is_active=eq.true&select=id,full_name,username,created_at&order=created_at.desc');
      allStudents = rows;
      renderTable(allStudents);
      updateStats(allStudents);
    } catch (err) {
      console.error(err);
      document.getElementById('studentTableBody').innerHTML =
        '<tr class="empty-row"><td colspan="4">Failed to load students. Check Supabase policies.</td></tr>';
    }
  }

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

  function showModalError(message) {
    const el = document.getElementById('addError');
    el.textContent = message;
    el.classList.add('visible');
    document.getElementById('addSubmitBtn').disabled = false;
    document.getElementById('addSubmitBtn').textContent = 'Create account';
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
    if (!response.ok) {
      throw new Error(payload.error || 'Student creation function is not deployed yet.');
    }
    return payload;
  }

  async function addStudent() {
    const name = document.getElementById('inputName').value.trim();
    const username = document.getElementById('inputUsername').value.trim().toLowerCase().replace(/\s+/g, '');
    const password = document.getElementById('inputPassword').value.trim();
    const btn = document.getElementById('addSubmitBtn');

    document.getElementById('addError').classList.remove('visible');
    if (!name) { showModalError('Full name is required.'); return; }
    if (!username) { showModalError('Username is required.'); return; }
    if (username.length < 3) { showModalError('Username must be at least 3 characters.'); return; }
    if (!password) { showModalError('Password is required.'); return; }
    if (password.length < 6) { showModalError('Password must be at least 6 characters.'); return; }

    btn.disabled = true;
    btn.textContent = 'Creating...';

    try {
      await createStudentAuthUser(name, username, password);
      document.getElementById('createdUsername').textContent = username;
      document.getElementById('createdPassword').textContent = password;
      document.getElementById('addForm').style.display = 'none';
      document.getElementById('addSuccess').style.display = 'block';
      await loadStudents();
    } catch (err) {
      console.error(err);
      showModalError(err.message || 'Could not create the student account.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Create account';
    }
  }

  function openDeleteModal(id, name) {
    deleteTargetId = id;
    window.satSetText('deleteStudentName', name);
    document.getElementById('deleteModal').classList.add('open');
  }

  function closeDeleteModal() {
    document.getElementById('deleteModal').classList.remove('open');
    deleteTargetId = null;
  }

  async function confirmDelete() {
    if (!deleteTargetId) return;
    try {
      await window.satPatch(`profiles?id=eq.${encodeURIComponent(deleteTargetId)}`, { is_active: false });
      closeDeleteModal();
      showToast('Student deactivated.');
      await loadStudents();
    } catch (err) {
      console.error(err);
      showToast('Failed to deactivate student.');
    }
  }

  function showToast(message) {
    const toast = document.getElementById('toast');
    window.satSetText('toastMsg', message);
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2800);
  }

  async function init() {
    context = await window.SAT_AUTH_READY;
    if (!context) return;
    window.satSetSidebarUser(context.profile, {
      name: ['adminName'],
      avatar: ['adminAvatar'],
    });
    document.getElementById('addModal').addEventListener('click', (event) => {
      if (event.target.id === 'addModal') closeAddModal();
    });
    document.getElementById('deleteModal').addEventListener('click', (event) => {
      if (event.target.id === 'deleteModal') closeDeleteModal();
    });
    await loadStudents();
  }

  window.openAddModal = openAddModal;
  window.closeAddModal = closeAddModal;
  window.addAnother = addAnother;
  window.addStudent = addStudent;
  window.openDeleteModal = openDeleteModal;
  window.closeDeleteModal = closeDeleteModal;
  window.confirmDelete = confirmDelete;
  window.filterTable = filterTable;

  init();
}());
