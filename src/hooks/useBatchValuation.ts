import { useState, useEffect } from 'react';
import Papa from 'papaparse';
import type { CSVRow, ValuationRow } from '@/types/stock';
import { fetchMultipleQuotes } from '@/lib/api';
import { calculateFullValuation } from '@/lib/calculators';

const STORAGE_KEY = 'stocks-ai-batch-valuation';
const CHUNK_SIZE = 5; // Limite de requisicoes simultaneas para evitar rate limit

export function useBatchValuation() {
  const [rows, setRows] = useState<ValuationRow[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [growthRate, setGrowthRate] = useState(7);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  }, [rows]);

  const importCSV = async (file: File) => {
    setIsLoading(true);
    setProgress({ done: 0, total: 0 });

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: async (results) => {
        const rawData = results.data as any[];
        
        // Validação básica de colunas
        const validRows: CSVRow[] = rawData
          .filter(r => r.ticker && r.avgCost !== undefined && r.dpa !== undefined && r.eps !== undefined && r.bvps !== undefined)
          .map(r => ({
            ticker: String(r.ticker).toUpperCase(),
            avgCost: Number(r.avgCost),
            dpa: Number(r.dpa),
            eps: Number(r.eps),
            bvps: Number(r.bvps),
            quantity: r.quantity ? Number(r.quantity) : undefined
          }));

        if (validRows.length === 0) {
          alert('Nenhuma linha valida encontrada no CSV. Verifique as colunas: ticker, avgCost, dpa, eps, bvps.');
          setIsLoading(false);
          return;
        }

        setProgress({ done: 0, total: validRows.length });
        
        const initialValuations: ValuationRow[] = validRows.map(r => ({
          ...r,
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
          fetchStatus: 'loading'
        }));
        
        setRows(initialValuations);

        // Processamento em lotes (chunks) para respeitar o rate limit
        const finalRows: ValuationRow[] = [...initialValuations];
        
        for (let i = 0; i < validRows.length; i += CHUNK_SIZE) {
          const chunk = validRows.slice(i, i + CHUNK_SIZE);
          const tickers = chunk.map(r => r.ticker);
          
          try {
            const quotes = await fetchMultipleQuotes(tickers);
            const quoteMap = new Map(quotes.map(q => [q.symbol, q.regularMarketPrice]));
            
            for (let j = 0; j < chunk.length; j++) {
              const rowIndex = i + j;
              const ticker = chunk[j].ticker;
              const price = quoteMap.get(ticker) || null;
              
              finalRows[rowIndex] = calculateFullValuation(chunk[j], price, growthRate);
              if (!price) {
                finalRows[rowIndex].fetchStatus = 'error';
                finalRows[rowIndex].fetchError = 'Ticker nao encontrado';
              }
            }
          } catch (error) {
            console.error('Erro ao buscar lote:', error);
            for (let j = 0; j < chunk.length; j++) {
              const rowIndex = i + j;
              finalRows[rowIndex].fetchStatus = 'error';
              finalRows[rowIndex].fetchError = 'Erro na API';
            }
          }
          
          setProgress(p => ({ ...p, done: Math.min(p.done + CHUNK_SIZE, p.total) }));
          setRows([...finalRows]);
        }

        setIsLoading(false);
      },
      error: (error) => {
        console.error('Erro no parse do CSV:', error);
        alert('Erro ao ler arquivo CSV.');
        setIsLoading(false);
      }
    });
  };

  const updateGrowthRate = (newRate: number) => {
    setGrowthRate(newRate);
    setRows(prev => prev.map(row => 
      calculateFullValuation(
        { ticker: row.ticker, avgCost: row.avgCost, dpa: row.dpa, eps: row.eps, bvps: row.bvps, quantity: row.quantity },
        row.currentPrice,
        newRate
      )
    ));
  };

  const clearBatch = () => {
    setRows([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  const exportCSV = () => {
    if (rows.length === 0) return;
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `valuation_lote_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return {
    rows,
    isLoading,
    progress,
    growthRate,
    importCSV,
    updateGrowthRate,
    clearBatch,
    exportCSV
  };
}
