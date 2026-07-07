    // ============================================================
    // PASTE YOUR SUPABASE CREDENTIALS HERE
    // Go to: supabase.com → your project → Settings → API
    // ============================================================
    const SUPABASE_URL      = 'https://lsbpskmzffmaztczlokh.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxzYnBza216ZmZtYXp0Y3psb2toIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2OTc5NzMsImV4cCI6MjA5ODI3Mzk3M30.zRtly7a6XPKoU6BaZ2eftQxxOTFSUkw1wQ8A6-H1-tI';

    const db = {
      async getWhere(table, column, operator, value) {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${column}=${operator}.${encodeURIComponent(value)}&select=*`, {
          headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      }
    };
    const pwInput = document.getElementById('password');
    const toggleBtn = document.getElementById('togglePw');
    toggleBtn.addEventListener('click', () => {
      const isHidden = pwInput.type === 'password';
      pwInput.type = isHidden ? 'text' : 'password';
      toggleBtn.textContent = isHidden ? 'Hide' : 'Show';
    });

    const form = document.getElementById('studentLoginForm');
    const submitBtn = document.getElementById('submitBtn');
    const globalError = document.getElementById('globalError');

    function setError(inputId, errorId, msg) {
      document.getElementById(inputId).classList.add('error');
      const e = document.getElementById(errorId);
      e.textContent = msg; e.classList.add('visible');
    }
    function clearError(inputId, errorId) {
      document.getElementById(inputId).classList.remove('error');
      document.getElementById(errorId).classList.remove('visible');
    }

    document.getElementById('username').addEventListener('input', () => { clearError('username','usernameError'); globalError.classList.remove('visible'); });
    document.getElementById('password').addEventListener('input', () => { clearError('password','passwordError'); globalError.classList.remove('visible'); });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value;
      let valid = true;
      if (!username) { setError('username','usernameError','Username is required.'); valid = false; }
      if (!password) { setError('password','passwordError','Password is required.'); valid = false; }
      if (!valid) return;

      submitBtn.disabled = true;
      submitBtn.textContent = 'Signing in...';

      try {
        // Look up user in Supabase by username
        const results = await db.getWhere('users', 'username', 'eq', username);

        // Check user exists, password matches, and role is student
        if (
          results.length === 0 ||
          results[0].password !== password ||
          results[0].role !== 'student'
        ) {
          throw new Error('Invalid credentials');
        }

        // Save session info to localStorage
        const user = results[0];
        localStorage.setItem('sat_user', JSON.stringify({
          id:       user.id,
          name:     user.full_name,
          username: user.username,
          role:     user.role,
        }));

        window.location.href = 'student-home.html';

      } catch (err) {
        globalError.classList.add('visible');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign in';
      }
    });
