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

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: callerData, error: callerErr } = await admin.auth.getUser(token);
    if (callerErr || !callerData?.user) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Sessão inválida ou expirada.' }) };
    }

    const { data: callerProfile, error: callerProfileErr } = await admin
      .from('profiles')
      .select('role')
      .eq('id', callerData.user.id)
      .single();

    if (callerProfileErr || callerProfile?.role !== 'admin') {
      return { statusCode: 403, body: JSON.stringify({ error: 'Apenas administradores podem excluir usuários.' }) };
    }

    const { userId } = JSON.parse(event.body || '{}');
    if (!userId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'userId é obrigatório.' }) };
    }
    if (userId === callerData.user.id) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Você não pode excluir o próprio usuário logado.' }) };
    }

    // Excluir o usuário de Auth também remove o profile (FK on delete cascade)
    const { error: deleteErr } = await admin.auth.admin.deleteUser(userId);
    if (deleteErr) {
      return { statusCode: 400, body: JSON.stringify({ error: deleteErr.message }) };
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message || 'Erro inesperado.' }) };
  }
};
