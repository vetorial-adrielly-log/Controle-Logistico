const { createClient } = require('@supabase/supabase-js');

// Cadastro e exclusão de usuários do módulo de rastreamento (/logistica/).
// - contratante: cria/exclui qualquer perfil (contratante, transportadora, motorista)
// - transportadora: cria/exclui só motoristas da própria transportadora
// Motoristas sem e-mail recebem um e-mail interno gerado a partir do CPF
// (<cpf>@motorista.local) e entram no app digitando o CPF.

const DRIVER_EMAIL_DOMAIN = 'motorista.local';
const ROLES = ['contratante', 'transportadora', 'motorista'];

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});
const digits = (v) => String(v || '').replace(/\D/g, '');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Método não permitido.' });

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) return json(401, { error: 'Sessão ausente.' });

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return json(500, { error: 'Função não configurada: defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nas variáveis de ambiente do Netlify.' });
    }
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // 1. Quem está chamando?
    const { data: callerData, error: callerErr } = await admin.auth.getUser(token);
    if (callerErr || !callerData?.user) return json(401, { error: 'Sessão inválida ou expirada.' });

    const { data: caller } = await admin
      .from('lg_users')
      .select('id, role, carrier_id, ativo')
      .eq('id', callerData.user.id)
      .single();
    if (!caller || !caller.ativo || !['contratante', 'transportadora'].includes(caller.role)) {
      return json(403, { error: 'Sem permissão para gerenciar usuários.' });
    }

    const body = JSON.parse(event.body || '{}');

    // ---------------- EXCLUIR / TROCAR SENHA ----------------
    if (body.action === 'delete' || body.action === 'password') {
      const { id } = body;
      if (!id) return json(400, { error: 'Informe o usuário.' });
      if (id === caller.id) return json(400, { error: 'Você não pode alterar o próprio usuário por aqui.' });

      const { data: target } = await admin.from('lg_users').select('id, role, carrier_id').eq('id', id).single();
      if (!target) return json(404, { error: 'Usuário não encontrado.' });
      if (caller.role === 'transportadora' &&
          (target.role !== 'motorista' || target.carrier_id !== caller.carrier_id)) {
        return json(403, { error: 'A transportadora só pode gerenciar os próprios motoristas.' });
      }

      if (body.action === 'password') {
        const password = String(body.password || '');
        if (password.length < 6) return json(400, { error: 'A senha precisa ter ao menos 6 caracteres.' });
        const { error: pwdErr } = await admin.auth.admin.updateUserById(id, { password });
        if (pwdErr) return json(400, { error: pwdErr.message });
        return json(200, { ok: true });
      }

      const { error: delErr } = await admin.auth.admin.deleteUser(id);
      if (delErr) return json(400, { error: delErr.message });
      return json(200, { ok: true });
    }

    // ---------------- CRIAR ----------------
    const nome = String(body.nome || '').trim();
    const role = body.role;
    const password = String(body.password || '');
    const cpf = digits(body.cpf) || null;
    let email = String(body.email || '').trim().toLowerCase();
    let carrierId = body.carrier_id || null;

    if (!nome) return json(400, { error: 'Informe o nome.' });
    if (!ROLES.includes(role)) return json(400, { error: 'Perfil inválido.' });
    if (password.length < 6) return json(400, { error: 'A senha precisa ter ao menos 6 caracteres.' });

    if (caller.role === 'transportadora') {
      if (role !== 'motorista') return json(403, { error: 'A transportadora só pode cadastrar motoristas.' });
      carrierId = caller.carrier_id;
    }
    if (role === 'contratante') carrierId = null;
    if (role !== 'contratante' && !carrierId) return json(400, { error: 'Selecione a transportadora.' });

    if (role === 'motorista') {
      // CPF (11 dígitos) ou documento de motorista estrangeiro
      if (!cpf || cpf.length < 5 || cpf.length > 14) return json(400, { error: 'Informe o CPF (11 dígitos) ou o documento do motorista.' });
      if (!email) email = `${cpf}@${DRIVER_EMAIL_DOMAIN}`;
    }
    if (!email) return json(400, { error: 'Informe o e-mail.' });

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });
    if (createErr) {
      const msg = /already/i.test(createErr.message) ? 'Já existe um usuário com este e-mail/CPF.' : createErr.message;
      return json(400, { error: msg });
    }

    const { error: insertErr } = await admin.from('lg_users').insert({
      id: created.user.id,
      nome,
      email,
      role,
      carrier_id: carrierId,
      cpf: role === 'motorista' ? cpf : null,
      telefone: String(body.telefone || '').trim(),
      placa: String(body.placa || '').trim().toUpperCase()
    });
    if (insertErr) {
      await admin.auth.admin.deleteUser(created.user.id);
      const msg = /lg_users_cpf_key/.test(insertErr.message) ? 'Já existe um motorista com este CPF.' : insertErr.message;
      return json(400, { error: msg });
    }

    return json(200, { ok: true, id: created.user.id, email });
  } catch (err) {
    return json(500, { error: err.message || 'Erro inesperado.' });
  }
};
