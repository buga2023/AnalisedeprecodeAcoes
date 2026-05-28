/**
 * Tipos do schema Supabase do Praxia. Sao espelho de supabase/migrations/001_initial.sql.
 * Quando mexer no SQL, atualizar este arquivo tambem.
 *
 * Formato segue a convencao do supabase-js: `Tables`, `Insert`, `Update`,
 * todos por tabela. O generic `PraxiaDatabase` cabe em `createClient<...>`.
 */

export type InvestorRisk = "low" | "mid" | "high";
export type InvestorHorizon = "short" | "mid" | "long";
export type InvestorInterest = "div" | "gro" | "esg" | "tec";
export type UserPlan = "free" | "pro";
export type ChatTone = "casual" | "formal";
export type AIVerbosity = "concise" | "verbose";
export type TransactionKind = "buy" | "sell" | "dividend";

export interface ProfileRow {
  user_id: string;
  risk: InvestorRisk | null;
  horizon: InvestorHorizon | null;
  interests: InvestorInterest[];
  quiz_completed_at: string | null;
  username: string | null;
  plan: UserPlan;
  plan_renewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PortfolioStockRow {
  user_id: string;
  ticker: string;
  name: string | null;
  sector: string | null;
  quantity: number;
  cost: number;
  added_at: string;
  updated_at: string;
}

export interface TransactionRow {
  id: string;
  user_id: string;
  ticker: string;
  kind: TransactionKind;
  quantity: number;
  price: number;
  total: number;
  note: string | null;
  occurred_at: string;
  created_at: string;
}

export interface PreferencesRow {
  user_id: string;
  accent: string;
  tone: ChatTone;
  ai_verbosity: AIVerbosity;
  updated_at: string;
}

/**
 * Tipo genérico que o supabase-js usa pra inferir colunas em chamadas:
 *   supabase.from("portfolio_stocks").select("*") -> PortfolioStockRow[]
 *   supabase.from("transactions").insert({...}) -> exige campos required
 */
export interface PraxiaDatabase {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Partial<ProfileRow> & { user_id: string };
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      portfolio_stocks: {
        Row: PortfolioStockRow;
        Insert: Partial<PortfolioStockRow> & { user_id: string; ticker: string };
        Update: Partial<PortfolioStockRow>;
        Relationships: [];
      };
      transactions: {
        Row: TransactionRow;
        Insert: Omit<TransactionRow, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<TransactionRow>;
        Relationships: [];
      };
      preferences: {
        Row: PreferencesRow;
        Insert: Partial<PreferencesRow> & { user_id: string };
        Update: Partial<PreferencesRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
