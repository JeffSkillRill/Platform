(function () {
  const AUTH_TIMEOUT_MS = 15000;
  const role = document.body?.dataset?.authRole;
  if (!role) {
    window.SAT_AUTH_READY = Promise.resolve(null);
    return;
  }

  function showConnectionProblem() {
    if (document.querySelector('.sat-auth-connection-error')) return;
    const host = document.querySelector('main, .main, .content') || document.body;
    const notice = document.createElement('div');
    notice.className = 'sat-auth-connection-error';
    notice.setAttribute('role', 'alert');

    const message = document.createElement('span');
    message.textContent = 'Connection problem';

    const retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = 'Retry';
    retry.addEventListener('click', () => window.location.reload());

    notice.append(message, document.createTextNode(' — '), retry);
    host.prepend(notice);
  }

  const loader = window.satAnimations?.showLoader('Checking access…', { delay: 150 });
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => {
      const error = new Error('Authentication check timed out');
      error.code = 'SAT_AUTH_TIMEOUT';
      reject(error);
    }, AUTH_TIMEOUT_MS);
  });

  window.SAT_AUTH_READY = Promise.race([window.satRequireAuth(role), timeout])
    .then((context) => {
      if (!context) return null;
      window.SAT_CURRENT_SESSION = context.session;
      window.SAT_CURRENT_PROFILE = context.profile;
      document.dispatchEvent(new CustomEvent('sat:auth-ready', { detail: context }));
      return context;
    })
    .catch((error) => {
      if (error?.code === 'SAT_AUTH_TIMEOUT') {
        console.warn(error.message);
        showConnectionProblem();
        return null;
      }
      console.error(error);
      window.satRedirectToLogin(role);
      return null;
    })
    .finally(() => {
      window.clearTimeout(timeoutId);
      loader?.hide();
    });
}());
