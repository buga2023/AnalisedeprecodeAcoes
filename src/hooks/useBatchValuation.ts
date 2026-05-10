import { useState, useEffect } from 'react';
import type { CSVRow, ValuationRow } from '@/types/stock';
import { fetchMultipleQuotes } from '@/lib/api';
import { calculateFullValuation } from '@/lib/calculators';
import { parseSheet, normalizeTicker, parseBRNumber } from '@/lib/sheetParser';
import { detectColumns } from '@/lib/columnMappings';

const STORAGE_KEY = 'stocks-ai-batch-valuation';
const CHUNK_SIZE = 5; 
const CHUNK_DELAY = 300; // ms

export interface PendingData {
  headers: string[];
  rows: Record<string, string>[];
  fileName: string;
  initialMapping: Partial<Record<keyof CSVRow, number>>;
}

export function useBatchValuation() {
  const [rows, setRows] = useState<ValuationRow[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [growthRate, setGrowthRate] = useState(7);
  const [pendingData, setPendingData] = useState<PendingData | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  }, [rows]);

  const startImport = async (file: File) => {
    setIsLoading(true);
    try {
      const { headers, rows: sheetRows } = await parseSheet(file);
      const { mapping } = detectColumns(headers);
      
      setPendingData({
        headers,
        rows: sheetRows,
        fileName: file.name,
        initialMapping: mapping
      });
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Erro ao processar arquivo.');
    } finally {
      setIsLoading(false);
    }
  };

  const processBatch = async (mapping: Record<keyof CSVRow, number | undefined>) => {
    if (!pendingData) return;
    
    setIsLoading(true);
    setRows([]);
    setProgress({ done: 0, total: pendingData.rows.length });

    const rawRows = pendingData.rows;
    const finalValuations: ValuationRow[] = [];

    // Primeiro mapeamento e calculo inicial
    const validRows: CSVRow[] = rawRows.map(raw => {
      const ticker = mapping.ticker !== undefined ? normalizeTicker(raw[pendingData.headers[mapping.ticker]]) : '';
      const avgCost = mapping.avgCost !== undefined ? parseBRNumber(raw[pendingData.headers[mapping.avgCost]]) || 0 : 0;
      
      return {
        ticker,
        avgCost,
        quantity: mapping.quantity !== undefined ? parseBRNumber(raw[pendingData.headers[mapping.quantity]]) || 0 : 0,
        dpa: mapping.dpa !== undefined ? parseBRNumber(raw[pendingData.headers[mapping.dpa]]) || 0 : 0,
        eps: mapping.eps !== undefined ? parseBRNumber(raw[pendingData.headers[mapping.eps]]) || 0 : 0,
        bvps: mapping.bvps !== undefined ? parseBRNumber(raw[pendingData.headers[mapping.bvps]]) || 0 : 0,
      };
    }).filter(r => r.ticker.length > 0);

    if (validRows.length === 0) {
      alert('Nenhum ticker valido encontrado após o mapeamento.');
      setIsLoading(false);
      setPendingData(null);
      return;
    }

    setProgress({ done: 0, total: validRows.length });

    // Processamento em lotes com delay
    for (let i = 0; i < validRows.length; i += CHUNK_SIZE) {
      const chunk = validRows.slice(i, i + CHUNK_SIZE);
      const tickers = chunk.map(r => r.ticker);

      try {
        const quotes = await fetchMultipleQuotes(tickers);
        const quoteMap = new Map(quotes.map(q => [q.symbol, q.regularMarketPrice]));

        for (const dataRow of chunk) {
          const price = quoteMap.get(dataRow.ticker) || null;
          const valuation = calculateFullValuation(dataRow, price, growthRate);
          
          if (!price) {
            valuation.fetchStatus = 'error';
            valuation.fetchError = 'Ticker nao encontrado';
          }
          finalValuations.push(valuation);
        }
      } catch (error) {
        console.error('Erro no lote:', error);
        for (const dataRow of chunk) {
          finalValuations.push({
            ...dataRow,
            currentPrice: null,
            bazinCeiling: null,
            bazinSignal: 'Sem dados',
            bazinMargin: null,
            grahamVI: null,
            grahamSignal: 'Sem dados',
            grahamMargin: null,
            grahamGrowth: null,
            grahamGrowthSignal: 'Sem dados',
            grahamGrowthMargin: null,
            roi: null,
            patrimony: null,
            fetchStatus: 'error',
            fetchError: 'Erro na API'
          } as unknown as ValuationRow);
        }
      }

      setProgress(p => ({ ...p, done: Math.min(i + CHUNK_SIZE, p.total) }));
      setRows([...finalValuations]);
      
      // Delay para evitar rate limit
      if (i + CHUNK_SIZE < validRows.length) {
        await new Promise(resolve => setTimeout(resolve, CHUNK_DELAY));
      }
    }

    setIsLoading(false);
    setPendingData(null);
  };

  const updateGrowthRate = (newRate: number) => {
    setGrowthRate(newRate);
    setRows(prev => prev.map(row => 
      calculateFullValuation(
        { 
          ticker: row.ticker, 
          avgCost: row.avgCost, 
          dpa: row.dpa, 
          eps: row.eps, 
          bvps: row.bvps, 
          quantity: row.quantity 
        },
        row.currentPrice,
        newRate
      )
    ));
  };

  const clearBatch = () => {
    setRows([]);
    setPendingData(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  return {
    rows,
    isLoading,
    progress,
    growthRate,
    pendingData,
    startImport,
    processBatch,
    cancelImport: () => setPendingData(null),
    updateGrowthRate,
    clearBatch,
  };
}
