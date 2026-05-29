-- Praxia — Cache SEMÂNTICO do chat da Pra (pgvector + embeddings gte-small)
--
-- Diferente do cache exato (`ai_cache`, migration 003), este recicla respostas
-- por SIMILARIDADE: uma pergunta parafraseada reaproveita uma resposta anterior
-- sem chamar o LLM. Embeddings vêm da Edge Function `embed` (modelo gte-small,
-- 384 dims) — ver `supabase/functions/embed/`.
--
-- Escrita/leitura SÓ pelo servidor (service_role). RLS ligada sem policy.
--
-- ⚠️ Pré-requisito: extensão pgvector. No Supabase: Dashboard → Database →
-- Extensions → habilitar "vector" (ou o create extension abaixo).

create extension if not exists vector;

create table if not exists public.ai_semantic_cache (
  id uuid primary key default gen_random_uuid(),
  question text not null,            -- última mensagem do usuário (para debug/inspeção)
  embedding vector(384) not null,    -- gte-small → 384 dimensões
  body jsonb not null,               -- resposta cacheada ({ content, provider })
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.ai_semantic_cache enable row level security;
-- Sem policy: apenas service_role acessa.

-- Índice ANN por distância de cosseno (HNSW — bom recall/latência).
create index if not exists ai_semantic_cache_embedding_idx
  on public.ai_semantic_cache using hnsw (embedding vector_cosine_ops);

create index if not exists ai_semantic_cache_expires_idx
  on public.ai_semantic_cache(expires_at);

-- Busca o vizinho mais próximo acima do limiar de similaridade, não expirado.
-- similaridade = 1 - distância_cosseno (∈ [0,1]; 1 = idêntico).
create or replace function public.match_semantic_cache(
  query_embedding vector(384),
  match_threshold float
) returns table (body jsonb, similarity float)
language sql
stable
as $$
  select c.body, 1 - (c.embedding <=> query_embedding) as similarity
  from public.ai_semantic_cache c
  where c.expires_at > now()
    and 1 - (c.embedding <=> query_embedding) >= match_threshold
  order by c.embedding <=> query_embedding
  limit 1;
$$;

revoke all on function public.match_semantic_cache(vector, float) from public;
grant execute on function public.match_semantic_cache(vector, float) to service_role;
