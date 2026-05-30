import { describe, it, expect } from "vitest";
import { detectMarket, detectSector, brandColor, detectAssetType, detectFIISegment } from "./stockMeta";

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

describe("detectAssetType", () => {
  it("classifica FII por ticker 11 + nome imobiliário", () => {
    expect(detectAssetType("HGLG11", "CSHG LOGISTICA FDO INV IMOB")).toBe("fii");
    expect(detectAssetType("MXRF11", "MAXI RENDA FII")).toBe("fii");
    expect(detectAssetType("KNRI11", "KINEA RENDA IMOBILIARIA")).toBe("fii");
  });
  it("NÃO classifica units de ação como FII (mesmo formato 11)", () => {
    expect(detectAssetType("SANB11", "BANCO SANTANDER BRASIL")).toBe("stock");
    expect(detectAssetType("TAEE11", "TRANSMISSORA ALIANCA")).toBe("stock");
    expect(detectAssetType("BPAC11", "BANCO BTG PACTUAL")).toBe("stock");
    expect(detectAssetType("KLBN11", "KLABIN SA")).toBe("stock");
  });
  it("ações comuns são stock", () => {
    expect(detectAssetType("PETR4", "PETROLEO BRASILEIRO")).toBe("stock");
    expect(detectAssetType("AAPL", "Apple Inc")).toBe("stock");
  });
  it("sem nome, assume stock (conservador)", () => {
    expect(detectAssetType("HGLG11")).toBe("stock");
  });
});

describe("detectFIISegment", () => {
  it("mapeia raízes conhecidas", () => {
    expect(detectFIISegment("HGLG11")).toBe("Logística");
    expect(detectFIISegment("XPML11")).toBe("Shopping");
    expect(detectFIISegment("MXRF11")).toBe("Papel/Recebíveis");
  });
  it("desconhecido retorna —", () => {
    expect(detectFIISegment("ZZZZ11")).toBe("—");
  });
});
