(function () {
  const KEY = 'sat_theme';

  function preferredTheme() {
    const saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(KEY, theme);
    const button = document.querySelector('[data-theme-toggle]');
    if (button) button.textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
  }

  function injectToggle() {
    const sidebar = document.querySelector('.sidebar');
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
