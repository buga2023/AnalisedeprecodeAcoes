-- Praxia — Cache durável de respostas de IA (recicla conhecimento entre usuários)
--
-- O cache em memória de `api/_aicache.ts` é por instância Vercel e some em cold
-- start. Esta tabela é o L2 compartilhado: a 1ª chamada com uma chave gera no
-- LLM; todas as outras (qualquer usuário, instância ou região) reusam pelo TTL
-- sem re-billar tokens.
--
-- Escrita/leitura SÓ pelo servidor (service_role). RLS ligada sem policy =
-- ninguém com anon/JWT lê ou escreve direto (defesa em profundidade; o cache
-- pode conter texto gerado e não deve ser sondável pelo client).

create table if not exists public.ai_cache (
  key text primary key,            -- sha1 de (provider, messages, temperature, max_tokens, response_format)
  body jsonb not null,             -- resposta cacheada ({ content, provider })
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.ai_cache enable row level security;
-- Sem policy: apenas service_role (que ignora RLS) acessa.

-- Varredura por expiração (reads filtram expires_at > now()).
create index if not exists ai_cache_expires_idx on public.ai_cache(expires_at);
