    const SUPABASE_URL     = 'https://lsbpskmzffmaztczlokh.supabase.co';       // e.g. https://xyzxyz.supabase.co
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxzYnBza216ZmZtYXp0Y3psb2toIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2OTc5NzMsImV4cCI6MjA5ODI3Mzk3M30.zRtly7a6XPKoU6BaZ2eftQxxOTFSUkw1wQ8A6-H1-tI'; // starts with eyJ...
    const session = JSON.parse(localStorage.getItem('sat_user') || '{}');
    if (!session.id) window.location.href = 'student-login.html';

    // Set name
    const initials = session.name ? session.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase() : 'ST';
    document.getElementById('sAvatar').textContent = initials;
    document.getElementById('sName').textContent   = session.name || 'Student';

    async function loadTests() {
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/tests?status=eq.published&select=*&order=created_at.desc`, {
          headers:{ 'apikey':SUPABASE_ANON_KEY,'Authorization':`Bearer ${SUPABASE_ANON_KEY}` }
        });
        const tests = await res.json();
        const list  = document.getElementById('testList');

        if (!tests.length) {
          list.innerHTML = `
            <div class="empty-state">
              <svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              <p>No tests available yet.<br>Your instructor hasn't published any tests.</p>
            </div>`;
          return;
        }

        // Load question counts per test
        const qRes = await fetch(`${SUPABASE_URL}/rest/v1/questions?select=test_id,section`, {
          headers:{ 'apikey':SUPABASE_ANON_KEY,'Authorization':`Bearer ${SUPABASE_ANON_KEY}` }
        });
        const allQs = await qRes.json();

        list.innerHTML = tests.map(t => {
          const qs    = allQs.filter(q => q.test_id === t.id);
          const math  = qs.filter(q => q.section === 'math').length;
          const rw    = qs.filter(q => q.section === 'rw').length;
          const total = qs.length;
          const date  = new Date(t.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});

          // Estimate time: rw=64min, math=70min
          const mins = (rw > 0 ? 64 : 0) + (math > 0 ? 70 : 0);

          return `
            <div class="test-card">
              <div class="test-icon">
                <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              </div>
              <div class="test-info">
                <div class="test-name">${t.name}</div>
                <div class="test-meta">
                  <span>📝 ${total} questions</span>
                  ${rw   ? `<span>📖 R&amp;W: ${rw}</span>`  : ''}
                  ${math ? `<span>🔢 Math: ${math}</span>` : ''}
                  <span>⏱ ~${mins} min</span>
                  <span>📅 ${date}</span>
                </div>
              </div>
              <button class="btn-start" onclick="startTest('${t.id}','${t.name.replace(/'/g,"\\'")}')">
                Start →
              </button>
            </div>`;
        }).join('');

      } catch(err) {
        document.getElementById('testList').innerHTML =
          `<div class="empty-state"><p>Failed to load tests. Check Supabase credentials.</p></div>`;
      }
    }

    function startTest(testId, testName) {
      if (!confirm(`Start "${testName}"?\n\nThe timer will begin immediately. Make sure you have enough time.`)) return;
      window.location.href = `student-test-solve.html?testId=${testId}&testName=${encodeURIComponent(testName)}`;
    }

    loadTests();
