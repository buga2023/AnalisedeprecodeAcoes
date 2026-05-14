import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage, InvestorProfile, Stock } from "@/types/stock";
import { riskLabel, horizonLabel, interestLabel } from "@/hooks/useInvestorProfile";

const STORAGE_KEY = "praxia-pra-chat";
const PROFILE_MARKER = /\[PROFILE\]\s*(\{[\s\S]*?\})\s*\[\/PROFILE\]/;

export type ChatTone = "casual" | "formal";

type ProfileDraft = Omit<InvestorProfile, "completedAt">;

interface UsePraChatArgs {
  tone: ChatTone;
  profile: InvestorProfile | null;
  stocks: Stock[];
  totalValue: number;
  onProfileDetected?: (p: ProfileDraft) => void;
}

function load(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as ChatMessage[];
  } catch {
    /* swallow */
  }
  return [];
}

function buildSystemPrompt(args: Omit<UsePraChatArgs, "onProfileDetected">): string {
  const { tone, profile, stocks, totalValue } = args;
  const personality =
    tone === "formal"
      ? "Voce e Pra, consultora financeira profissional. Tom respeitoso, claro, linguagem de mercado mas acessivel. Use 'voce'."
      : "Voce e Pra, mentora de investimentos amigavel e direta, como amiga que entende muito de mercado. Tom casual, descontraido. Seja breve.";

  const profileSummary = profile
    ? `Perfil: ${riskLabel(profile.risk)}, horizonte ${horizonLabel(profile.horizon)}, interesses: ${profile.interests.map(interestLabel).join(", ")}.`
    : "Perfil ainda nao definido.";

  const portfolio =
    stocks.length === 0
      ? "Carteira vazia."
      : `Patrimonio total estimado: R$ ${totalValue.toFixed(2)}. ` +
        `Ativos (${stocks.length}): ` +
        stocks
          .map(
            (s) =>
              `${s.ticker} (R$ ${s.price.toFixed(2)}, ${s.changePercent >= 0 ? "+" : ""}${s.changePercent.toFixed(2)}%, ` +
              `P/L ${s.pl.toFixed(1)}, P/VP ${s.pvp.toFixed(2)}, DY ${(s.dividendYield * 100).toFixed(1)}%, ` +
              `ROE ${(s.roe * 100).toFixed(1)}%, Score ${s.score}/100, ` +
              `Graham R$ ${(s.grahamValue ?? 0).toFixed(2)}, Margem Seg. ${(s.marginOfSafety ?? 0).toFixed(1)}%)`
          )
          .join("; ") +
        ".";

  const strategyMission =
    "Seu papel: ajudar o usuario a planejar estrategias alinhadas ao PERFIL DELE — alocacao por setor, acoes da B3 pra estudar, momento de comprar/vender, rebalanceamento e tese de longo prazo. Quando relevante, use os numeros do portfolio. Sugira tickers especificos e da opinioes concretas, sem ficar em cima do muro. Lembre que decisoes finais sao do usuario.";

  const profileRule = profile
    ? "REGRA DE PERFIL (NUNCA QUEBRE): TODA recomendacao deve comecar referenciando o perfil. Exemplo: 'Pelo seu perfil moderado e horizonte de 1-5 anos, ...'. Sem isso, voce esta dando conselho generico — recuse e volte a perguntar."
    : "REGRA DE PERFIL: o usuario AINDA nao tem perfil. NAO de recomendacao especifica de compra/venda. Sua prioridade e descobrir o perfil em ate 3 perguntas curtas (uma por mensagem). Quando tiver risco + horizonte + pelo menos 1 interesse, encerre com o marcador: [PROFILE]{\"risk\":\"low|mid|high\",\"horizon\":\"short|mid|long\",\"interests\":[\"div|gro|esg|tec\"]}[/PROFILE].";

  const sourceRule = `REGRA DE FONTES (NUNCA QUEBRE): para CADA afirmacao fatual (preco, multiplo, noticia, resultado, evento corporativo, dado macro) cite a fonte no FINAL da mensagem em um bloco unico no formato:
Fontes:
[1] BrAPI -- preco/fundamentos atuais do app
[2] Yahoo Finance -- historico
[3] https://ri.exemplo.com.br/release-3t24.pdf
[4] calculo do app -- valores de Graham/score
[5] perfil do usuario

Use [1], [2]... no corpo do texto para referenciar. Se NAO tem fonte verificavel pra um fato, escreva exatamente "(sem fonte verificavel)" no lugar e NAO afirme o fato. Numeros do PORTFOLIO acima ja vem da BrAPI -- pode citar [1] BrAPI.`;

  return [
    personality,
    "Responda em portugues brasileiro.",
    "Respostas curtas por padrao (2-4 frases). Quando o usuario pedir analise/estrategia, pode chegar a 4-8 frases — mas SEMPRE com fontes no final.",
    profileSummary,
    portfolio,
    strategyMission,
    profileRule,
    sourceRule,
    "Nao use markdown pesado. Negrito ok. Sem bullet points longos.",
  ]
    .filter(Boolean)
    .join("\n");
}

function greetingFor(tone: ChatTone, profile: InvestorProfile | null): string {
  if (tone === "formal") {
    return profile
      ? "Olá. Sou a Pra, sua assistente de investimentos. Como posso auxiliar você hoje? Posso analisar seu portfólio, comparar ativos ou sugerir oportunidades alinhadas ao seu perfil."
      : "Olá. Sou a Pra, sua assistente de investimentos. Antes de traçarmos estratégias, preciso conhecer você um pouco. Qual sua tolerância a oscilações de curto prazo: conservadora, moderada ou arrojada?";
  }
  if (!profile) {
    return "Oi! Sou a Pra 👋\nPra montar uma estratégia que faça sentido pra você, me conta uma coisa: quando o mercado cai forte, você prefere segurar (perfil mais conservador), tolera com calma (moderado) ou aproveita pra comprar mais (arrojado)?";
  }
  return `Oi! Sou a Pra 👋\nSeu perfil é ${riskLabel(profile.risk).toLowerCase()} com horizonte ${horizonLabel(profile.horizon).toLowerCase()}. Posso sugerir uma estratégia, comentar uma ação específica ou olhar pro seu portfólio. O que você quer fazer?`;
}

function fallbackReply(userMsg: string): string {
  const t = userMsg.toLowerCase();
  if (t.includes("dividend") || t.includes("renda")) {
    return "Pra dividendos consistentes no Brasil, eu olharia Itaú (ITUB4), Taesa (TAEE11), BB Seguridade (BBSE3) e Vale (VALE3). Yield acima de 8% e payout estável. Quer detalhar alguma?";
  }
  if (t.includes("risco") || t.includes("perfil")) {
    return "Risco varia muito com horizonte e correlação dos ativos. Diversificar entre setores (tech, bancos, energia, consumo) reduz volatilidade sem sacrificar muito retorno. Tem alguma posição preocupando?";
  }
  if (t.includes("rebalance")) {
    return "Pra rebalancear bem, primeiro mapeia a alocação alvo por setor (ex.: 30% tech, 25% bancos, 20% energia, 15% defensivos, 10% caixa). Depois vende o que tá acima e compra o que tá abaixo. Quer ajuda com seu caso específico?";
  }
  return "Estou com dificuldade pra acessar a IA agora. Volta a perguntar em alguns instantes.";
}

function tryExtractProfile(text: string): { clean: string; draft: ProfileDraft | null } {
  const match = text.match(PROFILE_MARKER);
  if (!match) return { clean: text, draft: null };

  const clean = text.replace(PROFILE_MARKER, "").trim();
  try {
    const parsed = JSON.parse(match[1]);
    const risk = parsed.risk;
    const horizon = parsed.horizon;
    const interests = parsed.interests;

    const validRisk = risk === "low" || risk === "mid" || risk === "high";
    const validHorizon = horizon === "short" || horizon === "mid" || horizon === "long";
    const validInterests =
      Array.isArray(interests) &&
      interests.length > 0 &&
      interests.every((i) => i === "div" || i === "gro" || i === "esg" || i === "tec");

    if (validRisk && validHorizon && validInterests) {
      return { clean, draft: { risk, horizon, interests } };
    }
  } catch {
    /* invalid JSON in marker — ignore */
  }
  return { clean, draft: null };
}

export function usePraChat({ tone, profile, stocks, totalValue, onProfileDetected }: UsePraChatArgs) {
  const [messages, setMessages] = useState<ChatMessage[]>(load);
  const [thinking, setThinking] = useState(false);
  const ctxRef = useRef({ tone, profile, stocks, totalValue });
  ctxRef.current = { tone, profile, stocks, totalValue };
  const onProfileRef = useRef(onProfileDetected);
  onProfileRef.current = onProfileDetected;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  const ensureGreeting = useCallback(() => {
    setMessages((prev) =>
      prev.length === 0
        ? [{ role: "pra", text: greetingFor(tone, profile), timestamp: new Date().toISOString() }]
        : prev
    );
  }, [tone, profile]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || thinking) return;

      const userMsg: ChatMessage = {
        role: "user",
        text: trimmed,
        timestamp: new Date().toISOString(),
      };
      const conversation = [...messages, userMsg];
      setMessages(conversation);
      setThinking(true);

      try {
        const system = buildSystemPrompt(ctxRef.current);
        const apiMessages = [
          { role: "system" as const, content: system },
          ...conversation.map((m) => ({
            role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
            content: m.text,
          })),
        ];

        const response = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: apiMessages,
            temperature: 0.6,
            max_tokens: 700,
          }),
        });

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          throw new Error(errBody.error || `IA respondeu com ${response.status}`);
        }

        const data = await response.json();
        const raw = (data.content ?? "").trim() || fallbackReply(trimmed);
        const { clean, draft } = tryExtractProfile(raw);

        if (draft && onProfileRef.current) {
          onProfileRef.current(draft);
        }

        setMessages((m) => [
          ...m,
          { role: "pra", text: clean || raw, timestamp: new Date().toISOString() },
        ]);
      } catch (err) {
        const reply = fallbackReply(trimmed);
        setMessages((m) => [
          ...m,
          {
            role: "pra",
            text: `${reply}\n\n(${err instanceof Error ? err.message : "erro desconhecido"})`,
            timestamp: new Date().toISOString(),
          },
        ]);
      } finally {
        setThinking(false);
      }
    },
    [messages, thinking]
  );

  const reset = useCallback(() => setMessages([]), []);

  return { messages, thinking, send, reset, ensureGreeting };
}
