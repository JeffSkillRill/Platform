(function () {
  const role = document.body?.dataset?.authRole;
  if (!role) {
    window.SAT_AUTH_READY = Promise.resolve(null);
    return;
  }

  window.SAT_AUTH_READY = window.satRequireAuth(role)
    .then((context) => {
      if (!context) return null;
      window.SAT_CURRENT_SESSION = context.session;
      window.SAT_CURRENT_PROFILE = context.profile;
      document.dispatchEvent(new CustomEvent('sat:auth-ready', { detail: context }));
      return context;
    })
    .catch((error) => {
      console.error(error);
      window.satRedirectToLogin(role);
      return null;
    });
}());
