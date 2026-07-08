(function () {
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[ch]));
  }

  function parseJson(value, fallback = {}) {
    if (value === null || value === undefined || value === '') return fallback;
    if (typeof value === 'object') return value;
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
    } catch (err) {
      return fallback;
    }
  }

  function initialsFor(name, fallback = 'ST') {
    const initials = String(name || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
    return initials || fallback;
  }

  function formatDate(value) {
    if (!value) return '—';
    return new Date(value).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function formatShortDate(value) {
    if (!value) return '—';
    return new Date(value).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }

  function formatTime(seconds) {
    const total = Math.max(0, Number(seconds) || 0);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    if (hours) return `${hours}h ${minutes}m ${secs}s`;
    return `${minutes}m ${String(secs).padStart(2, '0')}s`;
  }

  function safeImageUrl(value) {
    const url = String(value || '').trim();
    if (!url) return '';
    try {
      const parsed = new URL(url, window.location.href);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return parsed.href;
    } catch (err) {
      return '';
    }
    return '';
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  async function handleLogout() {
    if (!confirm('Sign out?')) return;
    localStorage.removeItem('sat_user');
    const client = window.satGetClient();
    await client.auth.signOut();
    window.location.href = 'student-login.html';
  }

  async function handleAdminLogout() {
    if (!confirm('Sign out?')) return;
    localStorage.removeItem('sat_user');
    const client = window.satGetClient();
    await client.auth.signOut();
    window.location.href = 'admin-login.html';
  }

  function setSidebarUser(profile, ids) {
    const name = profile?.full_name || profile?.name || 'Student';
    const initials = initialsFor(name, profile?.role === 'admin' ? 'AD' : 'ST');
    (ids.name || []).forEach((id) => setText(id, name));
    (ids.avatar || []).forEach((id) => setText(id, initials));
  }

  window.escapeHtml = escapeHtml;
  window.esc = escapeHtml;
  window.parseJson = parseJson;
  window.initialsFor = initialsFor;
  window.formatDate = formatDate;
  window.formatShortDate = formatShortDate;
  window.formatTime = formatTime;
  window.safeImageUrl = safeImageUrl;
  window.satSetText = setText;
  window.satSetSidebarUser = setSidebarUser;
  window.handleLogout = handleLogout;
  window.handleAdminLogout = handleAdminLogout;
}());
