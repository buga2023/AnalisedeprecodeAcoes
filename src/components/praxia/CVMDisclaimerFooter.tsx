import { PraxiaTokens } from "./tokens";
import { CVM_DISCLAIMER_SHORT } from "@/lib/legal";

/**
 * Rodapé legal compacto para colar abaixo de qualquer bloco gerado por IA
 * (StockAIAnalysisSection, PortfolioInsightsContent, ChatSheet, etc.).
 *
 * O texto vem de `lib/legal.ts:CVM_DISCLAIMER_SHORT` — fonte única da
 * verdade. Quando o texto regulatório mudar, é uma edição só.
 *
 * Não confundir com `DisclaimerBar` (banner maior, cabeçalho/destaque) —
 * `CVMDisclaimerFooter` é a versão minúscula em rodapé.
 */
export function CVMDisclaimerFooter() {
  const T = PraxiaTokens;
  return (
    <div
      style={{
        marginTop: 10,
        paddingTop: 8,
        borderTop: `0.5px dashed ${T.hairline}`,
        fontFamily: T.body,
        fontSize: 10.5,
        color: T.ink30,
        lineHeight: 1.4,
        letterSpacing: 0.1,
      }}
    >
      {CVM_DISCLAIMER_SHORT}
    </div>
  );
}
