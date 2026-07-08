(function () {
  const pwInput = document.getElementById('password');
  const toggleBtn = document.getElementById('togglePw');
  const form = document.getElementById('studentLoginForm');
  const submitBtn = document.getElementById('submitBtn');
  const globalError = document.getElementById('globalError');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');

  toggleBtn.addEventListener('click', () => {
    const isHidden = pwInput.type === 'password';
    pwInput.type = isHidden ? 'text' : 'password';
    toggleBtn.textContent = isHidden ? 'Hide' : 'Show';
  });

  function setError(inputId, errorId, msg) {
    document.getElementById(inputId).classList.add('error');
    const error = document.getElementById(errorId);
    error.textContent = msg;
    error.classList.add('visible');
  }

  function clearError(inputId, errorId) {
    document.getElementById(inputId).classList.remove('error');
    document.getElementById(errorId).classList.remove('visible');
  }

  usernameInput.addEventListener('input', () => {
    clearError('username', 'usernameError');
    globalError.classList.remove('visible');
  });

  passwordInput.addEventListener('input', () => {
    clearError('password', 'passwordError');
    globalError.classList.remove('visible');
  });

  async function requireStudentProfile(userId) {
    const profile = await window.satGetProfile(userId);
    if (!profile || profile.role !== 'student' || profile.is_active === false) {
      throw new Error('This login is not an active student account.');
    }
    return profile;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    let valid = true;

    if (!username) {
      setError('username', 'usernameError', 'Username is required.');
      valid = false;
    }
    if (!password) {
      setError('password', 'passwordError', 'Password is required.');
      valid = false;
    }
    if (!valid) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in...';

    try {
      const client = window.satGetClient();
      const { data, error } = await client.auth.signInWithPassword({
        email: window.satAuthEmailFromUsername(username),
        password,
      });
      if (error) throw error;

      const profile = await requireStudentProfile(data.user.id);
      localStorage.setItem('sat_user', JSON.stringify({
        id: profile.id,
        name: profile.full_name,
        username: profile.username,
        role: profile.role,
      }));
      window.location.href = 'student-home.html';
    } catch (err) {
      console.error(err);
      try { await window.satGetClient().auth.signOut(); } catch (signOutErr) { console.error(signOutErr); }
      globalError.classList.add('visible');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign in';
    }
  });
}());
