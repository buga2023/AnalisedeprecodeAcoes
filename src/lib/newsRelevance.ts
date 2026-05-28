import type { InvestorProfile, Stock, Interest } from "@/types/stock";
import type { WorldNewsItem } from "./context";

export interface RelevanceContext {
  profile: InvestorProfile | null;
  stocks: Stock[];
  dominantSectorLabel: string | null;
  now?: number;
}

export interface ScoredItem {
  item: WorldNewsItem;
  score: number;
  reasons: string[];
  matchedTickers: string[];
}

const TICKER_BOOST = 30;
const REGULATORY_TICKER_BOOST = 25;
const INTEREST_BOOST = 20;
const SECTOR_BOOST = 15;
const RECENT_BOOST = 5;
const RISK_VOLATILE_PENALTY = -10;

const REGULATORY_TOPIC = "regulatorio";

const RECENT_WINDOW_MS = 6 * 60 * 60 * 1000;
const VOLATILE_TOM_THRESHOLD = -0.5;

const INTEREST_KEYWORDS: Record<Interest, RegExp> = {
  div: /\b(dividend\w*|payout|jcp|provento\w*|distribui[cç][aã]o)\b/i,
  gro: /\b(crescimento|growth|expans[aã]o|receita\s+sobe|guidance|m&a|aquisi[cç][aã]o|fus[aã]o)\b/i,
  esg: /\b(esg|sustent[aá]vel|sustentabilidade|carbono|net[\s-]?zero|emiss[aã]o|verde|renov[aá]vel|social|governan[cç]a)\b/i,
  tec: /\b(tecnologia|tech|ia|ai|intelig[eê]ncia\s+artificial|semicondutor\w*|cloud|software|saas|chip\w*)\b/i,
};

const SECTOR_TOPIC_AFFINITY: Record<string, string[]> = {
  Bancos: ["brasil-fiscal", "politica-eua"],
  Energia: ["commodities", "geopolitica", "guerra"],
  Mineração: ["china", "commodities"],
  Industrial: ["china", "politica-eua", "commodities"],
  Varejo: ["brasil-fiscal"],
  Tech: ["politica-eua", "china"],
  Semicondutores: ["politica-eua", "china"],
  Saúde: ["brasil-fiscal"],
  Seguros: ["brasil-fiscal"],
  Streaming: ["politica-eua"],
  Auto: ["china", "commodities"],
  "Papel & Celulose": ["china", "commodities"],
  Locação: ["brasil-fiscal"],
};

function normalizeText(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function findMatchedTickers(item: WorldNewsItem, tickers: string[]): string[] {
  if (tickers.length === 0) return [];
  const haystack = normalizeText(`${item.titulo} ${item.link} ${item.fonte ?? ""}`);
  const matched: string[] = [];
  for (const t of tickers) {
    const tk = t.toUpperCase();
    const stem = tk.replace(/\d+$/, "");
    const reExact = new RegExp(`\\b${tk}\\b`, "i");
    const reStem = stem.length >= 3 ? new RegExp(`\\b${stem}\\b`, "i") : null;
    if (reExact.test(haystack) || (reStem && reStem.test(haystack))) {
      matched.push(tk);
    }
  }
  return matched;
}

function matchesInterest(item: WorldNewsItem, interests: Interest[]): Interest | null {
  const hay = `${item.titulo} ${item.fonte ?? ""}`;
  for (const i of interests) {
    if (INTEREST_KEYWORDS[i].test(hay)) return i;
  }
  return null;
}

function topicMatchesSector(topic: string | undefined, sectorLabel: string | null): boolean {
  if (!topic || !sectorLabel) return false;
  const affinity = SECTOR_TOPIC_AFFINITY[sectorLabel];
  return !!affinity && affinity.includes(topic);
}

export function scoreNewsItem(
  item: WorldNewsItem,
  ctx: RelevanceContext,
  topic?: string
): ScoredItem {
  const reasons: string[] = [];
  let score = 0;

  const tickers = ctx.stocks.map((s) => s.ticker);
  const matchedTickers = findMatchedTickers(item, tickers);
  if (matchedTickers.length > 0) {
    score += TICKER_BOOST;
    reasons.push(`ticker da carteira: ${matchedTickers.join(", ")}`);
    if (topic === REGULATORY_TOPIC) {
      score += REGULATORY_TICKER_BOOST;
      reasons.push("fato relevante de empresa da carteira");
    }
  }

  if (ctx.profile && ctx.profile.interests.length > 0) {
    const i = matchesInterest(item, ctx.profile.interests);
    if (i) {
      score += INTEREST_BOOST;
      reasons.push(`interesse: ${i}`);
    }
  }

  if (topicMatchesSector(topic, ctx.dominantSectorLabel)) {
    score += SECTOR_BOOST;
    reasons.push(`setor dominante: ${ctx.dominantSectorLabel}`);
  }

  if (
    ctx.profile?.risk === "low" &&
    typeof item.tom === "number" &&
    item.tom < VOLATILE_TOM_THRESHOLD
  ) {
    score += RISK_VOLATILE_PENALTY;
    reasons.push("conservador x notícia muito negativa");
  }

  if (item.publicado) {
    const t = Date.parse(item.publicado);
    if (!Number.isNaN(t)) {
      const now = ctx.now ?? Date.now();
      if (now - t < RECENT_WINDOW_MS) {
        score += RECENT_BOOST;
        reasons.push("publicado < 6h");
      }
    }
  }

  return { item, score, reasons, matchedTickers };
}

export interface ScoredFeedEntry extends ScoredItem {
  topic: string;
  topicLabel: string;
}

export function scoreFeed(
  entries: Array<{ item: WorldNewsItem; topic: string; topicLabel: string }>,
  ctx: RelevanceContext
): ScoredFeedEntry[] {
  return entries
    .map((e) => ({ ...scoreNewsItem(e.item, ctx, e.topic), topic: e.topic, topicLabel: e.topicLabel }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const da = Date.parse(a.item.publicado || "");
      const db = Date.parse(b.item.publicado || "");
      if (Number.isNaN(da) && Number.isNaN(db)) return 0;
      if (Number.isNaN(da)) return 1;
      if (Number.isNaN(db)) return -1;
      return db - da;
    });
}
