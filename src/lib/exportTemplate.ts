import * as XLSX from 'xlsx';

export function generateTemplate(): void {
  const wb = XLSX.utils.book_new();

  // Aba 1: Minha Carteira
  const wsData = [
    ['Ticker', 'Preço Médio', 'Quantidade', 'DPA', 'LPA', 'VPA'], // Cabeçalho
    ['PETR4', 38.50, 100, 2.40, 5.20, 28.30],
    ['ITUB4', 25.00, 200, 1.80, 3.10, 18.40],
    ['VALE3', 68.00, 50, 8.20, 12.50, 42.00],
    ['BBAS3', 52.30, 80, 4.10, 8.70, 35.20],
    ['WEGE3', 42.00, 150, 0.85, 1.92, 10.40]
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Estilização básica (largura das colunas)
  ws['!cols'] = [
    { wch: 12 }, // Ticker
    { wch: 15 }, // Preço Médio
    { wch: 12 }, // Quantidade
    { wch: 10 }, // DPA
    { wch: 10 }, // LPA
    { wch: 10 }, // VPA
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Minha Carteira');

  // Aba 2: Instruções
  const instrData = [
    ['Campo', 'O que é', 'Onde encontrar'],
    ['Ticker', 'Código da ação na B3', 'Ex: PETR4, VALE3, ITUB4'],
    ['Preço Médio', 'Seu preço médio de compra', 'Extrato da sua corretora'],
    ['Quantidade', 'Nº de ações que você tem', 'Extrato da sua corretora'],
    ['DPA', 'Dividendos pagos por ação (12m)', 'StatusInvest ou Fundamentus'],
    ['LPA', 'Lucro por Ação (EPS)', 'Resultados trimestrais ou StatusInvest'],
    ['VPA', 'Valor Patrimonial por Ação (BVPS)', 'Balanço patrimonial ou StatusInvest'],
    [''],
    ['Nota: DPA, LPA e VPA são opcionais.'],
    ['Se não preenchidos, o sistema tentará buscá-los automaticamente.'],
    [''],
    ['Links úteis:'],
    ['fundamentus.com.br'],
    ['statusinvest.com.br'],
    ['investidor10.com.br']
  ];

  const wsInstr = XLSX.utils.aoa_to_sheet(instrData);
  wsInstr['!cols'] = [{ wch: 15 }, { wch: 30 }, { wch: 40 }];
  
  XLSX.utils.book_append_sheet(wb, wsInstr, 'Instruções');

  // Exportar
  const fileName = `template-carteira-${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
