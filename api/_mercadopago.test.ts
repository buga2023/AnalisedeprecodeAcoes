/**
 * Testes do helper Mercado Pago — foco na verificação de assinatura do webhook,
 * que é a barreira anti-spoofing. `mpFetch` não é testado aqui (faz I/O real).
 */
import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyWebhookSignature, mpStatusToSubscriptionStatus } from "./_mercadopago";

const SECRET = "topsecret";

function sign(dataId: string, requestId: string, ts: string, secret = SECRET): string {
  const id = /[^0-9]/.test(dataId) ? dataId.toLowerCase() : dataId;
  const manifest = `id:${id};request-id:${requestId};ts:${ts};`;
  const v1 = createHmac("sha256", secret).update(manifest).digest("hex");
  return `ts=${ts},v1=${v1}`;
}

describe("verifyWebhookSignature", () => {
  it("aceita assinatura valida (dataId numerico)", () => {
    const xSignature = sign("12345", "req-1", "1700000000");
    expect(
      verifyWebhookSignature({ xSignature, xRequestId: "req-1", dataId: "12345", secret: SECRET })
    ).toBe(true);
  });

  it("aceita assinatura valida (dataId alfanumerico em minusculas)", () => {
    const xSignature = sign("ABC123", "req-2", "1700000001");
    expect(
      verifyWebhookSignature({ xSignature, xRequestId: "req-2", dataId: "ABC123", secret: SECRET })
    ).toBe(true);
  });

  it("rejeita assinatura adulterada", () => {
    expect(
      verifyWebhookSignature({
        xSignature: "ts=1700000000,v1=deadbeef",
        xRequestId: "req-1",
        dataId: "12345",
        secret: SECRET,
      })
    ).toBe(false);
  });

  it("rejeita secret diferente", () => {
    const xSignature = sign("12345", "req-1", "1700000000", "outro-secret");
    expect(
      verifyWebhookSignature({ xSignature, xRequestId: "req-1", dataId: "12345", secret: SECRET })
    ).toBe(false);
  });

  it("falha fechada quando falta secret / header / dataId", () => {
    const xSignature = sign("12345", "req-1", "1700000000");
    expect(verifyWebhookSignature({ xSignature, xRequestId: "req-1", dataId: "12345", secret: "" })).toBe(false);
    expect(verifyWebhookSignature({ xSignature: undefined, xRequestId: "req-1", dataId: "12345", secret: SECRET })).toBe(false);
    expect(verifyWebhookSignature({ xSignature, xRequestId: "req-1", dataId: undefined, secret: SECRET })).toBe(false);
  });

  it("falha quando header nao tem ts ou v1", () => {
    expect(
      verifyWebhookSignature({ xSignature: "v1=abc", xRequestId: "req-1", dataId: "12345", secret: SECRET })
    ).toBe(false);
  });
});

describe("mpStatusToSubscriptionStatus", () => {
  it("mapeia status do Preapproval -> status interno", () => {
    expect(mpStatusToSubscriptionStatus("authorized")).toBe("active");
    expect(mpStatusToSubscriptionStatus("pending")).toBe("pending");
    expect(mpStatusToSubscriptionStatus("paused")).toBe("paused");
    expect(mpStatusToSubscriptionStatus("cancelled")).toBe("cancelled");
  });
});
