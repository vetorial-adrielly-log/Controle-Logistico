# Portal de Painéis de Logística — Vetorial

Portal com login, controle de acesso por painel e área administrativa, agora rodando com
**Supabase** (banco de dados + autenticação real) e hospedado no **Netlify** (site + funções
serverless).

## O que mudou em relação à versão anterior

- Login por **e-mail + senha real**, gerenciado pelo Supabase Auth (nada de senha salva no
  navegador).
- Usuários e permissões de painel ficam em uma tabela `profiles` no Postgres do Supabase,
  protegida por Row Level Security (RLS): cada usuário só enxerga o que pode, e só
  administradores conseguem alterar cadastros.
- Criar/excluir usuários exige a `service_role key` do Supabase, que **nunca** deve ficar no
  navegador — por isso essas duas ações passam por duas **Netlify Functions**
  (`netlify/functions/admin-create-user.js` e `admin-delete-user.js`), que rodam no servidor.
- Editar um usuário existente (nome, perfil, painéis liberados) e gerenciar painéis continua
  acontecendo direto do navegador, protegido pelas políticas de RLS.

## Estrutura de arquivos

```
vetorial-portal/
├── index.html                          # o portal em si (front-end)
├── netlify.toml                        # configuração do Netlify
├── package.json                        # dependência das functions
├── netlify/functions/
│   ├── admin-create-user.js
│   └── admin-delete-user.js
└── supabase/
    └── schema.sql                      # script para criar as tabelas no Supabase
```

## Passo 1 — Criar o projeto no Supabase

1. Crie uma conta em [supabase.com](https://supabase.com) e clique em **New project**.
2. Anote a **senha do banco** que você definir (só é usada internamente pelo Supabase).
3. Quando o projeto terminar de provisionar, vá em **Project Settings → API** e copie:
   - `Project URL` (algo como `https://xxxxxxxx.supabase.co`)
   - `anon public key`
   - `service_role key` (fique **muito** atento: essa chave nunca deve ir para o front-end)

## Passo 2 — Criar as tabelas

1. No painel do Supabase, abra **SQL Editor → New query**.
2. Cole todo o conteúdo de `supabase/schema.sql` e clique em **Run**.
3. Isso cria as tabelas `profiles` e `panels`, as políticas de segurança (RLS) e 5 painéis de
   exemplo (Visão Geral, Ferro Gusa, Minério de Ferro, Co Produtos, Carvão) já com os ícones
   certos — você edita nome/ícone/URL de cada um depois, direto pela tela de Admin.

## Passo 3 — Criar o primeiro administrador

O cadastro de usuários pela tela do portal só funciona depois que já existe um administrador
logado (é ele quem aciona a função que cria os demais). Por isso o primeiro precisa ser criado
manualmente:

1. No Supabase, vá em **Authentication → Users → Add user**, preencha e-mail e senha, e marque
   **Auto Confirm User**.
2. Copie o **UID** desse usuário na lista.
3. Volte ao **SQL Editor** e rode (trocando os valores):

   ```sql
   insert into public.profiles (id, email, username, role, allowed_panels)
   values ('COLE-O-UID-AQUI', 'admin@suaempresa.com', 'Administrador', 'admin', '{}');
   ```

Esse usuário já pode fazer login no portal e, a partir da tela **Admin → Usuários**, cadastrar
todo mundo normalmente.

## Passo 4 — Preencher a configuração no `index.html`

Abra `index.html`, procure por `SUPABASE CONFIG` perto do topo do `<script>` final, e substitua:

```js
const SUPABASE_URL = "https://SEU-PROJETO.supabase.co";
const SUPABASE_ANON_KEY = "SUA-CHAVE-ANON-PUBLICA";
```

pelos valores do Passo 1 (`Project URL` e `anon public key`). Essa chave é pública por design —
quem protege os dados é o RLS configurado no banco, não o segredo da chave.

## Passo 5 — Publicar no Netlify

**Opção A — arrastar e soltar (mais simples, mas sem as Functions funcionando via Git):**
Acesse [app.netlify.com/drop](https://app.netlify.com/drop) e arraste a pasta inteira
`vetorial-portal`. Funciona para o site, mas para as Netlify Functions funcionarem com as
variáveis de ambiente é melhor a Opção B.

**Opção B — via Git (recomendado):**
1. Suba esta pasta para um repositório no GitHub (esta pasta já vem com um repositório Git
   inicializado e o primeiro commit pronto — você só precisa criar o repositório vazio no
   GitHub e apontar para ele):

   ```bash
   cd vetorial-portal
   git remote add origin https://github.com/SEU-USUARIO/vetorial-portal.git
   git push -u origin main
   ```

   (Crie o repositório vazio antes em [github.com/new](https://github.com/new) — **sem**
   marcar as opções de README/gitignore/license, para não conflitar com o que já existe aqui.
   Se preferir GitLab, o processo é o mesmo, só muda a URL do `git remote add origin`.)
2. No Netlify ([app.netlify.com](https://app.netlify.com)), clique em **Add new site → Import
   an existing project**, escolha **GitHub** e autorize o Netlify a acessar sua conta, depois
   selecione o repositório `vetorial-portal` que você acabou de criar.
3. Na tela de configuração de build, o Netlify já deve detectar o `netlify.toml` e preencher
   sozinho. Confirme que ficou assim (edite se necessário):
   - **Build command:** em branco (não há build a rodar)
   - **Publish directory:** `.`
   - **Functions directory:** `netlify/functions` (o `netlify.toml` já define isso)
4. Antes de clicar em Deploy — ou logo depois, em **Site settings → Environment variables →
   Add a variable** —, adicione as duas variáveis:
   - `SUPABASE_URL` → o mesmo `Project URL` do Passo 1
   - `SUPABASE_SERVICE_ROLE_KEY` → a `service_role key` do Passo 1 (⚠️ nunca coloque essa no
     `index.html` — ela só deve existir aqui, como variável de ambiente do servidor)

   Se você adicionar as variáveis **depois** do primeiro deploy, vá em **Deploys → Trigger
   deploy → Deploy site** para que as Functions passem a enxergá-las.
5. Clique em **Deploy site**. Em 1–2 minutos o Netlify te dá uma URL pública
   (`algo.netlify.app`) — é ela que você vai acessar e compartilhar com a equipe. Se quiser,
   depois dá para trocar por um domínio próprio em **Domain settings**.

Depois do deploy, as Netlify Functions ficam disponíveis em
`https://seu-site.netlify.app/.netlify/functions/admin-create-user` automaticamente — o
`index.html` já chama esse caminho relativo, então não precisa configurar nada a mais.

## Conferindo se ficou tudo certo

1. Abra a URL do Netlify e faça login com o e-mail/senha do administrador criado no Passo 3.
2. Vá em **Admin → Usuários → Novo usuário** e cadastre alguém de teste. Se aparecer erro
   dizendo que a função não foi encontrada, confira se as variáveis `SUPABASE_URL` e
   `SUPABASE_SERVICE_ROLE_KEY` foram salvas no Netlify e se você disparou um novo deploy depois
   de adicioná-las.
3. Vá em **Admin → Painéis** e cole a URL de embed de um relatório do Power BI para ver se ele
   carrega certinho no iframe.

## Testando localmente antes de publicar

Se você tiver o [Netlify CLI](https://docs.netlify.com/cli/get-started/) instalado:

```bash
npm install
netlify dev
```

Isso sobe o site e as Functions juntos em `localhost`, simulando o ambiente de produção
(as variáveis de ambiente locais vão em um arquivo `.env` na raiz do projeto — não o suba
para o Git).

## Resumo de segurança

- `anon key` → pública, vai no `index.html`, protegida pelo RLS.
- `service_role key` → secreta, vive **só** nas variáveis de ambiente do Netlify, usada
  apenas dentro das duas Functions.
- Toda escrita sensível (criar/excluir usuário) passa por uma Function que primeiro confere,
  no banco, se quem está pedindo é mesmo um administrador — mesmo que alguém tente chamar a
  Function diretamente sem passar pela tela.
