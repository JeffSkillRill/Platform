// Shared mobile navigation: hamburger + off-canvas sidebar drawer.
// Requires css/mobile.css. Safe on pages without a sidebar (no-op).
(function () {
  const sidebar = document.querySelector('.sidebar, .nav-sidebar');
  if (!sidebar) return;

  const BURGER_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round">' +
    '<path d="M4 7h16M4 12h16M4 17h16"/></svg>';

  const NAV_ICON_PATHS = {
    'admin-dashboard.html': '<path stroke-linecap="round" stroke-linejoin="round" d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10"/>',
    'student-home.html': '<path stroke-linecap="round" stroke-linejoin="round" d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10"/>',
    'admin-students.html': '<path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.4-1.9M17 20H7m10 0v-2a5 5 0 00-10 0v2m8-13a3 3 0 11-6 0 3 3 0 016 0z"/>',
    'admin-classes.html': '<path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.4-1.9M17 20H7m10 0v-2a5 5 0 00-10 0v2m8-13a3 3 0 11-6 0 3 3 0 016 0z"/>',
    'student-classes.html': '<path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.4-1.9M17 20H7m10 0v-2a5 5 0 00-10 0v2m8-13a3 3 0 11-6 0 3 3 0 016 0z"/>',
    'admin-tests.html': '<path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h6l6 6v10a2 2 0 01-2 2z"/>',
    'student-tests.html': '<path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h6l6 6v10a2 2 0 01-2 2z"/>',
    'admin-question-bank.html': '<path stroke-linecap="round" stroke-linejoin="round" d="M4 5a2 2 0 012-2h12a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm4 2h8M8 11h8M8 15h5"/>',
    'student-question-bank.html': '<path stroke-linecap="round" stroke-linejoin="round" d="M4 5a2 2 0 012-2h12a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm4 2h8M8 11h8M8 15h5"/>',
    'admin-vocabulary.html': '<path stroke-linecap="round" stroke-linejoin="round" d="M4 5.5A2.5 2.5 0 016.5 3H11v17H6.5A2.5 2.5 0 014 17.5v-12zM20 5.5A2.5 2.5 0 0017.5 3H13v17h4.5a2.5 2.5 0 002.5-2.5v-12z"/>',
    'student-vocabulary.html': '<path stroke-linecap="round" stroke-linejoin="round" d="M4 5.5A2.5 2.5 0 016.5 3H11v17H6.5A2.5 2.5 0 014 17.5v-12zM20 5.5A2.5 2.5 0 0017.5 3H13v17h4.5a2.5 2.5 0 002.5-2.5v-12z"/>',
    'student-practice.html': '<path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m6-6H6"/>',
    'student-results.html': '<path stroke-linecap="round" stroke-linejoin="round" d="M5 19V9m7 10V5m7 14v-7"/>',
    'admin-leaderboard.html': '<path stroke-linecap="round" stroke-linejoin="round" d="M12 3l2.3 4.7 5.2.8-3.8 3.7.9 5.3-4.6-2.5-4.6 2.5.9-5.3-3.8-3.7 5.2-.8L12 3z"/>',
    'student-leaderboard.html': '<path stroke-linecap="round" stroke-linejoin="round" d="M12 3l2.3 4.7 5.2.8-3.8 3.7.9 5.3-4.6-2.5-4.6 2.5.9-5.3-3.8-3.7 5.2-.8L12 3z"/>',
  };

  function ensureNavIcons() {
    sidebar.querySelectorAll('.nav-item[href]').forEach((link) => {
      if (link.querySelector('.nav-icon')) return;
      let page;
      try {
        page = new URL(link.href, window.location.href).pathname.split('/').pop();
      } catch (error) {
        return;
      }
      const path = NAV_ICON_PATHS[page];
      if (!path) return;
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.setAttribute('class', 'nav-icon');
      icon.setAttribute('fill', 'none');
      icon.setAttribute('stroke', 'currentColor');
      icon.setAttribute('stroke-width', '2');
      icon.setAttribute('viewBox', '0 0 24 24');
      icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = path;
      link.classList.add('has-injected-nav-icon');
      link.prepend(icon);
    });
  }

  ensureNavIcons();

  function ensureLogoutButton() {
    if (sidebar.querySelector('[data-satm-logout], [onclick*="handleLogout"], [onclick*="handleAdminLogout"]')) return;
    const host = sidebar.querySelector('.sidebar-bottom') || sidebar;
    const button = document.createElement('button');
    const isAdmin = document.body.dataset.authRole === 'admin';
    button.type = 'button';
    button.className = 'satm-sidebar-logout';
    button.dataset.satmLogout = 'true';
    button.textContent = 'Sign out';
    button.addEventListener('click', () => {
      const handler = isAdmin ? window.handleAdminLogout : window.handleLogout;
      if (typeof handler === 'function') handler();
    });
    host.appendChild(button);
  }

  ensureLogoutButton();

  function makeBurger() {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'satm-burger';
    b.setAttribute('aria-label', 'Open menu');
    b.innerHTML = BURGER_SVG;
    b.addEventListener('click', toggle);
    return b;
  }

  function makeLogoLink() {
    const link = document.createElement('a');
    const isAdmin = document.body.dataset.authRole === 'admin';
    link.className = 'brand-lockup satm-brand';
    link.href = isAdmin ? 'admin-dashboard.html' : 'student-home.html';
    link.setAttribute('aria-label', isAdmin ? '4Prep admin dashboard' : '4Prep student home');
    link.appendChild(window.Logo({ size: 32, variant: 'white' }));
    return link;
  }

  // Overlay (click to close)
  const overlay = document.createElement('div');
  overlay.className = 'satm-overlay';
  overlay.addEventListener('click', close);
  document.body.appendChild(overlay);

  // Reuse an existing mobile topbar if the page has one; otherwise inject ours.
  const existing = document.querySelector('.mobile-topbar');
  if (existing) {
    existing.insertBefore(makeBurger(), existing.firstChild);
  } else {
    const bar = document.createElement('div');
    bar.className = 'satm-topbar';
    bar.appendChild(makeBurger());
    bar.appendChild(makeLogoLink());
    const title = document.createElement('span');
    title.className = 'satm-title';
    const t = document.querySelector('.topbar-title, .page-head h1');
    title.textContent = (t && t.textContent.trim()) || '4Prep';
    bar.appendChild(title);
    document.body.insertBefore(bar, document.body.firstChild);
  }

  function open() {
    document.body.classList.add('satm-nav-open');
  }
  function close() {
    document.body.classList.remove('satm-nav-open');
  }
  function toggle() {
    document.body.classList.toggle('satm-nav-open');
  }

  // Must match the breakpoint in css/mobile.css (1024px — see the
  // comment there about legacy per-page sidebar breakpoints).
  const mobileViewport = window.matchMedia('(max-width: 1024px)');
  mobileViewport.addEventListener('change', function (event) {
    if (!event.matches) close();
  });

  // Close the drawer when a nav link is tapped or Escape is pressed.
  sidebar.addEventListener('click', function (e) {
    if (e.target.closest('a')) close();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') close();
  });
}());
