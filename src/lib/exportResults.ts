import * as XLSX from 'xlsx';
import type { ValuationRow } from '@/types/stock';

export function exportResults(rows: ValuationRow[]): void {
  const wb = XLSX.utils.book_new();

  const data = rows.map(row => ({
    'Ticker': row.ticker,
    'Preço Médio': row.avgCost,
    'Preço Atual': row.currentPrice || 0,
    'Qtd': row.quantity || 0,
    'Patrimônio': row.patrimony || 0,
    'ROI%': row.roi ? row.roi / 100 : 0,
    'Teto Bazin': row.bazinCeiling || 0,
    'Margem Bazin': row.bazinMargin ? row.bazinMargin / 100 : 0,
    'Sinal Bazin': row.bazinSignal,
    'Graham VI': row.grahamVI || 0,
    'Margem Graham': row.grahamMargin ? row.grahamMargin / 100 : 0,
    'Sinal Graham': row.grahamSignal,
    'Graham Cresc.': row.grahamGrowth || 0,
    'Margem Cresc.': row.grahamGrowthMargin ? row.grahamGrowthMargin / 100 : 0,
    'Sinal Cresc.': row.grahamGrowthSignal,
    'Sinal Geral': calculateGeneralSignal(row)
  }));

  function calculateGeneralSignal(row: ValuationRow) {
    let buys = 0;
    if (row.bazinSignal === 'Comprar') buys++;
    if (row.grahamSignal === 'Comprar') buys++;
    if (row.grahamGrowthSignal === 'Comprar') buys++;
    return buys >= 2 ? 'COMPRAR' : (buys === 0 ? 'CARO' : 'OBSERVAR');
  }

  const ws = XLSX.utils.json_to_sheet(data);

  // Formatação de colunas
  const fmtPercent = '0.00%';
  const fmtCurrency = 'R$ #,##0.00';

  // Aplicar formatos (SheetJS usa a propriedade z)
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let R = range.s.r + 1; R <= range.e.r; ++R) {
    // ROI% (F)
    const cellROI = ws[XLSX.utils.encode_cell({ r: R, c: 5 })];
    if (cellROI) cellROI.z = fmtPercent;

    // Margens (H, K, N)
    [7, 10, 13].forEach(c => {
      const cell = ws[XLSX.utils.encode_cell({ r: R, c })];
      if (cell) cell.z = fmtPercent;
    });

    // Moedas (B, C, E, G, J, M)
    [1, 2, 4, 6, 9, 12].forEach(c => {
      const cell = ws[XLSX.utils.encode_cell({ r: R, c })];
      if (cell) cell.z = fmtCurrency;
    });
  }

  ws['!cols'] = [
    { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 15 }, { wch: 10 },
    { wch: 12 }, { wch: 12 }, { wch: 12 },
    { wch: 12 }, { wch: 12 }, { wch: 12 },
    { wch: 12 }, { wch: 12 }, { wch: 12 },
    { wch: 12 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Análise Completa');

  const fileName = `analise-carteira-${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
