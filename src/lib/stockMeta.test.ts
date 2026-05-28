import { describe, it, expect } from "vitest";
import { detectMarket, detectSector, brandColor } from "./stockMeta";

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
