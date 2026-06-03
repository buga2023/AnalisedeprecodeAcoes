import { describe, it, expect } from "vitest";
import { detectMarket, detectSector, brandColor, isFII } from "./stockMeta";

describe("detectMarket", () => {
  it("identifica B3 por terminação em dígito", () => {
    expect(detectMarket("PETR4")).toBe("B3");
    expect(detectMarket("ITUB11")).toBe("B3");
  });
  it("identifica NASDAQ por padrão 1-5 letras", () => {
    expect(detectMarket("AAPL")).toBe("NASDAQ");
    expect(detectMarket("MSFT")).toBe("NASDAQ");
  });
  it("retorna OTHER em formatos exóticos", () => {
    expect(detectMarket("BRK-B")).toBe("OTHER");
  });
});

describe("detectSector", () => {
  it("mapeia tickers conhecidos pelo stem", () => {
    expect(detectSector("PETR4")).toBe("Energia");
    expect(detectSector("ITUB4")).toBe("Bancos");
    expect(detectSector("VALE3")).toBe("Mineração");
  });
  it("mapeia tickers US conhecidos", () => {
    expect(detectSector("AAPL")).toBe("Tech");
    expect(detectSector("NVDA")).toBe("Semicondutores");
  });
  it("retorna — para desconhecido", () => {
    expect(detectSector("XYZQ3")).toBe("—");
  });
});

describe("isFII", () => {
  it("retorna true para FIIs conhecidos", () => {
    expect(isFII("KNRI11")).toBe(true);
    expect(isFII("HGLG11")).toBe(true);
    expect(isFII("XPML11")).toBe(true);
    expect(isFII("MXRF11")).toBe(true);
  });

  it("retorna false para ETFs que terminam em 11", () => {
    expect(isFII("BOVA11")).toBe(false);
    expect(isFII("SMAL11")).toBe(false);
    expect(isFII("IVVB11")).toBe(false);
    expect(isFII("HASH11")).toBe(false);
  });

  it("retorna false para ações normais", () => {
    expect(isFII("PETR4")).toBe(false);
    expect(isFII("VALE3")).toBe(false);
    expect(isFII("ITUB4")).toBe(false);
  });

  it("é case-insensitive", () => {
    expect(isFII("knri11")).toBe(true);
    expect(isFII("bova11")).toBe(false);
  });

  it("retorna false para tickers fora do padrão B3", () => {
    expect(isFII("AAPL")).toBe(false);
    expect(isFII("XYZ")).toBe(false);
  });
});

describe("detectSector — FIIs", () => {
  it("retorna segmento FII para tickers reconhecidos", () => {
    expect(detectSector("KNRI11")).toBe("Lajes Corp.");
    expect(detectSector("HGLG11")).toBe("Logística");
    expect(detectSector("XPML11")).toBe("Shopping");
  });

  it("retorna 'FII' genérico para FII sem segmento mapeado", () => {
    expect(detectSector("ZZZZ11")).toBe("FII");
  });

  it("retorna '—' para ticker de ação desconhecida (não FII)", () => {
    expect(detectSector("ZZZQ3")).toBe("—");
  });
});

describe("brandColor", () => {
  it("retorna cor da marca quando conhecido", () => {
    expect(brandColor("PETR4")).toBe("#1a8754");
  });
  it("retorna fallback HSL determinístico", () => {
    const c1 = brandColor("XYZQ3");
    const c2 = brandColor("XYZQ3");
    expect(c1).toBe(c2);
    expect(c1).toMatch(/^hsl\(\d+, 56%, 42%\)$/);
  });
});
