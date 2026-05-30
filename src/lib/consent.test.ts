import { beforeEach, describe, expect, it } from "vitest";
import { CONSENT_KEY, CONSENT_VERSION, readConsent, writeConsent } from "./consent";

describe("consent record (LGPD Art. 8)", () => {
  beforeEach(() => localStorage.clear());

  it("retorna null quando não há registro (banner aparece)", () => {
    expect(readConsent()).toBeNull();
  });

  it("grava 'accepted' com versão e timestamp", () => {
    writeConsent("accepted");
    const rec = readConsent();
    expect(rec?.decision).toBe("accepted");
    expect(rec?.version).toBe(CONSENT_VERSION);
    expect(typeof rec?.decidedAt).toBe("string");
  });

  it("grava 'refused' (escolha livre demonstrável)", () => {
    writeConsent("refused");
    expect(readConsent()?.decision).toBe("refused");
  });

  it("ignora registro de versão antiga (força reaceite)", () => {
    localStorage.setItem(
      CONSENT_KEY,
      JSON.stringify({ version: "2020-01-01", decision: "accepted", decidedAt: "x" })
    );
    expect(readConsent()).toBeNull();
  });

  it("retorna null em JSON corrompido", () => {
    localStorage.setItem(CONSENT_KEY, "{not json");
    expect(readConsent()).toBeNull();
  });
});
