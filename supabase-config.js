// Central Supabase configuration for the static SAT platform.
// The anon key is public by design, but it must only appear in this file.
(function () {
  const url = 'https://lsbpskmzffmaztczlokh.supabase.co';
  const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxzYnBza216ZmZtYXp0Y3psb2toIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2OTc5NzMsImV4cCI6MjA5ODI3Mzk3M30.zRtly7a6XPKoU6BaZ2eftQxxOTFSUkw1wQ8A6-H1-tI';
  const emailDomain = 'satprep.local';

  window.SAT_SUPABASE_URL = url;
  window.SAT_SUPABASE_ANON_KEY = anonKey;
  window.SAT_AUTH_EMAIL_DOMAIN = emailDomain;

  window.satAuthEmailFromUsername = function satAuthEmailFromUsername(value) {
    const username = String(value || '').trim().toLowerCase();
    if (!username) return '';
    return username.includes('@') ? username : `${username}@${emailDomain}`;
  };

  window.satGetClient = function satGetClient() {
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      throw new Error('Supabase JS is not loaded. Include @supabase/supabase-js before supabase-config.js.');
    }
    if (!window.SAT_SUPABASE_CLIENT) {
      window.SAT_SUPABASE_CLIENT = window.supabase.createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
    }
    return window.SAT_SUPABASE_CLIENT;
  };

  window.satGetSession = async function satGetSession() {
    const client = window.satGetClient();
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    return data.session || null;
  };

  window.satGetProfile = async function satGetProfile(userId) {
    if (!userId) return null;
    const client = window.satGetClient();
    let { data, error } = await client
      .from('profiles')
      .select('id, full_name, username, role, is_active, target_score, created_at, last_login_at')
      .eq('id', userId)
      .single();
    if (error && /target_score/i.test(error.message || '')) {
      const fallback = await client
        .from('profiles')
        .select('id, full_name, username, role, is_active, created_at, last_login_at')
        .eq('id', userId)
        .single();
      data = fallback.data ? { ...fallback.data, target_score: null } : null;
      error = fallback.error;
    }
    if (error) throw error;
    return data;
  };

  window.satRedirectToLogin = function satRedirectToLogin(role) {
    window.SAT_AUTH_BLOCKED = true;
    window.location.replace(role === 'admin' ? 'admin-login.html' : 'student-login.html');
  };

  window.satRequireAuth = async function satRequireAuth(requiredRole) {
    const client = window.satGetClient();
    const session = await window.satGetSession();
    if (!session) {
      window.satRedirectToLogin(requiredRole);
      return null;
    }

    const profile = await window.satGetProfile(session.user.id);
    if (!profile || profile.is_active === false || (requiredRole && profile.role !== requiredRole)) {
      await client.auth.signOut();
      window.satRedirectToLogin(requiredRole || 'student');
      return null;
    }

    const cachedUser = {
      id: profile.id,
      name: profile.full_name,
      username: profile.username,
      role: profile.role,
    };
    localStorage.setItem('sat_user', JSON.stringify(cachedUser));

    return { client, session, user: session.user, profile };
  };

  async function authHeaders(extraHeaders) {
    const session = await window.satGetSession();
    return {
      apikey: anonKey,
      Authorization: `Bearer ${session ? session.access_token : anonKey}`,
      ...extraHeaders,
    };
  }

  window.satRest = async function satRest(path, options = {}) {
    const method = options.method || 'GET';
    const headers = await authHeaders(options.headers || {});
    const init = { method, headers };

    if (options.body !== undefined) {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
      init.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    }

    const response = await fetch(`${url}/rest/v1/${path}`, init);
    const text = await response.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch (err) {
        data = text;
      }
    }
    if (!response.ok) {
      const message = data && data.message ? data.message : text || `Supabase request failed (${response.status})`;
      throw new Error(message);
    }
    return data;
  };

  window.satRpc = async function satRpc(functionName, body) {
    return window.satRest(`rpc/${functionName}`, {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: body || {},
    });
  };

  window.satInsert = async function satInsert(table, data, prefer = 'return=representation') {
    return window.satRest(table, {
      method: 'POST',
      headers: { Prefer: prefer },
      body: data,
    });
  };

  window.satPatch = async function satPatch(path, data, prefer = 'return=representation') {
    return window.satRest(path, {
      method: 'PATCH',
      headers: { Prefer: prefer },
      body: data,
    });
  };

  window.satDelete = async function satDelete(path) {
    return window.satRest(path, { method: 'DELETE' });
  };
}());
