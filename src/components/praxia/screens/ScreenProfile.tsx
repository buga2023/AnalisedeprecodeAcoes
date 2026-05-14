import { useState } from "react";
import { PraxiaTokens, ACCENT_OPTIONS } from "../tokens";
import { PraxiaBackground } from "../PraxiaBackground";
import { PraxiaCard } from "../PraxiaCard";
import { Icon } from "../Icon";
import { PraMark } from "../PraMark";
import type { AIProvider, AIProviderConfig, InvestorProfile } from "@/types/stock";
import {
  riskLabel,
  horizonLabel,
  interestLabel,
} from "@/hooks/useInvestorProfile";
import type { ChatTone } from "@/hooks/usePraChat";

interface ScreenProfileProps {
  profile: InvestorProfile | null;
  username: string;
  accent: string;
  onAccentChange: (a: string) => void;
  tone: ChatTone;
  onToneChange: (t: ChatTone) => void;
  providerConfig: AIProviderConfig | null;
  onProviderSave: (config: AIProviderConfig | null) => void;
  onRetakeQuiz: () => void;
  onOpenBatchValuation?: () => void;
  onLogout: () => void;
  onClearLocalData: () => void;
}

export function ScreenProfile({
  profile,
  username,
  accent,
  onAccentChange,
  tone,
  onToneChange,
  providerConfig,
  onProviderSave,
  onRetakeQuiz,
  onOpenBatchValuation,
  onLogout,
  onClearLocalData,
}: ScreenProfileProps) {
  const T = PraxiaTokens;
  const [showAI, setShowAI] = useState(false);

  return (
    <div
      className="praxia-scroll pra-screen"
      key="profile"
      style={{
        position: "relative",
        height: "100dvh",
        overflowY: "auto",
        overflowX: "hidden",
      }}
    >
      <PraxiaBackground accent={accent} />
      <div
        style={{
          position: "relative",
          zIndex: 2,
          padding: "54px 16px 120px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div
          style={{
            fontFamily: T.display,
            fontSize: 24,
            fontWeight: 600,
            color: T.ink,
            letterSpacing: -0.6,
          }}
        >
          Perfil
        </div>

        {/* User card */}
        <PraxiaCard padding={18} raised>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <PraMark size={48} accent={accent} />
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontFamily: T.display,
                  fontWeight: 600,
                  fontSize: 17,
                  color: T.ink,
                }}
              >
                {username}
              </div>
              <div
                style={{
                  fontFamily: T.body,
                  fontSize: 12.5,
                  color: T.ink50,
                }}
              >
                {profile
                  ? `${riskLabel(profile.risk)} · ${horizonLabel(profile.horizon)}`
                  : "Perfil ainda não definido"}
              </div>
            </div>
            <button
              onClick={onRetakeQuiz}
              style={{
                background: "rgba(255,255,255,0.05)",
                border: `0.5px solid ${T.hairline}`,
                color: T.ink70,
                borderRadius: 999,
                height: 32,
                padding: "0 14px",
                fontFamily: T.body,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {profile ? "Refazer" : "Fazer"}
            </button>
          </div>
          {profile && profile.interests.length > 0 && (
            <div
              style={{
                marginTop: 12,
                display: "flex",
                gap: 6,
                flexWrap: "wrap",
              }}
            >
              {profile.interests.map((i) => (
                <span
                  key={i}
                  style={{
                    fontFamily: T.body,
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: accent,
                    padding: "4px 10px",
                    borderRadius: 999,
                    background: `${accent}1f`,
                    border: `0.5px solid ${accent}55`,
                  }}
                >
                  {interestLabel(i)}
                </span>
              ))}
            </div>
          )}
        </PraxiaCard>

        {/* Accent color */}
        <PraxiaCard padding={16}>
          <SettingLabel label="Cor de destaque" />
          <div
            style={{
              display: "flex",
              gap: 10,
              marginTop: 10,
              flexWrap: "wrap",
            }}
          >
            {ACCENT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onAccentChange(opt.value)}
                aria-label={opt.label}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  background: opt.value,
                  border:
                    accent === opt.value
                      ? "2px solid white"
                      : "0.5px solid rgba(255,255,255,0.2)",
                  cursor: "pointer",
                  boxShadow: `0 4px 14px ${opt.value}55`,
                }}
              />
            ))}
          </div>
        </PraxiaCard>

        {/* Tom */}
        <PraxiaCard padding={16}>
          <SettingLabel label="Tom da Pra" />
          <div
            style={{
              marginTop: 10,
              display: "flex",
              gap: 8,
            }}
          >
            {(["casual", "formal"] as ChatTone[]).map((t) => (
              <button
                key={t}
                onClick={() => onToneChange(t)}
                style={{
                  flex: 1,
                  height: 38,
                  borderRadius: 10,
                  background: tone === t ? `${accent}25` : "rgba(255,255,255,0.04)",
                  color: tone === t ? T.ink : T.ink70,
                  border:
                    tone === t
                      ? `1px solid ${accent}`
                      : `0.5px solid ${T.hairline}`,
                  fontFamily: T.body,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  textTransform: "capitalize",
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </PraxiaCard>

        {/* AI Provider */}
        <PraxiaCard padding={16}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <SettingLabel label="Provedor de IA" sub={providerConfig ? `${providerConfig.provider} configurado` : "nenhum configurado"} />
            <button
              onClick={() => setShowAI((v) => !v)}
              style={{
                background: "none",
                border: "none",
                color: accent,
                fontFamily: T.body,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {showAI ? "Fechar" : "Configurar"}
            </button>
          </div>
          {showAI && (
            <AIProviderForm
              accent={accent}
              current={providerConfig}
              onSave={(c) => {
                onProviderSave(c);
                setShowAI(false);
              }}
            />
          )}
        </PraxiaCard>

        {/* Ferramentas */}
        {onOpenBatchValuation && (
          <PraxiaCard padding={16}>
            <SettingLabel label="Ferramentas" sub="Análises avançadas e importação" />
            <button
              onClick={onOpenBatchValuation}
              style={{
                marginTop: 12,
                width: "100%",
                height: 44,
                borderRadius: 10,
                background: `${accent}1f`,
                color: T.ink,
                border: `0.5px solid ${accent}55`,
                fontFamily: T.body,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <Icon.invest size={14} color={accent} />
              Valuation em lote (CSV/XLSX)
            </button>
          </PraxiaCard>
        )}

        {/* Danger */}
        <PraxiaCard padding={16}>
          <SettingLabel label="Dados locais" sub="Tudo é guardado no seu navegador" />
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button
              onClick={onClearLocalData}
              style={{
                flex: 1,
                height: 40,
                borderRadius: 10,
                background: "rgba(255,107,129,0.08)",
                color: T.down,
                border: "0.5px solid rgba(255,107,129,0.3)",
                fontFamily: T.body,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <Icon.trash size={14} color={T.down} />
              Limpar dados
            </button>
            <button
              onClick={onLogout}
              style={{
                flex: 1,
                height: 40,
                borderRadius: 10,
                background: "rgba(255,255,255,0.04)",
                color: T.ink70,
                border: `0.5px solid ${T.hairline}`,
                fontFamily: T.body,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <Icon.logout size={14} color={T.ink70} />
              Sair
            </button>
          </div>
        </PraxiaCard>

        <div
          style={{
            fontFamily: T.body,
            fontSize: 11,
            color: T.ink30,
            textAlign: "center",
            paddingTop: 4,
          }}
        >
          © {new Date().getFullYear()} Praxia · simulação local (paper trading)
        </div>
      </div>
    </div>
  );
}

function SettingLabel({ label, sub }: { label: string; sub?: string }) {
  const T = PraxiaTokens;
  return (
    <div>
      <div
        style={{
          fontFamily: T.display,
          fontSize: 13.5,
          fontWeight: 600,
          color: T.ink,
        }}
      >
        {label}
      </div>
      {sub && (
        <div
          style={{
            fontFamily: T.body,
            fontSize: 11.5,
            color: T.ink50,
            marginTop: 2,
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

const PROVIDERS: { value: AIProvider; label: string; hint: string }[] = [
  { value: "groq", label: "Groq", hint: "Llama 3.3 70B · grátis" },
  { value: "openai", label: "OpenAI", hint: "GPT-4o" },
  { value: "anthropic", label: "Anthropic", hint: "Claude 3.5 Sonnet" },
  { value: "gemini", label: "Gemini", hint: "Google Gemini 1.5 Flash" },
];

function AIProviderForm({
  accent,
  current,
  onSave,
}: {
  accent: string;
  current: AIProviderConfig | null;
  onSave: (c: AIProviderConfig | null) => void;
}) {
  const T = PraxiaTokens;
  const [provider, setProvider] = useState<AIProvider>(current?.provider ?? "groq");
  const [apiKey, setApiKey] = useState(current?.apiKey ?? "");

  return (
    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 6,
        }}
      >
        {PROVIDERS.map((p) => (
          <button
            key={p.value}
            onClick={() => setProvider(p.value)}
            style={{
              textAlign: "left",
              padding: "10px 12px",
              borderRadius: 10,
              background: provider === p.value ? `${accent}25` : "rgba(255,255,255,0.04)",
              border:
                provider === p.value
                  ? `1px solid ${accent}`
                  : `0.5px solid ${T.hairline}`,
              color: T.ink,
              cursor: "pointer",
            }}
          >
            <div
              style={{
                fontFamily: T.display,
                fontWeight: 600,
                fontSize: 12.5,
              }}
            >
              {p.label}
            </div>
            <div style={{ fontFamily: T.body, fontSize: 10.5, color: T.ink50 }}>
              {p.hint}
            </div>
          </button>
        ))}
      </div>
      <input
        id="ai-api-key"
        name="apiKey"
        type="password"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        placeholder="Cole sua API key"
        style={{
          height: 40,
          padding: "0 12px",
          borderRadius: 10,
          background: "rgba(255,255,255,0.04)",
          border: `0.5px solid ${T.hairline}`,
          color: T.ink,
          fontFamily: T.mono,
          fontSize: 12,
          outline: "none",
        }}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => {
            if (current) onSave(null);
          }}
          disabled={!current}
          style={{
            flex: 1,
            height: 38,
            borderRadius: 10,
            background: "rgba(255,255,255,0.04)",
            color: current ? T.ink70 : T.ink30,
            border: `0.5px solid ${T.hairline}`,
            fontFamily: T.body,
            fontSize: 12.5,
            fontWeight: 600,
            cursor: current ? "pointer" : "not-allowed",
          }}
        >
          Remover
        </button>
        <button
          disabled={!apiKey.trim()}
          onClick={() => onSave({ provider, apiKey: apiKey.trim() })}
          style={{
            flex: 1,
            height: 38,
            borderRadius: 10,
            background: apiKey.trim() ? accent : "rgba(255,255,255,0.1)",
            color: apiKey.trim() ? "white" : "rgba(255,255,255,0.4)",
            border: "none",
            fontFamily: T.body,
            fontSize: 12.5,
            fontWeight: 700,
            cursor: apiKey.trim() ? "pointer" : "not-allowed",
          }}
        >
          Salvar
        </button>
      </div>
    </div>
  );
}
