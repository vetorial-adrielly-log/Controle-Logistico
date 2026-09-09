-- ============================================================
-- Portal de Painéis de Logística — Schema Supabase
-- Rode este arquivo inteiro no SQL Editor do seu projeto Supabase
-- (Painel do Supabase > SQL Editor > New query > colar > Run)
-- ============================================================

-- Extensão para gerar UUIDs
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Tabela de perfis (um por usuário do Supabase Auth)
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  username text not null,
  role text not null default 'user' check (role in ('admin', 'user')),
  allowed_panels uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Tabela de painéis
-- ------------------------------------------------------------
create table if not exists public.panels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text not null default 'grid',
  embed_url text not null default '',
  description text not null default '',
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Função auxiliar: verifica se o usuário autenticado é admin
-- (security definer evita recursão nas policies de profiles)
-- ------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid()) = 'admin',
    false
  );
$$;

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.panels enable row level security;

-- profiles: qualquer usuário autenticado pode ler seu próprio perfil;
-- admins podem ler e alterar todos os perfis.
create policy "profiles_select_self" on public.profiles
  for select using (auth.uid() = id or public.is_admin());

create policy "profiles_update_admin" on public.profiles
  for update using (public.is_admin());

create policy "profiles_delete_admin" on public.profiles
  for delete using (public.is_admin());

-- Inserção de profiles só acontece via Netlify Function com a
-- service_role key (que ignora RLS), então nenhuma policy de INSERT
-- é necessária para o cliente anônimo/autenticado comum.

-- panels: qualquer usuário autenticado pode ler; só admins escrevem.
create policy "panels_select_authenticated" on public.panels
  for select using (auth.role() = 'authenticated');

create policy "panels_insert_admin" on public.panels
  for insert with check (public.is_admin());

create policy "panels_update_admin" on public.panels
  for update using (public.is_admin());

create policy "panels_delete_admin" on public.panels
  for delete using (public.is_admin());

-- ------------------------------------------------------------
-- Painéis de exemplo (opcional — apague ou edite como quiser)
-- ------------------------------------------------------------
insert into public.panels (name, icon, embed_url, description) values
  ('Visão Geral', 'grid', '', ''),
  ('Ferro Gusa', 'helmet', '', ''),
  ('Minério de Ferro', 'gem', '', ''),
  ('Co Produtos', 'bag', '', ''),
  ('Carvão', 'flame', '', '')
on conflict do nothing;

-- ============================================================
-- BOOTSTRAP DO PRIMEIRO ADMINISTRADOR
-- ============================================================
-- 1. No painel do Supabase, vá em Authentication > Users > Add user
--    e crie o primeiro usuário (e-mail + senha), marcando
--    "Auto Confirm User".
-- 2. Copie o UUID desse usuário (coluna "UID" na lista de users).
-- 3. Rode o comando abaixo substituindo os valores:
--
-- insert into public.profiles (id, email, username, role, allowed_panels)
-- values (
--   'COLE-AQUI-O-UUID-DO-USUARIO',
--   'admin@suaempresa.com',
--   'Administrador',
--   'admin',
--   '{}'
-- );
--
-- Depois disso, esse usuário já pode logar no portal e cadastrar
-- os demais (o cadastro dos demais usuários é feito pela própria
-- tela de Admin > Usuários, que usa a Netlify Function).
