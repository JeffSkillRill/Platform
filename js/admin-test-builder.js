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

    // ---- Load saved draft ----
    function loadDraft() {
      const saved = localStorage.getItem('sat_draft_test');
      if (saved) {
        const data = JSON.parse(saved);
        moduleQuestions = data.moduleQuestions || { rw1:[], rw2:[], math1:[], math2:[] };
        document.getElementById('testNameInput').value = data.name || '';
        renderList();
        updateEstimator();
      }
    }

    // ============================================================
    // PASTE YOUR SUPABASE CREDENTIALS HERE
    // ============================================================
   const SUPABASE_URL     = 'https://lsbpskmzffmaztczlokh.supabase.co';       // e.g. https://xyzxyz.supabase.co
   const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxzYnBza216ZmZtYXp0Y3psb2toIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2OTc5NzMsImV4cCI6MjA5ODI3Mzk3M30.zRtly7a6XPKoU6BaZ2eftQxxOTFSUkw1wQ8A6-H1-tI'; // starts with eyJ...

    const db = {
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
      }
    };

    // ---- Save draft ----
    function saveDraft() {
      const name = document.getElementById('testNameInput').value.trim();
      if (!name) { showToast('Please enter a test name first.'); return; }
      if (currentQIndex !== null) collectCurrentForm();
      localStorage.setItem('sat_draft_test', JSON.stringify({ name, moduleQuestions }));
      showToast('Draft saved locally ✓');
    }

    // ---- Publish to Supabase ----
    async function publishTest() {
      const name = document.getElementById('testNameInput').value.trim();
      if (!name) { showToast('Please enter a test name first.'); return; }
      const all = allQuestions();
      if (all.length === 0) { showToast('Add at least one question before publishing.'); return; }
      if (currentQIndex !== null) collectCurrentForm();

      const incomplete = all.filter(q =>
        !q.stem.trim() || q.choices.some(c => !c.trim()) || q.correct === null
      );
      if (incomplete.length > 0) {
        showToast(`${incomplete.length} question(s) are incomplete.`); return;
      }

      const btn = document.querySelector('.btn-primary');
      btn.disabled = true; btn.textContent = 'Publishing…';

      try {
        const [test] = await db.insert('tests', { name, status:'published' });

        // Insert questions with order_num tracking per module
        let orderNum = 0;
        for (const [modKey, qs] of Object.entries(moduleQuestions)) {
          const cfg = MODULE_CONFIG[modKey];
          for (const q of qs) {
            await db.insert('questions', {
              test_id:    test.id,
              section:    cfg.section,
              module_key: modKey,           // rw1 / rw2 / math1 / math2
              difficulty: q.difficulty,
              stem:       q.stem,
              image_url:  q.image || null,
              choices:    q.choices,
              correct:    q.correct,
              order_num:  orderNum++
            });
          }
        }

        localStorage.removeItem('sat_draft_test');
        showToast(`"${name}" published — ${all.length} questions saved ✓`);
        setTimeout(() => { window.location.href = 'admin-dashboard.html'; }, 1800);

      } catch(err) {
        showToast('Failed to publish. Check your Supabase credentials.');
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
      document.getElementById('qStem').value                = q.stem;

      // Image
      const preview = document.getElementById('imgPreview');
      const zone    = document.getElementById('uploadZone');
      if (q.image) {
        document.getElementById('previewImg').src = q.image;
        preview.style.display = 'block'; zone.style.display = 'none';
      } else {
        preview.style.display = 'none'; zone.style.display = 'block';
      }

      renderChoices(q.choices, q.correct);

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
      return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
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
      q.stem       = document.getElementById('qStem').value;
      q.correct    = correctAnswer;
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
            <div class="q-chip-text">${preview}</div>
            <span class="q-diff ${q.difficulty}">${q.difficulty[0].toUpperCase()}</span>
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
        const color = done ? '#3adbba' : count > 0 ? '#fbbf24' : 'rgba(255,255,255,0.1)';
        return `
          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
              <span style="font-size:0.58rem;font-weight:600;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:0.06em;">${mod.label}</span>
              <span style="font-size:0.6rem;font-weight:700;color:${done?'#3adbba':'rgba(255,255,255,0.3)'};">${count}/${mod.target}</span>
            </div>
            <div style="height:4px;background:rgba(255,255,255,0.08);border-radius:99px;overflow:hidden;">
              <div style="height:100%;width:${pct}%;background:${color};border-radius:99px;transition:width 0.3s;"></div>
            </div>
          </div>`;
      }).join('');
    }

    // ---- Image upload ----
    function handleImageUpload(event) {
      const file = event.target.files[0];
      if (!file) return;
      if (file.size > 5*1024*1024) { showToast('Image must be under 5MB.'); return; }
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target.result;
        if (currentQIndex !== null) moduleQuestions[activeTab][currentQIndex].image = base64;
        document.getElementById('previewImg').src       = base64;
        document.getElementById('imgPreview').style.display = 'block';
        document.getElementById('uploadZone').style.display = 'none';
      };
      reader.readAsDataURL(file);
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
    loadDraft();
    switchTab('rw1');
    updateEstimator();
