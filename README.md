# Portal de Painéis de Logística — Vetorial

> **Novo:** módulo de **Rastreamento Logístico** na pasta `logistica/`, publicado como site próprio (transportadoras, motoristas,
> localização em tempo real, importação de cargas e comprovantes de entrega). Veja a seção
> [Rastreamento Logístico](#rastreamento-logístico-logistica) no fim deste arquivo.

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


---

# Rastreamento Logístico (`logistica/`)

Site para acompanhar as entregas feitas pelas transportadoras contratadas. Usa o **mesmo projeto
Supabase** do portal, mas é publicado como um **site próprio no Netlify** (a pasta `logistica/` é
autossuficiente: tem o próprio `netlify.toml`, `package.json` e função).

## Como funciona

| Perfil | O que faz |
|---|---|
| **Contratante** | Importa o arquivo do sistema que "dá carga" nas rotas, vê **todos** os motoristas de **todas** as transportadoras no mapa, consulta trajetos e comprovantes, cadastra transportadoras e usuários. |
| **Transportadora** | Vê no mapa **só os seus** motoristas, atribui motorista/placa às cargas que vieram para ela e cadastra os próprios motoristas. |
| **Motorista** | Entra pelo celular com **CPF + senha**, vê as rotas atribuídas a ele, toca em **Iniciar rota** (a localização passa a ser enviada), e no fim da rota **envia a foto/PDF do documento de entrega** e toca em **Finalizar entrega**. |

Fluxo de uma carga:

1. O contratante importa o arquivo (CSV ou Excel) exportado do sistema → cada linha vira uma rota
   **Pendente**, ligada à transportadora (pelo CNPJ ou nome) e, se o arquivo trouxer o CPF, ao
   motorista. Reimportar o mesmo arquivo **atualiza** as rotas pelo código da carga, sem perder
   status, trajeto ou comprovantes.
2. Se a carga veio sem motorista, a transportadora escolhe o motorista em **Rotas**.
3. O motorista inicia a rota → status **Em rota**; o celular envia a posição a cada ~30 s em
   movimento (ou a cada 2 min parado). Sem internet, as posições ficam guardadas no aparelho e
   são enviadas quando o sinal volta.
4. No destino, o motorista fotografa o canhoto/documento de entrega (ou anexa um PDF) e finaliza →
   status **Entregue**. O sistema **não deixa finalizar sem o documento**.
5. Contratante e transportadora acompanham tudo no **Painel** (mapa em tempo real) e em **Rotas**
   (detalhe com trajeto no mapa, comprovantes e exportação CSV).

## Arquivos

```
logistica/
├── index.html               # o app (uma página só, responsiva — funciona no celular)
├── app.js                   # lógica das telas dos três perfis
├── app.css                  # estilos (mesma identidade visual do portal)
├── manifest.webmanifest     # permite "Adicionar à tela inicial" no celular
├── icon.svg
├── modelo-importacao.csv    # modelo do arquivo de cargas
├── netlify.toml             # configuração do site próprio no Netlify
├── package.json             # dependência da função
└── netlify/functions/
    └── lg-users.js          # cria/exclui usuários e troca senha (usa a service_role)
supabase/logistica.sql       # tabelas, segurança (RLS), bucket dos comprovantes, realtime
```

## Instalação (uma vez)

1. **Banco:** no Supabase, abra **SQL Editor → New query**, cole todo o conteúdo de
   `supabase/logistica.sql` e clique em **Run**. Isso cria as tabelas `lg_*`, as regras de acesso
   por perfil, o bucket privado **comprovantes** no Storage e liga o Realtime do mapa. O script
   pode ser rodado de novo sem perder dados.
2. **Primeiro contratante:** use um usuário que já existe em **Authentication → Users** (por
   exemplo, o administrador do portal) ou crie um novo (marque **Auto Confirm User**). Copie o UID e
   rode no SQL Editor:

   ```sql
   insert into public.lg_users (id, nome, email, role)
   values ('COLE-O-UID-AQUI', 'Nome do Contratante', 'contratante@suaempresa.com', 'contratante');
   ```
3. **Netlify (site próprio):** em **Add new site → Import an existing project**, escolha o
   repositório e, na tela de configuração, preencha **Base directory** = `logistica` (os demais
   campos vêm de `logistica/netlify.toml`). Em **Environment variables** do novo site, crie:
   - `SUPABASE_URL` → `Project URL` do Supabase
   - `SUPABASE_SERVICE_ROLE_KEY` → a chave **secreta** (`sb_secret_...` ou a `service_role`
     legada), **nunca** a `sb_publishable_...`

   Depois de salvar as variáveis, faça **Deploys → Trigger deploy → Deploy site**.
4. Acesse o endereço do novo site, entre como contratante e:
   - cadastre as **transportadoras** (ou deixe a importação criá-las automaticamente);
   - em **Usuários**, crie um usuário de perfil **Transportadora** para cada empresa;
   - cada transportadora cadastra seus **motoristas** (nome, CPF, senha, placa).

> A URL e a chave pública do Supabase ficam no topo de `logistica/app.js` (já preenchidas com as
> mesmas do portal).

## Arquivo de importação

O arquivo padrão é o **relatório de agendamentos** exportado do sistema (`.xlsx`, cabeçalho em 3
linhas com células mescladas). Ele é reconhecido automaticamente — a tela mostra de qual coluna
vem cada informação e deixa ajustar antes de importar:

| Campo no app | Coluna do relatório |
|---|---|
| Código da carga | `#` (nº do agendamento — chave para reimportar/atualizar) |
| Transportadora | `Transportador › Nome` e `› CNPJ/CPF` |
| Motorista | `Motorista › Nome`, `› Documento identificação`, `› Telefone` |
| Veículo | `Veículo › Placa tração`, `› Placa(s) carreta(s)`, `› Equipamento` |
| Terminal / origem | `Terminal` |
| Cliente / destino | `Cliente › Nome` / `Cliente › Endereço` |
| Operação | `Janela › Descrição` |
| Produto, quantidade | `Contrato › Produtos`, `Quantidade` + `Unidade` |
| Status no sistema, último evento, tempo no terminal | `Status`, `Último Evento`, `Tempo no terminal` |
| Data / janela | `Cota`, `Período › Início` e `› Fim` |
| Agendado por | `Agendado por › Nome` e `› E-mail` |

Regras da importação:
- **Dados pessoais dos motoristas** (nome, documento e telefone) só são importados se a opção
  **"Importar dados dos motoristas"** for marcada na tela de importação — ela vem desmarcada.
- **Sem duplicatas:** o nº do agendamento (`#`) é único no banco. Importar o relatório todo dia
  **atualiza** as rotas que já existem (sem perder status de entrega, trajeto, comprovantes e
  motorista atribuído) e só cria as novas. Antes de importar, a tela mostra quantas são novas,
  quantas serão atualizadas e se há `#` repetido dentro do próprio arquivo (vale a última linha).
- Agendamento com status **Cancelado** no sistema → rota cancelada no app (se ainda não entregue).
- Motorista que **ainda não tem acesso** ao app: a rota guarda nome, documento e telefone dele e
  aparece em **Usuários/Motoristas → "Motoristas das cargas ainda sem acesso"**, com botão
  **Cadastrar** já preenchido. Ao cadastrar, todas as cargas com o documento dele passam para ele
  automaticamente.
- Linha **sem transportadora** no arquivo → entra em **"SEM TRANSPORTADORA"**; o contratante
  escolhe a transportadora certa no detalhe da rota (a reimportação não desfaz a escolha).
- A linha de total no fim do relatório (ex.: "132 veículos") é ignorada.
- Motoristas estrangeiros entram com o número do documento no lugar do CPF.

Também aceita outras planilhas e CSV (veja `logistica/modelo-importacao.csv`).

> **Banco criado antes desta versão?** Rode `supabase/logistica-atualizacao-1.sql` uma vez no SQL
> Editor (adiciona os campos novos; não apaga dados).

## Celular do motorista — pontos importantes

- O motorista abre o endereço do site de rastreamento no navegador do celular
  (Chrome no Android, Safari no iPhone) e entra com **CPF e senha**. Dica: use "Adicionar à tela
  inicial" para abrir como um aplicativo.
- O navegador pede permissão de **localização** na primeira vez — é preciso **permitir**.
- Por ser um site (e não um app instalado da loja), **a localização só é enviada enquanto o app
  estiver aberto na tela**. O app mantém a tela ligada durante a rota (quando o aparelho permite)
  e avisa se o motorista tentar fechar com uma rota em andamento. Se o celular bloquear a tela ou
  o motorista trocar de app, o envio pausa e volta sozinho ao reabrir — e o mapa mostra há quanto
  tempo foi a última posição (verde: até 5 min; laranja: até 30 min; cinza: mais antigo).
  Para rastreamento contínuo em segundo plano seria necessário um app nativo (Android/iOS) — dá para
  evoluir para isso depois aproveitando o mesmo banco.
- Fotos grandes são reduzidas automaticamente antes do envio para economizar dados.
- Motorista esqueceu a senha: a transportadora edita o motorista em **Motoristas** e define uma
  nova senha.

## App Android (rastreamento com a tela bloqueada)

O site roda no navegador, mas o navegador só envia a localização com o app aberto na tela. Para
rastrear com a **tela bloqueada**, existe o **app Android** (pasta `app-android/`, feito com
Capacitor + plugin de localização em segundo plano):

- O app abre o próprio site publicado (endereço em `app-android/site-url.txt`), então tudo o que
  muda no site chega ao app sem reinstalar.
- Ao iniciar uma rota, o Android mostra a notificação fixa **"Rastreamento ativo"** e a posição
  continua sendo enviada com a tela bloqueada ou com outro app aberto. Ao finalizar, a notificação
  some.
- **Gerar o APK:** é automático pelo GitHub Actions (`.github/workflows/android.yml`) sempre que
  algo em `app-android/` muda na `main`; ou manualmente em **Actions → App Android (APK) → Run
  workflow**. O arquivo `rastreamento-logistico.apk` fica em **Releases** e nos *Artifacts* da
  execução.
- **Instalar no celular:** envie o APK ao motorista (WhatsApp, e-mail…), abra o arquivo e permita
  "instalar apps desta fonte". Na primeira rota, permita a **localização** e as **notificações**.
- Em alguns aparelhos (Xiaomi, Samsung, Motorola…) vale desativar a **economia de bateria** para o
  app (Configurações → Apps → Rastreamento Logístico → Bateria → Sem restrições), senão o sistema
  pode encerrar o rastreamento depois de muito tempo bloqueado.
- A assinatura do APK usa `app-android/release.keystore` (versionado no repositório, só para
  distribuição interna). Para publicar na Play Store, gere uma chave nova e guarde-a como
  *secret* do GitHub.

## Segurança

- Todas as regras de acesso ficam no banco (RLS): a transportadora só consegue ler os próprios
  motoristas, rotas, posições e comprovantes — mesmo que alguém tente consultar a API diretamente.
- O motorista só grava posição para si mesmo e só anexa comprovante nas rotas dele; iniciar e
  finalizar rota passam por funções do banco que validam isso.
- Comprovantes ficam em bucket **privado**; os links de visualização são temporários (1 hora).
- Os mapas usam os tiles públicos do OpenStreetMap, adequados para uso moderado. Para muitos
  acessos simultâneos, troque a URL dos tiles em `logistica/app.js` (função `makeMap`) por um
  provedor com chave (MapTiler, Mapbox, etc.).
