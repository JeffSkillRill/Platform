(function () {
  const pwInput = document.getElementById('password');
  const toggleBtn = document.getElementById('togglePw');
  const form = document.getElementById('adminLoginForm');
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
    const input = document.getElementById(inputId);
    input.classList.add('error');
    input.setAttribute('aria-invalid', 'true');
    const error = document.getElementById(errorId);
    error.textContent = msg;
    error.classList.add('visible');
  }

  function clearError(inputId, errorId) {
    const input = document.getElementById(inputId);
    input.classList.remove('error');
    input.removeAttribute('aria-invalid');
    document.getElementById(errorId).classList.remove('visible');
  }

  function showGlobalError(message) {
    globalError.textContent = message;
    globalError.classList.add('visible');
  }

  usernameInput.addEventListener('input', () => {
    clearError('username', 'usernameError');
    globalError.classList.remove('visible');
  });

  passwordInput.addEventListener('input', () => {
    clearError('password', 'passwordError');
    globalError.classList.remove('visible');
  });

  async function requireAdminProfile(userId) {
    const profile = await window.satGetProfile(userId);
    if (!profile || profile.role !== 'admin' || profile.is_active === false) {
      const error = new Error('This login is not an active admin account.');
      error.code = 'SAT_PROFILE_ACCESS';
      throw error;
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
    if (!valid) {
      (username ? passwordInput : usernameInput).focus();
      return;
    }

    window.satSetButtonLoading(submitBtn, true, 'Signing in');

    try {
      const client = window.satGetClient();
      const { data, error } = await client.auth.signInWithPassword({
        email: window.satAuthEmailFromUsername(username),
        password,
      });
      if (error) {
        console.error(error);
        if (error.status === 400 || error.status === 401) {
          showGlobalError('Incorrect username or password. Try again.');
        } else {
          showGlobalError('Could not reach the sign-in service. Check your connection and try again.');
        }
        return;
      }

      let profile;
      try {
        profile = await requireAdminProfile(data.user.id);
      } catch (profileErr) {
        console.error(profileErr);
        if (profileErr.code === 'SAT_PROFILE_ACCESS') {
          try { await client.auth.signOut(); } catch (signOutErr) { console.error(signOutErr); }
          showGlobalError(profileErr.message);
        } else {
          showGlobalError('You are signed in, but your admin profile could not be loaded. Check your connection and try again.');
        }
        return;
      }

      localStorage.setItem('sat_user', JSON.stringify({
        id: profile.id,
        name: profile.full_name,
        username: profile.username,
        role: profile.role,
      }));
      window.location.href = 'admin-dashboard.html';
    } catch (err) {
      console.error(err);
      try { await window.satGetClient().auth.signOut(); } catch (signOutErr) { console.error(signOutErr); }
      showGlobalError('Could not complete sign-in. Check your connection and try again.');
    } finally {
      window.satSetButtonLoading(submitBtn, false);
    }
  });
}());
