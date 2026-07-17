(function () {
  let context = null;
  let classes = [];
  let counts = [];
  let students = [];
  let members = [];
  let tests = [];
  let selectedClassId = null;

  function countFor(classId) {
    return counts.find((row) => row.class_id === classId)?.member_count || 0;
  }

  function membersFor(classId) {
    return members.filter((row) => row.class_id === classId);
  }

  function renderClasses() {
    const grid = document.getElementById('classGrid');
    if (!classes.length) {
      grid.innerHTML = '<div class="empty-state">No classes yet. Create your first class.</div>';
      return;
    }
    grid.innerHTML = classes.map((item) => `
      <button class="card class-card" type="button" data-class-id="${window.escapeHtml(item.id)}">
        <h2>${window.escapeHtml(item.name)}</h2>
        <p>${window.escapeHtml(item.description || 'No description yet.')}</p>
        <div class="class-card-footer">
          <span class="tag blue">${countFor(item.id)} students</span>
          <span class="tag green join-code">${window.escapeHtml(item.join_code)}</span>
        </div>
      </button>`).join('');
    grid.querySelectorAll('[data-class-id]').forEach((button) => {
      button.addEventListener('click', () => {
        selectedClassId = button.dataset.classId;
        renderDetail();
      });
    });
  }

  function renderDetail() {
    const detail = document.getElementById('classDetail');
    const item = classes.find((row) => row.id === selectedClassId);
    if (!item) {
      detail.innerHTML = '<div class="empty-state">Select a class to manage members and assignments.</div>';
      return;
    }
    const currentMembers = membersFor(item.id);
    const memberIds = new Set(currentMembers.map((row) => row.student_id));
    const availableStudents = students.filter((student) => !memberIds.has(student.id));
    detail.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;">
        <div>
          <h2>${window.escapeHtml(item.name)}</h2>
          <div class="detail-sub">${window.escapeHtml(item.description || 'No description.')}</div>
          <span class="tag green join-code">${window.escapeHtml(item.join_code)}</span>
        </div>
        <button class="btn btn-secondary" id="editClassBtn">Edit</button>
      </div>
      <div class="detail-section">
        <h3>Members</h3>
        <div class="form-row">
          <select id="studentPicker">
            <option value="">Select student</option>
            ${availableStudents.map((student) => `<option value="${window.escapeHtml(student.id)}">${window.escapeHtml(student.full_name || student.username)}</option>`).join('')}
          </select>
          <button class="btn btn-primary" id="addMemberBtn">Add</button>
        </div>
        <div id="memberRows">
          ${currentMembers.length ? currentMembers.map((member) => {
            const student = students.find((row) => row.id === member.student_id) || {};
            return `<div class="member-row"><span>${window.escapeHtml(student.full_name || student.username || 'Student')}</span><button class="btn btn-secondary" data-remove-member="${window.escapeHtml(member.id)}">Remove</button></div>`;
          }).join('') : '<div class="empty-state" style="padding:1.5rem;">No students in this class yet.</div>'}
        </div>
      </div>
      <div class="detail-section">
        <h3>Assign test to class</h3>
        <div class="form-row">
          <select id="testPicker">
            <option value="">Select published test</option>
            ${tests.map((test) => `<option value="${window.escapeHtml(test.id)}">${window.escapeHtml(test.name)}</option>`).join('')}
          </select>
          <button class="btn btn-primary" id="assignTestBtn">Assign</button>
        </div>
        <input id="classDueAt" type="datetime-local" title="Optional due date">
      </div>`;
    document.getElementById('editClassBtn').addEventListener('click', () => openClassModal(item));
    document.getElementById('addMemberBtn').addEventListener('click', addMember);
    document.getElementById('assignTestBtn').addEventListener('click', assignTest);
    detail.querySelectorAll('[data-remove-member]').forEach((button) => {
      button.addEventListener('click', () => removeMember(button.dataset.removeMember));
    });
  }

  function openClassModal(item = null) {
    document.getElementById('classId').value = item?.id || '';
    document.getElementById('className').value = item?.name || '';
    document.getElementById('classDescription').value = item?.description || '';
    document.getElementById('classModalTitle').textContent = item ? 'Edit class' : 'New class';
    window.satAnimations.openModal('#classModal');
  }

  function closeClassModal() {
    window.satAnimations.closeModal('#classModal');
  }

  async function saveClass(event) {
    event.preventDefault();
    const button = document.getElementById('saveClassBtn');
    const id = document.getElementById('classId').value;
    const payload = {
      name: document.getElementById('className').value.trim(),
      description: document.getElementById('classDescription').value.trim() || null,
      teacher_id: context.profile.id,
    };
    if (!payload.name) return;
    window.satSetButtonLoading(button, true, 'Saving class');
    try {
      if (id) await window.satPatch(`classes?id=eq.${encodeURIComponent(id)}`, payload);
      else await window.satInsert('classes', payload);
      closeClassModal();
      await load();
    } finally {
      window.satSetButtonLoading(button, false);
    }
  }

  async function addMember() {
    const studentId = document.getElementById('studentPicker').value;
    if (!selectedClassId || !studentId) return;
    await window.satInsert('class_members', {
      class_id: selectedClassId,
      student_id: studentId,
      added_by: context.profile.id,
    });
    await load();
  }

  async function removeMember(memberId) {
    if (!memberId) return;
    await window.satDelete(`class_members?id=eq.${encodeURIComponent(memberId)}`);
    await load();
  }

  async function assignTest() {
    const testId = document.getElementById('testPicker').value;
    const dueValue = document.getElementById('classDueAt').value;
    if (!selectedClassId || !testId) return;
    await window.satInsert('test_assignments', {
      test_id: testId,
      class_id: selectedClassId,
      assigned_by: context.profile.id,
      due_at: dueValue ? new Date(dueValue).toISOString() : null,
    }, 'resolution=ignore-duplicates,return=minimal');
    await window.satPatch(
      `test_assignments?test_id=eq.${encodeURIComponent(testId)}&class_id=eq.${encodeURIComponent(selectedClassId)}`,
      { due_at: dueValue ? new Date(dueValue).toISOString() : null },
      'return=minimal'
    );
    alert('Assigned to class.');
  }

  async function load() {
    [classes, counts, students, members, tests] = await Promise.all([
      window.satRest('classes?is_archived=eq.false&select=*&order=created_at.desc'),
      window.satRest('class_member_counts?select=*'),
      window.satRest('profiles?role=eq.student&is_active=eq.true&select=id,full_name,username&order=full_name.asc'),
      window.satRest('class_members?select=*'),
      window.satRest('tests?status=eq.published&select=id,name&order=created_at.desc'),
    ]);
    renderClasses();
    renderDetail();
  }

  async function init() {
    context = await window.SAT_AUTH_READY;
    if (!context) return;
    document.getElementById('newClassBtn').addEventListener('click', () => openClassModal());
    document.getElementById('cancelClassBtn').addEventListener('click', closeClassModal);
    document.getElementById('classForm').addEventListener('submit', saveClass);
    try {
      await load();
    } catch (err) {
      console.error(err);
      document.getElementById('classGrid').innerHTML = '<div class="empty-state">Run migration 004 to enable Classes.</div>';
    }
  }

  init();
}());
