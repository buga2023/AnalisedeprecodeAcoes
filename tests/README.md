# Testes do Praxia

## Camadas

```
tests/
├── e2e/              # Playwright — fluxos reais no navegador (login, portfolio, chat)
└── integration/      # Vitest — múltiplas camadas conectadas (sem mock no meio)
src/
├── lib/*.test.ts     # Unit tests de lógica pura
├── hooks/*.test.ts   # Unit tests dos hooks via renderHook
└── components/...    # Smoke tests de componentes primitivos
api/
└── *.test.ts         # Unit tests dos handlers Vercel
```

## Comandos

```bash
npm run test              # Vitest em watch (unit + integration)
npm run test:run          # Vitest run-once
npm run coverage          # Vitest + relatório v8 (threshold global 70%)
npm run test:e2e          # Playwright (sobe `npm run dev` automático)
npm run test:e2e:ui       # Playwright em modo UI interativo
```

## Pré-requisito do E2E: instalar Chromium

Os specs em `tests/e2e/` precisam do binário Chromium do Playwright.

```bash
npx playwright install chromium
```

### Se o download falhar com `SELF_SIGNED_CERT_IN_CHAIN` (Kaspersky/firewall)

O Kaspersky intercepta TLS com cert próprio e o download falha. Duas opções:

1. **Adicionar o cert raiz do Kaspersky às CAs do Node**:
   ```powershell
   $env:NODE_EXTRA_CA_CERTS = "C:\caminho\para\kaspersky-root.cer"
   npx playwright install chromium
   ```
   O cert geralmente está em
   `C:\ProgramData\Kaspersky Lab\AVP*\Data\Crypto\KasperskyAntiVirusPersonalRoot.cer`.

2. **Pular verificação TLS apenas para o download** (rápido):
   ```powershell
   $env:NODE_TLS_REJECT_UNAUTHORIZED = "0"
   npx playwright install chromium
   Remove-Item Env:NODE_TLS_REJECT_UNAUTHORIZED
   ```

3. **Usar um mirror corporativo** se houver, via `PLAYWRIGHT_DOWNLOAD_HOST`.

Uma vez instalado, `npm run test:e2e` sobe o Vite + roda os specs.

## Cobertura atual

| Camada | Statements | Branches | Functions |
|---|---|---|---|
| Total | 88.75% | 73.17% | 95.86% |
| `src/lib/` | 92.44% | 79.76% | 97.22% |
| `src/hooks/` | 86.04% | 65.92% | 96.42% |
| `api/` | ~85% | ~70% | ~95% |
| `src/components/praxia/` (primitivos) | 99.76% | 84.61% | 100% |

UI grande (`screens/**`, `ChatSheet`, modais) fica **fora da métrica de
cobertura** porque o test plan adequado é E2E, não unit. Veja
`vitest.config.ts > coverage.exclude`.
