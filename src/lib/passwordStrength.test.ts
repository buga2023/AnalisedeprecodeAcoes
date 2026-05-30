import { describe, expect, it } from "vitest";
import {
  MIN_PASSWORD_LENGTH,
  validatePasswordStrength,
} from "./passwordStrength";

describe("validatePasswordStrength", () => {
  it("rejeita string vazia com as 3 regras quebradas", () => {
    const r = validatePasswordStrength("");
    expect(r.valid).toBe(false);
    expect(r.issues).toHaveLength(3);
  });

  it("rejeita senha curta (< 8) e lista a regra de comprimento primeiro", () => {
    const r = validatePasswordStrength("ab12");
    expect(r.valid).toBe(false);
    expect(r.issues[0]).toContain(String(MIN_PASSWORD_LENGTH));
  });

  it("rejeita senha sem dígito", () => {
    const r = validatePasswordStrength("abcdefgh");
    expect(r.valid).toBe(false);
    expect(r.issues).toHaveLength(1);
    expect(r.issues[0]).toMatch(/número|numero|dígito|digito/i);
  });

  it("rejeita senha sem letra", () => {
    const r = validatePasswordStrength("12345678");
    expect(r.valid).toBe(false);
    expect(r.issues).toHaveLength(1);
    expect(r.issues[0]).toMatch(/letra/i);
  });

  it("aceita senha com ≥8 chars, letra e número", () => {
    const r = validatePasswordStrength("abcd1234");
    expect(r.valid).toBe(true);
    expect(r.issues).toHaveLength(0);
  });

  it("aceita símbolo mas não o exige", () => {
    const r = validatePasswordStrength("abcd1234!");
    expect(r.valid).toBe(true);
    expect(r.issues).toHaveLength(0);
  });

  it("conta letras acentuadas como letra (Unicode)", () => {
    const r = validatePasswordStrength("ção12345");
    expect(r.valid).toBe(true);
  });
});
