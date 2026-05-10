import React, { useState } from 'react';
import { CheckCircle2, HelpCircle, ArrowRight, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { CSVRow } from '@/types/stock';

interface ColumnMapperProps {
  headers: string[];
  initialMapping: Partial<Record<keyof CSVRow, number>>;
  onConfirm: (mapping: Record<keyof CSVRow, number | undefined>) => void;
  onCancel: () => void;
  fileName: string;
  rowCount: number;
}

const FIELDS: { key: keyof CSVRow; label: string; required: boolean; description: string }[] = [
  { key: 'ticker', label: 'Ticker / Ativo', required: true, description: 'Ex: PETR4, ITUB4' },
  { key: 'avgCost', label: 'Preço Médio', required: true, description: 'Seu custo de aquisição' },
  { key: 'quantity', label: 'Quantidade', required: false, description: 'Número de ações' },
  { key: 'dpa', label: 'Dividendos (DPA)', required: false, description: 'Proventos por ação' },
  { key: 'eps', label: 'Lucro por Ação (LPA)', required: false, description: 'Earnings Per Share' },
  { key: 'bvps', label: 'V. Patrimonial (VPA)', required: false, description: 'Book Value Per Share' },
];

export const ColumnMapper: React.FC<ColumnMapperProps> = ({
  headers,
  initialMapping,
  onConfirm,
  onCancel,
  fileName,
  rowCount
}) => {
  const [mapping, setMapping] = useState<Record<keyof CSVRow, number | undefined>>({
    ticker: initialMapping.ticker,
    avgCost: initialMapping.avgCost,
    quantity: initialMapping.quantity,
    dpa: initialMapping.dpa,
    eps: initialMapping.eps,
    bvps: initialMapping.bvps,
  });

  const handleSelect = (field: keyof CSVRow, index: number | undefined) => {
    setMapping(prev => ({ ...prev, [field]: index }));
  };

  const isReady = mapping.ticker !== undefined && mapping.avgCost !== undefined;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto">
      <div className="p-8 rounded-[2rem] bg-card/50 border border-border/50 backdrop-blur-xl shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 border-b border-border/20 pb-8">
          <div className="space-y-2">
            <h2 className="text-3xl font-black text-white tracking-tighter flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
              Mapeamento de Colunas
            </h2>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Badge variant="outline" className="font-mono text-[10px]">{fileName}</Badge>
              <span>•</span>
              <span className="font-bold text-primary">{rowCount} ativos detectados</span>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={onCancel} className="font-bold">Cancelar</Button>
            <Button 
              onClick={() => onConfirm(mapping)} 
              disabled={!isReady}
              className="bg-primary hover:bg-blue-600 font-bold shadow-lg shadow-primary/20 px-8 h-12 rounded-xl"
            >
              Confirmar e Processar
              <Play className="ml-2 h-4 w-4 fill-current" />
            </Button>
          </div>
        </div>

        <div className="grid gap-6">
          <div className="grid grid-cols-12 gap-4 px-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            <div className="col-span-5">Campo do Sistema</div>
            <div className="col-span-1 text-center"></div>
            <div className="col-span-6">Coluna na sua Planilha</div>
          </div>

          {FIELDS.map((field) => {
            const isMapped = mapping[field.key] !== undefined;
            
            return (
              <div 
                key={field.key} 
                className={`grid grid-cols-12 items-center gap-4 p-4 rounded-2xl border transition-all duration-300 ${
                  isMapped ? 'bg-primary/5 border-primary/30' : 'bg-muted/20 border-border/50'
                }`}
              >
                <div className="col-span-5 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-white">{field.label}</span>
                    {field.required && (
                      <span className="text-[9px] font-black bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded uppercase">Obrigatório</span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground">{field.description}</p>
                </div>

                <div className="col-span-1 flex justify-center">
                  <ArrowRight className={`h-4 w-4 ${isMapped ? 'text-primary' : 'text-muted-foreground/30'}`} />
                </div>

                <div className="col-span-6">
                  <select
                    className={`w-full h-11 px-4 rounded-xl border appearance-none transition-all cursor-pointer text-sm font-bold ${
                      isMapped 
                        ? 'bg-primary/10 border-primary/30 text-white' 
                        : 'bg-background border-border/50 text-muted-foreground hover:border-primary/50'
                    }`}
                    value={mapping[field.key] ?? ''}
                    onChange={(e) => handleSelect(field.key, e.target.value === '' ? undefined : Number(e.target.value))}
                  >
                    <option value="">{field.required ? '⚠️ Selecione uma coluna...' : 'Buscar automaticamente via API'}</option>
                    {headers.map((header, idx) => (
                      <option key={idx} value={idx}>{header}</option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-10 flex items-start gap-4 p-5 rounded-2xl bg-primary/5 border border-primary/10">
          <HelpCircle className="h-5 w-5 text-primary shrink-0" />
          <div className="space-y-1">
            <h4 className="text-xs font-black text-white uppercase tracking-wider">Por que mapear?</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Cada corretora exporta planilhas com nomes de colunas diferentes (ex: "Código" vs "Ticker"). 
              Nosso sistema tentou detectar automaticamente, mas você pode ajustar se algo estiver incorreto. 
              Campos não mapeados serão preenchidos com dados reais do mercado via API.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
