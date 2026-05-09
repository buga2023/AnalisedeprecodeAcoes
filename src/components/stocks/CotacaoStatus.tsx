import { RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Stock } from "@/types/stock";

interface CotacaoStatusProps {
  stocks: Stock[];
  lastRefreshed: Date | null;
  isRefreshing: boolean;
  onRefresh: () => Promise<void>;
}

function formatTime(date: Date | null) {
  if (!date) return "Atualizacao pendente";
  return `Atualizado as ${new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)}`;
}

export function CotacaoStatus({ stocks, lastRefreshed, isRefreshing, onRefresh }: CotacaoStatusProps) {
  const averageChange = stocks.length > 0
    ? stocks.reduce((sum, stock) => sum + stock.changePercent, 0) / stocks.length
    : 0;
  const positive = averageChange >= 0;

  return (
    <div className="rounded-xl border border-border/50 bg-card/80 px-4 py-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-bold text-white">{formatTime(lastRefreshed)}</span>
          <Badge className={positive ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300"}>
            {positive ? <TrendingUp className="mr-1.5 h-3.5 w-3.5" /> : <TrendingDown className="mr-1.5 h-3.5 w-3.5" />}
            {positive ? "+" : ""}{averageChange.toFixed(2)}% hoje
          </Badge>
        </div>

        <Button
          className="h-9 bg-primary font-bold hover:bg-blue-600"
          onClick={() => void onRefresh()}
          disabled={isRefreshing || stocks.length === 0}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          Atualizar Agora
        </Button>
      </div>
    </div>
  );
}
