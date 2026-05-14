import { useState } from "react";
import { PraxiaTokens } from "../tokens";
import { PraxiaBackground } from "../PraxiaBackground";
import { Icon } from "../Icon";
import type {
  InvestorProfile,
  RiskTolerance,
  InvestmentHorizon,
  Interest,
} from "@/types/stock";

interface ScreenQuizProps {
  onComplete: (p: Omit<InvestorProfile, "completedAt">) => void;
  accent?: string;
}

const STEPS = [
  {
    q: "Quanto risco você topa?",
    sub: "Sua tolerância nos ajuda a calibrar as recomendações.",
    multi: false as const,
    key: "risk" as const,
    opts: [
      { v: "low" as RiskTolerance, lbl: "Conservador", desc: "Prefiro segurança, mesmo que renda menos." },
      { v: "mid" as RiskTolerance, lbl: "Moderado", desc: "Topo oscilações por retorno equilibrado." },
      { v: "high" as RiskTolerance, lbl: "Arrojado", desc: "Aceito volatilidade por retorno maior." },
    ],
  },
  {
    q: "Qual seu horizonte?",
    sub: "Por quanto tempo o dinheiro pode ficar investido.",
    multi: false as const,
    key: "horizon" as const,
    opts: [
      { v: "short" as InvestmentHorizon, lbl: "Curto", desc: "Até 1 ano" },
      { v: "mid" as InvestmentHorizon, lbl: "Médio", desc: "1 a 5 anos" },
      { v: "long" as InvestmentHorizon, lbl: "Longo", desc: "Mais de 5 anos" },
    ],
  },
  {
    q: "O que mais te interessa?",
    sub: "Pode escolher um ou mais.",
    multi: true as const,
    key: "interests" as const,
    opts: [
      { v: "div" as Interest, lbl: "Dividendos", desc: "Renda passiva mensal" },
      { v: "gro" as Interest, lbl: "Crescimento", desc: "Empresas em expansão" },
      { v: "esg" as Interest, lbl: "ESG", desc: "Sustentabilidade e governança" },
      { v: "tec" as Interest, lbl: "Tecnologia", desc: "Inovação e disrupção" },
    ],
  },
];

type Answers = {
  risk?: RiskTolerance;
  horizon?: InvestmentHorizon;
  interests?: Interest[];
};

export function ScreenQuiz({ onComplete, accent = PraxiaTokens.accent }: ScreenQuizProps) {
  const T = PraxiaTokens;
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});

  const s = STEPS[step];
  const sel = s.multi
    ? (answers.interests ?? [])
    : (answers[s.key as "risk" | "horizon"] as string | undefined);
  const canNext = s.multi ? (sel as Interest[]).length > 0 : !!sel;

  const choose = (v: string) => {
    if (s.multi) {
      const cur = answers.interests ?? [];
      const next = cur.includes(v as Interest)
        ? cur.filter((x) => x !== v)
        : [...cur, v as Interest];
      setAnswers({ ...answers, interests: next });
    } else {
      setAnswers({ ...answers, [s.key]: v });
    }
  };

  const advance = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      onComplete({
        risk: answers.risk!,
        horizon: answers.horizon!,
        interests: answers.interests ?? [],
      });
    }
  };

  return (
    <div
      style={{
        position: "relative",
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <PraxiaBackground accent={accent} />
      <div
        style={{
          position: "relative",
          zIndex: 2,
          padding: "70px 24px 24px",
          flex: 1,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", gap: 6, marginBottom: 32 }}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 3,
                borderRadius: 2,
                background: i <= step ? accent : "rgba(255,255,255,0.12)",
                transition: "background 0.3s",
              }}
            />
          ))}
        </div>

        <div
          style={{
            fontFamily: T.mono,
            fontSize: 10.5,
            color: accent,
            letterSpacing: 1.2,
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          Passo {step + 1} de {STEPS.length} · Perfil
        </div>
        <h1
          style={{
            margin: 0,
            fontFamily: T.display,
            fontSize: 28,
            fontWeight: 600,
            color: T.ink,
            letterSpacing: -0.6,
            lineHeight: 1.1,
          }}
        >
          {s.q}
        </h1>
        <p
          style={{
            marginTop: 10,
            fontFamily: T.body,
            fontSize: 14,
            color: T.ink50,
            lineHeight: 1.5,
          }}
        >
          {s.sub}
        </p>

        <div
          style={{
            marginTop: 28,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {s.opts.map((opt) => {
            const isSel = s.multi
              ? ((sel as Interest[]) ?? []).includes(opt.v as Interest)
              : sel === opt.v;
            return (
              <button
                key={opt.v}
                onClick={() => choose(opt.v)}
                style={{
                  textAlign: "left",
                  padding: "14px 16px",
                  borderRadius: 16,
                  background: isSel ? `${accent}1f` : "rgba(255,255,255,0.035)",
                  border: `1px solid ${isSel ? accent : "rgba(255,255,255,0.08)"}`,
                  color: T.ink,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  transition: "all 0.18s",
                  fontFamily: T.body,
                }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: s.multi ? 6 : 11,
                    flexShrink: 0,
                    border: `1.5px solid ${isSel ? accent : "rgba(255,255,255,0.25)"}`,
                    background: isSel ? accent : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {isSel && <Icon.check size={13} color="white" />}
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontFamily: T.display,
                      fontSize: 15,
                      fontWeight: 600,
                      color: T.ink,
                      letterSpacing: -0.1,
                    }}
                  >
                    {opt.lbl}
                  </div>
                  <div
                    style={{ fontSize: 12.5, color: T.ink50, marginTop: 2 }}
                  >
                    {opt.desc}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: "auto", paddingBottom: 16, display: "flex", gap: 10 }}>
          {step > 0 && (
            <button
              onClick={() => setStep(step - 1)}
              style={{
                height: 52,
                padding: "0 22px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.06)",
                color: T.ink,
                border: "1px solid rgba(255,255,255,0.1)",
                fontFamily: T.display,
                fontWeight: 600,
                fontSize: 15,
                cursor: "pointer",
              }}
            >
              Voltar
            </button>
          )}
          <button
            disabled={!canNext}
            onClick={advance}
            style={{
              flex: 1,
              height: 52,
              borderRadius: 999,
              background: canNext ? T.ink : "rgba(255,255,255,0.1)",
              color: canNext ? "#05071a" : "rgba(255,255,255,0.4)",
              border: "none",
              fontFamily: T.display,
              fontWeight: 600,
              fontSize: 15,
              cursor: canNext ? "pointer" : "not-allowed",
              letterSpacing: -0.1,
              transition: "all 0.2s",
            }}
          >
            {step === STEPS.length - 1 ? "Concluir perfil" : "Continuar"}
          </button>
        </div>
      </div>
    </div>
  );
}
