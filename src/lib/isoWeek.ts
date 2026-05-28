/**
 * Utilitarios de semana ISO-8601 (segunda = primeiro dia da semana; semana 1 = a
 * semana contendo 4 de janeiro). Puro, sem deps externas — usado pelo digest
 * semanal e por filtros temporais que precisam de chave estavel ("2026-W22").
 */

export interface ISOWeek {
  year: number;
  week: number;
}

/** Retorna {year, week} ISO 8601 da data. */
export function getISOWeek(date: Date): ISOWeek {
  // Algoritmo classico: ajusta para a quinta-feira da semana — a semana ISO
  // pertence ao ano da quinta-feira (ou seja, se quinta cai em janeiro do ano
  // seguinte, a semana e a 1 desse ano). UTC para evitar drift por timezone.
  const tmp = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = tmp.getUTCDay() || 7; // domingo=7
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum); // move pra quinta
  const year = tmp.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year, week };
}

/** "2026-W22" — chave estavel para cache. */
export function getISOWeekString(date: Date): string {
  const { year, week } = getISOWeek(date);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** Segunda-feira 00:00 UTC da semana ISO contendo a data. */
export function getWeekStart(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7; // domingo=7
  d.setUTCDate(d.getUTCDate() - (day - 1));
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Domingo 23:59:59.999 UTC da semana ISO contendo a data. */
export function getWeekEnd(date: Date): Date {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);
  return end;
}

/** True se `date` cai dentro da mesma semana ISO de `ref`. */
export function isInWeek(date: Date, ref: Date): boolean {
  const start = getWeekStart(ref).getTime();
  const end = getWeekEnd(ref).getTime();
  const t = date.getTime();
  return t >= start && t <= end;
}

/**
 * Label PT-BR amigavel: "Semana de 19 a 25 de maio". Usa o `weekStart` como
 * referencia (segunda-feira). Quando a semana cruza meses, mostra "19 mai a 1 jun".
 */
export function formatWeekLabelPtBR(weekStart: Date): string {
  const end = new Date(weekStart);
  end.setUTCDate(end.getUTCDate() + 6);
  const months = [
    "jan",
    "fev",
    "mar",
    "abr",
    "mai",
    "jun",
    "jul",
    "ago",
    "set",
    "out",
    "nov",
    "dez",
  ];
  const d1 = weekStart.getUTCDate();
  const m1 = months[weekStart.getUTCMonth()];
  const d2 = end.getUTCDate();
  const m2 = months[end.getUTCMonth()];
  if (m1 === m2) {
    return `Semana de ${d1} a ${d2} de ${m1}.`;
  }
  return `Semana de ${d1} ${m1}. a ${d2} ${m2}.`;
}
