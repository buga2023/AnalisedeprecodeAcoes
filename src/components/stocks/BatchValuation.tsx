import React, { useRef } from 'react';
import { Upload, FileSpreadsheet, Download, RefreshCw, Trash2, TrendingUp, AlertCircle, Info, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBatchValuation } from '@/hooks/useBatchValuation';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const BatchValuation: React.FC = () => {
  const {
    rows,
    isLoading,
    progress,
    growthRate,
    importCSV,
    updateGrowthRate,
    clearBatch,
    exportCSV
  } = useBatchValuation();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      importCSV(file);
    }
  };

  const formatValue = (val: number | null, prefix = 'R$ ') => {
    if (val === null) return '—';
    return `${prefix}${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatPercent = (val: number | null) => {
    if (val === null) return '—';
    return `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`;
  };

  const getSignalBadge = (row: any) => {
    // Sinal Geral: 'Comprar' se pelo menos 2 dos 3 métodos sinalizam compra
    let buyCount = 0;
    if (row.bazinSignal === 'Comprar') buyCount++;
    if (row.grahamSignal === 'Comprar') buyCount++;
    if (row.grahamGrowthSignal === 'Comprar') buyCount++;

    if (buyCount >= 2) return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">COMPRAR</Badge>;
    if (buyCount === 0) return <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/30">CARO</Badge>;
    return <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30">OBSERVAR</Badge>;
  };

  // --- Etapa 1: Upload ---
  if (rows.length === 0 && !isLoading) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-border/50 rounded-3xl bg-card/30 backdrop-blur-sm hover:bg-card/50 transition-all group">
          <div className="p-6 rounded-full bg-primary/10 mb-6 group-hover:scale-110 transition-transform">
            <Upload className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-2xl font-black text-white mb-2 tracking-tight">Análise em Lote</h2>
          <p className="text-muted-foreground text-center max-w-md mb-8">
            Suba sua planilha de ativos e calcule os indicadores de Graham e Bazin instantaneamente.
          </p>
          
          <input
            type="file"
            accept=".csv"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileChange}
          />
          
          <div className="flex flex-col gap-4 w-full max-w-sm">
            <Button 
              size="lg" 
              className="w-full bg-primary hover:bg-blue-600 font-bold text-base py-6"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileSpreadsheet className="mr-2 h-5 w-5" />
              Selecionar CSV da Carteira
            </Button>
            
            <a 
              href="/template-carteira.csv" 
              download 
              className="flex items-center justify-center text-xs text-muted-foreground hover:text-primary transition-colors py-2"
            >
              <Download className="mr-2 h-3.5 w-3.5" />
              Baixar Template CSV
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-card border border-border/50 space-y-3">
            <div className="size-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Calculator className="h-4 w-4 text-emerald-400" />
            </div>
            <h3 className="font-bold text-white">Método Bazin</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Baseado no histórico de dividendos (DPA). Define o preço teto para um yield de 6%.
            </p>
          </div>
          <div className="p-6 rounded-2xl bg-card border border-border/50 space-y-3">
            <div className="size-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-blue-400" />
            </div>
            <h3 className="font-bold text-white">Graham Tradicional</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Fórmula clássica: √(22,5 × LPA × VPA). Foca em margem de segurança e valor patrimonial.
            </p>
          </div>
          <div className="p-6 rounded-2xl bg-card border border-border/50 space-y-3">
            <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <h3 className="font-bold text-white">Graham Crescimento</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Ajustado pelo crescimento projetado (g). Ideal para empresas com lucro crescente.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // --- Etapa 2: Tabela de Resultados ---
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header de Controle */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-card border border-border/50">
        <div className="flex items-center gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-black text-white tracking-tight">Resultados da Carteira</h2>
            {isLoading ? (
              <div className="flex items-center gap-2 text-xs text-primary font-bold animate-pulse">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Buscando cotações... {progress.done}/{progress.total}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="size-2 rounded-full bg-emerald-400" />
                {rows.length} Ativos Analisados
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3 bg-slate-900/50 px-3 py-1.5 rounded-xl border border-border/50">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Crescimento (g)</span>
            <input
              type="number"
              value={growthRate}
              onChange={(e) => updateGrowthRate(Number(e.target.value))}
              className="w-12 bg-transparent text-sm font-bold text-primary focus:outline-none"
            />
            <span className="text-sm font-bold text-primary">%</span>
          </div>

          <Button variant="outline" size="sm" onClick={exportCSV} disabled={isLoading}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>

          <Button 
            variant="ghost" 
            size="sm" 
            onClick={clearBatch}
            className="text-muted-foreground hover:text-rose-400"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Nova Importação
          </Button>
        </div>
      </div>

      {/* Tabela */}
      <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent border-b border-border/50">
                <TableHead className="text-[10px] font-black uppercase tracking-widest py-4 px-6">Ativo</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Cotação</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">P. Médio</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">ROI%</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Bazin (Teto)</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Margem Bazin</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Graham (VI)</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Margem Graham</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Graham (Cresc)</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Margem Cresc</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-right px-6">Sinal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow key={`${row.ticker}-${i}`} className="group hover:bg-primary/5 transition-colors border-b border-border/20">
                  <TableCell className="py-4 px-6">
                    <div className="flex flex-col">
                      <span className="font-black text-white group-hover:text-primary transition-colors">{row.ticker}</span>
                      {row.fetchStatus === 'error' && (
                        <span className="text-[10px] text-rose-400 flex items-center gap-1">
                          <AlertCircle className="h-2.5 w-2.5" />
                          {row.fetchError}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  
                  <TableCell className="font-mono text-xs font-bold text-white">
                    {row.fetchStatus === 'loading' ? (
                      <div className="h-4 w-16 bg-slate-800 animate-pulse rounded" />
                    ) : formatValue(row.currentPrice)}
                  </TableCell>

                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {formatValue(row.avgCost)}
                  </TableCell>

                  <TableCell>
                    <span className={`text-xs font-black ${row.roi && row.roi >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {formatPercent(row.roi)}
                    </span>
                  </TableCell>

                  <TableCell className="font-mono text-xs text-white/80">
                    {formatValue(row.bazinCeiling)}
                  </TableCell>

                  <TableCell>
                    <span className={`text-xs font-black ${row.bazinMargin && row.bazinMargin > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {formatPercent(row.bazinMargin)}
                    </span>
                  </TableCell>

                  <TableCell className="font-mono text-xs text-white/80">
                    {formatValue(row.grahamVI)}
                  </TableCell>

                  <TableCell>
                    <span className={`text-xs font-black ${row.grahamMargin && row.grahamMargin > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {formatPercent(row.grahamMargin)}
                    </span>
                  </TableCell>

                  <TableCell className="font-mono text-xs text-white/80">
                    {formatValue(row.grahamGrowth)}
                  </TableCell>

                  <TableCell>
                    <span className={`text-xs font-black ${row.grahamGrowthMargin && row.grahamGrowthMargin > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {formatPercent(row.grahamGrowthMargin)}
                    </span>
                  </TableCell>

                  <TableCell className="text-right px-6">
                    {getSignalBadge(row)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Sumário */}
      <div className="flex items-center gap-6 p-4 rounded-xl bg-slate-900/30 border border-border/30">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-blue-400" />
          <span className="text-xs text-muted-foreground">
            Sinal <strong>COMPRAR</strong> exige pelo menos 2 métodos favoráveis.
          </span>
        </div>
        <div className="flex-1" />
        <div className="text-xs font-bold text-emerald-400">
          {rows.filter(r => {
            let buys = 0;
            if (r.bazinSignal === 'Comprar') buys++;
            if (r.grahamSignal === 'Comprar') buys++;
            if (r.grahamGrowthSignal === 'Comprar') buys++;
            return buys >= 2;
          }).length} Oportunidades
        </div>
        <div className="text-xs font-bold text-rose-400">
          {rows.filter(r => {
            let buys = 0;
            if (r.bazinSignal === 'Comprar') buys++;
            if (r.grahamSignal === 'Comprar') buys++;
            if (r.grahamGrowthSignal === 'Comprar') buys++;
            return buys === 0;
          }).length} Caras
        </div>
      </div>
    </div>
  );
};
