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

  let currentContext = null;
  let currentBestScore = 0;

  function setRingScore(score, targetScore) {
    const value = Number(score) || 0;
    const circle = document.querySelector('.ring-progress');
    const target = document.querySelector('.ring-target');
    const circumference = 351.86;
    const offset = circumference * (1 - Math.min(value, 1600) / 1600);
    window.satSetText('ringScore', value ? value : '—');
    if (circle) {
      circle.style.setProperty('--ring-end', offset);
      circle.style.strokeDashoffset = offset;
    }
    if (target) {
      const targetValue = Number(targetScore) || 0;
      const targetCirc = 301.59;
      target.style.strokeDashoffset = targetValue ? targetCirc * (1 - Math.min(targetValue, 1600) / 1600) : targetCirc;
    }
    updateGoalText(value, targetScore);
  }

  function updateGoalText(score, targetScore) {
    const target = Number(targetScore) || 0;
    if (!target) {
      window.satSetText('goalText', 'No score goal yet');
      return;
    }
    const gap = Math.max(0, target - (Number(score) || 0));
    window.satSetText('goalText', gap ? `${gap} points to your ${target} goal` : `Goal reached: ${target}`);
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

  function renderTrend(attempts) {
    const el = document.getElementById('trendChart');
    const rows = [...attempts].sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at)).slice(-10);
    if (!el || rows.length < 2) {
      if (el) el.innerHTML = '<span style="font-size:0.72rem;color:var(--text-faint);">Trend appears after 2 attempts</span>';
      return;
    }
    const width = 220;
    const height = 52;
    const pad = 6;
    const points = rows.map((row, index) => {
      const x = pad + (index / Math.max(1, rows.length - 1)) * (width - pad * 2);
      const y = height - pad - ((Number(row.total_score || 400) - 400) / 1200) * (height - pad * 2);
      return { x, y, row };
    });
    el.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Score trend">
        <line class="trend-axis" x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}"></line>
        <polyline class="trend-line" points="${points.map((p) => `${p.x},${p.y}`).join(' ')}"></polyline>
        ${points.map((p) => `
          <circle class="trend-dot" cx="${p.x}" cy="${p.y}" r="3.5">
            <title>${p.row.total_score} total · R&W ${p.row.rw_score || '—'} · Math ${p.row.math_score || '—'}</title>
          </circle>`).join('')}
      </svg>`;
  }

  function localDay(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function computeStreak(attempts, practiceEvents) {
    const counts = new Map();
    attempts.forEach((attempt) => {
      const day = localDay(attempt.submitted_at);
      if (day) counts.set(day, { attempt: true, practice: counts.get(day)?.practice || 0 });
    });
    practiceEvents.forEach((event) => {
      const day = localDay(event.answered_at);
      if (!day) return;
      const current = counts.get(day) || { attempt: false, practice: 0 };
      current.practice += 1;
      counts.set(day, current);
    });

    let streak = 0;
    const cursor = new Date();
    while (true) {
      const day = localDay(cursor);
      const item = counts.get(day);
      if (!item || (!item.attempt && item.practice < 5)) break;
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  function renderBadges(attempts, practiceEvents) {
    const rules = window.SAT_BADGE_RULES || [];
    const bestScore = attempts.reduce((max, item) => Math.max(max, Number(item.total_score || 0)), 0);
    const earned = rules.filter((rule) => rule.earned({ attempts, practiceEvents, bestScore }));
    window.satSetText('badgeCount', `${earned.length}/${rules.length} earned`);
    const strip = document.getElementById('badgeStrip');
    if (!strip) return;
    strip.innerHTML = rules.map((rule) => {
      const isEarned = earned.includes(rule);
      return `
        <div class="badge ${isEarned ? 'earned' : ''}">
          <div class="badge-icon">${isEarned ? '✓' : '•'}</div>
          <div class="badge-name">${window.escapeHtml(rule.label)}</div>
          <div class="badge-desc">${window.escapeHtml(rule.desc)}</div>
        </div>`;
    }).join('');
  }

  function renderStats(profile, currentAttempts, leaderboardRows, publishedTests, practiceEvents) {
    const sortedByDate = [...currentAttempts].sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at));
    const best = [...currentAttempts].sort((a, b) => Number(b.total_score || 0) - Number(a.total_score || 0))[0];
    const latest = sortedByDate[sortedByDate.length - 1];
    const average = currentAttempts.length
      ? Math.round(currentAttempts.reduce((sum, item) => sum + Number(item.total_score || 0), 0) / currentAttempts.length / 10) * 10
      : 0;

    currentBestScore = Number(best?.total_score || 0);
    setRingScore(currentBestScore, profile.target_score);
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
    renderTrend(currentAttempts);
    window.satSetText('streakChip', `${computeStreak(currentAttempts, practiceEvents)}-day study streak`);
    renderBadges(currentAttempts, practiceEvents);

    const rankIndex = leaderboardRows.findIndex((row) => row.student_id === profile.id);
    window.satSetText('lbRank', rankIndex >= 0 ? `#${rankIndex + 1}` : '—');
    window.satSetText(
      'lbRankSub',
      leaderboardRows.length ? `out of ${leaderboardRows.length} ranked students` : 'No ranked students yet'
    );
  }

  function dueBadge(testId, assignments) {
    const assignment = assignments
      .filter((item) => item.test_id === testId && item.due_at)
      .sort((a, b) => new Date(a.due_at) - new Date(b.due_at))[0];
    if (!assignment) return '';
    const due = new Date(assignment.due_at);
    const now = new Date();
    const hours = (due - now) / 36e5;
    const status = hours < 0 ? 'overdue' : hours < 48 ? 'soon' : '';
    const text = hours < 0 ? 'Overdue' : `Due ${window.formatShortDate(assignment.due_at)}`;
    return `<span class="due-badge ${status}">${window.escapeHtml(text)}</span>`;
  }

  function dueSortValue(testId, assignments) {
    const assignment = assignments
      .filter((item) => item.test_id === testId && item.due_at)
      .sort((a, b) => new Date(a.due_at) - new Date(b.due_at))[0];
    return assignment?.due_at ? new Date(assignment.due_at).getTime() : Number.MAX_SAFE_INTEGER;
  }

  function renderTests(currentAttempts, tests, questions, assignments) {
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
        dueSort: dueSortValue(test.id, assignments),
        sortDate: submitted?.submitted_at || test.created_at,
      };
    }).sort((a, b) => a.dueSort - b.dueSort || new Date(b.sortDate) - new Date(a.sortDate)).slice(0, 4);

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
            <div class="test-meta">${window.escapeHtml(meta)} ${dueBadge(test.id, assignments)}</div>
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
      const [tests, questions, ownAttempts, leaderboardAttempts, profiles, assignments, practiceEvents] = await Promise.all([
        window.satRest('tests?status=eq.published&select=id,name,status,created_at&order=created_at.desc'),
        window.satRest('student_questions?select=test_id,section,module_key,order_num'),
        window.satRest(`test_attempts?student_id=eq.${encodeURIComponent(context.profile.id)}&status=eq.submitted&select=id,student_id,test_id,time_taken,correct_count,total_questions,rw_score,math_score,total_score,submitted_at&order=submitted_at.asc`),
        window.satRest('leaderboard_attempts?select=*&order=submitted_at.desc'),
        window.satRest('leaderboard_profiles?select=id,full_name,username'),
        window.satRest('test_assignments?select=test_id,due_at,class_id'),
        window.satRest('practice_events?select=question_id,is_correct,answered_at&order=answered_at.desc'),
      ]);

      const currentAttempts = submittedAttempts(ownAttempts);
      const leaderboardRows = bestOverallRows(submittedAttempts(leaderboardAttempts));

      renderStats(context.profile, currentAttempts, leaderboardRows, tests, practiceEvents);
      renderTests(currentAttempts, tests, questions, assignments);
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

  function openGoalModal() {
    const input = document.getElementById('targetScoreInput');
    if (input) input.value = currentContext?.profile?.target_score || '';
    document.getElementById('goalModal')?.classList.add('open');
  }

  function closeGoalModal() {
    document.getElementById('goalModal')?.classList.remove('open');
  }

  async function saveTargetScore() {
    const input = document.getElementById('targetScoreInput');
    const value = Number(input?.value || 0);
    if (!value || value < 400 || value > 1600) {
      alert('Enter a target score between 400 and 1600.');
      return;
    }
    try {
      const updated = await window.satRpc('set_target_score', { p_target_score: value });
      const profile = Array.isArray(updated) ? updated[0] : updated;
      currentContext.profile.target_score = profile?.target_score || value;
      setRingScore(currentBestScore, currentContext.profile.target_score);
      closeGoalModal();
    } catch (err) {
      console.error(err);
      alert('Could not save your goal. Run migration 002 first.');
    }
  }

  async function init() {
    const context = await window.SAT_AUTH_READY;
    if (!context) return;
    currentContext = context;
    window.satSetSidebarUser(context.profile, {
      name: ['sidebarName'],
      avatar: ['sidebarAvatar', 'mobileAvatar'],
    });
    setGreeting(context.profile);
    setDate();
    await loadDashboard(context);
  }

  window.openGoalModal = openGoalModal;
  window.closeGoalModal = closeGoalModal;
  window.saveTargetScore = saveTargetScore;

  init();
}());
