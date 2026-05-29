import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage, InvestorProfile, Stock } from "@/types/stock";
import { riskLabel, horizonLabel, interestLabel } from "@/hooks/useInvestorProfile";
import { PRAXIA_SYSTEM_PROMPT, CHAT_OUTPUT_SUFFIX } from "@/lib/praxiaPrompt";
import { checkRateLimit, estimateTokens, recordCall } from "@/lib/aiTelemetry";
import { aiAuthHeaders, throwIfPaywalled } from "@/lib/aiAuth";

const STORAGE_KEY = "praxia-pra-chat";
const PROFILE_MARKER = /\[PROFILE\]\s*(\{[\s\S]*?\})\s*\[\/PROFILE\]/;
// Thinking tag pode aparecer no inicio das respostas (esperado pelo system prompt).
// UI pode renderizar de forma especial; aqui so usamos pra strip se necessario.
const THINKING_TAG = /<thinking>[\s\S]*?<\/thinking>\s*/;

/** Maximo de mensagens preservadas em localStorage e em memoria. */
const MAX_HISTORY = 30;
/** Janela de turns recentes enviada integralmente ao LLM (3 user + 3 pra). */
const WINDOW_KEEP = 6;
/** A partir deste tamanho, mensagens fora da janela viram um resumo heuristico. */
const SUMMARY_THRESHOLD = 10;

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
    if (raw) {
      const all = JSON.parse(raw) as ChatMessage[];
      // Trunca FIFO — preserva so as ultimas MAX_HISTORY pra evitar inflar.
      return all.slice(-MAX_HISTORY);
    }
  } catch {
    /* swallow */
  }
  return [];
}

/**
 * Resumo heuristico (sem LLM) das mensagens antigas — extrai tickers
 * mencionados + 4 substantivos mais frequentes. Custo zero, qualidade
 * "suficiente" pra Pra lembrar do que se falou.
 */
const STOPWORDS = new Set([
  "para", "como", "voce", "isso", "mais", "muito", "sobre", "minha", "meu",
  "esse", "essa", "este", "esta", "pelo", "pela", "perfil", "carteira",
  "ativo", "ativos", "acao", "acoes", "mercado", "preco", "valor", "pode",
  "quer", "tenho", "sera", "agora", "depois", "antes", "qual", "quem",
  "onde", "porque", "porque", "porem", "entao", "tambem", "exato", "esses",
  "entre", "fazer", "deveria", "deve", "deveria", "novas",
]);
const TICKER_RE = /\b[A-Z]{4}\d{1,2}\b/g;
const WORD_RE = /\b[a-zA-Zàâãéêíóôõúç]{5,}\b/g;

function summarizeOldTurns(messages: ChatMessage[]): string {
  if (messages.length === 0) return "";
  const text = messages.map((m) => m.text).join(" ");

  const tickers = Array.from(new Set(text.match(TICKER_RE) ?? [])).slice(0, 6);

  const counts = new Map<string, number>();
  for (const w of text.match(WORD_RE) ?? []) {
    const lower = w.toLowerCase();
    if (STOPWORDS.has(lower)) continue;
    counts.set(lower, (counts.get(lower) ?? 0) + 1);
  }
  const topics = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map((e) => e[0]);

  const parts: string[] = [];
  if (tickers.length > 0) parts.push(`tickers ja discutidos: ${tickers.join(", ")}`);
  if (topics.length > 0) parts.push(`temas: ${topics.join(", ")}`);
  if (parts.length === 0) return "";
  return `RESUMO DA CONVERSA ANTERIOR (${messages.length} turns): ${parts.join("; ")}.`;
}

/**
 * Monta o user prompt complementar para o chat. O PRAXIA_SYSTEM_PROMPT mestre
 * (em src/lib/praxiaPrompt.ts) ja cobre identidade, cadeia de raciocinio,
 * cadeias de transmissao, regras e exemplos. Aqui injetamos APENAS o contexto
 * que muda por conversa: tom, perfil, carteira, modo de elicitacao.
 */
function buildChatContextPrompt(args: Omit<UsePraChatArgs, "onProfileDetected">): string {
  const { tone, profile, stocks, totalValue } = args;

  const personality =
    tone === "formal"
      ? "TOM: profissional, respeitoso, linguagem de mercado mas acessivel. Use 'voce'."
      : "TOM: amigavel e direto, como mentora que entende muito de mercado. Casual sem perder substancia.";

  const profileSummary = profile
    ? `PERFIL DO USUARIO: ${riskLabel(profile.risk)}, horizonte ${horizonLabel(
        profile.horizon
      )}, interesses: ${profile.interests.map(interestLabel).join(", ")}.`
    : "PERFIL DO USUARIO: ainda nao definido.";

  const portfolio =
    stocks.length === 0
      ? "CARTEIRA ATUAL: vazia."
      : `CARTEIRA ATUAL (priorize estes tickers): patrimonio R$ ${totalValue.toFixed(
          2
        )} em ${stocks.length} ativos. ` +
        stocks
          .map(
            (s) =>
              `${s.ticker} (R$ ${s.price.toFixed(2)}, ${s.changePercent >= 0 ? "+" : ""}${s.changePercent.toFixed(
                2
              )}%, P/L ${s.pl.toFixed(1)}, P/VP ${s.pvp.toFixed(2)}, DY ${(s.dividendYield * 100).toFixed(
                1
              )}%, ROE ${(s.roe * 100).toFixed(1)}%, Score ${s.score}/100, Graham R$ ${(
                s.grahamValue ?? 0
              ).toFixed(2)}, MoS ${(s.marginOfSafety ?? 0).toFixed(1)}%)`
          )
          .join("; ") +
        ".";

  // Modo de elicitacao de perfil — UNICO ao chat (outras capabilities nao
  // perguntam perfil ao usuario, so consomem).
  const elicitationMode = profile
    ? ""
    : `MODO ELICITACAO DE PERFIL ATIVO:
- O usuario AINDA nao tem perfil definido.
- NAO de recomendacao especifica de compra/venda.
- Sua prioridade e descobrir o perfil em ate 3 perguntas curtas (uma por mensagem).
- Quando tiver risco + horizonte + pelo menos 1 interesse, ENCERRE com o marcador EXATO:
  [PROFILE]{"risk":"low|mid|high","horizon":"short|mid|long","interests":["div|gro|esg|tec"]}[/PROFILE]
- NUNCA quebre o JSON do marker (sem virgula final, aspas duplas obrigatorias).`;

  return [
    "MODO DE OUTPUT: chat (texto livre + bloco Fontes ao final).",
    personality,
    profileSummary,
    portfolio,
    elicitationMode,
    CHAT_OUTPUT_SUFFIX,
  ]
    .filter(Boolean)
    .join("\n\n");
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
    // Persiste so as ultimas MAX_HISTORY mensagens — evita inflar localStorage
    // ao longo de meses de uso.
    const toSave = messages.length > MAX_HISTORY ? messages.slice(-MAX_HISTORY) : messages;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  }, [messages]);

  /**
   * Hash dos campos que mudam o chatContext (perfil, conjunto de tickers,
   * faixa de patrimonio). So recalcula buildChatContextPrompt quando esse
   * hash muda — evita re-montar o prompt em todo send.
   */
  const contextHash = useMemo(() => {
    const profileSig = profile
      ? `${profile.risk}-${profile.horizon}-${(profile.interests ?? []).slice().sort().join(",")}`
      : "noprof";
    const stocksSig = stocks.map((s) => s.ticker.toUpperCase()).sort().join(",");
    // Bucket de patrimonio: faixa logaritmica pra nao invalidar a cada R$ 100.
    const totalBucket = totalValue > 0 ? Math.floor(Math.log10(Math.max(1, totalValue)) * 10) : 0;
    return `${profileSig}|${stocksSig}|t${totalBucket}|${tone}`;
  }, [profile, stocks, totalValue, tone]);

  const chatContextMemo = useMemo(
    () => buildChatContextPrompt({ tone, profile, stocks, totalValue }),
    // Recomputa SO quando o hash muda. ctxRef segue como fallback no `send`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contextHash]
  );

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
        // Rate-limit guard: barra antes de bater 429 no provider.
        const gate = checkRateLimit();
        if (!gate.allowed) {
          const seconds = Math.ceil(gate.retryAfterMs / 1000);
          setMessages((m) => [
            ...m,
            {
              role: "pra",
              text: `Estamos no limite de chamadas IA do plano gratuito (Groq). Aguarde ~${seconds}s e tente de novo — ou ajuste o uso (cache ja cobre boa parte das respostas).`,
              timestamp: new Date().toISOString(),
            },
          ]);
          setThinking(false);
          return;
        }

        // chatContext vem do memo — so muda quando perfil/tickers/patrimonio mudam.
        const chatContext = chatContextMemo;
        // Sliding window: em conversas longas, mensagens antigas viram um
        // resumo heuristico curto (sem chamada LLM) e so as ultimas WINDOW_KEEP
        // turns vao integrais. Mantem continuidade sem inflar tokens.
        const useWindow = conversation.length > SUMMARY_THRESHOLD;
        const recent = useWindow ? conversation.slice(-WINDOW_KEEP) : conversation;
        const summary = useWindow
          ? summarizeOldTurns(conversation.slice(0, -WINDOW_KEEP))
          : "";

        const apiMessages = [
          { role: "system" as const, content: PRAXIA_SYSTEM_PROMPT },
          { role: "user" as const, content: chatContext },
          { role: "assistant" as const, content: "Entendido. Vou seguir o reasoning_chain e o output format de chat (thinking + resposta + Fontes)." },
          ...(summary
            ? [{ role: "user" as const, content: summary }, { role: "assistant" as const, content: "Anotado, continuo de onde paramos." }]
            : []),
          ...recent.map((m) => ({
            role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
            content: m.text,
          })),
        ];

        const response = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...aiAuthHeaders() },
          body: JSON.stringify({
            messages: apiMessages,
            // Temperatura mais baixa pra seguir melhor o reasoning_chain.
            temperature: 0.4,
            // max_tokens calibrado pra <thinking> compacto (3 bullets) + resposta + Fontes.
            max_tokens: 900,
            // Sinaliza o servidor pra aplicar o cache semântico (L3) + gate.
            feature: "chat",
          }),
        });

        await throwIfPaywalled(response, "ai-analysis");

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          throw new Error(errBody.error || `IA respondeu com ${response.status}`);
        }

        const data = await response.json();
        let raw = String(data.content ?? "").trim() || fallbackReply(trimmed);

        // Telemetria: estima tokens in/out pelo tamanho de cada bloco.
        const tokensIn = apiMessages.reduce((acc, m) => acc + estimateTokens(m.content), 0);
        recordCall("chat", tokensIn, estimateTokens(raw));
        // Strip do bloco <thinking>...</thinking> antes de exibir — eh chain of
        // thought interno, nao precisa poluir a UI. Pode ser exposto via toggle
        // "ver raciocinio" no futuro se quisermos transparencia.
        raw = raw.replace(THINKING_TAG, "").trim();
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
    [messages, thinking, chatContextMemo]
  );

  const reset = useCallback(() => setMessages([]), []);

  return { messages, thinking, send, reset, ensureGreeting };
}
