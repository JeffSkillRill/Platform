(function () {
  function setGreeting(profile) {
    const hour = new Date().getHours();
    const part = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
    const firstName = String(profile.full_name || 'Student').split(' ')[0];
    window.satSetText('greetingText', `Good ${part}, ${firstName}`);
  }

  function setDate() {
    const date = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
    window.satSetText('dateLabel', date);
  }

  function setRingScore(score) {
    const value = Number(score) || 0;
    const circle = document.querySelector('.ring-progress');
    const circumference = 351.86;
    const offset = circumference * (1 - Math.min(value, 1600) / 1600);
    window.satSetText('ringScore', value ? value : '—');
    if (circle) {
      circle.style.setProperty('--ring-end', offset);
      circle.style.strokeDashoffset = offset;
    }
  }

  function submittedAttempts(rows) {
    return rows.filter((row) => row.submitted_at && Number(row.total_score) > 0);
  }

  function bestOverallRows(attempts) {
    const counts = new Map();
    attempts.forEach((attempt) => {
      counts.set(attempt.student_id, (counts.get(attempt.student_id) || 0) + 1);
    });

    const best = new Map();
    attempts.forEach((attempt) => {
      const previous = best.get(attempt.student_id);
      if (!previous || Number(attempt.total_score) > Number(previous.total_score)) {
        best.set(attempt.student_id, {
          ...attempt,
          attempts: counts.get(attempt.student_id) || 1,
        });
      }
    });

    return [...best.values()].sort((a, b) =>
      Number(b.total_score || 0) - Number(a.total_score || 0) ||
      Number(b.correct_count || 0) - Number(a.correct_count || 0)
    );
  }

  function renderStats(profile, currentAttempts, leaderboardRows, publishedTests) {
    const sortedByDate = [...currentAttempts].sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at));
    const best = [...currentAttempts].sort((a, b) => Number(b.total_score || 0) - Number(a.total_score || 0))[0];
    const latest = sortedByDate[sortedByDate.length - 1];
    const average = currentAttempts.length
      ? Math.round(currentAttempts.reduce((sum, item) => sum + Number(item.total_score || 0), 0) / currentAttempts.length / 10) * 10
      : 0;

    setRingScore(best?.total_score || 0);
    window.satSetText('mathScore', best?.math_score || '—');
    window.satSetText('rwScore', best?.rw_score || '—');
    window.satSetText('testsCompleted', currentAttempts.length);
    window.satSetText('testsCompletedSub', `${publishedTests.length} available ${publishedTests.length === 1 ? 'test' : 'tests'}`);
    window.satSetText('avgScore', average || '—');

    if (sortedByDate.length >= 2) {
      const improvement = Number(latest.total_score || 0) - Number(sortedByDate[0].total_score || 0);
      window.satSetText('improvement', improvement > 0 ? `+${improvement}` : String(improvement));
    } else {
      window.satSetText('improvement', currentAttempts.length ? '0' : '—');
    }

    const rankIndex = leaderboardRows.findIndex((row) => row.student_id === profile.id);
    window.satSetText('lbRank', rankIndex >= 0 ? `#${rankIndex + 1}` : '—');
    window.satSetText(
      'lbRankSub',
      leaderboardRows.length ? `out of ${leaderboardRows.length} ranked students` : 'No ranked students yet'
    );
  }

  function renderTests(currentAttempts, tests, questions) {
    const list = document.getElementById('dashboardTestList');
    const latestByTest = new Map();
    currentAttempts.forEach((attempt) => {
      const previous = latestByTest.get(attempt.test_id);
      if (!previous || new Date(attempt.submitted_at) > new Date(previous.submitted_at)) {
        latestByTest.set(attempt.test_id, attempt);
      }
    });

    const cards = tests.map((test) => {
      const submitted = latestByTest.get(test.id);
      return {
        test,
        submitted,
        count: questions.filter((q) => q.test_id === test.id).length,
        sortDate: submitted?.submitted_at || test.created_at,
      };
    }).sort((a, b) => new Date(b.sortDate) - new Date(a.sortDate)).slice(0, 4);

    if (!cards.length) {
      list.innerHTML = `
        <div class="test-item" style="cursor:default;">
          <span class="test-status-dot new"></span>
          <div class="test-info">
            <div class="test-name">No tests available yet</div>
            <div class="test-meta">Your instructor has not assigned a published test.</div>
          </div>
        </div>`;
      return;
    }

    list.innerHTML = cards.map(({ test, submitted, count }) => {
      const href = submitted
        ? `student-test-results.html?attemptId=${encodeURIComponent(submitted.id)}`
        : 'student-tests.html';
      const statusClass = submitted ? 'done' : 'new';
      const badgeText = submitted ? submitted.total_score : 'New';
      const meta = submitted
        ? `${count} questions · Submitted ${window.formatDate(submitted.submitted_at)}`
        : `${count} questions · Published ${window.formatDate(test.created_at)}`;

      return `
        <a class="test-item" href="${href}">
          <span class="test-status-dot ${statusClass}"></span>
          <div class="test-info">
            <div class="test-name">${window.escapeHtml(test.name)}</div>
            <div class="test-meta">${window.escapeHtml(meta)}</div>
          </div>
          <span class="test-score-badge ${statusClass}">${window.escapeHtml(badgeText)}</span>
          <span class="test-arrow">›</span>
        </a>`;
    }).join('');
  }

  function renderLeaderboard(rows, profiles, currentProfile) {
    const preview = document.getElementById('leaderboardPreview');
    if (!rows.length) {
      preview.innerHTML = `
        <div class="lb-row">
          <span class="lb-rank">—</span>
          <div class="lb-avatar" style="background:var(--accent);">ST</div>
          <div class="lb-name">No submitted tests yet<small>Take a test to appear here</small></div>
          <span class="lb-score">—</span>
        </div>`;
      window.satSetText('leaderboardFooterLink', 'See full leaderboard →');
      return;
    }

    let visibleRows = rows.slice(0, 5);
    const myIndex = rows.findIndex((row) => row.student_id === currentProfile.id);
    if (myIndex >= 5) visibleRows = [...rows.slice(0, 4), rows[myIndex]];

    const colors = ['#6D28D9', '#0891B2', '#3adbba', '#059669', '#DC2626', '#D97706'];
    preview.innerHTML = visibleRows.map((row) => {
      const rank = rows.indexOf(row) + 1;
      const user = profiles.find((item) => item.id === row.student_id) || {};
      const isMe = row.student_id === currentProfile.id;
      const rankClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
      const name = user.full_name || (isMe ? currentProfile.full_name : 'Student');
      return `
        <div class="lb-row ${isMe ? 'me' : ''}">
          <span class="lb-rank ${rankClass}" ${isMe ? 'style="color:var(--accent);"' : ''}>${rank}</span>
          <div class="lb-avatar" style="background:${colors[(rank - 1) % colors.length]};">${window.escapeHtml(window.initialsFor(name))}</div>
          <div class="lb-name">
            ${window.escapeHtml(name)} ${isMe ? '<span class="you-tag">you</span>' : ''}
            <small>${row.attempts} ${row.attempts === 1 ? 'test' : 'tests'} done</small>
          </div>
          <span class="lb-score">${window.escapeHtml(row.total_score)}</span>
        </div>`;
    }).join('');

    window.satSetText(
      'leaderboardFooterLink',
      `See all ${rows.length} ranked ${rows.length === 1 ? 'student' : 'students'} →`
    );
  }

  async function loadDashboard(context) {
    try {
      const [tests, questions, ownAttempts, leaderboardAttempts, profiles] = await Promise.all([
        window.satRest('tests?status=eq.published&select=id,name,status,created_at&order=created_at.desc'),
        window.satRest('student_questions?select=test_id,section,module_key,order_num'),
        window.satRest(`test_attempts?student_id=eq.${encodeURIComponent(context.profile.id)}&status=eq.submitted&select=id,student_id,test_id,time_taken,correct_count,total_questions,rw_score,math_score,total_score,submitted_at&order=submitted_at.asc`),
        window.satRest('leaderboard_attempts?select=*&order=submitted_at.desc'),
        window.satRest('leaderboard_profiles?select=id,full_name,username'),
      ]);

      const currentAttempts = submittedAttempts(ownAttempts);
      const leaderboardRows = bestOverallRows(submittedAttempts(leaderboardAttempts));

      renderStats(context.profile, currentAttempts, leaderboardRows, tests);
      renderTests(currentAttempts, tests, questions);
      renderLeaderboard(leaderboardRows, profiles, context.profile);
    } catch (err) {
      console.error(err);
      document.getElementById('dashboardTestList').innerHTML = `
        <div class="test-item" style="cursor:default;">
          <span class="test-status-dot pending"></span>
          <div class="test-info">
            <div class="test-name">Could not load dashboard</div>
            <div class="test-meta">Check your Supabase schema, assignments, and policies.</div>
          </div>
        </div>`;
      document.getElementById('leaderboardPreview').innerHTML = `
        <div class="lb-row">
          <span class="lb-rank">—</span>
          <div class="lb-avatar" style="background:var(--accent);">ST</div>
          <div class="lb-name">Leaderboard unavailable<small>Check Supabase connection</small></div>
          <span class="lb-score">—</span>
        </div>`;
    }
  }

  async function init() {
    const context = await window.SAT_AUTH_READY;
    if (!context) return;
    window.satSetSidebarUser(context.profile, {
      name: ['sidebarName'],
      avatar: ['sidebarAvatar', 'mobileAvatar'],
    });
    setGreeting(context.profile);
    setDate();
    await loadDashboard(context);
  }

  init();
}());
