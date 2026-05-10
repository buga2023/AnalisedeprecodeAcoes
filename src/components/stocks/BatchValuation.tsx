import React, { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, Download, RefreshCw, Trash2, TrendingUp, AlertCircle, Info, Calculator, FileText, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBatchValuation } from '@/hooks/useBatchValuation';
import { Badge } from '@/components/ui/badge';
import { ColumnMapper } from './ColumnMapper';
import { generateTemplate } from '@/lib/exportTemplate';
import { exportResults } from '@/lib/exportResults';
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
    pendingData,
    startImport,
    processBatch,
    cancelImport,
    updateGrowthRate,
    clearBatch,
  } = useBatchValuation();

  const [showInstructions, setShowInstructions] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      startImport(file);
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
    let buyCount = 0;
    if (row.bazinSignal === 'Comprar') buyCount++;
    if (row.grahamSignal === 'Comprar') buyCount++;
    if (row.grahamGrowthSignal === 'Comprar') buyCount++;

    if (buyCount >= 2) return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">COMPRAR</Badge>;
    if (buyCount === 0) return <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/30">CARO</Badge>;
    return <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30">OBSERVAR</Badge>;
  };

  // --- ETAPA DE MAPEAMENTO ---
  if (pendingData) {
    return (
      <ColumnMapper
        headers={pendingData.headers}
        initialMapping={pendingData.initialMapping}
        fileName={pendingData.fileName}
        rowCount={pendingData.rows.length}
        onConfirm={processBatch}
        onCancel={cancelImport}
      />
    );
  }

  // --- ETAPA DE UPLOAD ---
  if (rows.length === 0 && !isLoading) {
    return (
      <div className="space-y-12 animate-in fade-in duration-700">
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-blue-600/20 rounded-[2rem] blur-xl opacity-50 group-hover:opacity-100 transition duration-1000 group-hover:duration-200" />
          
          <div className="relative flex flex-col items-center justify-center p-12 md:p-20 border border-border/50 rounded-[2rem] bg-card/50 backdrop-blur-xl shadow-2xl overflow-hidden">
            <div className="absolute top-0 right-0 -mr-10 -mt-10 size-64 bg-primary/5 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 -ml-10 -mb-10 size-64 bg-blue-600/5 rounded-full blur-3xl" />

            <div className="relative z-10 flex flex-col items-center">
              <div className="relative mb-8">
                <div className="p-6 rounded-2xl bg-gradient-to-br from-primary/20 to-blue-600/20 border border-primary/20 group-hover:scale-110 transition-transform duration-500 shadow-inner">
                  <FileSpreadsheet className="h-12 w-12 text-primary" />
                </div>
                <div className="absolute -bottom-2 -right-2 p-2 rounded-lg bg-emerald-500 shadow-lg border-2 border-slate-950">
                  <Upload className="h-4 w-4 text-white" />
                </div>
              </div>

              <h2 className="text-3xl md:text-4xl font-black text-white mb-3 tracking-tighter text-center">
                Análise em <span className="text-primary italic">Lote</span>
              </h2>
              <p className="text-muted-foreground text-center max-w-lg mb-10 leading-relaxed text-sm md:text-base">
                Importe sua carteira completa (.xlsx, .xls ou .csv) e descubra o valor intrínseco dos seus ativos. 
                <span className="block mt-2 font-bold text-primary/80">Suporta exportações da XP, Rico, Clear e NuInvest.</span>
              </p>
              
              <input
                type="file"
                accept=".csv, .xlsx, .xls"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileChange}
              />
              
              <div className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-md">
                <Button 
                  size="lg" 
                  className="w-full h-14 bg-primary hover:bg-blue-600 font-bold text-base shadow-lg shadow-primary/20 rounded-2xl"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mr-3 h-5 w-5" />
                  Importar Carteira
                </Button>
                
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full h-14 border-border/50 hover:border-primary/50 hover:bg-primary/5 font-bold rounded-2xl"
                  onClick={() => generateTemplate()}
                >
                  <Download className="mr-3 h-5 w-5" />
                  Baixar Template
                </Button>
              </div>

              <button 
                onClick={() => setShowInstructions(!showInstructions)}
                className="mt-8 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
              >
                <FileText className="h-3.5 w-3.5" />
                Ver instruções de preenchimento
                <ChevronRight className={`h-3 w-3 transition-transform ${showInstructions ? 'rotate-90' : ''}`} />
              </button>

              {showInstructions && (
                <div className="mt-6 p-6 rounded-2xl bg-slate-900/50 border border-border/30 max-w-2xl animate-in zoom-in-95 duration-300">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-primary uppercase">Obrigatórios</p>
                      <ul className="text-xs text-muted-foreground space-y-1.5">
                        <li>• <strong className="text-white">Ticker:</strong> Código B3 (ex: PETR4)</li>
                        <li>• <strong className="text-white">Preço Médio:</strong> Seu custo de compra</li>
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-emerald-400 uppercase">Opcionais (Auto-Busca)</p>
                      <ul className="text-xs text-muted-foreground space-y-1.5">
                        <li>• <strong className="text-white">DPA:</strong> Dividendos por ação</li>
                        <li>• <strong className="text-white">LPA:</strong> Lucro por ação (EPS)</li>
                        <li>• <strong className="text-white">VPA:</strong> Valor patrimonial (BVPS)</li>
                      </ul>
                    </div>
                  </div>
                  <p className="mt-4 pt-4 border-t border-border/20 text-[10px] text-muted-foreground italic">
                    Dica: Se sua corretora exportar colunas com nomes diferentes, você poderá mapeá-las na próxima etapa.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Metodologias */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="group relative p-8 rounded-3xl bg-card/40 border border-border/50 hover:border-emerald-500/30 transition-all duration-300">
            <div className="absolute top-4 right-4 text-[40px] font-black text-white/5 select-none group-hover:text-emerald-500/5 transition-colors">01</div>
            <div className="size-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Calculator className="h-6 w-6 text-emerald-400" />
            </div>
            <h3 className="text-lg font-black text-white mb-3 flex items-center gap-2">
              Bazin
              <Badge className="bg-emerald-500/10 text-emerald-400 text-[8px] border-none font-black tracking-widest">DIVIDENDOS</Badge>
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Foca no fluxo de caixa direto para o acionista. Define o preço teto exigindo um retorno mínimo de 6% ao ano em dividendos.
            </p>
          </div>

          <div className="group relative p-8 rounded-3xl bg-card/40 border border-border/50 hover:border-blue-500/30 transition-all duration-300">
            <div className="absolute top-4 right-4 text-[40px] font-black text-white/5 select-none group-hover:text-blue-500/5 transition-colors">02</div>
            <div className="size-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <TrendingUp className="h-6 w-6 text-blue-400" />
            </div>
            <h3 className="text-lg font-black text-white mb-3 flex items-center gap-2">
              Graham VI
              <Badge className="bg-blue-500/10 text-blue-400 text-[8px] border-none font-black tracking-widest">FUNDAMENTOS</Badge>
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              O "Pai do Value Investing". Usa a fórmula √(22,5 × LPA × VPA) para equilibrar lucros reais e ativos físicos tangíveis.
            </p>
          </div>

          <div className="group relative p-8 rounded-3xl bg-card/40 border border-border/50 hover:border-primary/30 transition-all duration-300">
            <div className="absolute top-4 right-4 text-[40px] font-black text-white/5 select-none group-hover:text-primary/5 transition-colors">03</div>
            <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <TrendingUp className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-black text-white mb-3 flex items-center gap-2">
              Graham Cresc.
              <Badge className="bg-primary/10 text-primary text-[8px] border-none font-black tracking-widest">CRESCIMENTO</Badge>
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Adaptado para empresas que reinvestem lucros. Considera a taxa de crescimento projetada (g) para calcular o valor futuro.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // --- ETAPA DE RESULTADOS ---
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
                Processando... {progress.done}/{progress.total}
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

          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => exportResults(rows)} 
            disabled={isLoading || rows.length === 0}
            className="border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-400"
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar (.xlsx)
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

      {/* Sumário Executivo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-card border border-border/50">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Patrimônio Total</p>
          <p className="text-xl font-black text-white">
            {formatValue(rows.reduce((acc, curr) => acc + (curr.patrimony || 0), 0))}
          </p>
        </div>
        <div className="p-4 rounded-2xl bg-card border border-border/50">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">ROI Médio</p>
          <p className={`text-xl font-black ${
            (rows.reduce((acc, curr) => acc + (curr.roi || 0), 0) / rows.length) >= 0 ? "text-emerald-400" : "text-rose-400"
          }`}>
            {formatPercent(rows.reduce((acc, curr) => acc + (curr.roi || 0), 0) / rows.length)}
          </p>
        </div>
        <div className="p-4 rounded-2xl bg-card border border-border/50">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Oportunidades</p>
          <p className="text-xl font-black text-emerald-400">
            {rows.filter(r => {
              let buys = 0;
              if (r.bazinSignal === 'Comprar') buys++;
              if (r.grahamSignal === 'Comprar') buys++;
              if (r.grahamGrowthSignal === 'Comprar') buys++;
              return buys >= 2;
            }).length} <span className="text-xs font-normal text-muted-foreground">ativos</span>
          </p>
        </div>
        <div className="p-4 rounded-2xl bg-card border border-border/50">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">DPA Médio</p>
          <p className="text-xl font-black text-primary">
            {formatValue(rows.reduce((acc, curr) => acc + (curr.dpa || 0), 0) / rows.length)}
          </p>
        </div>
      </div>

      {/* Tabela */}
      <div className="rounded-[2rem] border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="hover:bg-transparent border-b border-border/50">
                <TableHead className="text-[10px] font-black uppercase tracking-widest py-6 px-8">Ativo</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Cotação</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">P. Médio</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">ROI%</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Bazin (Teto)</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Margem</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Graham (VI)</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Margem</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Graham (C)</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Margem</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-right px-8">Sinal Geral</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow key={`${row.ticker}-${i}`} className="group hover:bg-primary/5 transition-colors border-b border-border/10">
                  <TableCell className="py-5 px-8">
                    <div className="flex flex-col">
                      <span className="font-black text-white group-hover:text-primary transition-colors text-base">{row.ticker}</span>
                      <span className="text-[9px] text-muted-foreground font-medium">{row.quantity || 0} ações</span>
                      {row.fetchStatus === 'error' && (
                        <span className="text-[10px] text-rose-400 flex items-center gap-1 mt-1">
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
                    <span className={`text-xs font-black px-2 py-1 rounded-lg ${row.roi && row.roi >= 0 ? "text-emerald-400 bg-emerald-500/10" : "text-rose-400 bg-rose-500/10"}`}>
                      {formatPercent(row.roi)}
                    </span>
                  </TableCell>

                  <TableCell className="font-mono text-xs text-white/80">
                    {formatValue(row.bazinCeiling)}
                  </TableCell>

                  <TableCell>
                    <span className={`text-xs font-bold ${row.bazinMargin && row.bazinMargin > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {formatPercent(row.bazinMargin)}
                    </span>
                  </TableCell>

                  <TableCell className="font-mono text-xs text-white/80">
                    {formatValue(row.grahamVI)}
                  </TableCell>

                  <TableCell>
                    <span className={`text-xs font-bold ${row.grahamMargin && row.grahamMargin > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {formatPercent(row.grahamMargin)}
                    </span>
                  </TableCell>

                  <TableCell className="font-mono text-xs text-white/80">
                    {formatValue(row.grahamGrowth)}
                  </TableCell>

                  <TableCell>
                    <span className={`text-xs font-bold ${row.grahamGrowthMargin && row.grahamGrowthMargin > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {formatPercent(row.grahamGrowthMargin)}
                    </span>
                  </TableCell>

                  <TableCell className="text-right px-8">
                    {getSignalBadge(row)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Info footer */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 rounded-2xl bg-slate-900/40 border border-border/30">
        <div className="flex items-start gap-3 max-w-2xl">
          <div className="p-2 rounded-xl bg-blue-500/10">
            <Info className="h-5 w-5 text-blue-400" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-white">Metodologia de Sinalização</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              O sistema atribui o selo <strong className="text-emerald-400">COMPRAR</strong> apenas quando o ativo apresenta desconto em pelo menos dois métodos independentes. Isso garante maior margem de segurança contra erros de projeção ou dados não recorrentes.
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4 bg-card/50 p-4 rounded-xl border border-border/50">
          <div className="text-center">
            <p className="text-[10px] font-black text-muted-foreground uppercase mb-1">Status da API</p>
            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              <span className="text-xs font-bold text-white">Yahoo Finance OK</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
