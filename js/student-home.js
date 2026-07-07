    const SUPABASE_URL = 'https://lsbpskmzffmaztczlokh.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxzYnBza216ZmZtYXp0Y3psb2toIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2OTc5NzMsImV4cCI6MjA5ODI3Mzk3M30.zRtly7a6XPKoU6BaZ2eftQxxOTFSUkw1wQ8A6-H1-tI';

    // ---- Load session from localStorage ----
    const session = JSON.parse(localStorage.getItem('sat_user') || '{}');

    // If no session, redirect back to login
    if (!session.name) {
      window.location.href = 'student-login.html';
    }

    // Get first name only for greeting (e.g. "Abdujafar Rashidov" → "Abdujafar")
    const firstName = session.name ? session.name.split(' ')[0] : 'Student';

    // Get initials for avatar (e.g. "Abdujafar Rashidov" → "AR")
    const initials = session.name
      ? session.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
      : 'ST';

    // ---- Greeting by time of day ----
    function setGreeting() {
      const hour = new Date().getHours();
      const part = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
      document.getElementById('greetingText').textContent = `Good ${part}, ${firstName} 👋`;
    }

    // ---- Update sidebar name and avatar ----
    function setUserInfo() {
      document.getElementById('sidebarName').textContent = session.name || 'Student';
      document.getElementById('sidebarAvatar').textContent = initials;
      document.getElementById('mobileAvatar').textContent = initials;
    }

    // ---- Date in topbar ----
    function setDate() {
      const d = new Date();
      document.getElementById('dateLabel').textContent =
        d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    }

    setGreeting();
    setUserInfo();
    setDate();

    function escapeHtml(value) {
      return String(value ?? '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[ch]));
    }

    function parseJson(value) {
      if (!value) return {};
      if (typeof value === 'object') return value;
      try {
        const parsed = JSON.parse(value);
        return typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
      } catch (err) {
        return {};
      }
    }

    async function supabaseGet(path) {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        }
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    }

    function sectionScore(correct, total) {
      if (!total) return 0;
      return Math.round((200 + (correct / total) * 600) / 10) * 10;
    }

    function calculateScore(submission, questions) {
      const testQuestions = questions.filter(q => q.test_id === submission.test_id);
      const answers = parseJson(submission.answers);
      let rwCorrect = 0;
      let rwTotal = 0;
      let mathCorrect = 0;
      let mathTotal = 0;

      testQuestions.forEach(q => {
        const chosen = answers[q.id];
        const isCorrect = chosen !== null && chosen !== undefined && Number(chosen) === Number(q.correct);
        if (q.section === 'rw') {
          rwTotal++;
          if (isCorrect) rwCorrect++;
        } else if (q.section === 'math') {
          mathTotal++;
          if (isCorrect) mathCorrect++;
        }
      });

      const rw = sectionScore(rwCorrect, rwTotal);
      const math = sectionScore(mathCorrect, mathTotal);
      const total = rw && math ? rw + math : rw || math || 0;

      return {
        ...submission,
        rw,
        math,
        total,
        correct: rwCorrect + mathCorrect,
        questionCount: rwTotal + mathTotal,
      };
    }

    function setRingScore(score) {
      const value = Number(score) || 0;
      const circle = document.querySelector('.ring-progress');
      const circumference = 351.86;
      const offset = circumference * (1 - Math.min(value, 1600) / 1600);
      document.getElementById('ringScore').textContent = value ? value : '—';
      circle.style.setProperty('--ring-end', offset);
      circle.style.strokeDashoffset = offset;
    }

    function formatDate(value) {
      return new Date(value).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }

    function renderStats(currentScores, leaderboardRows, publishedTests) {
      const sortedByDate = [...currentScores].sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at));
      const best = [...currentScores].sort((a, b) => b.total - a.total)[0];
      const latest = sortedByDate[sortedByDate.length - 1];
      const average = currentScores.length
        ? Math.round(currentScores.reduce((sum, item) => sum + item.total, 0) / currentScores.length / 10) * 10
        : 0;

      setRingScore(best?.total || 0);
      document.getElementById('mathScore').textContent = best?.math || '—';
      document.getElementById('rwScore').textContent = best?.rw || '—';
      document.getElementById('testsCompleted').textContent = currentScores.length;
      document.getElementById('testsCompletedSub').textContent =
        `${publishedTests.length} available ${publishedTests.length === 1 ? 'test' : 'tests'}`;
      document.getElementById('avgScore').textContent = average || '—';

      if (sortedByDate.length >= 2) {
        const improvement = latest.total - sortedByDate[0].total;
        document.getElementById('improvement').textContent = improvement > 0 ? `+${improvement}` : String(improvement);
      } else {
        document.getElementById('improvement').textContent = currentScores.length ? '0' : '—';
      }

      const rankIndex = leaderboardRows.findIndex(row => row.student_id === session.id);
      document.getElementById('lbRank').textContent = rankIndex >= 0 ? `#${rankIndex + 1}` : '—';
      document.getElementById('lbRankSub').textContent =
        leaderboardRows.length ? `out of ${leaderboardRows.length} ranked students` : 'No ranked students yet';
    }

    function renderTests(currentScores, tests, questions) {
      const list = document.getElementById('dashboardTestList');
      const byTest = new Map();
      currentScores.forEach(score => {
        const previous = byTest.get(score.test_id);
        if (!previous || new Date(score.submitted_at) > new Date(previous.submitted_at)) {
          byTest.set(score.test_id, score);
        }
      });

      const published = tests.filter(t => t.status === 'published');
      const cards = published.map(test => {
        const submitted = byTest.get(test.id);
        const count = questions.filter(q => q.test_id === test.id).length;
        return {
          test,
          submitted,
          count,
          sortDate: submitted?.submitted_at || test.created_at
        };
      }).sort((a, b) => new Date(b.sortDate) - new Date(a.sortDate)).slice(0, 4);

      if (!cards.length) {
        list.innerHTML = `
          <div class="test-item" style="cursor:default;">
            <span class="test-status-dot new"></span>
            <div class="test-info">
              <div class="test-name">No tests available yet</div>
              <div class="test-meta">Your instructor has not published a test.</div>
            </div>
          </div>`;
        return;
      }

      list.innerHTML = cards.map(({ test, submitted, count }) => {
        const href = submitted ? 'student-results.html' : 'student-tests.html';
        const statusClass = submitted ? 'done' : 'new';
        const badgeText = submitted ? submitted.total : 'New';
        const meta = submitted
          ? `${count} questions · Submitted ${formatDate(submitted.submitted_at)}`
          : `${count} questions · Published ${formatDate(test.created_at)}`;

        return `
          <a class="test-item" href="${href}">
            <span class="test-status-dot ${statusClass}"></span>
            <div class="test-info">
              <div class="test-name">${escapeHtml(test.name)}</div>
              <div class="test-meta">${escapeHtml(meta)}</div>
            </div>
            <span class="test-score-badge ${statusClass}">${escapeHtml(badgeText)}</span>
            <span class="test-arrow">›</span>
          </a>`;
      }).join('');
    }

    function initialsFor(name) {
      return String(name || 'Student').split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase() || 'ST';
    }

    function renderLeaderboard(rows, users) {
      const preview = document.getElementById('leaderboardPreview');
      if (!rows.length) {
        preview.innerHTML = `
          <div class="lb-row">
            <span class="lb-rank">—</span>
            <div class="lb-avatar" style="background:var(--accent);">ST</div>
            <div class="lb-name">No submitted tests yet<small>Take a test to appear here</small></div>
            <span class="lb-score">—</span>
          </div>`;
        document.getElementById('leaderboardFooterLink').textContent = 'See full leaderboard →';
        return;
      }

      let visibleRows = rows.slice(0, 5);
      const myIndex = rows.findIndex(row => row.student_id === session.id);
      if (myIndex >= 5) visibleRows = [...rows.slice(0, 4), rows[myIndex]];

      const colors = ['#6D28D9', '#0891B2', '#3adbba', '#059669', '#DC2626', '#D97706'];
      preview.innerHTML = visibleRows.map(row => {
        const rank = rows.indexOf(row) + 1;
        const user = users.find(u => u.id === row.student_id) || {};
        const isMe = row.student_id === session.id;
        const rankClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
        const name = user.full_name || (isMe ? session.name : 'Student');
        return `
          <div class="lb-row ${isMe ? 'me' : ''}">
            <span class="lb-rank ${rankClass}" ${isMe ? 'style="color:var(--accent);"' : ''}>${rank}</span>
            <div class="lb-avatar" style="background:${colors[(rank - 1) % colors.length]};">${escapeHtml(initialsFor(name))}</div>
            <div class="lb-name">
              ${escapeHtml(name)} ${isMe ? '<span class="you-tag">you</span>' : ''}
              <small>${row.attempts} ${row.attempts === 1 ? 'test' : 'tests'} done</small>
            </div>
            <span class="lb-score">${row.total}</span>
          </div>`;
      }).join('');

      document.getElementById('leaderboardFooterLink').textContent =
        `See all ${rows.length} ranked ${rows.length === 1 ? 'student' : 'students'} →`;
    }

    function buildLeaderboard(scoredSubmissions) {
      const best = new Map();
      scoredSubmissions.forEach(score => {
        const previous = best.get(score.student_id);
        if (!previous || score.total > previous.total) {
          best.set(score.student_id, {
            student_id: score.student_id,
            total: score.total,
            attempts: scoredSubmissions.filter(item => item.student_id === score.student_id).length,
          });
        }
      });

      return [...best.values()].sort((a, b) => b.total - a.total);
    }

    async function loadDashboard() {
      try {
        const [tests, questions, submissions, users] = await Promise.all([
          supabaseGet('tests?select=id,name,status,created_at&order=created_at.desc'),
          supabaseGet('questions?select=id,test_id,section,correct,order_num'),
          supabaseGet('submissions?select=*&order=submitted_at.asc'),
          supabaseGet('users?role=eq.student&select=id,full_name,username')
        ]);

        const scored = submissions.map(submission => calculateScore(submission, questions));
        const currentScores = scored.filter(item => item.student_id === session.id);
        const leaderboardRows = buildLeaderboard(scored);
        const publishedTests = tests.filter(test => test.status === 'published');

        renderStats(currentScores, leaderboardRows, publishedTests);
        renderTests(currentScores, tests, questions);
        renderLeaderboard(leaderboardRows, users);
      } catch (err) {
        document.getElementById('dashboardTestList').innerHTML = `
          <div class="test-item" style="cursor:default;">
            <span class="test-status-dot pending"></span>
            <div class="test-info">
              <div class="test-name">Could not load dashboard</div>
              <div class="test-meta">Check Supabase policies and connection.</div>
            </div>
          </div>`;
        document.getElementById('leaderboardPreview').innerHTML = `
          <div class="lb-row">
            <span class="lb-rank">—</span>
            <div class="lb-avatar" style="background:var(--accent);">ST</div>
            <div class="lb-name">Leaderboard unavailable<small>Check Supabase connection</small></div>
            <span class="lb-score">—</span>
          </div>`;
        console.error(err);
      }
    }

    loadDashboard();

    // ---- Logout ----
    function handleLogout() {
      if (confirm('Sign out?')) {
        localStorage.removeItem('sat_user');
        window.location.href = 'student-login.html';
      }
    }
