import { useEffect, useRef, useState } from "react";
import { PraxiaTokens } from "./tokens";
import { GlassButton } from "./GlassButton";
import { Icon } from "./Icon";
import { PraMark } from "./PraMark";
import type { ChatMessage, InvestorProfile, Stock } from "@/types/stock";
import { usePraChat, type ChatTone } from "@/hooks/usePraChat";
import { riskLabel, horizonLabel } from "@/hooks/useInvestorProfile";
import { renderWithLinks, splitCitations, SourcesList } from "./Citations";

interface ChatSheetProps {
  open: boolean;
  onClose: () => void;
  accent?: string;
  tone: ChatTone;
  profile: InvestorProfile | null;
  stocks: Stock[];
  totalValue: number;
  onProfileDetected?: (p: Omit<InvestorProfile, "completedAt">) => void;
}

const SUGGESTIONS = [
  "Como minha carteira está agora?",
  "Sugira 3 ações pro meu perfil",
  "Como reduzir risco da carteira?",
  "O que é dividend yield?",
];

export function ChatSheet({
  open,
  onClose,
  accent = PraxiaTokens.accent,
  tone,
  profile,
  stocks,
  totalValue,
  onProfileDetected,
}: ChatSheetProps) {
  const T = PraxiaTokens;
  const { messages, thinking, send, ensureGreeting } = usePraChat({
    tone,
    profile,
    stocks,
    totalValue,
    onProfileDetected,
  });
  const [input, setInput] = useState("");
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) ensureGreeting();
  }, [open, ensureGreeting]);

  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [messages, thinking, open]);

  if (!open) return null;

  const submit = async (text?: string) => {
    const value = (text ?? input).trim();
    if (!value || thinking) return;
    setInput("");
    await send(value);
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 50,
          background: "rgba(2, 3, 20, 0.6)",
          backdropFilter: "blur(6px)",
          animation: "praFadeIn 0.2s ease-out",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 51,
          height: "88%",
          background: `
            radial-gradient(120% 60% at 80% 0%, ${accent}22 0%, transparent 50%),
            linear-gradient(180deg, #0a1030 0%, #050818 80%)
          `,
          borderTopLeftRadius: 32,
          borderTopRightRadius: 32,
          border: `0.5px solid ${T.hairlineStrong}`,
          boxShadow: "0 -20px 60px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "column",
          animation: "praSlideUp 0.32s cubic-bezier(.2,.7,.3,1)",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 8 }}>
          <div
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              background: "rgba(255,255,255,0.2)",
            }}
          />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 18px 14px",
            borderBottom: `0.5px solid ${T.hairline}`,
          }}
        >
          <div style={{ position: "relative" }}>
            <PraMark size={40} accent={accent} />
            <div
              style={{
                position: "absolute",
                bottom: 0,
                right: 0,
                width: 10,
                height: 10,
                borderRadius: 5,
                background: T.up,
                border: "2px solid #0a1030",
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontFamily: T.display,
                fontWeight: 600,
                fontSize: 15,
                color: T.ink,
              }}
            >
              Pra
            </div>
            <div
              style={{
                fontFamily: T.body,
                fontSize: 11.5,
                color: T.ink50,
              }}
            >
              {profile
                ? `Recomendações ancoradas no seu perfil ${riskLabel(profile.risk).toLowerCase()} · ${horizonLabel(profile.horizon).toLowerCase()}`
                : "Vou conhecer seu perfil antes de recomendar"}
            </div>
          </div>
          <GlassButton onClick={onClose} ariaLabel="Fechar chat">
            <Icon.close size={16} color={T.ink70} />
          </GlassButton>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 18px",
            background: `${accent}0d`,
            borderBottom: `0.5px solid ${T.hairline}`,
            fontFamily: T.body,
            fontSize: 11,
            color: T.ink70,
          }}
        >
          <Icon.shield size={12} color={accent} />
          <span>
            A Pra sempre cita fontes e ancora cada recomendação no seu perfil. Nada de
            afirmações sem referência.
          </span>
        </div>

        <div
          ref={scrollerRef}
          className="praxia-scroll"
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 18px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {messages.map((m, i) => (
            <Bubble key={i} message={m} accent={accent} />
          ))}
          {thinking && <ThinkingBubble accent={accent} />}
          {messages.length === 1 && (
            <div style={{ marginTop: 8 }}>
              <div
                style={{
                  fontFamily: T.mono,
                  fontSize: 10.5,
                  color: T.ink30,
                  letterSpacing: 0.8,
                  marginBottom: 8,
                }}
              >
                SUGESTÕES
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => submit(s)}
                    style={{
                      textAlign: "left",
                      padding: "12px 14px",
                      borderRadius: 14,
                      background: "rgba(255,255,255,0.04)",
                      border: `0.5px solid ${T.hairline}`,
                      color: T.ink,
                      fontFamily: T.body,
                      fontSize: 13,
                      cursor: "pointer",
                      lineHeight: 1.4,
                    }}
                  >
                    <span style={{ color: accent, marginRight: 6 }}>›</span>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            padding: "12px 16px 24px",
            borderTop: `0.5px solid ${T.hairline}`,
            background: "rgba(2,3,20,0.5)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 10,
              padding: "8px 8px 8px 16px",
              borderRadius: 24,
              background: "rgba(255,255,255,0.06)",
              border: `0.5px solid ${T.hairlineStrong}`,
            }}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="Pergunte algo sobre seus investimentos…"
              rows={1}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: T.ink,
                fontFamily: T.body,
                fontSize: 14,
                resize: "none",
                paddingTop: 9,
                paddingBottom: 9,
                maxHeight: 100,
              }}
            />
            <button
              onClick={() => submit()}
              disabled={!input.trim() || thinking}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                border: "none",
                cursor: input.trim() && !thinking ? "pointer" : "not-allowed",
                background:
                  input.trim() && !thinking ? accent : "rgba(255,255,255,0.1)",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.15s",
              }}
            >
              <Icon.send size={16} color="white" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function Bubble({ message, accent }: { message: ChatMessage; accent: string }) {
  const T = PraxiaTokens;
  const isMe = message.role === "user";

  // The user's message is rendered verbatim. Pra's messages have a structured
  // `Fontes:` block extracted into a separate citations list.
  const { body, sources } = isMe
    ? { body: message.text, sources: [] }
    : splitCitations(message.text);

  return (
    <div style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start" }}>
      <div
        style={{
          maxWidth: "85%",
          padding: "10px 14px",
          borderRadius: 18,
          background: isMe ? accent : "rgba(255,255,255,0.06)",
          color: isMe ? "white" : T.ink,
          borderTopRightRadius: isMe ? 4 : 18,
          borderTopLeftRadius: isMe ? 18 : 4,
          fontFamily: T.body,
          fontSize: 13.5,
          lineHeight: 1.45,
          border: isMe ? "none" : `0.5px solid ${T.hairline}`,
          whiteSpace: "pre-wrap",
        }}
      >
        {isMe ? body : <>{renderWithLinks(body, accent)}</>}
        {!isMe && <SourcesList sources={sources} accent={accent} />}
      </div>
    </div>
  );
}

function ThinkingBubble({ accent }: { accent: string }) {
  const T = PraxiaTokens;
  return (
    <div style={{ display: "flex", justifyContent: "flex-start" }}>
      <div
        style={{
          padding: "12px 16px",
          borderRadius: 18,
          borderTopLeftRadius: 4,
          background: "rgba(255,255,255,0.06)",
          border: `0.5px solid ${T.hairline}`,
          display: "flex",
          gap: 4,
          alignItems: "center",
        }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              background: accent,
              display: "inline-block",
              animation: `praDot 1s ease-in-out ${i * 0.15}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
