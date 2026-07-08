import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const emailDomain = Deno.env.get('SAT_AUTH_EMAIL_DOMAIN') || 'satprep.local';

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: 'Supabase environment variables are not configured.' }, 500);
  }

  const authHeader = request.headers.get('Authorization') || '';
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return json({ error: 'Not authenticated.' }, 401);
  }

  const { data: adminProfile, error: profileError } = await adminClient
    .from('profiles')
    .select('role, is_active')
    .eq('id', userData.user.id)
    .single();

  if (profileError || adminProfile?.role !== 'admin' || adminProfile?.is_active === false) {
    return json({ error: 'Admin access required.' }, 403);
  }

  const body = await request.json().catch(() => ({}));
  const fullName = String(body.full_name || '').trim();
  const username = String(body.username || '').trim().toLowerCase();
  const password = String(body.password || '');
  const assignExistingTests = body.assign_existing_tests !== false;

  if (!fullName || !username || password.length < 6) {
    return json({ error: 'Full name, username, and a 6+ character password are required.' }, 400);
  }

  if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
    return json({ error: 'Username must be 3-40 characters and use only letters, numbers, dots, underscores, or hyphens.' }, 400);
  }

  const { data: existingProfile, error: existingError } = await adminClient
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle();

  if (existingError) {
    return json({ error: existingError.message }, 400);
  }

  if (existingProfile) {
    return json({ error: `Username "${username}" is already taken.` }, 409);
  }

  const email = username.includes('@') ? username : `${username}@${emailDomain}`;
  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      username,
      role: 'student',
    },
  });

  if (createError || !created.user) {
    return json({ error: createError?.message || 'Could not create Auth user.' }, 400);
  }

  const { error: insertError } = await adminClient
    .from('profiles')
    .insert({
      id: created.user.id,
      full_name: fullName,
      username,
      role: 'student',
      is_active: true,
    });

  if (insertError) {
    await adminClient.auth.admin.deleteUser(created.user.id);
    return json({ error: insertError.message }, 400);
  }

  let assignedTests = 0;
  if (assignExistingTests) {
    const { data: publishedTests, error: testsError } = await adminClient
      .from('tests')
      .select('id')
      .eq('status', 'published');

    if (testsError) {
      await adminClient.from('profiles').delete().eq('id', created.user.id);
      await adminClient.auth.admin.deleteUser(created.user.id);
      return json({ error: testsError.message }, 400);
    }

    if (publishedTests && publishedTests.length > 0) {
      const assignments = publishedTests.map((test) => ({
        test_id: test.id,
        student_id: created.user.id,
        assigned_by: userData.user.id,
      }));

      const { error: assignError } = await adminClient
        .from('test_assignments')
        .upsert(assignments, { onConflict: 'test_id,student_id', ignoreDuplicates: true });

      if (assignError) {
        await adminClient.from('profiles').delete().eq('id', created.user.id);
        await adminClient.auth.admin.deleteUser(created.user.id);
        return json({ error: assignError.message }, 400);
      }

      assignedTests = assignments.length;
    }
  }

  return json({
    id: created.user.id,
    username,
    email,
    assigned_tests: assignedTests,
  });
});
