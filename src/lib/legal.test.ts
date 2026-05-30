import { describe, it, expect } from "vitest";
import {
  CVM_DISCLAIMER,
  CVM_DISCLAIMER_SHORT,
  LGPD_COOKIE_NOTICE,
  PRIVACY_POLICY,
  TERMS_OF_USE,
} from "./legal";

/**
 * Testes de regressão dos textos legais — quando algo mudar, o teste falha
 * para que a alteração de redação passe por code review (impacto LGPD/CVM).
 */
describe("legal — disclaimers", () => {
  it("CVM_DISCLAIMER cita Resolução CVM 14", () => {
    expect(CVM_DISCLAIMER).toMatch(/Resolução CVM 14/i);
  });

  it("CVM_DISCLAIMER deixa explícito que é educacional, não recomendação", () => {
    expect(CVM_DISCLAIMER).toMatch(/educacional/i);
    expect(CVM_DISCLAIMER).toMatch(/Não constitui recomendação/i);
  });

  it("CVM_DISCLAIMER_SHORT existe e cita CVM 14", () => {
    expect(CVM_DISCLAIMER_SHORT.length).toBeGreaterThan(20);
    expect(CVM_DISCLAIMER_SHORT.length).toBeLessThan(200);
    expect(CVM_DISCLAIMER_SHORT).toMatch(/CVM 14/);
  });

  it("LGPD_COOKIE_NOTICE é aviso (localStorage/dispositivo) sem linguagem de consentimento", () => {
    expect(LGPD_COOKIE_NOTICE).toMatch(/localStorage/);
    expect(LGPD_COOKIE_NOTICE).toMatch(/dispositivo/);
    expect(LGPD_COOKIE_NOTICE).not.toMatch(/você concorda/i);
  });
});

describe("legal — PRIVACY_POLICY", () => {
  it("tem versão (vigorEm) no formato ISO", () => {
    expect(PRIVACY_POLICY.vigorEm).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("tem ao menos 5 seções (intro + LGPD direitos + DPO + mudanças)", () => {
    expect(PRIVACY_POLICY.secoes.length).toBeGreaterThanOrEqual(5);
  });

  it("cada seção tem título e ao menos um parágrafo", () => {
    for (const sec of PRIVACY_POLICY.secoes) {
      expect(sec.titulo.length).toBeGreaterThan(0);
      expect(sec.conteudo.length).toBeGreaterThan(0);
    }
  });

  it("menciona direitos LGPD (acesso, exclusão, portabilidade)", () => {
    const all = PRIVACY_POLICY.secoes.flatMap((s) => s.conteudo).join(" ");
    expect(all).toMatch(/Acessar/i);
    expect(all).toMatch(/Excluir/i);
    expect(all).toMatch(/portabilidade/i);
  });

  it("nomeia processadores externos (Groq/Yahoo/Vercel)", () => {
    const all = PRIVACY_POLICY.secoes.flatMap((s) => s.conteudo).join(" ");
    expect(all).toMatch(/Groq/i);
    expect(all).toMatch(/Yahoo/i);
    expect(all).toMatch(/Vercel/i);
  });

  it("declara base legal (execução de contrato + legítimo interesse, Art. 7)", () => {
    const all = PRIVACY_POLICY.secoes.flatMap((s) => [s.titulo, ...s.conteudo]).join(" ");
    expect(all).toMatch(/base legal/i);
    expect(all).toMatch(/execução de contrato/i);
    expect(all).toMatch(/leg[íi]timo interesse/i);
    expect(all).toMatch(/Art\. 7/);
  });

  it("declara transferência internacional (Art. 33)", () => {
    const all = PRIVACY_POLICY.secoes.flatMap((s) => [s.titulo, ...s.conteudo]).join(" ");
    expect(all).toMatch(/transfer[êe]ncia internacional/i);
    expect(all).toMatch(/Art\. 33/);
  });

  it("aponta a portabilidade para 'Exportar meus dados' (não mais 'Exportar resultados')", () => {
    const all = PRIVACY_POLICY.secoes.flatMap((s) => [s.titulo, ...s.conteudo]).join(" ");
    expect(all).toMatch(/Exportar meus dados/i);
    expect(all).not.toMatch(/Exportar resultados/i);
  });
});

describe("legal — TERMS_OF_USE", () => {
  it("tem versão (vigorEm) no formato ISO", () => {
    expect(TERMS_OF_USE.vigorEm).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("seção 4 (NÃO é consultor) inclui o CVM_DISCLAIMER completo", () => {
    const allText = TERMS_OF_USE.secoes.flatMap((s) => s.conteudo).join(" ");
    expect(allText).toContain(CVM_DISCLAIMER);
  });

  it("menciona maioridade e residência no Brasil", () => {
    const all = TERMS_OF_USE.secoes.flatMap((s) => s.conteudo).join(" ");
    expect(all).toMatch(/18 anos/);
    expect(all).toMatch(/Brasil/i);
  });
});
