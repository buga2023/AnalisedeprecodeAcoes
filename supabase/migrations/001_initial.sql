-- Praxia — Schema inicial (MVP)
--
-- Multi-tenant por user_id (uuid de auth.users). Row Level Security (RLS) em
-- todas as tabelas: cada usuario so le/escreve seus proprios registros.
-- Alertas e chat ficam em localStorage no MVP (nao precisam de server).

-- ─────────────────────────────────────────────────────────────────────────
-- 1) PROFILES — perfil de investidor (do quiz) + metadados de conta
-- ─────────────────────────────────────────────────────────────────────────

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  -- Quiz de investidor
  risk text check (risk in ('low', 'mid', 'high')),
  horizon text check (horizon in ('short', 'mid', 'long')),
  interests text[] not null default '{}', -- ['div', 'gro', 'esg', 'tec']
  quiz_completed_at timestamptz,
  -- UX
  username text,
  -- Billing (preparacao Mercado Pago — 1.6)
  plan text not null default 'free' check (plan in ('free', 'pro')),
  plan_renewed_at timestamptz,
  -- Auditoria
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profile_owner_select" on public.profiles
  for select using (auth.uid() = user_id);

create policy "profile_owner_upsert" on public.profiles
  for insert with check (auth.uid() = user_id);

create policy "profile_owner_update" on public.profiles
  for update using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────
-- 2) PORTFOLIO_STOCKS — uma linha por (user, ticker)
-- ─────────────────────────────────────────────────────────────────────────

create table public.portfolio_stocks (
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null,
  name text,
  sector text,
  quantity numeric not null default 0 check (quantity >= 0),
  cost numeric not null default 0 check (cost >= 0),
  added_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, ticker)
);

alter table public.portfolio_stocks enable row level security;

create policy "portfolio_owner_all" on public.portfolio_stocks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index portfolio_stocks_user_idx on public.portfolio_stocks(user_id);

-- ─────────────────────────────────────────────────────────────────────────
-- 3) TRANSACTIONS — log de paper-trading (compra/venda/dividendo)
-- ─────────────────────────────────────────────────────────────────────────

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null,
  kind text not null check (kind in ('buy', 'sell', 'dividend')),
  quantity numeric not null check (quantity > 0),
  price numeric not null check (price >= 0),
  total numeric not null check (total >= 0), -- pre-calculado client-side
  note text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.transactions enable row level security;

create policy "transactions_owner_all" on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index transactions_user_occurred_idx on public.transactions(user_id, occurred_at desc);

-- ─────────────────────────────────────────────────────────────────────────
-- 4) PREFERENCES — UI (accent, tone, aiVerbosity)
-- ─────────────────────────────────────────────────────────────────────────

create table public.preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  accent text not null default '#c8a25c',
  tone text not null default 'casual' check (tone in ('casual', 'formal')),
  ai_verbosity text not null default 'concise' check (ai_verbosity in ('concise', 'verbose')),
  updated_at timestamptz not null default now()
);

alter table public.preferences enable row level security;

create policy "preferences_owner_all" on public.preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────
-- 5) Triggers: updated_at automatico
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger portfolio_stocks_set_updated_at
  before update on public.portfolio_stocks
  for each row execute function public.set_updated_at();

create trigger preferences_set_updated_at
  before update on public.preferences
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- 6) Auto-criacao de profile + preferences ao signup
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict do nothing;
  insert into public.preferences (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
