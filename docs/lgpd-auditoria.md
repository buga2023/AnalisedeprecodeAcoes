# Auditoria LGPD — Praxia

> **Agente D (Privacidade/LGPD)** · branch `audit/lgpd` · 2026-05-29
> Lei 13.709/2018 (LGPD). Auditoria **read-only** — nenhum código de produção foi
> alterado; este relatório é o único entregável.
> Metodologia: leitura estática + confronto entre o que a **política de
> privacidade afirma** (`src/lib/legal.ts`) e o que o **código realmente faz**.

## Escopo auditado

| Camada | Artefatos |
|---|---|
| Exclusão (Art. 18 VI) | `api/delete-account.ts`, `ScreenDeleteAccount.tsx` |
| Textos legais | `src/lib/legal.ts`, `ScreenLegalDoc.tsx` |
| Consentimento | `CookieConsentBanner.tsx` + integração `App.tsx` |
| Persistência local | `eraseAll` + 15+ chaves localStorage |
| Persistência servidor | `supabase/migrations/001_initial.sql`, `002_billing.sql`, `supabaseSync.ts` |
| Auth | `LoginScreen.tsx`, `useAuth.ts`, `supabase.ts` (magic-link PKCE) |
| Processadores | `api/ai.ts`, `api/_llm.ts`, `api/_cors.ts` |

## Estado do projeto (lido ao vivo)

`SITUAÇÃO_ATUAL.md §10.2` confirma que a tranche LGPD/auth foi entregue na sessão
de 2026-05-28/29: magic-link Supabase, RLS, `delete-account`, telas legais e banner.
**Discrepância de documentação:** `SECURITY.md:27` ainda diz que `LoginScreen.tsx`
valida `admin/1234` no client — isso está **desatualizado**; o código real é
magic-link sem senha (`useAuth.ts:73`). Ver achado B5.

---

## Resumo executivo

A base de **segurança de dados** é robusta: RLS em todas as tabelas, exclusão
server-side com validação de JWT, varredura de prefixo no localStorage, banco em
região brasileira (sa-east-1), zero cookies de rastreamento. **Não há achado
Crítico** — nenhum vazamento, quebra de isolamento ou segredo exposto. As lacunas
reais são de **transparência e de direitos do titular declarados-mas-não-
entregues** (concentradas em `legal.ts`).

| # | Severidade | Achado | Artigo |
|---|---|---|---|
| — | ⚫ Crítico | *Nenhum.* | — |
| A1 | 🔴 Alto | Portabilidade (Art. 18 V) declarada mas inexistente; texto enganoso | Art. 18 V, Art. 6 IV/VI |
| A2 | 🔴 Alto | Base legal não declarada para nenhum tratamento | Art. 9 II, Art. 7/11 |
| A3 | 🔴 Alto | Consentimento sem recusa, tardio e não demonstrável | Art. 8 §2/§5 |
| M1 | 🟠 Médio | Prazo de retenção não definido (política promete e não cumpre) | Art. 15, Art. 16 |
| M2 | 🟠 Médio | Transferência internacional a LLMs (EUA) sem base do Art. 33 | Art. 33 |
| M3 | 🟠 Médio | Exclusão não-atômica; `subscriptions`/`usage_log` só via cascade | Art. 18 VI, Art. 6 X |
| M4 | 🟠 Médio | Direito de acesso só manual via DPO, sem prazo/SLA | Art. 18 II, Art. 19 |
| B1 | 🟡 Baixo | Controlador/encarregado informais (PF vs PJ ambíguo) | Art. 41, Art. 5 VI/VIII |
| B2 | 🟡 Baixo | Sem verificação de idade / tratamento de menores | Art. 14 |
| B3 | 🟡 Baixo | PII voluntária no chat repassada a LLMs sem aviso | Art. 6 III |
| B4 | 🟡 Baixo | Ponto de coleta do e-mail sem link para a política | Art. 9 |
| B5 | 🟡 Baixo | `SECURITY.md` desatualizado sobre auth (governança) | Art. 6 X |

---

## Pontos fortes (já conformes — preservar)

- **RLS em 100% das tabelas** (`001`, `002`): toda policy usa `auth.uid() = user_id`;
  `subscriptions`/`usage_log` só permitem `select` ao dono, writes via `service_role`.
- **Exclusão server-side madura** (`delete-account.ts`): valida JWT
  (`admin.auth.getUser`, l.67), deleta 4 tabelas + `admin.deleteUser`, rate-limit
  5/min/IP, e **logs sanitizados** — só UUID, nunca e-mail/JWT/body (l.15, 69, 92).
- **`ON DELETE CASCADE`** em `auth.users` em todas as FKs (defesa em profundidade).
- **`eraseAll` cobre tudo** (`ScreenDeleteAccount.tsx:45-69`): lista canônica +
  varredura de prefixo `praxia-`/`stocks-ai` → pega caches dinâmicos
  (`stocks-ai-analysis:*`, `praxia-stock-news:*`, `praxia-dividend-history:*`,
  `praxia-digest:*`, `praxia-alerts`, `stocks-ai-batch-valuation`). **Verifiquei:
  nenhuma chave de dado pessoal escapa.**
- **Banco em região BR** (Supabase AWS sa-east-1) — minimiza transferência
  internacional dos dados estruturados.
- **Sem cookies de rastreamento / analytics / pixel** — confere com o código.
- **Minimização real aos LLMs**: `api/ai.ts` repassa só `messages` + contexto de
  carteira; sem e-mail/UUID/CPF anexados pelo app.
- **CORS com allowlist** (`api/_cors.ts`) e **disclaimer CVM** em todo conteúdo IA.

---

## Achados detalhados

### 🔴 A1 — Portabilidade (Art. 18 V) declarada mas inexistente

- **O que a LGPD exige.** Art. 18 V: portabilidade dos dados a outro fornecedor,
  mediante requisição. Art. 6 IV/VI: transparência e livre acesso, informação
  clara e **exata**.
- **O que o código faz hoje.** `legal.ts:74` diz: *"Pedir portabilidade — exportar
  via 'Exportar resultados' na tela de Análise em lote."* Mas essa ação
  (`ScreenBatchValuation.tsx:257` → `exportResults(rows)`) exporta **o valuation de
  um CSV que o próprio usuário acabou de subir** — não os dados pessoais
  armazenados (`portfolio_stocks`/`profiles`/`transactions`/`preferences` nem as
  chaves de localStorage). Não existe nenhum fluxo de export dos dados do titular.
- **A lacuna.** Direito de portabilidade não atendido **e** afirmação enganosa na
  política (transparência inexata — agrava por si só).
- **Recomendação.** Criar "Exportar meus dados" em *Meu Perfil* serializando para
  JSON as chaves locais + (se logado) `fetchPortfolioFromServer` /
  `fetchProfileFromServer` / `fetchTransactionsFromServer` /
  `fetchPreferencesFromServer` (já existem em `supabaseSync.ts`). Até lá, **corrigir
  o texto** para não afirmar que a portabilidade já existe.

### 🔴 A2 — Base legal não declarada

- **O que a LGPD exige.** Art. 7/11: todo tratamento precisa de uma hipótese legal.
  Art. 9 II: o titular deve ser informado da finalidade **e** da base de cada
  tratamento.
- **O que o código faz hoje.** `PRIVACY_POLICY` (`legal.ts:31-91`) descreve dados,
  processadores e finalidades, mas **nunca nomeia a base legal** (consentimento,
  execução de contrato, legítimo interesse…).
- **A lacuna.** Sem base declarada, cada tratamento é contestável e a política
  fere o dever de informação.
- **Recomendação.** Adicionar seção "Base legal" mapeando: e-mail/auth →
  execução de contrato (Art. 7 V); perfil/carteira → consentimento ou contrato;
  IP no Vercel → legítimo interesse (Art. 7 IX); billing → obrigação legal/contrato.

### 🔴 A3 — Consentimento sem recusa, tardio e não demonstrável

- **O que a LGPD exige.** Art. 8: consentimento livre, informado, inequívoco e
  **revogável**; §2: ônus da prova é do controlador; §5: revogação facilitada.
- **O que o código faz hoje.**
  1. `CookieConsentBanner.tsx:137` oferece **só** "Entendi" (+ "Saiba mais") — **sem
     opção de recusar**; o texto (`legal.ts:20`) enquadra como consentimento
     (*"Ao continuar, você concorda…"*).
  2. O banner é renderizado **dentro de `PraxiaApp`** (`App.tsx:553`), ou seja
     **após** login e onboarding/quiz. O e-mail já foi enviado ao Supabase no
     `LoginScreen` antes de o banner aparecer.
  3. A prova de consentimento (`praxia-lgpd-consent`) vive **só em localStorage**
     (`CookieConsentBanner.tsx:44-55`) — não é demonstrável nem persiste entre
     dispositivos.
- **A lacuna.** Se a base for consentimento (como o texto sugere), ele não é livre
  (sem recusa), nem prévio, nem demonstrável (Art. 8 §2).
- **Recomendação.** Decidir a base: (a) se *necessidade/contrato* para storage
  essencial, reescrever o banner como **aviso** (não "consentimento"); (b) se
  manter consentimento, adicionar "Recusar", exibir **antes** do login, e registrar
  o aceite no servidor (tabela `consents` ou coluna em `preferences`).

### 🟠 M1 — Prazo de retenção não definido

- **O que a LGPD exige.** Art. 15/16: término do tratamento e eliminação ao fim da
  finalidade; retenção só nas exceções do Art. 16 (obrigação legal etc.).
- **O que o código faz hoje.** A intro (`legal.ts:36-37`) promete dizer "por quanto
  tempo", mas nenhuma seção define prazo; dados persistem **indefinidamente** até
  exclusão manual.
- **A lacuna.** Sem política de retenção; potencial conflito futuro de `usage_log`
  (billing) com retenção fiscal obrigatória.
- **Recomendação.** Publicar prazo (ex.: "enquanto a conta existir; 30 dias em
  backups após exclusão") e considerar expurgo de contas inativas.

### 🟠 M2 — Transferência internacional a LLMs sem tratar o Art. 33

- **O que a LGPD exige.** Art. 33: transferência internacional só com hipótese
  legal (país adequado, cláusulas-padrão, consentimento específico…) e informação
  ao titular.
- **O que o código faz hoje.** `legal.ts:52` informa que mensagens + contexto de
  carteira vão a Groq/OpenAI/Anthropic/Google (todos nos EUA), mas **não trata** a
  natureza internacional nem a base do Art. 33.
- **A lacuna.** Transferência internacional sem base declarada. (O banco em
  sa-east-1 não é o problema — o tráfego para os LLMs é.)
- **Recomendação.** Adicionar parágrafo "Transferência internacional" indicando
  países e base do Art. 33 (normalmente cláusulas contratuais com os provedores).

### 🟠 M3 — Exclusão não-atômica; billing só via cascade

- **O que a LGPD exige.** Art. 18 VI + Art. 6 X (segurança/responsabilização): a
  eliminação deve ser completa e confiável.
- **O que o código faz hoje.** `delete-account.ts`: se um `delete` de tabela falha
  (l.91-97) retorna **500 sem apagar o `auth.user`** (estado parcial); se as
  tabelas apagam mas `deleteUser` falha (l.100-112) retorna 207 e a **conta de
  login persiste**. As tabelas `subscriptions`/`usage_log` (migration `002`) **não
  são apagadas explicitamente** — só por `ON DELETE CASCADE`, o que **contradiz o
  comentário do próprio arquivo** (l.76-77: *"executar explicitamente garante
  consistência caso o cascade falhe"*).
- **A lacuna.** Exclusão pode ficar incompleta; inconsistência entre o que é
  deletado explícito vs. por cascade é frágil a mudanças de schema.
- **Recomendação.** Incluir `subscriptions`/`usage_log` no `Promise.all`; em falha
  de tabela ainda tentar `deleteUser` (cascade resolve o resto) e registrar retry;
  no 207, instruir o usuário a escalar.

### 🟠 M4 — Direito de acesso só manual, sem prazo

- **O que a LGPD exige.** Art. 18 II + Art. 19: confirmação e acesso fornecidos em
  formato simplificado imediato, ou declaração completa em até 15 dias.
- **O que o código faz hoje.** `legal.ts:71` — dados do servidor "são listados sob
  pedido para o DPO"; não há self-service nem prazo prometido.
- **A lacuna.** Atendimento depende de processo manual não documentado, sem SLA.
- **Recomendação.** Reaproveitar o export de A1 como acesso self-service e declarar
  o prazo de 15 dias para pedidos via DPO.

### 🟡 B1 — Controlador/encarregado informais

- **Exige.** Art. 5 VI/VIII + Art. 41: identificar controlador e indicar encarregado.
- **Hoje.** `legal.ts:79-81` nomeia "Gustavo Santos / e-mail pessoal" como "DPO".
- **Lacuna.** Não esclarece se o controlador é PF ou PJ (CNPJ) nem separa os papéis.
- **Recomendação.** Identificar formalmente o controlador e um canal de encarregado.

### 🟡 B2 — Menores

- **Exige.** Art. 14: tratamento de dados de crianças/adolescentes com proteção
  específica.
- **Hoje.** `TERMS_OF_USE` (`legal.ts:108-109`) restringe a 18+, sem verificação.
- **Lacuna.** Sem verificação de idade (aceitável em MVP).
- **Recomendação.** Registrar como decisão consciente; revisar ao escalar.

### 🟡 B3 — PII voluntária no chat repassada aos LLMs

- **Exige.** Art. 6 III: minimização — só dados necessários à finalidade.
- **Hoje.** `legal.ts:52` afirma "sem nome, e-mail ou documento" — verdadeiro quanto
  ao que o **app** anexa, mas o **texto livre** do usuário pode conter PII e é
  repassado sem aviso/scrubbing.
- **Lacuna.** Risco de envio de PII não-necessária a processador internacional.
- **Recomendação.** Avisar o usuário no chat para não inserir dados pessoais.

### 🟡 B4 — Coleta do e-mail sem link para a política

- **Exige.** Art. 9: informação no momento da coleta.
- **Hoje.** `LoginScreen.tsx` coleta o e-mail (1º dado pessoal no servidor) mas não
  exibe link para Política/Termos — só o rodapé "paper trading".
- **Lacuna.** Transparência ausente no ponto de coleta.
- **Recomendação.** Adicionar link "Política de Privacidade · Termos" abaixo do
  botão de envio.

### 🟡 B5 — `SECURITY.md` desatualizado (governança)

- **Exige.** Art. 6 X (responsabilização): documentação fiel das medidas.
- **Hoje.** `SECURITY.md:27,60` ainda descreve login `admin/1234` no client como
  "bloqueador de produção", mas `useAuth.ts`/`LoginScreen.tsx` já migraram para
  magic-link Supabase (confirmado em `SITUAÇÃO_ATUAL.md §10.2`).
- **Lacuna.** Documento de segurança contradiz o código — confunde auditoria e
  governança.
- **Recomendação.** Atualizar `SECURITY.md` para refletir o auth atual.

> **Nota correlata (fora do escopo LGPD estrito).** O `xlsx@0.18.5` (CVEs de
> Prototype Pollution/ReDoS) processa planilhas com dados de carteira (dado
> pessoal). Está **mitigado em código** (`sheetParser.ts`: cap 5 MB,
> `Object.create(null)`, bloqueio de chaves `__proto__`), upgrade bloqueado por
> proxy corporativo (`SECURITY.md`). Toca a segurança do tratamento (Art. 46) — sem
> ação nova requerida além do upgrade já planejado.

---

## Direitos do titular (Art. 18) — placar

| Direito | Status | Onde |
|---|---|---|
| II — Acesso | ⚠️ Manual via DPO, sem prazo | M4 |
| III — Correção | ✅ Via interface do app | `legal.ts:72` |
| V — Portabilidade | ❌ Declarada, não implementada | A1 |
| VI — Eliminação | ✅ Robusta (local + servidor + conta) | `delete-account.ts`, `eraseAll` |
| IX — Info sobre compartilhamento | ✅ Processadores listados | `legal.ts:48-58` |
| Revogação de consentimento | ⚠️ Só via "apagar tudo" | A3 |

## Inventário de dados × processadores (validado no código)

| Dado | Onde | Processador | Observação |
|---|---|---|---|
| E-mail | `auth.users` | Supabase (sa-east-1) | Magic-link; base não declarada (A2) |
| UUID, carteira, transações, perfil, prefs | tabelas `public.*` | Supabase | RLS por `user_id` ✅ |
| Carteira + caches IA | localStorage | dispositivo | Coberto por `eraseAll` ✅ |
| Mensagens + contexto de carteira | trânsito | Groq/OpenAI/Anthropic/Google (EUA) | Transferência intl. — A2/M2/B3 |
| IP da requisição | logs | Vercel | Base não declarada (legítimo interesse) |
| Ticker consultado | trânsito | Yahoo / scraping | Sem identificadores ✅ |
| Billing (assinatura, uso) | `subscriptions`,`usage_log` | Supabase | Exclusão só por cascade — M3 |

---

## Conclusão

Nenhum achado **Crítico**: a arquitetura de segurança (RLS, exclusão, sanitização
de logs, região BR) está sólida. As prioridades reais, em ordem:

1. **A1 + A2 + A3** (Alto): portabilidade, base legal e modelo de consentimento —
   os três expõem afirmações falsas/ausentes na própria política.
2. **M1–M4** (Médio): retenção, transferência internacional, atomicidade da
   exclusão e prazo de acesso.
3. **B1–B5** (Baixo): formalização do encarregado, transparência e higiene de docs.

A maioria dos achados altos/médios resolve-se **editando `legal.ts`** + **um** fluxo
novo de export (reaproveitando helpers já existentes em `supabaseSync.ts`). Esforço
de remediação baixo frente ao impacto.

> **Aviso:** auditoria técnica de engenharia, não parecer jurídico. Recomenda-se
> revisão por advogado de proteção de dados antes de produção com usuários reais
> (alinhado ao item 1.7/"Termos — revisão jurídica" em `SITUAÇÃO_ATUAL.md §10.4`).
