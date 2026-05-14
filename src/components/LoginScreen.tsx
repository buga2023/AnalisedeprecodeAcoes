import { useState } from "react";
import { PraxiaTokens } from "@/components/praxia/tokens";
import { PraxiaBackground } from "@/components/praxia/PraxiaBackground";
import { PraxiaLogo } from "@/components/praxia/PraxiaLogo";
import { Icon } from "@/components/praxia/Icon";

interface LoginScreenProps {
  onLogin: () => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const T = PraxiaTokens;
  const accent = T.accent;
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    // Lightweight artificial delay so the user feels the action register.
    window.setTimeout(() => {
      if (username.trim() === "admin" && password === "1234") {
        onLogin();
      } else {
        setError("Usuário ou senha incorretos.");
        setSubmitting(false);
      }
    }, 280);
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        justifyContent: "center",
        background: T.bgDeep,
        color: T.ink,
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 440,
          minHeight: "100dvh",
          overflow: "hidden",
          background: T.bg,
          boxShadow: "0 0 60px rgba(0,0,0,0.7)",
        }}
      >
        <PraxiaBackground accent={accent} />

        {/* Ambient glow under the form, anchored to the bottom for depth. */}
        <div
          style={{
            position: "absolute",
            bottom: -180,
            left: -60,
            right: -60,
            height: 460,
            background: `
              radial-gradient(closest-side at 50% 50%, ${accent} 0%, ${accent}66 32%, transparent 70%),
              radial-gradient(closest-side at 30% 60%, #8b5cf6aa 0%, transparent 60%)
            `,
            filter: "blur(40px)",
            opacity: 0.55,
            pointerEvents: "none",
          }}
        />

        <form
          onSubmit={handleSubmit}
          className="pra-screen"
          style={{
            position: "relative",
            zIndex: 2,
            padding: "72px 28px 32px",
            minHeight: "100dvh",
            display: "flex",
            flexDirection: "column",
            gap: 22,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <PraxiaLogo size={28} accent={accent} />
            <span
              style={{
                fontFamily: T.display,
                fontSize: 18,
                fontWeight: 600,
                letterSpacing: 0.3,
                color: T.ink,
              }}
            >
              Praxia
            </span>
          </div>

          <div style={{ marginTop: 36 }}>
            <h1
              style={{
                margin: 0,
                fontFamily: T.display,
                fontSize: 42,
                fontWeight: 500,
                lineHeight: 1.02,
                color: T.ink,
                letterSpacing: -1,
              }}
            >
              Bem-vindo{" "}
              <span style={{ fontStyle: "italic", color: T.gold }}>
                de volta
              </span>
              .
            </h1>
            {/* filete dourado editorial */}
            <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 32, height: 1, background: T.gold }} />
              <span
                style={{
                  width: 4,
                  height: 4,
                  background: T.gold,
                  transform: "rotate(45deg)",
                }}
              />
            </div>
            <p
              style={{
                marginTop: 16,
                fontFamily: T.body,
                fontSize: 14,
                lineHeight: 1.55,
                color: T.ink70,
                maxWidth: 320,
              }}
            >
              Acesse sua carteira, converse com a Pra e veja a análise calibrada para o seu perfil.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
            <Field
              label="Usuário"
              icon={<Icon.profile size={16} color={T.ink50} />}
              input={
                <input
                  id="username"
                  name="username"
                  type="text"
                  value={username}
                  placeholder="admin"
                  autoFocus
                  autoComplete="username"
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (error) setError("");
                  }}
                  style={inputStyle()}
                />
              }
            />

            <Field
              label="Senha"
              icon={<Icon.shield size={16} color={T.ink50} />}
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: T.ink50,
                    cursor: "pointer",
                    fontFamily: T.mono,
                    fontSize: 10.5,
                    letterSpacing: 0.6,
                    textTransform: "uppercase",
                  }}
                >
                  {showPwd ? "Ocultar" : "Mostrar"}
                </button>
              }
              input={
                <input
                  id="password"
                  name="password"
                  type={showPwd ? "text" : "password"}
                  value={password}
                  placeholder="••••"
                  autoComplete="current-password"
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError("");
                  }}
                  style={inputStyle()}
                />
              }
            />

            {error && (
              <div
                style={{
                  marginTop: 2,
                  padding: "10px 12px",
                  borderRadius: 12,
                  background: "rgba(255,107,129,0.10)",
                  border: "0.5px solid rgba(255,107,129,0.32)",
                  color: T.down,
                  fontFamily: T.body,
                  fontSize: 12.5,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Icon.shield size={14} color={T.down} />
                {error}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting || !username.trim() || !password}
            style={{
              marginTop: 10,
              height: 54,
              borderRadius: 999,
              background:
                submitting || !username.trim() || !password
                  ? "rgba(255,255,255,0.08)"
                  : accent,
              color:
                submitting || !username.trim() || !password
                  ? "rgba(255,255,255,0.4)"
                  : "white",
              border: "none",
              fontFamily: T.display,
              fontWeight: 600,
              fontSize: 15,
              cursor:
                submitting || !username.trim() || !password ? "not-allowed" : "pointer",
              boxShadow:
                submitting || !username.trim() || !password ? "none" : `0 16px 36px ${accent}55`,
              letterSpacing: -0.1,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
            }}
          >
            {submitting ? "Entrando…" : "Entrar"}
            {!submitting && username.trim() && password && (
              <span
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  background: "rgba(255,255,255,0.18)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </span>
            )}
          </button>

          <div
            style={{
              marginTop: "auto",
              fontFamily: T.mono,
              fontSize: 10.5,
              color: T.ink30,
              letterSpacing: 1,
              textTransform: "uppercase",
              textAlign: "center",
            }}
          >
            paper trading · simulação local
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  icon,
  input,
  trailing,
}: {
  label: string;
  icon?: React.ReactNode;
  input: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  const T = PraxiaTokens;
  return (
    <label style={{ display: "block" }}>
      <div
        style={{
          fontFamily: T.body,
          fontSize: 11.5,
          color: T.ink50,
          fontWeight: 500,
          letterSpacing: 0.3,
          marginBottom: 6,
          paddingLeft: 2,
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          height: 48,
          padding: "0 14px",
          borderRadius: 14,
          background: "rgba(255,255,255,0.04)",
          border: `0.5px solid ${T.hairline}`,
        }}
      >
        {icon}
        {input}
        {trailing}
      </div>
    </label>
  );
}

function inputStyle(): React.CSSProperties {
  return {
    flex: 1,
    background: "transparent",
    border: "none",
    outline: "none",
    color: PraxiaTokens.ink,
    fontFamily: PraxiaTokens.body,
    fontSize: 14,
  };
}
