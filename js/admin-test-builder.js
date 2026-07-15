    // ================================================================
    // DATA STRUCTURE
    // questions are now stored per module, not in one flat array:
    // moduleQuestions = {
    //   rw1:   [ {id, module:'rw1',  difficulty, stem, image, choices, correct}, ... ],
    //   rw2:   [ ... ],
    //   math1: [ ... ],
    //   math2: [ ... ],
    // }
    // ================================================================

    const MODULE_CONFIG = {
      rw1:   { label:'R&W — Module 1',  section:'rw',   cap:27, time:'32 min', tabId:'tab-rw1'   },
      rw2:   { label:'R&W — Module 2',  section:'rw',   cap:27, time:'32 min', tabId:'tab-rw2'   },
      math1: { label:'Math — Module 3', section:'math', cap:22, time:'35 min', tabId:'tab-math1' },
      math2: { label:'Math — Module 4', section:'math', cap:22, time:'35 min', tabId:'tab-math2' },
    };

    let moduleQuestions = { rw1:[], rw2:[], math1:[], math2:[] };
    let activeTab       = 'rw1';    // which module tab is showing
    let currentQIndex   = null;     // index within activeTab's array
    let correctAnswer   = null;

    const LETTERS = ['A','B','C','D'];

    // ---- Flat list of all questions (for publish) ----
    function allQuestions() {
      return [
        ...moduleQuestions.rw1,
        ...moduleQuestions.rw2,
        ...moduleQuestions.math1,
        ...moduleQuestions.math2,
      ];
    }

    const params = new URLSearchParams(window.location.search);
    let context = null;
    let editingTestId = params.get('id');
    let originalStatus = 'draft';
    let classOptions = [];

    function toDatetimeLocal(value) {
      if (!value) return '';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '';
      const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
      return shifted.toISOString().slice(0, 16);
    }

    function dueAtIso() {
      const value = document.getElementById('dueDateInput')?.value;
      return value ? new Date(value).toISOString() : null;
    }

    // ---- Load saved draft or existing DB test ----
    async function loadDraft() {
      classOptions = await window.satRest('classes?is_archived=eq.false&select=id,name&order=name.asc').catch(() => []);
      const classSelect = document.getElementById('assignClassSelect');
      if (classSelect) {
        classSelect.innerHTML = '<option value="">Assign to all students</option>' + classOptions
          .map((item) => `<option value="${window.escapeHtml(item.id)}">${window.escapeHtml(item.name)}</option>`)
          .join('');
      }

      if (editingTestId) {
        const testRows = await window.satRest(`tests?id=eq.${encodeURIComponent(editingTestId)}&select=*`);
        const test = testRows[0];
        if (!test) throw new Error('Test not found.');
        originalStatus = test.status || 'draft';
        document.getElementById('testNameInput').value = test.name || '';
        const assignmentRows = await window.satRest(`test_assignments?test_id=eq.${encodeURIComponent(editingTestId)}&select=due_at,class_id`);
        const selectedAssignment = assignmentRows.find((row) => row.class_id) || assignmentRows[0];
        document.getElementById('dueDateInput').value = toDatetimeLocal(selectedAssignment?.due_at);
        if (classSelect) classSelect.value = selectedAssignment?.class_id || '';

        const questions = await window.satRest(`admin_questions?test_id=eq.${encodeURIComponent(editingTestId)}&select=*&order=module_key.asc,order_num.asc`);
        moduleQuestions = { rw1:[], rw2:[], math1:[], math2:[] };
        questions.forEach((question) => {
          const key = question.module_key;
          if (!moduleQuestions[key]) return;
          moduleQuestions[key].push({
            id: question.id,
            module: key,
            difficulty: question.difficulty || 'medium',
            stem: question.stem || '',
            image: question.image_url || null,
            choices: window.parseJson(question.choices, ['', '', '', '']),
            correct: question.correct,
            answerType: question.answer_type || 'mcq',
            answerText: question.answer_text || '',
            topic: question.topic || null,
            explanation: question.explanation || null,
          });
        });
        return;
      }

      const saved = localStorage.getItem('sat_draft_test_new') || localStorage.getItem('sat_draft_test');
      if (saved) {
        const data = JSON.parse(saved);
        moduleQuestions = data.moduleQuestions || { rw1:[], rw2:[], math1:[], math2:[] };
        document.getElementById('testNameInput').value = data.name || '';
        document.getElementById('dueDateInput').value = data.dueAt ? toDatetimeLocal(data.dueAt) : '';
        if (classSelect) classSelect.value = data.classId || '';
      }
    }

    // ---- Save draft ----
    function saveDraft() {
      const name = document.getElementById('testNameInput').value.trim();
      if (!name) { showToast('Please enter a test name first.'); return; }
      if (currentQIndex !== null) collectCurrentForm();
      const key = editingTestId ? `sat_draft_test_${editingTestId}` : 'sat_draft_test_new';
      localStorage.setItem(key, JSON.stringify({
        name,
        moduleQuestions,
        dueAt: dueAtIso(),
        classId: document.getElementById('assignClassSelect')?.value || '',
      }));
      showToast('Draft saved locally ✓');
    }

    // ---- Publish to Supabase ----
    async function publishTest() {
      const name = document.getElementById('testNameInput').value.trim();
      if (!name) { showToast('Please enter a test name first.'); return; }
      if (currentQIndex !== null) collectCurrentForm();
      const all = allQuestions();
      const dueAt = dueAtIso();
      const classId = document.getElementById('assignClassSelect')?.value || '';
      if (all.length === 0) { showToast('Add at least one question before publishing.'); return; }

      const incomplete = all.filter((q) => {
        const type = q.answerType || 'mcq';
        if (!q.stem.trim()) return true;
        if (type === 'spr') return !String(q.answerText || '').trim();
        return !Array.isArray(q.choices) || q.choices.some((c) => !c.trim()) || q.correct === null;
      });
      if (incomplete.length > 0) {
        showToast(`${incomplete.length} question(s) are incomplete.`); return;
      }

      const btn = document.querySelector('.btn-primary');
      btn.disabled = true; btn.textContent = 'Publishing…';

      try {
        let testId = editingTestId;
        if (testId) {
          await window.satPatch(`tests?id=eq.${encodeURIComponent(testId)}`, {
            name,
            status: 'draft',
            updated_at: new Date().toISOString(),
          });
          await window.satDelete(`questions?test_id=eq.${encodeURIComponent(testId)}`);
        } else {
          const [created] = await window.satInsert('tests', {
            name,
            status: 'draft',
            created_by: context.profile.id,
          });
          testId = created.id;
          editingTestId = testId;
        }

        const questionRows = [];
        let orderNum = 0;
        Object.entries(moduleQuestions).forEach(([modKey, qs]) => {
          const cfg = MODULE_CONFIG[modKey];
          qs.forEach((q) => {
            questionRows.push({
              test_id:    testId,
              section:    cfg.section,
              module_key: modKey,
              difficulty: q.difficulty,
              stem:       q.stem,
              image_url:  q.image || null,
              choices:    (q.answerType || 'mcq') === 'spr' ? [] : q.choices,
              correct:    (q.answerType || 'mcq') === 'spr' ? null : q.correct,
              answer_type:(q.answerType || 'mcq'),
              answer_text:(q.answerType || 'mcq') === 'spr' ? String(q.answerText || '').trim() : null,
              topic:      q.topic || null,
              explanation:q.explanation || null,
              order_num:  orderNum++,
            });
          });
        });

        await window.satInsert('questions', questionRows);
        await window.satDelete(`test_assignments?test_id=eq.${encodeURIComponent(testId)}`);
        if (classId) {
          await window.satInsert('test_assignments', {
            test_id: testId,
            class_id: classId,
            assigned_by: context.profile.id,
            due_at: dueAt,
          }, 'return=minimal');
        } else {
          const students = await window.satRest('profiles?role=eq.student&is_active=eq.true&select=id');
          if (students.length) {
            await window.satRest('test_assignments', {
              method: 'POST',
              headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
              body: students.map((student) => ({
                test_id: testId,
                student_id: student.id,
                assigned_by: context.profile.id,
                due_at: dueAt,
              })),
            });
          }
        }
        await window.satPatch(`tests?id=eq.${encodeURIComponent(testId)}`, {
          name,
          status: 'published',
          updated_at: new Date().toISOString(),
        });

        localStorage.removeItem(`sat_draft_test_${testId}`);
        localStorage.removeItem('sat_draft_test_new');
        localStorage.removeItem('sat_draft_test');
        showToast(`"${name}" published — ${all.length} questions saved ✓`);
        setTimeout(() => { window.location.href = 'admin-tests.html'; }, 1800);

      } catch(err) {
        showToast(`Failed to publish. Test stayed as ${editingTestId ? 'draft' : originalStatus}.`);
        console.error(err);
        btn.disabled = false; btn.textContent = 'Publish test';
      }
    }

    // ---- Switch module tab ----
    function switchTab(tab) {
      if (currentQIndex !== null) collectCurrentForm();
      activeTab     = tab;
      currentQIndex = null;

      // Update tab styles
      Object.keys(MODULE_CONFIG).forEach(key => {
        const el = document.getElementById('tab-' + key);
        if (!el) return;
        const isActive = key === tab;
        el.style.color        = isActive ? 'var(--teal-darker)' : 'var(--text-muted)';
        el.style.borderBottom = isActive ? '2px solid var(--teal)' : '2px solid transparent';
        el.style.background   = isActive ? 'var(--teal-light)' : 'none';
      });

      // Hide form, show empty or last question
      document.getElementById('emptyState').style.display    = 'flex';
      document.getElementById('questionForm').style.display  = 'none';

      renderList();
      updateAddButton();
    }

    // ---- Check if current module is at cap ----
    function isAtCap(modKey) {
      const cfg = MODULE_CONFIG[modKey];
      return moduleQuestions[modKey].length >= cfg.cap;
    }

    // ---- Update add button state ----
    function updateAddButton() {
      const btn     = document.getElementById('addQBtn');
      const warnEl  = document.getElementById('limitWarning');
      const cfg     = MODULE_CONFIG[activeTab];
      const count   = moduleQuestions[activeTab].length;
      const at_cap  = count >= cfg.cap;

      btn.disabled      = at_cap;
      btn.style.opacity = at_cap ? '0.4' : '1';
      btn.style.cursor  = at_cap ? 'not-allowed' : 'pointer';

      if (at_cap) {
        warnEl.style.display = 'block';
        warnEl.textContent   = `Module full: ${cfg.cap}/${cfg.cap} questions reached. Switch to another module.`;
      } else {
        warnEl.style.display = 'none';
      }
    }

    // ---- Create new question in active module ----
    function newQuestion() {
      if (isAtCap(activeTab)) {
        showToast(`This module is full (${MODULE_CONFIG[activeTab].cap} questions max).`);
        return;
      }
      if (currentQIndex !== null) collectCurrentForm();

      const q = {
        id:         'q_' + Date.now(),
        module:     activeTab,
        difficulty: 'medium',
        stem:       '',
        image:      null,
        choices:    ['','','',''],
        correct:    null,
        answerType: 'mcq',
        answerText: '',
      };

      moduleQuestions[activeTab].push(q);
      currentQIndex = moduleQuestions[activeTab].length - 1;
      renderList();
      updateEstimator();
      loadQuestionIntoForm(currentQIndex);
    }

    // ---- Load question into form ----
    function loadQuestionIntoForm(idx) {
      const q = moduleQuestions[activeTab][idx];
      if (!q) return;

      currentQIndex = idx;
      correctAnswer = q.correct;
      const cfg     = MODULE_CONFIG[activeTab];

      document.getElementById('emptyState').style.display   = 'none';
      document.getElementById('questionForm').style.display = 'block';

      document.getElementById('formHeadTitle').textContent = `Question ${idx + 1}`;
      document.getElementById('formHeadSub').textContent   = `${cfg.label} — ${cfg.time}`;
      document.getElementById('qModuleDisplay').textContent = cfg.label;
      document.getElementById('qDifficulty').value          = q.difficulty;
      document.getElementById('qAnswerType').value          = q.answerType || 'mcq';
      document.getElementById('qAnswerText').value          = q.answerText || '';
      document.getElementById('qStem').value                = q.stem;
      updateAnswerTypeUI(q.answerType || 'mcq');

      // Image
      const preview = document.getElementById('imgPreview');
      const zone    = document.getElementById('uploadZone');
      if (q.image) {
        document.getElementById('previewImg').src = q.image;
        preview.style.display = 'block'; zone.style.display = 'none';
      } else {
        preview.style.display = 'none'; zone.style.display = 'block';
      }

      renderChoices(q.choices || ['', '', '', ''], q.correct);

      // Nav counters
      const modQs = moduleQuestions[activeTab];
      document.getElementById('navCurrent').textContent = idx + 1;
      document.getElementById('navTotal').textContent   = modQs.length;
      document.getElementById('btnPrev').disabled       = idx === 0;

      // Highlight chip
      document.querySelectorAll('.q-chip').forEach(c => c.classList.remove('active'));
      document.querySelectorAll('.q-chip').forEach(c => {
        if (c.dataset.qid === q.id) c.classList.add('active');
      });
    }

    // ---- Answer type UI ----
    function updateAnswerTypeUI(type) {
      const isSpr = type === 'spr';
      const choicesCard = document.getElementById('choicesCard');
      const sprCard = document.getElementById('sprAnswersCard');
      if (choicesCard) choicesCard.style.display = isSpr ? 'none' : 'block';
      if (sprCard) sprCard.style.display = isSpr ? 'block' : 'none';
      if (isSpr) {
        correctAnswer = null;
      } else if (currentQIndex !== null) {
        correctAnswer = moduleQuestions[activeTab][currentQIndex]?.correct ?? null;
        updateCorrectHint(correctAnswer);
      }
    }

    function setAnswerType(type) {
      if (currentQIndex !== null) {
        const q = moduleQuestions[activeTab][currentQIndex];
        if (q) {
          q.answerType = type === 'spr' ? 'spr' : 'mcq';
          if (q.answerType === 'spr') q.correct = null;
        }
      }
      updateAnswerTypeUI(type === 'spr' ? 'spr' : 'mcq');
      renderList();
    }

    // ---- Render choice inputs ----
    function renderChoices(choices, correct) {
      const grid = document.getElementById('choicesGrid');
      grid.innerHTML = LETTERS.map((letter, i) => `
        <div class="choice-wrap ${correct === i ? 'correct' : ''}" id="choiceWrap${i}">
          <div class="choice-letter" onclick="setCorrect(${i})">${letter}</div>
          <div class="choice-input">
            <input type="text" id="choice${i}" placeholder="Choice ${letter}" value="${escHtml(choices[i]||'')}" />
          </div>
        </div>`).join('');
      updateCorrectHint(correct);
    }

    function escHtml(str) {
      return window.escapeHtml(str);
    }

    function setCorrect(idx) {
      correctAnswer = idx;
      LETTERS.forEach((_,i) => {
        document.getElementById('choiceWrap'+i).classList.toggle('correct', i===idx);
      });
      updateCorrectHint(idx);
    }

    function updateCorrectHint(correct) {
      const hint = document.getElementById('correctHintText');
      if (correct === null || correct === undefined) {
        hint.textContent = 'No correct answer selected. Click a letter circle to mark it.';
        hint.style.color = 'var(--amber)';
      } else {
        hint.textContent = `Correct answer: Choice ${LETTERS[correct]}`;
        hint.style.color = 'var(--green)';
      }
    }

    // ---- Collect current form into moduleQuestions ----
    function collectCurrentForm() {
      if (currentQIndex === null) return;
      const q = moduleQuestions[activeTab][currentQIndex];
      if (!q) return;
      q.difficulty = document.getElementById('qDifficulty').value;
      q.answerType = document.getElementById('qAnswerType').value === 'spr' ? 'spr' : 'mcq';
      q.stem       = document.getElementById('qStem').value;
      q.answerText = document.getElementById('qAnswerText').value || '';
      q.correct    = q.answerType === 'spr' ? null : correctAnswer;
      q.choices    = LETTERS.map((_,i) => document.getElementById('choice'+i)?.value || '');
    }

    // ---- Navigate within module ----
    function saveAndNext() {
      collectCurrentForm();
      renderList();
      const modQs = moduleQuestions[activeTab];
      if (currentQIndex < modQs.length - 1) {
        loadQuestionIntoForm(currentQIndex + 1);
      } else {
        if (isAtCap(activeTab)) {
          showToast(`Module full (${MODULE_CONFIG[activeTab].cap} questions). Switch to next module to continue.`);
        } else {
          newQuestion();
        }
      }
    }

    function prevQuestion() {
      if (currentQIndex > 0) {
        collectCurrentForm();
        renderList();
        loadQuestionIntoForm(currentQIndex - 1);
      }
    }

    // ---- Delete current question ----
    function deleteCurrentQuestion() {
      if (currentQIndex === null) return;
      if (!confirm('Delete this question?')) return;
      moduleQuestions[activeTab].splice(currentQIndex, 1);
      renderList();
      updateEstimator();
      updateAddButton();
      const modQs = moduleQuestions[activeTab];
      if (modQs.length === 0) {
        currentQIndex = null;
        document.getElementById('emptyState').style.display  = 'flex';
        document.getElementById('questionForm').style.display = 'none';
      } else {
        loadQuestionIntoForm(Math.min(currentQIndex, modQs.length - 1));
      }
    }

    // ---- Delete from chip list ----
    function deleteQuestion(idx) {
      if (!confirm('Delete this question?')) return;
      moduleQuestions[activeTab].splice(idx, 1);
      if (currentQIndex === idx) {
        currentQIndex = null;
        const modQs = moduleQuestions[activeTab];
        if (modQs.length > 0) loadQuestionIntoForm(Math.max(0, idx-1));
        else {
          document.getElementById('emptyState').style.display  = 'flex';
          document.getElementById('questionForm').style.display = 'none';
        }
      } else if (currentQIndex !== null && currentQIndex > idx) {
        currentQIndex--;
      }
      renderList();
      updateEstimator();
      updateAddButton();
    }

    // ---- Select question from chip ----
    function selectQuestion(idx) {
      if (currentQIndex !== null) collectCurrentForm();
      loadQuestionIntoForm(idx);
    }

    // ---- Render chip list for active module ----
    function renderList() {
      const list   = document.getElementById('qList');
      const modQs  = moduleQuestions[activeTab];
      const cfg    = MODULE_CONFIG[activeTab];

      // Update all tab counts
      Object.keys(MODULE_CONFIG).forEach(key => {
        const countEl = document.getElementById('count-' + key);
        if (countEl) {
          const count = moduleQuestions[key].length;
          const cap   = MODULE_CONFIG[key].cap;
          countEl.textContent = `${count} / ${cap}`;
          countEl.style.color = count >= cap ? 'var(--green)' : count > 0 ? 'var(--amber)' : 'var(--text-faint)';
        }
      });

      if (modQs.length === 0) {
        list.innerHTML = `
          <div class="q-empty">
            No questions in ${cfg.label} yet.<br>
            <span style="color:var(--teal-darker);font-weight:600;">Limit: ${cfg.cap} questions · ${cfg.time}</span>
          </div>`;
        return;
      }

      list.innerHTML = modQs.map((q, i) => {
        const isActive = i === currentQIndex;
        const preview  = q.stem.trim() ? q.stem.slice(0,46) + (q.stem.length > 46 ? '…':'') : 'Empty question';
        return `
          <div class="q-chip ${isActive?'active':''}" onclick="selectQuestion(${i})" data-qid="${q.id}">
            <div class="q-num">${i+1}</div>
            <div class="q-chip-text">${window.escapeHtml(preview)}</div>
            <span class="q-type">${(q.answerType || 'mcq').toUpperCase()}</span>
            <span class="q-diff ${window.escapeHtml(q.difficulty)}">${window.escapeHtml(q.difficulty[0].toUpperCase())}</span>
            <button class="q-delete" onclick="event.stopPropagation();deleteQuestion(${i})" title="Delete">
              <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>`;
      }).join('');
    }

    // ---- Update estimator panel ----
    const MOD_TARGETS = [
      { key:'rw1',   label:'R&W Mod 1',  target:27 },
      { key:'rw2',   label:'R&W Mod 2',  target:27 },
      { key:'math1', label:'Math Mod 3', target:22 },
      { key:'math2', label:'Math Mod 4', target:22 },
    ];

    function updateEstimator() {
      const rwCount   = moduleQuestions.rw1.length + moduleQuestions.rw2.length;
      const mathCount = moduleQuestions.math1.length + moduleQuestions.math2.length;
      const total     = rwCount + mathCount;

      document.getElementById('estTotal').textContent     = total;
      document.getElementById('estRW').textContent        = rwCount;
      document.getElementById('estMath').textContent      = mathCount;
      document.getElementById('estRWCount').textContent   = '/ 54 needed';
      document.getElementById('estMathCount').textContent = '/ 44 needed';

      const progEl = document.getElementById('moduleProgress');
      progEl.innerHTML = MOD_TARGETS.map(mod => {
        const count = moduleQuestions[mod.key].length;
        const pct   = Math.min((count / mod.target) * 100, 100);
        const done  = count >= mod.target;
        const color = done ? '#3CDBBF' : count > 0 ? '#fbbf24' : 'rgba(255,255,255,0.1)';
        return `
          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
              <span style="font-size:0.58rem;font-weight:600;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:0.06em;">${mod.label}</span>
              <span style="font-size:0.6rem;font-weight:700;color:${done?'#3CDBBF':'rgba(255,255,255,0.3)'};">${count}/${mod.target}</span>
            </div>
            <div style="height:4px;background:rgba(255,255,255,0.08);border-radius:99px;overflow:hidden;">
              <div style="height:100%;width:${pct}%;background:${color};border-radius:99px;transition:width 0.3s;"></div>
            </div>
          </div>`;
      }).join('');
    }

    // ---- Image upload ----
    async function handleImageUpload(event) {
      const file = event.target.files[0];
      if (!file) return;
      if (file.size > 5*1024*1024) { showToast('Image must be under 5MB.'); return; }
      if (!file.type.startsWith('image/')) { showToast('Please choose an image file.'); return; }

      try {
        const client = window.satGetClient();
        const ext = file.name.split('.').pop() || 'png';
        const path = `${editingTestId || 'draft'}/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;
        const { error } = await client.storage
          .from('question-images')
          .upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw error;

        const { data } = client.storage.from('question-images').getPublicUrl(path);
        const publicUrl = data.publicUrl;
        if (currentQIndex !== null) moduleQuestions[activeTab][currentQIndex].image = publicUrl;
        document.getElementById('previewImg').src = publicUrl;
        document.getElementById('imgPreview').style.display = 'block';
        document.getElementById('uploadZone').style.display = 'none';
      } catch (err) {
        console.error(err);
        showToast('Image upload failed. Check the question-images storage bucket.');
      }
    }

    function removeImage() {
      if (currentQIndex !== null) moduleQuestions[activeTab][currentQIndex].image = null;
      document.getElementById('imgPreview').style.display = 'none';
      document.getElementById('uploadZone').style.display = 'block';
      document.getElementById('imgInput').value = '';
    }

    // ---- Toast ----
    function showToast(msg) {
      const t = document.getElementById('toast');
      document.getElementById('toastMsg').textContent = msg;
      t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), 2800);
    }

    // ---- Init ----
    async function init() {
      context = await window.SAT_AUTH_READY;
      if (!context) return;
      try {
        await loadDraft();
      } catch (err) {
        console.error(err);
        showToast('Could not load this test.');
      }
      switchTab('rw1');
      renderList();
      updateEstimator();
    }

    init();
