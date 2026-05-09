import { useMemo } from "react";
import { ChevronDown, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Relatorio, Stock } from "@/types/stock";

interface RelatoriosPanelProps {
  stocks: Stock[];
  relatorios: Relatorio[];
  loading: boolean;
  error: string | null;
  onRefresh: () => Promise<void>;
}

function formatCurrency(value: number) {
  if (Math.abs(value) >= 1_000_000_000) return `R$ ${(value / 1_000_000_000).toFixed(1)} bi`;
  if (Math.abs(value) >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)} mi`;
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function isNovo(dataFim: string) {
  return Date.now() - new Date(dataFim).getTime() <= 60 * 24 * 60 * 60 * 1000;
}

function groupByTicker(relatorios: Relatorio[]) {
  return relatorios.reduce<Record<string, Relatorio[]>>((acc, relatorio) => {
    acc[relatorio.ticker] = [...(acc[relatorio.ticker] ?? []), relatorio];
    return acc;
  }, {});
}

export function RelatoriosPanel({ stocks, relatorios, loading, error, onRefresh }: RelatoriosPanelProps) {
  const grouped = useMemo(() => groupByTicker(relatorios), [relatorios]);

  if (stocks.length === 0) return null;

  return (
    <section className="rounded-xl border border-border/50 bg-card shadow-xl">
      <div className="flex items-center justify-between border-b border-border/30 px-6 py-4">
        <div>
          <h2 className="text-lg font-bold text-white">Relatorios de Resultados</h2>
          <p className="text-xs text-muted-foreground">Dados trimestrais via brapi.dev com cache local de 24h</p>
        </div>
        <Button variant="outline" className="h-9 border-border" onClick={() => void onRefresh()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {error && (
        <div className="border-b border-rose-500/20 bg-rose-500/10 px-6 py-3 text-sm text-rose-300">
          {error}
        </div>
      )}

      {loading && relatorios.length === 0 ? (
        <div className="space-y-3 p-6">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-16 animate-pulse rounded-lg bg-muted/40" />
          ))}
        </div>
      ) : (
        <div className="divide-y divide-border/30">
          {stocks.map((stock) => {
            const rows = (grouped[stock.ticker] ?? []).slice(0, 4);

            return (
              <details key={stock.ticker} className="group px-6 py-4" open>
                <summary className="flex cursor-pointer list-none items-center justify-between">
                  <span className="text-base font-black text-white">{stock.ticker}</span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>

                {rows.length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">Dados nao disponiveis</p>
                ) : (
                  <div className="mt-4 overflow-hidden rounded-lg border border-border/30">
                    {rows.map((relatorio) => (
                      <div
                        key={`${relatorio.ticker}-${relatorio.periodo}-${relatorio.dataFim}`}
                        className="grid grid-cols-[80px_1fr_1fr_80px] items-center gap-3 border-b border-border/20 px-4 py-3 last:border-b-0"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-black text-white">{relatorio.periodo}</span>
                          {isNovo(relatorio.dataFim) && (
                            <Badge className="bg-emerald-500/10 text-emerald-300">NOVO</Badge>
                          )}
                        </div>
                        <span className="font-mono text-sm text-muted-foreground">{formatCurrency(relatorio.receita)}</span>
                        <span className="font-mono text-sm font-bold text-white">{formatCurrency(relatorio.lucroLiquido)}</span>
                        <span className="flex items-center justify-end">
                          <span className={`h-2.5 w-2.5 rounded-full ${relatorio.resultado === "positivo" ? "bg-emerald-400" : "bg-rose-400"}`} />
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </details>
            );
          })}
        </div>
      )}
    </section>
  );
}
