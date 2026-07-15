(function () {
  const KEY = 'sat_theme';

  function getSavedTheme() {
    try {
      return localStorage.getItem(KEY);
    } catch (_) {
      return null;
    }
  }

  function saveTheme(theme) {
    try {
      localStorage.setItem(KEY, theme);
    } catch (_) {
      // Theme still works for the current page when storage is unavailable.
    }
  }

  function preferredTheme() {
    const saved = getSavedTheme();
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    saveTheme(theme);
    const button = document.querySelector('[data-theme-toggle]');
    if (button) {
      const nextTheme = theme === 'dark' ? 'light' : 'dark';
      button.textContent = `${nextTheme === 'dark' ? 'Dark' : 'Light'} mode`;
      button.setAttribute('aria-label', `Switch to ${nextTheme} mode`);
    }
  }

  function injectToggle() {
    const sidebar = document.querySelector('.sidebar, .nav-sidebar');
    if (!sidebar || sidebar.querySelector('[data-theme-toggle]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'theme-toggle';
    button.dataset.themeToggle = 'true';
    button.addEventListener('click', () => {
      applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
    });
    const bottom = sidebar.querySelector('.sidebar-bottom') || sidebar.querySelector('.student') || null;
    if (bottom) sidebar.insertBefore(button, bottom);
    else sidebar.appendChild(button);
    applyTheme(document.documentElement.dataset.theme || preferredTheme());
  }

  applyTheme(preferredTheme());
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectToggle);
  } else {
    injectToggle();
  }
}());
