    const LETTERS = ['A','B','C','D'];
    const SUPABASE_URL     = 'https://lsbpskmzffmaztczlokh.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxzYnBza216ZmZtYXp0Y3psb2toIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2OTc5NzMsImV4cCI6MjA5ODI3Mzk3M30.zRtly7a6XPKoU6BaZ2eftQxxOTFSUkw1wQ8A6-H1-tI';
    const db = {
      async getWhere(table, col, op, val, extra='') {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${col}=${op}.${encodeURIComponent(val)}${extra}&select=*`, {
          headers:{ 'apikey':SUPABASE_ANON_KEY,'Authorization':`Bearer ${SUPABASE_ANON_KEY}` }
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      }
    };

    let allQuestions = [];
    let answers      = {};
    let activeFilter = 'all';

    // Load result from localStorage
    const result = JSON.parse(localStorage.getItem('sat_last_result') || '{}');
    if (!result.questions) {
      document.querySelector('.content').innerHTML =
        '<div style="text-align:center;padding:4rem;color:var(--text-faint);">No results found. Please take a test first.</div>';
    } else {
      allQuestions = result.questions;
      answers      = result.answers || {};
      init();
    }

    async function init() {
      await hydrateCorrectAnswers();
      const canReview = allQuestions.every(q => q.correct !== undefined && q.correct !== null);
      if (!canReview) {
        document.querySelector('.content').innerHTML =
          '<div style="text-align:center;padding:4rem;color:var(--text-faint);">Review is unavailable for this session. Please open the saved result after the secure review API is enabled.</div>';
        return;
      }

      document.getElementById('topbarName').textContent   = result.testName || 'Test Results';
      document.getElementById('summaryTitle').textContent = result.testName || 'Test Results';

      // Time taken
      const t   = result.timeTaken || 0;
      const hh  = Math.floor(t / 3600);
      const mm  = Math.floor((t % 3600) / 60);
      const ss  = t % 60;
      const timeStr = hh > 0
        ? `${hh}h ${mm}m ${ss}s`
        : `${mm}m ${ss}s`;

      document.getElementById('timeBadge').innerHTML = `
        <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path stroke-linecap="round" d="M12 6v6l4 2"/></svg>
        Time: ${timeStr}`;

      document.getElementById('summarySub').textContent =
        `${allQuestions.length} questions · Completed ${new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}`;

      // Count correct / wrong / skipped
      let correct = 0, wrong = 0, skipped = 0;
      allQuestions.forEach(q => {
        const chosen = answers[q.id];
        if (chosen === null || chosen === undefined) skipped++;
        else if (chosen === q.correct) correct++;
        else wrong++;
      });

      document.getElementById('summaryStats').innerHTML = `
        <div class="sum-stat"><div class="sum-stat-val correct">${correct}</div><div class="sum-stat-lbl">Correct</div></div>
        <div class="sum-stat"><div class="sum-stat-val wrong">${wrong}</div><div class="sum-stat-lbl">Wrong</div></div>
        <div class="sum-stat"><div class="sum-stat-val skipped">${skipped}</div><div class="sum-stat-lbl">Skipped</div></div>
        <div class="sum-stat"><div class="sum-stat-val" style="color:#fff;">${allQuestions.length}</div><div class="sum-stat-lbl">Total</div></div>`;

      renderList();
    }

    async function hydrateCorrectAnswers() {
      const hasCorrectAnswers = allQuestions.every(q => q.correct !== undefined && q.correct !== null);
      if (hasCorrectAnswers || !result.testId) return;

      try {
        const fullQuestions = await db.getWhere('questions','test_id','eq',result.testId,'&order=order_num.asc');
        if (fullQuestions.length) {
          allQuestions = fullQuestions.map(q => ({
            ...q,
            choices: typeof q.choices === 'string' ? JSON.parse(q.choices) : q.choices
          }));
        }
      } catch (err) {
        document.getElementById('summarySub').textContent =
          'Review unavailable because correct answers are protected for this session.';
      }
    }

    function getStatus(q) {
      const chosen = answers[q.id];
      if (chosen === null || chosen === undefined) return 'skipped';
      return chosen === q.correct ? 'correct' : 'wrong';
    }

    function setFilter(f, btn) {
      activeFilter = f;
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderList();
    }

    function renderList() {
      const list   = document.getElementById('questionList');
      let filtered = allQuestions.filter(q => activeFilter === 'all' || getStatus(q) === activeFilter);

      if (filtered.length === 0) {
        list.innerHTML = `<div style="text-align:center;padding:3rem;color:var(--text-faint);">No questions in this category.</div>`;
        return;
      }

      // Group by section
      const rw   = filtered.filter(q => q.section === 'rw');
      const math = filtered.filter(q => q.section === 'math');

      let html = '';

      if (rw.length > 0) {
        html += `<div class="section-divider"><div class="section-divider-line"></div><div class="section-divider-label">Reading & Writing</div><div class="section-divider-line"></div></div>`;
        html += rw.map((q,i) => buildCard(q, allQuestions.indexOf(q)+1)).join('');
      }
      if (math.length > 0) {
        html += `<div class="section-divider"><div class="section-divider-line"></div><div class="section-divider-label">Math</div><div class="section-divider-line"></div></div>`;
        html += math.map((q,i) => buildCard(q, allQuestions.indexOf(q)+1)).join('');
      }

      list.innerHTML = html;
    }

    function buildCard(q, globalNum) {
      const status  = getStatus(q);
      const chosen  = answers[q.id];

      const imgHtml = q.image_url
        ? `<img class="q-image" src="${q.image_url}" alt="Question image"/>`
        : '';

      const choicesHtml = q.choices.map((c, i) => {
        const isCorrect = i === q.correct;
        const isChosen  = i === chosen;
        let rowClass = 'neutral';
        if (isCorrect) rowClass = 'was-correct';
        else if (isChosen && !isCorrect) rowClass = 'was-wrong';

        let tags = '';
        if (isCorrect) tags += `<span class="tag correct-tag">Correct answer</span>`;
        if (isChosen && !isCorrect) tags += `<span class="tag wrong-tag">Your answer</span>`;
        if (isChosen && isCorrect)  tags += `<span class="tag correct-tag">Your answer ✓</span>`;

        return `
          <div class="answer-row ${rowClass}">
            <div class="ans-letter">${LETTERS[i]}</div>
            <div class="ans-text">${c}${tags}</div>
          </div>`;
      }).join('');

      const labelMap = { correct:'Correct', wrong:'Wrong', skipped:'Skipped' };

      return `
        <div class="q-review ${status}" id="card-${q.id}">
          <div class="q-review-head" onclick="toggleCard('${q.id}')">
            <div class="q-num-badge ${status}">${globalNum}</div>
            <div class="q-stem-preview">${q.stem}</div>
            <div class="result-tag ${status}">${labelMap[status]}</div>
            <svg class="expand-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
          </div>
          <div class="q-review-body">
            ${imgHtml}
            <div class="q-full-stem">${q.stem}</div>
            ${choicesHtml}
          </div>
        </div>`;
    }

    function toggleCard(qId) {
      const card = document.getElementById('card-' + qId);
      card.classList.toggle('open');
    }
