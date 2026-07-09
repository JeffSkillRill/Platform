(function () {
  window.SAT_BADGE_RULES = [
    {
      id: 'first-test',
      label: 'First Test',
      desc: 'Submit one full test',
      earned: ({ attempts }) => attempts.length >= 1,
    },
    {
      id: 'club-1200',
      label: '1200 Club',
      desc: 'Score 1200+',
      earned: ({ bestScore }) => bestScore >= 1200,
    },
    {
      id: 'club-1400',
      label: '1400 Club',
      desc: 'Score 1400+',
      earned: ({ bestScore }) => bestScore >= 1400,
    },
    {
      id: 'perfect-test',
      label: 'Perfect Test',
      desc: 'Answer every question correctly',
      earned: ({ attempts }) => attempts.some((a) => Number(a.total_questions) > 0 && Number(a.correct_count) === Number(a.total_questions)),
    },
    {
      id: 'comeback',
      label: 'Comeback',
      desc: '+100 from first attempt',
      earned: ({ attempts }) => {
        if (attempts.length < 2) return false;
        const sorted = [...attempts].sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at));
        const first = Number(sorted[0]?.total_score || 0);
        return sorted.some((a) => Number(a.total_score || 0) - first >= 100);
      },
    },
    {
      id: 'mistake-crusher',
      label: 'Mistake Crusher',
      desc: 'Clear 50 practice answers',
      earned: ({ practiceEvents }) => practiceEvents.filter((event) => event.is_correct).length >= 50,
    },
  ];
}());
