# Orquestração — 4 agentes paralelos (Praxia)

> Montado em 2026-05-29. Coordenador: agente na worktree `main`
> (`AnalisedeprecodeAcoes`). Cada agente roda numa **git worktree isolada** com
> `node_modules` compartilhado (junction) e a skill `/praxia` já presente.

## Mapa de worktrees

| Agente | Diretório | Branch | Base |
|---|---|---|---|
| **A — Feature: Screener** | `..\praxia-screener` | `feat/screener-fase4` | WIP `5892bc7` (não compila ainda) |
| **B — Feature: Rebalanceador** | `..\praxia-rebalanceador` | `feat/rebalanceador` | `main` limpa |
| **C — Testes** | `..\praxia-tests` | `test/cobertura` | `main` limpa |
| **D — LGPD** | `..\praxia-lgpd` | `audit/lgpd` | `main` limpa |
| Coordenador (eu) | `AnalisedeprecodeAcoes` | `main` | integra/merge |

## Regras para TODOS

1. **Rode `/praxia` primeiro** — carrega contexto e manda ler `SITUAÇÃO_ATUAL.md`.
2. **Fique na sua worktree.** Nunca `cd` para outra worktree nem para a main.
3. **Commite na sua branch.** Nunca toque na `main` — eu faço o merge.
4. **Não rode `npm install`** — o `node_modules` é uma junction compartilhada;
   instalar quebraria as outras. Se faltar um pacote, **me avise** (peça ao
   usuário), não instale.
5. Respeite as **fronteiras de arquivo** abaixo. Se precisar editar algo fora da
   sua zona, pare e sinalize — provável conflito de merge.
6. `npm run build` + `npm run lint` antes de considerar "pronto".

## Fronteiras de arquivo (evita conflito no merge)

- **A (Screener):** `src/lib/screener.ts`, `src/lib/stockMapper.ts`,
  `src/lib/ai.ts` (capability `screener`), `ScreenAnalysis.tsx`,
  `PortfolioScoreHero.tsx`, nova tela/aba "Descobrir". Tipo `AICapability` e
  `ScreenerFilter` em `src/types/stock.ts`.
- **B (Rebalanceador):** arquivos NOVOS (`src/lib/rebalance.ts`, nova
  `Screen*`/modal), `App.tsx` (só adicionar rota/sibling do modal). Evitar editar
  `ai.ts`/`stock.ts` nas mesmas linhas que A — adicionar no fim dos arquivos.
- **C (Testes):** só `tests/**`, `api/*.test.ts`, configs de teste
  (`vitest.config`, `playwright.config`). **Não edita código de produção**;
  se um teste revelar bug, abre relatório, não corrige.
- **D (LGPD):** read-only de auditoria + relatório em `docs/lgpd-auditoria.md`.
  Só edita código se eu autorizar uma correção pontual.

## Ordem de merge sugerida (eu executo)

1. C (testes) e D (LGPD) primeiro — baixo risco de conflito.
2. B (Rebalanceador) — arquivos majoritariamente novos.
3. A (Screener) por último — toca mais arquivos compartilhados; resolvo
   conflitos contra o que já entrou.

## Limpeza ao terminar

```bash
git worktree remove ../praxia-screener   # idem para as outras
git branch -d feat/screener-fase4         # após merge
```
