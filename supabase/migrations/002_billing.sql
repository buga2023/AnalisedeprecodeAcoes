-- Praxia — Billing (Mercado Pago Subscriptions + Usage tracking)
--
-- Sub-entrega 1.6: assinatura mensal Praxia Pro (R$ 29/mês) via Mercado Pago
-- Preapproval. Free tem soft limit de 10 chamadas IA/mês contadas em usage_log.
--
-- Multi-tenant por user_id; RLS por owner. Writes principais vêm do servidor
-- (api/checkout, api/mp-webhook, api/_usageGuard) via service_role — RLS aqui
-- protege contra leitura/escrita direta do client.

-- ─────────────────────────────────────────────────────────────────────────
-- 1) SUBSCRIPTIONS — uma linha por (user_id, mp_preapproval_id)
-- ─────────────────────────────────────────────────────────────────────────
-- Status mapeia 1:1 com o enum do Mercado Pago Preapproval:
--   'pending'   — usuario clicou "assinar" mas ainda nao pagou primeira parcela
--   'active'    — pagando OK
--   'paused'    — temporariamente suspensa (usuario ou MP)
--   'cancelled' — usuario cancelou (acesso ate current_period_end)
--   'past_due'  — falha de cobranca, MP vai tentar novamente

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Identificadores do Mercado Pago
  mp_preapproval_id text unique,
  mp_payer_id text,
  -- Plano e status
  plan text not null default 'pro' check (plan in ('pro')),
  status text not null check (status in ('pending', 'active', 'paused', 'cancelled', 'past_due')),
  amount_brl numeric not null default 29.00 check (amount_brl > 0),
  -- Datas de ciclo
  started_at timestamptz,
  current_period_end timestamptz,
  cancelled_at timestamptz,
  -- Auditoria
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

-- Apenas o proprio user le sua subscription. Writes vem do servidor (service_role).
create policy "subscriptions_owner_select" on public.subscriptions
  for select using (auth.uid() = user_id);

create index subscriptions_user_status_idx on public.subscriptions(user_id, status);
create index subscriptions_mp_preapproval_idx on public.subscriptions(mp_preapproval_id);

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- 2) USAGE_LOG — contador de uso de features por mês
-- ─────────────────────────────────────────────────────────────────────────
-- Chave composta: (user_id, month, feature). Incrementado pelo servidor antes
-- de chamar o LLM. Soft limit do plano free = sum(count) where month=current.
--
-- `month` é texto "YYYY-MM" pra garantir bucketing consistente independente de
-- timezone. Server normaliza com UTC.

create table public.usage_log (
  user_id uuid not null references auth.users(id) on delete cascade,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  feature text not null check (length(feature) between 1 and 64),
  count integer not null default 0 check (count >= 0),
  last_used_at timestamptz not null default now(),
  primary key (user_id, month, feature)
);

alter table public.usage_log enable row level security;

-- User le seu proprio usage; nao escreve direto (servidor faz via service_role).
create policy "usage_owner_select" on public.usage_log
  for select using (auth.uid() = user_id);

create index usage_log_user_month_idx on public.usage_log(user_id, month);

-- ─────────────────────────────────────────────────────────────────────────
-- 3) Helper: increment_usage atomico (server chama via RPC ou direto)
-- ─────────────────────────────────────────────────────────────────────────
-- Atomic upsert + increment. Evita race condition de "select + update" em
-- alto trafego. Server passa user_id + feature; mes e calculado internamente.

create or replace function public.increment_usage(
  p_user_id uuid,
  p_feature text
) returns integer
language plpgsql
security definer
as $$
declare
  v_month text := to_char((now() at time zone 'utc'), 'YYYY-MM');
  v_count integer;
begin
  insert into public.usage_log (user_id, month, feature, count, last_used_at)
  values (p_user_id, v_month, p_feature, 1, now())
  on conflict (user_id, month, feature) do update
    set count = public.usage_log.count + 1,
        last_used_at = now()
  returning count into v_count;
  return v_count;
end;
$$;

-- Apenas roles autenticados podem chamar (servidor com service_role tem acesso total).
revoke all on function public.increment_usage(uuid, text) from public;
grant execute on function public.increment_usage(uuid, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 4) View pra leitura agregada do mês corrente (uso opcional pelo client)
-- ─────────────────────────────────────────────────────────────────────────

create or replace view public.current_month_usage as
  select
    user_id,
    sum(count) as total_this_month,
    jsonb_object_agg(feature, count) as by_feature
  from public.usage_log
  where month = to_char((now() at time zone 'utc'), 'YYYY-MM')
  group by user_id;

-- Herda RLS da tabela base por padrao no Supabase.
grant select on public.current_month_usage to authenticated;
