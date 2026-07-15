// Shared mobile navigation: hamburger + off-canvas sidebar drawer.
// Requires css/mobile.css. Safe on pages without a sidebar (no-op).
(function () {
  const sidebar = document.querySelector('.sidebar, .nav-sidebar');
  if (!sidebar) return;

  const BURGER_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round">' +
    '<path d="M4 7h16M4 12h16M4 17h16"/></svg>';

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

  // Close the drawer when a nav link is tapped or Escape is pressed.
  sidebar.addEventListener('click', function (e) {
    if (e.target.closest('a')) close();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') close();
  });
}());
