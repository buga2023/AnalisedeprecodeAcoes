# Security — Praxia

Documento operacional sobre estado atual de segurança e dívidas conhecidas.
Última atualização: 2026-05-28.

## Estado dos endpoints serverless

Todos os endpoints em `api/*.ts` agora têm CORS + rate-limit + (quando aplicável) validação de input por regex. Resumo:

| Endpoint | CORS | Rate-limit | Validação |
|---|---|---|---|
| `api/ai.ts` | ✅ | 60s/10 + burst 3/5s | Tipagem messages |
| `api/brapi.ts` | ✅ | 60s/120 + burst 30/5s | regex ticker + cap 30 tickers |
| `api/dividends.ts` | ✅ | 60s/30 | regex B3/US |
| `api/fundamentals.ts` | ✅ | 60s/10 + burst 3/5s | regex ticker, usa `_llm.ts` (sem bypass) |
| `api/fundamentals-history.ts` | ✅ | 60s/30 | regex B3/US |
| `api/macro.ts` | ✅ | 60s/60 + burst 10/5s | sem input de usuário |
| `api/market.ts` | ✅ | 60s/60 + burst 10/5s | hardcoded symbols |
| `api/news.ts` | ✅ | 60s/30 + burst 5/5s | regex ticker, slice q |
| `api/scrape.ts` | ✅ | 60s/20 + burst 3/5s | regex B3 strict |
| `api/world-news.ts` | ✅ | 60s/30 + burst 5/5s (skip cron) | params internos |

Todos os endpoints fazem logging restrito: `error.message.slice(0, 120)` ou similar — nunca despejam payload completo no Vercel logs.

## Auth

`LoginScreen.tsx:27` ainda valida `admin/1234` no client. Bloqueador absoluto pra produção/cobrança. Roadmap: migrar para `POST /api/auth` com bcrypt + rate-limit + integração Convex (decisão de stack feita em 2026-05-28).

## Persistência

Tudo em `localStorage` (15+ chaves). Sem sync entre devices. Roadmap: Convex (reactive DB + functions + auth integrado).

## Dependências com CVE pendente

### xlsx@0.18.5 (Prototype Pollution + ReDoS)

**Status**: **mitigado em código**, upgrade formal **bloqueado por ambiente**.

CVEs:
- GHSA-4r6h-8v6p-xvw6 (Prototype Pollution)
- GHSA-5pgg-2g8v-p4x9 (ReDoS via crafted regex)

**Defesas ativas** em `src/lib/sheetParser.ts`:
1. Tamanho máximo 5 MB (`MAX_SHEET_BYTES`) — bloqueia vetor de ReDoS por arquivo gigante.
2. `Object.create(null)` em todos os objetos-resultado — chaves bizarras ficam isoladas do prototype global.
3. `FORBIDDEN_HEADER_KEYS = ["__proto__", "constructor", "prototype"]` — bloqueia injeção via header malicioso.

**Upgrade pendente**: a versão atualizada (0.20.3+) vive no CDN próprio do SheetJS, fora do npm registry. Tentativa de `npm install xlsx@https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` falha no ambiente atual com `SELF_SIGNED_CERT_IN_CHAIN` (proxy corporativo intercepta SSL).

**Ação para o time de infra/devops**:
```bash
# Em ambiente com rede sem MITM SSL ou com cafile correto:
npm install --save xlsx@https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz
# A API é drop-in. Nenhum refactor em sheetParser.ts ou exportResults.ts.
```
Alternativa: configurar `npm config set cafile <path-to-corp-cert>` ou usar `@e965/xlsx` (fork community no npm padrão).

## Login placeholder público

`admin/1234` em `LoginScreen.tsx`. Removível só quando o substituto (Convex auth) estiver pronto. Aceitável enquanto demo, **não para produção**.

## Histórico de hardening desta sessão

1. Adicionado `checkRateLimit` em `api/macro.ts`, `api/world-news.ts`, `api/market.ts` (eram os 3 endpoints expostos sem teto de chamadas).
2. Padronizado logging restrito (`.slice(0, 120)` ou genérico) em todos os endpoints — sem dump de payload.
3. Verificado que `api/fundamentals.ts` **NÃO** chama Groq direto (usa `_llm.ts` compartilhado, que respeita rate-limit + multi-provider). Suspeita inicial era falsa.
4. Formalizado documento de mitigações do `xlsx@0.18.5`.

## Próximos passos críticos (em ordem)

1. **Auth real** (Convex) — bloqueador #1 pra cobrar
2. **Persistência server-side** (Convex) — bloqueador #2
3. **Pagamento** (Mercado Pago) — bloqueador #3
4. **Compliance BR** (LGPD + termo + disclaimer CVM) — bloqueador #4
5. **Upgrade xlsx** em ambiente apropriado — risco residual baixo dadas as defesas
6. **Sentry + Analytics** — visibilidade pós-launch
