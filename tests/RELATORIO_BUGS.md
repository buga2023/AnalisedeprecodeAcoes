# Relatório de bugs — Agente C (QA/Testes)

Branch `test/cobertura`. Registro de tudo que os testes revelaram. Conforme a
regra do trabalho: **não corrijo código de produção** — só documento aqui
(arquivo, sintoma, repro) para o agente responsável tratar.

---

## Status: nenhum bug de produção confirmado

A ampliação de cobertura (sync Supabase, auth, hooks de estado) **não revelou
defeitos de lógica de negócio**. Todas as funções testadas se comportaram
conforme a intenção documentada no código. As 586 specs passam.

---

## 1. [INFRA / flake — NÃO é bug de produto] EBUSY no jsdom durante `npm run coverage`

- **Arquivo:** ambiente (`node_modules/jsdom/...`), não código do app.
- **Sintoma:** `npm run coverage` intermitentemente aborta 3 arquivos de teste
  com `Error: EBUSY: resource busy or locked, open '...\AnalisedeprecodeAcoes\node_modules\jsdom\lib\jsdom\living\generated\*.js'`.
  O caminho aponta para o `node_modules` da pasta **main** (a junction
  compartilhada entre as worktrees).
- **Causa provável:** múltiplos agentes/worktrees rodando vitest em paralelo
  contra a **mesma** `node_modules` (junction). O OneDrive somado ao lock de
  arquivo do Windows agrava.
- **Repro:** rodar `npm run coverage` em duas worktrees simultaneamente.
- **Impacto:** zero no produto. `npm run test:run` isolado passa 100%
  (586/586). Só atrapalha a métrica de cobertura quando há concorrência.
- **Mitigação sugerida (infra, não código):** rodar coverage de uma worktree
  por vez, ou dar a cada worktree sua própria `node_modules`.

---

## Pontos de atenção verificados (revisados — NÃO são bugs)

Itens que inspecionei a fundo durante os testes e **confirmei estarem corretos**
— registrados só para poupar re-análise de quem ler o diff:

- `src/hooks/useTransactions.ts` `makeId()` (linha ~38): a expressão
  `hex[(Math.random() * 4) | (0 + 8)]` para o nibble de variante UUID v4 é
  ofuscada mas correta — produz índices 8–11 (`8/9/a/b`), que é o intervalo
  esperado. Só roda no fallback (quando `crypto.randomUUID` não existe).
- `src/lib/supabaseSync.ts` `fetchTransactionsFromServer` (linha ~201): mapear
  `kind === "dividend"` → `type: "buy"` é uma perda **intencional** (o tipo
  legado `Transaction.type` não tem `"dividend"`), já comentada no código.
