(function () {
  let context = null;
  let lists = [];
  let words = [];
  let personalList = null;
  let activeList = null;
  let flashIndex = 0;
  let flashFlipped = false;
  let quiz = null;

  function parseCSV(value) {
    return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
  }

  function wordsFor(listId) {
    const query = document.getElementById('vocabSearch')?.value?.toLowerCase() || '';
    return words.filter((word) => word.list_id === listId && (
      !query ||
      word.word.toLowerCase().includes(query) ||
      word.definition.toLowerCase().includes(query)
    ));
  }

  async function ensurePersonalList() {
    if (personalList) return personalList;
    const created = await window.satInsert('vocab_lists', {
      title: 'My Vocabulary',
      description: 'Personal words',
      owner_id: context.profile.id,
      scope: 'personal',
    });
    personalList = created[0];
    lists.unshift(personalList);
    return personalList;
  }

  function renderHome() {
    activeList = null;
    const adminLists = lists.filter((list) => list.scope === 'admin' && list.owner_id !== context.profile.id);
    const mine = lists.filter((list) => list.owner_id === context.profile.id);
    const app = document.getElementById('vocabApp');
    app.innerHTML = `
      <div class="vocab-grid">
        <section class="card">
          <h2>Offered by Admins</h2>
          ${adminLists.length ? adminLists.map(renderListRow).join('') : '<div class="empty-state">No teacher vocabulary lists yet.</div>'}
        </section>
        <section class="card">
          <h2>My Vocabulary (${mine.reduce((sum, list) => sum + wordsFor(list.id).length, 0)})</h2>
          ${mine.length ? mine.map(renderListRow).join('') : '<div class="empty-state"><strong>Your Vocabulary is Empty</strong><br><span>Add your first word with the + button.</span></div>'}
        </section>
      </div>`;
    app.querySelectorAll('[data-open-list]').forEach((button) => {
      button.addEventListener('click', () => openList(button.dataset.openList));
    });
  }

  function renderListRow(list) {
    const count = words.filter((word) => word.list_id === list.id).length;
    return `
      <div class="list-row">
        <div><strong>${window.escapeHtml(list.title)}</strong><div style="color:var(--text-muted);">${window.escapeHtml(list.description || '')}</div></div>
        <div style="display:flex;gap:.5rem;align-items:center;"><span class="tag blue">${count} words</span><button class="btn btn-primary" data-open-list="${window.escapeHtml(list.id)}">Study</button></div>
      </div>`;
  }

  function openList(listId) {
    activeList = lists.find((list) => list.id === listId);
    const listWords = wordsFor(listId);
    document.getElementById('vocabApp').innerHTML = `
      <section class="card">
        <button class="btn btn-secondary" id="backToVocabBtn">Back</button>
        <div class="page-head" style="margin-top:1rem;"><h1>${window.escapeHtml(activeList.title)}</h1><p>${window.formatShortDate(activeList.created_at)} · ${activeList.scope === 'admin' ? 'Admin List' : 'Personal List'} · ${listWords.length} words</p></div>
        <div style="display:flex;gap:.6rem;flex-wrap:wrap;"><button class="btn btn-secondary" id="flashBtn">Practice Flashcards</button><button class="btn btn-primary" id="quizBtn">Take Quiz</button></div>
        ${listWords.length ? `<div class="word-grid">${listWords.map(renderWordCard).join('')}</div>` : '<div class="empty-state" style="margin-top:1rem;">No matching words.</div>'}
      </section>`;
    document.getElementById('backToVocabBtn').addEventListener('click', renderHome);
    document.getElementById('flashBtn').addEventListener('click', startFlashcards);
    document.getElementById('quizBtn').addEventListener('click', startQuiz);
  }

  function renderWordCard(word) {
    const syns = window.parseJson(word.synonyms, []);
    const ants = window.parseJson(word.antonyms, []);
    return `<article class="card word-card">
      <h3>${window.escapeHtml(word.word)}</h3>
      <p><strong>Definition</strong><br>${window.escapeHtml(word.definition)}</p>
      ${syns.length ? `<div class="chip-row"><strong>Synonyms</strong>${syns.map((s) => `<span class="tag blue">${window.escapeHtml(s)}</span>`).join('')}</div>` : ''}
      ${ants.length ? `<div class="chip-row"><strong>Antonyms</strong>${ants.map((s) => `<span class="tag yellow">${window.escapeHtml(s)}</span>`).join('')}</div>` : ''}
    </article>`;
  }

  function startFlashcards() {
    flashIndex = 0;
    flashFlipped = false;
    renderFlashcard();
  }

  function renderFlashcard() {
    const listWords = wordsFor(activeList.id);
    const word = listWords[flashIndex];
    if (!word) return openList(activeList.id);
    document.getElementById('vocabApp').innerHTML = `
      <section class="card">
        <button class="btn btn-secondary" id="backListBtn">Back</button>
        <div class="flashcard" id="flashcard">${flashFlipped ? `<div><strong>${window.escapeHtml(word.definition)}</strong><p>${window.escapeHtml(word.example || '')}</p></div>` : `<strong>${window.escapeHtml(word.word)}</strong>`}</div>
        <div style="display:flex;gap:.75rem;"><button class="btn btn-secondary" id="againBtn">Again</button><button class="btn btn-primary" id="goodBtn">Good</button></div>
      </section>`;
    document.getElementById('backListBtn').addEventListener('click', () => openList(activeList.id));
    document.getElementById('flashcard').addEventListener('click', () => { flashFlipped = !flashFlipped; renderFlashcard(); });
    document.getElementById('againBtn').addEventListener('click', () => updateProgress(word.id, 'learning', 0));
    document.getElementById('goodBtn').addEventListener('click', () => updateProgress(word.id, 'known', 1));
  }

  async function updateProgress(wordId, status, increment) {
    await window.satRest('vocab_progress?on_conflict=student_id,word_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: {
        student_id: context.profile.id,
        word_id: wordId,
        status,
        last_reviewed_at: new Date().toISOString(),
        correct_streak: increment,
      },
    });
    flashIndex += 1;
    flashFlipped = false;
    renderFlashcard();
  }

  function startQuiz() {
    const pool = wordsFor(activeList.id).sort(() => Math.random() - 0.5);
    quiz = { items: pool.slice(0, 10), index: 0, correct: 0 };
    if (!quiz.items.length) return alert('No words to quiz.');
    renderQuiz();
  }

  function renderQuiz() {
    const item = quiz.items[quiz.index];
    if (!item) {
      document.getElementById('vocabApp').innerHTML = `<section class="card"><h2>Quiz complete</h2><div class="stat-box"><div class="stat-box-label">Score</div><div class="stat-box-value">${quiz.correct}/${quiz.items.length}</div></div><button class="btn btn-primary" id="quizDoneBtn">Back to list</button></section>`;
      document.getElementById('quizDoneBtn').addEventListener('click', () => openList(activeList.id));
      return;
    }
    const distractors = wordsFor(activeList.id).filter((w) => w.id !== item.id).sort(() => Math.random() - 0.5).slice(0, 3);
    const options = [item, ...distractors].sort(() => Math.random() - 0.5);
    document.getElementById('vocabApp').innerHTML = `<section class="card"><div class="tag blue">Question ${quiz.index + 1}/${quiz.items.length}</div><h2 style="margin-top:1rem;">${window.escapeHtml(item.word)}</h2>${options.map((option) => `<button class="quiz-choice" data-answer="${option.id}">${window.escapeHtml(option.definition)}</button>`).join('')}</section>`;
    document.querySelectorAll('[data-answer]').forEach((button) => {
      button.addEventListener('click', async () => {
        if (button.dataset.answer === item.id) quiz.correct += 1;
        await window.satRest('vocab_progress?on_conflict=student_id,word_id', {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: { student_id: context.profile.id, word_id: item.id, status: button.dataset.answer === item.id ? 'known' : 'learning', last_reviewed_at: new Date().toISOString(), correct_streak: button.dataset.answer === item.id ? 1 : 0 },
        });
        quiz.index += 1;
        renderQuiz();
      });
    });
  }

  function openWordModal() {
    document.getElementById('wordForm').reset();
    document.getElementById('wordModal').classList.add('open');
  }

  function closeWordModal() {
    document.getElementById('wordModal').classList.remove('open');
  }

  async function saveWord(event) {
    event.preventDefault();
    const list = await ensurePersonalList();
    await window.satInsert('vocab_words', {
      list_id: list.id,
      word: document.getElementById('wordInput').value.trim(),
      definition: document.getElementById('definitionInput').value.trim(),
      synonyms: parseCSV(document.getElementById('synonymsInput').value),
      antonyms: parseCSV(document.getElementById('antonymsInput').value),
      example: document.getElementById('exampleInput').value.trim() || null,
    });
    closeWordModal();
    await load();
  }

  async function load() {
    [lists, words] = await Promise.all([
      window.satRest('vocab_lists?select=*&order=created_at.desc'),
      window.satRest('vocab_words?select=*&order=created_at.desc'),
    ]);
    personalList = lists.find((list) => list.owner_id === context.profile.id && list.scope === 'personal') || null;
    renderHome();
  }

  async function init() {
    context = await window.SAT_AUTH_READY;
    if (!context) return;
    window.satSetSidebarUser(context.profile, { name: ['vocabName'], avatar: ['vocabAvatar'] });
    document.getElementById('quickAddWordBtn').addEventListener('click', openWordModal);
    document.getElementById('cancelWordBtn').addEventListener('click', closeWordModal);
    document.getElementById('wordForm').addEventListener('submit', saveWord);
    document.getElementById('vocabSearch').addEventListener('input', () => activeList ? openList(activeList.id) : renderHome());
    try { await load(); } catch (err) {
      console.error(err);
      document.getElementById('vocabApp').innerHTML = '<div class="empty-state">Run migration 006 to enable Vocabulary.</div>';
    }
  }

  init();
}());
