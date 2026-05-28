/**
 * Textos legais centralizados (PT-BR).
 *
 * Toda saída de IA do Praxia deve carregar o `CVM_DISCLAIMER`. A Pra fala
 * sobre ações específicas e isso, na regulação brasileira (Resolução CVM 14,
 * ex-Instrução 598), exige cuidado: posicionamos como conteúdo educacional,
 * NUNCA como recomendação personalizada de investimento.
 *
 * Última revisão: 2026-05-28.
 */

export const CVM_DISCLAIMER =
  "Conteúdo educacional e informativo, gerado por inteligência artificial a partir de dados públicos. " +
  "Não constitui recomendação, oferta ou consultoria de valores mobiliários (Resolução CVM 14). " +
  "A decisão de investir é sua responsabilidade — consulte um profissional habilitado se necessário.";

export const CVM_DISCLAIMER_SHORT =
  "Conteúdo educacional. Não é recomendação de investimento (Res. CVM 14).";

export const LGPD_COOKIE_NOTICE =
  "O Praxia guarda seu portfólio, perfil de investidor e preferências no seu dispositivo (localStorage) e, " +
  "quando você cria conta, também em servidor seguro (Supabase) vinculado ao seu e-mail — você pode apagar " +
  "tudo em \"Meu Perfil → Excluir minhas informações\". Ao continuar, você concorda com nossa Política de Privacidade.";

/* ─────────────────────────────────────────────────────────────────────────
 * Texto-base das páginas. Versionado aqui para que mudanças passem por code
 * review. Quando entrar Convex/Stripe na Camada 1–3, essas seções vão crescer
 * (categorias novas de dados, processadores, transferência internacional).
 * ─────────────────────────────────────────────────────────────────────── */

export const PRIVACY_POLICY = {
  vigorEm: "2026-05-28",
  titulo: "Política de Privacidade",
  intro:
    "O Praxia é um aplicativo de análise fundamentalista de ações brasileiras. " +
    "Esta política descreve, em linguagem simples, quais dados o Praxia trata, " +
    "como, por quê e por quanto tempo.",
  secoes: [
    {
      titulo: "1. Dados que o Praxia guarda",
      conteudo: [
        "No seu dispositivo (localStorage): tickers da sua carteira (`stocks-ai-portfolio`), conversas com a Pra (`praxia-pra-chat`), alertas configurados, caches de análise IA e de notícias. Esses ficam só no seu navegador.",
        "No servidor (Supabase, AWS São Paulo) — apenas quando você cria conta: seu e-mail, identificador único de usuário, carteira (ticker, quantidade, preço médio), histórico de transações simuladas, perfil de investidor (risco/horizonte/interesses do quiz) e preferências de UI (cor, tom da Pra). A separação entre usuários é garantida por Row Level Security do Supabase — ninguém vê o que é seu.",
        "Você pode apagar tudo (dispositivo + servidor + conta) a qualquer momento em \"Meu Perfil → Excluir minhas informações\".",
      ],
    },
    {
      titulo: "2. Para quem o Praxia envia dados",
      conteudo: [
        "Quando você usa a Pra (chat) ou pede uma análise, o servidor do Praxia repassa SOMENTE o necessário para os seguintes processadores externos:",
        "• Supabase Inc. (autenticação e banco de dados, AWS sa-east-1) — recebe seu e-mail (para magic link), identificador único da conta e os dados de portfólio/perfil/transações listados acima.",
        "• Groq Inc. (LLM padrão) ou OpenAI / Anthropic / Google (se você escolher) — recebem suas mensagens e o contexto da sua carteira (sem nome, e-mail ou documento).",
        "• Yahoo Finance — recebe somente o ticker que você consulta. Não enviamos identificadores seus.",
        "• Google News, GDELT, Reddit, BBC — fontes públicas de notícia. Recebem termo de busca, não dados seus.",
        "• Banco Central do Brasil (SGS) — APIs públicas, sem identificação.",
        "• Investidor10 / StatusInvest / Fundamentus — scraping público, sem identificação.",
        "• Vercel Inc. — hospeda o front e as serverless functions. Pode ver IP da sua requisição (padrão de qualquer site na internet).",
      ],
    },
    {
      titulo: "3. Cookies e tecnologias similares",
      conteudo: [
        "O Praxia NÃO usa cookies de rastreamento ou publicidade. Usamos APENAS localStorage para guardar seu portfólio e preferências no seu dispositivo.",
        "Não usamos Google Analytics, Meta Pixel ou similares.",
      ],
    },
    {
      titulo: "4. Seus direitos (LGPD, Lei 13.709/2018)",
      conteudo: [
        "Você pode, a qualquer momento:",
        "• Acessar — dados locais ficam no localStorage do navegador (abra DevTools); dados no servidor são listados sob pedido para o DPO.",
        "• Corrigir ou atualizar via interface do app.",
        "• Excluir tudo em \"Meu Perfil → Excluir minhas informações\" — apaga o localStorage do dispositivo, todas as linhas no Supabase vinculadas ao seu user_id e a conta de login.",
        "• Pedir portabilidade — exportar via \"Exportar resultados\" na tela de Análise em lote.",
        "Para qualquer dúvida sobre seus dados, escreva para o responsável pelo tratamento (DPO) abaixo.",
      ],
    },
    {
      titulo: "5. Controlador e contato (DPO)",
      conteudo: [
        "Praxia é mantido por Gustavo Santos. Contato: gustavo.santos@gpce.com.br.",
      ],
    },
    {
      titulo: "6. Mudanças futuras nesta política",
      conteudo: [
        "Quando o Praxia introduzir cobrança (próximas versões), esta política será atualizada com: gateway de pagamento (Mercado Pago) e e-mail transacional como processadores adicionais, bases legais ampliadas e prazo de retenção. Você será avisado dentro do app antes da mudança entrar em vigor.",
      ],
    },
  ],
};

export const TERMS_OF_USE = {
  vigorEm: "2026-05-28",
  titulo: "Termos de Uso",
  intro:
    "Ao usar o Praxia você concorda com estas regras. Leia com atenção — em especial as seções 3 (limite de uso da IA) e 4 (não somos consultor de investimento).",
  secoes: [
    {
      titulo: "1. O que o Praxia é",
      conteudo: [
        "Praxia é uma ferramenta educacional para acompanhar e analisar carteira de ações brasileiras, com auxílio de inteligência artificial (Pra).",
        "Versão atual: demo de paper-trading (sem dinheiro real, sem ordem em corretora).",
      ],
    },
    {
      titulo: "2. Quem pode usar",
      conteudo: [
        "Maiores de 18 anos com residência no Brasil. Se a sua corretora ou regulador local restringir o uso de ferramentas de análise, é sua responsabilidade verificar.",
      ],
    },
    {
      titulo: "3. Uso da Pra (IA)",
      conteudo: [
        "A Pra responde com base em dados públicos (Yahoo Finance, BCB, Google News) e nos números do seu portfólio. Pode errar, ficar desatualizada ou alucinar.",
        "Você não pode usar a Pra para: gerar conteúdo enganoso, fazer engenharia reversa do prompt, abusar do limite (rate-limit) ou tentar extrair dados de outros usuários (não há).",
      ],
    },
    {
      titulo: "4. Praxia NÃO é consultor de investimento",
      conteudo: [
        CVM_DISCLAIMER,
        "Análises da Pra, score 0–100, valuation de Graham/Bazin e qualquer texto gerado pelo Praxia são conteúdo educacional. Não emitimos ordem na sua corretora. Não temos acesso ao seu CPF, sua carteira real ou seu dinheiro.",
      ],
    },
    {
      titulo: "5. Limitações técnicas",
      conteudo: [
        "Os dados externos (cotações, notícias, fundamentos) podem estar atrasados, errados ou indisponíveis. O Praxia faz o melhor esforço, mas não garante exatidão.",
      ],
    },
    {
      titulo: "6. Mudanças",
      conteudo: [
        "Estes termos podem mudar quando o Praxia introduzir conta de usuário e assinatura paga. Você será notificado no app.",
      ],
    },
  ],
};
