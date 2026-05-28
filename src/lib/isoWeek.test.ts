import { describe, it, expect } from "vitest";
import {
  getISOWeek,
  getISOWeekString,
  getWeekStart,
  getWeekEnd,
  isInWeek,
  formatWeekLabelPtBR,
} from "./isoWeek";

function utc(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d));
}

describe("getISOWeek", () => {
  it("retorna semana 1 quando a quinta da semana cai em 4 de janeiro", () => {
    // 2024-01-04 é quinta → semana 1/2024
    expect(getISOWeek(utc(2024, 1, 4))).toEqual({ year: 2024, week: 1 });
  });

  it("retorna semana 52 ou 53 nas viradas de ano (ano da quinta-feira)", () => {
    // 2020-12-31 é quinta → semana 53/2020
    expect(getISOWeek(utc(2020, 12, 31))).toEqual({ year: 2020, week: 53 });
    // 2024-12-30 é segunda; a quinta da semana é 2025-01-02 → semana 1/2025
    expect(getISOWeek(utc(2024, 12, 30))).toEqual({ year: 2025, week: 1 });
  });

  it("é estável dentro da semana — todos os dias retornam mesma semana", () => {
    const semana = { year: 2026, week: 22 };
    // 2026-W22 vai de 2026-05-25 (seg) a 2026-05-31 (dom)
    expect(getISOWeek(utc(2026, 5, 25))).toEqual(semana);
    expect(getISOWeek(utc(2026, 5, 28))).toEqual(semana);
    expect(getISOWeek(utc(2026, 5, 31))).toEqual(semana);
  });
});

describe("getISOWeekString", () => {
  it("formata como YYYY-WNN com padding de 2 dígitos", () => {
    expect(getISOWeekString(utc(2026, 5, 28))).toBe("2026-W22");
    expect(getISOWeekString(utc(2024, 1, 4))).toBe("2024-W01");
  });
});

describe("getWeekStart / getWeekEnd", () => {
  it("getWeekStart retorna segunda-feira 00:00 UTC", () => {
    // 2026-05-28 é quinta → semana começa em 2026-05-25 (segunda)
    const start = getWeekStart(utc(2026, 5, 28));
    expect(start.getUTCFullYear()).toBe(2026);
    expect(start.getUTCMonth()).toBe(4); // maio = 4
    expect(start.getUTCDate()).toBe(25);
    expect(start.getUTCHours()).toBe(0);
    expect(start.getUTCMinutes()).toBe(0);
  });

  it("getWeekEnd retorna domingo 23:59:59.999 UTC", () => {
    const end = getWeekEnd(utc(2026, 5, 28));
    expect(end.getUTCDate()).toBe(31); // domingo
    expect(end.getUTCHours()).toBe(23);
    expect(end.getUTCMinutes()).toBe(59);
    expect(end.getUTCSeconds()).toBe(59);
    expect(end.getUTCMilliseconds()).toBe(999);
  });

  it("getWeekStart de uma segunda retorna a própria data", () => {
    const segunda = utc(2026, 5, 25);
    expect(getWeekStart(segunda).getUTCDate()).toBe(25);
  });

  it("getWeekStart de um domingo volta para a segunda anterior", () => {
    // 2026-05-31 é domingo da semana W22 → segunda é 2026-05-25
    const start = getWeekStart(utc(2026, 5, 31));
    expect(start.getUTCDate()).toBe(25);
  });
});

describe("isInWeek", () => {
  const ref = utc(2026, 5, 28); // quinta da W22

  it("true para o início da semana (segunda)", () => {
    expect(isInWeek(utc(2026, 5, 25), ref)).toBe(true);
  });

  it("true para o fim da semana (domingo 23:59)", () => {
    const dom = new Date(Date.UTC(2026, 4, 31, 23, 59, 0));
    expect(isInWeek(dom, ref)).toBe(true);
  });

  it("false para a segunda da semana seguinte", () => {
    expect(isInWeek(utc(2026, 6, 1), ref)).toBe(false);
  });

  it("false para o domingo da semana anterior", () => {
    expect(isInWeek(utc(2026, 5, 24), ref)).toBe(false);
  });
});

describe("formatWeekLabelPtBR", () => {
  it("usa mesmo mês quando a semana não cruza", () => {
    expect(formatWeekLabelPtBR(utc(2026, 5, 25))).toBe("Semana de 25 a 31 de mai.");
  });

  it("formata quando a semana cruza meses (dois meses diferentes)", () => {
    // Semana iniciando em 2026-06-29 (segunda) → termina 2026-07-05 (domingo)
    expect(formatWeekLabelPtBR(utc(2026, 6, 29))).toBe("Semana de 29 jun. a 5 jul.");
  });

  it("usa abreviação correta de cada mês", () => {
    // jan (semana de 5 a 11 jan 2026)
    expect(formatWeekLabelPtBR(utc(2026, 1, 5))).toContain("jan");
    // dez (semana de 28 dez a 3 jan)
    expect(formatWeekLabelPtBR(utc(2026, 12, 28))).toContain("dez");
  });
});
