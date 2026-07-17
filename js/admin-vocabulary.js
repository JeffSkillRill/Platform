(function () {
  let context = null;
  let lists = [];
  let words = [];
  let classes = [];
  let activeListId = null;

  function parseCSV(value) {
    return String(value || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function wordsFor(listId) {
    return words.filter((word) => word.list_id === listId);
  }

  function className(classId) {
    if (!classId) return 'All students';
    return classes.find((item) => item.id === classId)?.name || 'Class';
  }

  function renderClassOptions() {
    const select = document.getElementById('listClass');
    select.innerHTML = '<option value="">All students</option>' + classes
      .map((item) => `<option value="${window.escapeHtml(item.id)}">${window.escapeHtml(item.name)}</option>`)
      .join('');
  }

  function render() {
    const app = document.getElementById('adminVocabApp');
    if (!lists.length) {
      app.innerHTML = '<div class="empty-state">No vocabulary lists yet. Create the first list.</div>';
      return;
    }

    if (!activeListId || !lists.some((list) => list.id === activeListId)) {
      activeListId = lists[0].id;
    }

    const activeList = lists.find((list) => list.id === activeListId);
    const activeWords = wordsFor(activeListId);

    app.innerHTML = `
      <div class="vocab-grid">
        <section class="card">
          <h2>Admin Lists</h2>
          ${lists.map((list) => {
            const count = wordsFor(list.id).length;
            return `
              <div class="list-row ${list.id === activeListId ? 'active' : ''}">
                <button type="button" class="list-main" data-select-list="${window.escapeHtml(list.id)}">
                  <strong>${window.escapeHtml(list.title)}</strong>
                  <span>${window.escapeHtml(list.description || className(list.class_id))}</span>
                </button>
                <div class="list-actions">
                  <span class="tag ${list.class_id ? 'yellow' : 'blue'}">${window.escapeHtml(className(list.class_id))}</span>
                  <span class="tag green">${count} words</span>
                  <button class="btn btn-secondary" type="button" data-edit-list="${window.escapeHtml(list.id)}">Edit</button>
                  <button class="btn btn-secondary" type="button" data-delete-list="${window.escapeHtml(list.id)}">Delete</button>
                </div>
              </div>`;
          }).join('')}
        </section>
        <section class="card">
          <div style="display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;">
            <div>
              <h2>${window.escapeHtml(activeList.title)}</h2>
              <p style="color:var(--text-muted);margin:.35rem 0 0;">${window.escapeHtml(activeList.description || 'No description.')}</p>
            </div>
            <button class="btn btn-primary" id="addAdminWordBtn" type="button">Add word</button>
          </div>
          <div class="word-admin-list">
            ${activeWords.length ? activeWords.map(renderWordRow).join('') : '<div class="empty-state" style="margin-top:1rem;">No words in this list yet.</div>'}
          </div>
        </section>
      </div>`;

    app.querySelectorAll('[data-select-list]').forEach((button) => {
      button.addEventListener('click', () => {
        activeListId = button.dataset.selectList;
        render();
      });
    });
    app.querySelectorAll('[data-edit-list]').forEach((button) => {
      button.addEventListener('click', () => openListModal(lists.find((list) => list.id === button.dataset.editList)));
    });
    app.querySelectorAll('[data-delete-list]').forEach((button) => {
      button.addEventListener('click', () => deleteList(button.dataset.deleteList));
    });
    app.querySelectorAll('[data-edit-word]').forEach((button) => {
      button.addEventListener('click', () => openWordModal(words.find((word) => word.id === button.dataset.editWord)));
    });
    app.querySelectorAll('[data-delete-word]').forEach((button) => {
      button.addEventListener('click', () => deleteWord(button.dataset.deleteWord));
    });
    document.getElementById('addAdminWordBtn').addEventListener('click', () => openWordModal());
  }

  function renderWordRow(word) {
    const synonyms = window.parseJson(word.synonyms, []);
    const antonyms = window.parseJson(word.antonyms, []);
    return `
      <div class="word-admin-row">
        <div>
          <strong>${window.escapeHtml(word.word)}</strong>
          <p>${window.escapeHtml(word.definition)}</p>
          <div class="chip-row">
            ${synonyms.map((item) => `<span class="tag blue">${window.escapeHtml(item)}</span>`).join('')}
            ${antonyms.map((item) => `<span class="tag yellow">${window.escapeHtml(item)}</span>`).join('')}
          </div>
        </div>
        <div class="word-actions">
          <button class="btn btn-secondary" type="button" data-edit-word="${window.escapeHtml(word.id)}">Edit</button>
          <button class="btn btn-secondary" type="button" data-delete-word="${window.escapeHtml(word.id)}">Delete</button>
        </div>
      </div>`;
  }

  function openListModal(list = null) {
    document.getElementById('listForm').reset();
    document.getElementById('listId').value = list?.id || '';
    document.getElementById('listTitle').value = list?.title || '';
    document.getElementById('listDescription').value = list?.description || '';
    document.getElementById('listClass').value = list?.class_id || '';
    window.satAnimations.openModal('#listModal');
  }

  function closeListModal() {
    window.satAnimations.closeModal('#listModal');
  }

  function openWordModal(word = null) {
    const listId = word?.list_id || activeListId;
    if (!listId) return;
    document.getElementById('adminWordForm').reset();
    document.getElementById('adminWordId').value = word?.id || '';
    document.getElementById('adminWordListId').value = listId;
    document.getElementById('adminWordInput').value = word?.word || '';
    document.getElementById('adminDefinitionInput').value = word?.definition || '';
    document.getElementById('adminSynonymsInput').value = window.parseJson(word?.synonyms, []).join(', ');
    document.getElementById('adminAntonymsInput').value = window.parseJson(word?.antonyms, []).join(', ');
    document.getElementById('adminExampleInput').value = word?.example || '';
    window.satAnimations.openModal('#adminWordModal');
  }

  function closeWordModal() {
    window.satAnimations.closeModal('#adminWordModal');
  }

  async function saveList(event) {
    event.preventDefault();
    const button = document.getElementById('saveListBtn');
    const id = document.getElementById('listId').value;
    const payload = {
      title: document.getElementById('listTitle').value.trim(),
      description: document.getElementById('listDescription').value.trim() || null,
      owner_id: context.profile.id,
      scope: 'admin',
      class_id: document.getElementById('listClass').value || null,
    };
    if (!payload.title) return;
    window.satSetButtonLoading(button, true, 'Saving list');
    try {
      if (id) await window.satPatch(`vocab_lists?id=eq.${encodeURIComponent(id)}`, payload);
      else {
        const created = await window.satInsert('vocab_lists', payload);
        activeListId = created[0]?.id || activeListId;
      }
      closeListModal();
      await load();
    } finally {
      window.satSetButtonLoading(button, false);
    }
  }

  async function saveWord(event) {
    event.preventDefault();
    const button = document.getElementById('saveAdminWordBtn');
    const id = document.getElementById('adminWordId').value;
    const payload = {
      list_id: document.getElementById('adminWordListId').value,
      word: document.getElementById('adminWordInput').value.trim(),
      definition: document.getElementById('adminDefinitionInput').value.trim(),
      synonyms: parseCSV(document.getElementById('adminSynonymsInput').value),
      antonyms: parseCSV(document.getElementById('adminAntonymsInput').value),
      example: document.getElementById('adminExampleInput').value.trim() || null,
    };
    if (!payload.list_id || !payload.word || !payload.definition) return;
    window.satSetButtonLoading(button, true, 'Saving word');
    try {
      if (id) await window.satPatch(`vocab_words?id=eq.${encodeURIComponent(id)}`, payload);
      else await window.satInsert('vocab_words', payload);
      closeWordModal();
      await load();
    } finally {
      window.satSetButtonLoading(button, false);
    }
  }

  async function deleteList(listId) {
    if (!confirm('Delete this vocabulary list and all its words?')) return;
    await window.satDelete(`vocab_lists?id=eq.${encodeURIComponent(listId)}`);
    if (activeListId === listId) activeListId = null;
    await load();
  }

  async function deleteWord(wordId) {
    if (!confirm('Delete this word?')) return;
    await window.satDelete(`vocab_words?id=eq.${encodeURIComponent(wordId)}`);
    await load();
  }

  async function load() {
    [lists, words, classes] = await Promise.all([
      window.satRest('vocab_lists?scope=eq.admin&select=*&order=created_at.desc'),
      window.satRest('vocab_words?select=*&order=created_at.desc'),
      window.satRest('classes?is_archived=eq.false&select=id,name&order=name.asc').catch(() => []),
    ]);
    renderClassOptions();
    render();
  }

  async function init() {
    context = await window.SAT_AUTH_READY;
    if (!context) return;
    document.getElementById('newListBtn').addEventListener('click', () => openListModal());
    document.getElementById('cancelListBtn').addEventListener('click', closeListModal);
    document.getElementById('listForm').addEventListener('submit', saveList);
    document.getElementById('cancelAdminWordBtn').addEventListener('click', closeWordModal);
    document.getElementById('adminWordForm').addEventListener('submit', saveWord);
    try {
      await load();
    } catch (err) {
      console.error(err);
      document.getElementById('adminVocabApp').innerHTML = '<div class="empty-state">Run migration 006 to enable Vocabulary.</div>';
    }
  }

  init();
}());
