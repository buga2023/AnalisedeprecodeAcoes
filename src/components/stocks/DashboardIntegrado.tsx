import { CalendarDays, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { calculateGrahamValue, calculateMarginOfSafety, getScoreLabel } from "@/lib/calculators";
import type { Relatorio, Stock } from "@/types/stock";

interface DashboardIntegradoProps {
  stocks: Stock[];
  relatorios: Relatorio[];
}

function formatCurrency(value: number) {
  if (Math.abs(value) >= 1_000_000_000) return `R$ ${(value / 1_000_000_000).toFixed(1)} bi`;
  if (Math.abs(value) >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)} mi`;
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function nextQuarterEstimate(dataFim?: string) {
  if (!dataFim) return "N/D";
  const date = new Date(dataFim);
  date.setMonth(date.getMonth() + 4);
  return `~${new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric" }).format(date)}`;
}

export function DashboardIntegrado({ stocks, relatorios }: DashboardIntegradoProps) {
  if (stocks.length === 0) return null;

  return (
    <section className="rounded-xl border border-border/50 bg-card/80 p-5 shadow-xl">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold tracking-tight text-white">Dashboard Integrado</h2>
        <Badge className="border-border bg-muted/50 text-muted-foreground">Cotacao x Teto x Resultado</Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {stocks.map((stock) => {
          const precoTeto = calculateGrahamValue(stock.lpa, stock.vpa);
          const margem = calculateMarginOfSafety(stock.price, precoTeto);
          const ultimoResultado = relatorios.find((relatorio) => relatorio.ticker === stock.ticker);
          const resultadoPositivo = !ultimoResultado || ultimoResultado.resultado === "positivo";
          const margemPositiva = margem >= 0;

          return (
            <div key={stock.ticker} className="rounded-lg border border-border/40 bg-background/40 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-base font-black text-white">{stock.ticker}</span>
                <span className={`flex items-center gap-1 text-xs font-black ${stock.changePercent >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {stock.changePercent >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                  {stock.changePercent >= 0 ? "+" : ""}{stock.changePercent.toFixed(1)}% hoje
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Cotacao</span>
                  <span className="font-mono font-bold text-white">{formatCurrency(stock.price)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Preco Teto Graham</span>
                  <span className="font-mono font-bold text-white">{formatCurrency(precoTeto)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Margem de Seguranca</span>
                  <span className={`font-black ${margemPositiva ? "text-emerald-400" : "text-rose-400"}`}>
                    {(margem * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Score</span>
                  <span className="font-bold text-primary">{stock.score}/100 {getScoreLabel(stock.score)}</span>
                </div>
                <div className="flex justify-between gap-3 border-t border-border/30 pt-2">
                  <span className="text-muted-foreground">Ultimo resultado</span>
                  <span className={`flex items-center gap-1 font-bold ${resultadoPositivo ? "text-emerald-400" : "text-rose-400"}`}>
                    {resultadoPositivo ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                    {ultimoResultado ? `${ultimoResultado.periodo} ${resultadoPositivo ? "Lucro" : "Prejuizo"}` : "Dados nao disponiveis"}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Lucro Liquido</span>
                  <span className="font-mono font-bold text-white">
                    {ultimoResultado ? formatCurrency(ultimoResultado.lucroLiquido) : "N/D"}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Proximo resultado</span>
                  <span className="flex items-center gap-1 font-bold text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {nextQuarterEstimate(ultimoResultado?.dataFim)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
