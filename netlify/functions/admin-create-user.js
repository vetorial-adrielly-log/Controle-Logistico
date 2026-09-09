const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método não permitido.' }) };
  }

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Sessão ausente.' }) };
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Função não configurada: defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nas variáveis de ambiente do Netlify.' }) };
    }

    // Cliente com a service role key (acesso total, ignora RLS)
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // 1. Identifica quem está chamando, a partir do token enviado pelo front-end
    const { data: callerData, error: callerErr } = await admin.auth.getUser(token);
    if (callerErr || !callerData?.user) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Sessão inválida ou expirada.' }) };
    }

    // 2. Confirma que quem está chamando é administrador
    const { data: callerProfile, error: callerProfileErr } = await admin
      .from('profiles')
      .select('role')
      .eq('id', callerData.user.id)
      .single();

    if (callerProfileErr || callerProfile?.role !== 'admin') {
      return { statusCode: 403, body: JSON.stringify({ error: 'Apenas administradores podem cadastrar usuários.' }) };
    }

    // 3. Lê os dados do novo usuário
    const body = JSON.parse(event.body || '{}');
    const { email, password, username, role, allowedPanels } = body;

    if (!email || !password || !username) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Preencha e-mail, senha e nome de exibição.' }) };
    }
    if (password.length < 6) {
      return { statusCode: 400, body: JSON.stringify({ error: 'A senha precisa ter ao menos 6 caracteres.' }) };
    }

    // 4. Cria o usuário no Supabase Auth
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });
    if (createErr) {
      return { statusCode: 400, body: JSON.stringify({ error: createErr.message }) };
    }

    // 5. Cria a linha correspondente em profiles
    const finalRole = role === 'admin' ? 'admin' : 'user';
    const { error: insertErr } = await admin.from('profiles').insert({
      id: created.user.id,
      email,
      username,
      role: finalRole,
      allowed_panels: finalRole === 'admin' ? [] : (Array.isArray(allowedPanels) ? allowedPanels : [])
    });

    if (insertErr) {
      // Reverte a criação do usuário de autenticação se o perfil falhar
      await admin.auth.admin.deleteUser(created.user.id);
      return { statusCode: 400, body: JSON.stringify({ error: insertErr.message }) };
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, id: created.user.id }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message || 'Erro inesperado.' }) };
  }
};
