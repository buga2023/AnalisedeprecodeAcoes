import { useState } from "react";
import { PraxiaTokens } from "@/components/praxia/tokens";
import { PraxiaBackground } from "@/components/praxia/PraxiaBackground";
import { PraxiaLogo } from "@/components/praxia/PraxiaLogo";
import { Icon } from "@/components/praxia/Icon";
import { useAuth } from "@/hooks/useAuth";
import { isSupabaseConfigured } from "@/lib/supabase";
import { humanizeAuthError } from "@/lib/authErrors";
import { validatePasswordStrength } from "@/lib/passwordStrength";

interface LoginScreenProps {
  /** Quando true, abre direto no fluxo de definir nova senha (link de reset clicado). */
  recoveryMode?: boolean;
}

type Mode = "signin" | "signup";
type Step = "input" | "sent" | "reset-sent" | "recovery";

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginScreen({ recoveryMode = false }: LoginScreenProps) {
  const T = PraxiaTokens;
  const accent = T.accent;
  const {
    signInWithPassword,
    signUpWithPassword,
    signInWithMagicLink,
    resetPassword,
    updatePassword,
  } = useAuth();

  const [mode, setMode] = useState<Mode>("signin");
  const [step, setStep] = useState<Step>(recoveryMode ? "recovery" : "input");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const emailValid = emailRe.test(email.trim());
  const pwCheck = validatePasswordStrength(password);
  // signin: nao trava por composicao (usuarios legados podem ter senha antiga);
  // so exige nao-vazia e deixa o Supabase decidir. signup/recovery: forca real.
  const passwordValid = mode === "signin" ? password.length > 0 : pwCheck.valid;

  function resetFeedback() {
    if (error) setError("");
    if (notice) setNotice("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || !emailValid || !passwordValid || !isSupabaseConfigured) return;
    setSubmitting(true);
    setError("");
    setNotice("");

    const result =
      mode === "signin"
        ? await signInWithPassword(email, password)
        : await signUpWithPassword(email, password);

    if (result.ok) {
      if (result.needsConfirmation) {
        setNotice(`Conta criada. Confirme o email enviado para ${email.trim()} para entrar.`);
      }
      // Sucesso com sessao → App.tsx detecta o user e troca de tela sozinho.
    } else {
      setError(humanizeAuthError(result.error));
    }
    setSubmitting(false);
  }

  async function handleMagicLink() {
    if (submitting || !emailValid || !isSupabaseConfigured) return;
    setSubmitting(true);
    setError("");
    setNotice("");
    const result = await signInWithMagicLink(email);
    if (result.ok) setStep("sent");
    else setError(humanizeAuthError(result.error));
    setSubmitting(false);
  }

  async function handleForgot() {
    if (submitting || !emailValid || !isSupabaseConfigured) {
      if (!emailValid) setError("Digite seu email primeiro para recuperar a senha.");
      return;
    }
    setSubmitting(true);
    setError("");
    setNotice("");
    const result = await resetPassword(email);
    if (result.ok) setStep("reset-sent");
    else setError(humanizeAuthError(result.error));
    setSubmitting(false);
  }

  async function handleRecovery(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const check = validatePasswordStrength(password);
    if (!check.valid) {
      setError(check.issues.join(" "));
      return;
    }
    if (password !== password2) {
      setError("As senhas nao conferem.");
      return;
    }
    setSubmitting(true);
    setError("");
    const result = await updatePassword(password);
    // Sucesso → passwordRecovery reseta no hook e o App.tsx cai na app.
    if (!result.ok) setError(humanizeAuthError(result.error));
    setSubmitting(false);
  }

  const headline = (() => {
    if (step === "sent") return ["Link", "enviado"];
    if (step === "reset-sent") return ["Email", "enviado"];
    if (step === "recovery") return ["Nova", "senha"];
    return mode === "signin" ? ["Bem-vindo", "de volta"] : ["Crie", "sua conta"];
  })();

  const subtext = (() => {
    if (step === "sent")
      return `Verifique ${email.trim()}. Clique no link da Praxia para entrar — ele expira em 1 hora.`;
    if (step === "reset-sent")
      return `Enviamos um link de recuperacao para ${email.trim()}. Abra-o no mesmo navegador para definir uma nova senha.`;
    if (step === "recovery")
      return "Defina uma nova senha: 8+ caracteres, com ao menos uma letra e um numero.";
    return mode === "signin"
      ? "Entre com seu email e senha. Esqueceu? Recupere o acesso abaixo."
      : "Escolha um email e uma senha (8+ caracteres, com letra e numero) para comecar.";
  })();

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
          onSubmit={step === "recovery" ? handleRecovery : handleSubmit}
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
              {headline[0]}{" "}
              <span style={{ fontStyle: "italic", color: T.gold }}>{headline[1]}</span>.
            </h1>
            <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 32, height: 1, background: T.gold }} />
              <span
                style={{ width: 4, height: 4, background: T.gold, transform: "rotate(45deg)" }}
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
              {subtext}
            </p>
          </div>

          {!isSupabaseConfigured && step === "input" && (
            <div
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                background: "rgba(255,200,92,0.10)",
                border: "0.5px solid rgba(255,200,92,0.32)",
                color: T.warn,
                fontFamily: T.body,
                fontSize: 11.5,
                lineHeight: 1.4,
              }}
            >
              Auth ainda nao configurado neste navegador. Defina <code>VITE_SUPABASE_URL</code> e{" "}
              <code>VITE_SUPABASE_ANON_KEY</code> em <code>.env.local</code>.
            </div>
          )}

          {step === "input" && (
            <>
              {/* Toggle Entrar / Criar conta */}
              <div
                style={{
                  display: "flex",
                  gap: 4,
                  padding: 4,
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.04)",
                  border: `0.5px solid ${T.hairline}`,
                }}
              >
                {(["signin", "signup"] as Mode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setMode(m);
                      resetFeedback();
                    }}
                    style={{
                      flex: 1,
                      height: 36,
                      borderRadius: 999,
                      border: "none",
                      cursor: "pointer",
                      fontFamily: T.body,
                      fontSize: 13,
                      fontWeight: 600,
                      color: mode === m ? "white" : T.ink70,
                      background: mode === m ? accent : "transparent",
                      transition: "background 0.15s",
                    }}
                  >
                    {m === "signin" ? "Entrar" : "Criar conta"}
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <Field
                  label="Email"
                  icon={<Icon.profile size={16} color={T.ink50} />}
                  input={
                    <input
                      id="email"
                      name="email"
                      type="email"
                      value={email}
                      placeholder="voce@email.com"
                      autoFocus
                      autoComplete="email"
                      inputMode="email"
                      onChange={(e) => {
                        setEmail(e.target.value);
                        resetFeedback();
                      }}
                      style={inputStyle()}
                    />
                  }
                />

                <Field
                  label="Senha"
                  icon={<Icon.shield size={16} color={T.ink50} />}
                  input={
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      placeholder="minimo 8 caracteres"
                      autoComplete={mode === "signin" ? "current-password" : "new-password"}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        resetFeedback();
                      }}
                      style={inputStyle()}
                    />
                  }
                  trailing={
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      style={trailingBtnStyle()}
                    >
                      {showPassword ? "ocultar" : "ver"}
                    </button>
                  }
                />

                {mode === "signup" && password.length > 0 && pwCheck.issues.length > 0 && (
                  <PasswordHints issues={pwCheck.issues} />
                )}
                {notice && <NoticeBox text={notice} accent={accent} />}
                {error && <ErrorBox text={error} />}

                {mode === "signin" && (
                  <button
                    type="button"
                    onClick={handleForgot}
                    disabled={submitting}
                    style={linkBtnStyle(T.ink50)}
                  >
                    Esqueci minha senha
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting || !emailValid || !passwordValid || !isSupabaseConfigured}
                style={primaryBtnStyle(
                  accent,
                  submitting || !emailValid || !passwordValid || !isSupabaseConfigured
                )}
              >
                {submitting
                  ? "Aguarde…"
                  : mode === "signin"
                    ? "Entrar"
                    : "Criar conta"}
                {!submitting && emailValid && passwordValid && isSupabaseConfigured && <ArrowDot />}
              </button>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginTop: 2,
                }}
              >
                <span style={{ flex: 1, height: 1, background: T.hairline }} />
                <span style={{ fontFamily: T.body, fontSize: 11, color: T.ink30 }}>ou</span>
                <span style={{ flex: 1, height: 1, background: T.hairline }} />
              </div>

              <button
                type="button"
                onClick={handleMagicLink}
                disabled={submitting || !emailValid || !isSupabaseConfigured}
                style={secondaryBtnStyle(T)}
              >
                Entrar com link magico
              </button>
            </>
          )}

          {step === "recovery" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
              <Field
                label="Nova senha"
                icon={<Icon.shield size={16} color={T.ink50} />}
                input={
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    placeholder="minimo 8 caracteres"
                    autoFocus
                    autoComplete="new-password"
                    onChange={(e) => {
                      setPassword(e.target.value);
                      resetFeedback();
                    }}
                    style={inputStyle()}
                  />
                }
                trailing={
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    style={trailingBtnStyle()}
                  >
                    {showPassword ? "ocultar" : "ver"}
                  </button>
                }
              />
              <Field
                label="Confirmar senha"
                icon={<Icon.shield size={16} color={T.ink50} />}
                input={
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password2}
                    placeholder="repita a senha"
                    autoComplete="new-password"
                    onChange={(e) => {
                      setPassword2(e.target.value);
                      resetFeedback();
                    }}
                    style={inputStyle()}
                  />
                }
              />
              {password.length > 0 && pwCheck.issues.length > 0 && (
                <PasswordHints issues={pwCheck.issues} />
              )}
              {error && <ErrorBox text={error} />}
              <button
                type="submit"
                disabled={submitting || !pwCheck.valid || password !== password2}
                style={primaryBtnStyle(
                  accent,
                  submitting || !pwCheck.valid || password !== password2
                )}
              >
                {submitting ? "Salvando…" : "Salvar nova senha"}
              </button>
            </div>
          )}

          {(step === "sent" || step === "reset-sent") && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 14 }}>
              <div
                style={{
                  padding: "16px 16px",
                  borderRadius: 14,
                  background: `${accent}1f`,
                  border: `0.5px solid ${accent}55`,
                  fontFamily: T.body,
                  fontSize: 13,
                  color: T.ink,
                  lineHeight: 1.5,
                }}
              >
                {step === "sent" ? "Link de acesso enviado" : "Link de recuperacao enviado"} para{" "}
                <b>{email.trim()}</b>. Abra do mesmo navegador para continuar aqui.
              </div>
              <button
                type="button"
                onClick={() => {
                  setStep("input");
                  setError("");
                  setNotice("");
                }}
                style={secondaryBtnStyle(T)}
              >
                Voltar
              </button>
            </div>
          )}

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
            paper trading · sem recomendacao personalizada
          </div>
        </form>
      </div>
    </div>
  );
}

function NoticeBox({ text, accent }: { text: string; accent: string }) {
  const T = PraxiaTokens;
  return (
    <div
      style={{
        marginTop: 2,
        padding: "10px 12px",
        borderRadius: 12,
        background: `${accent}14`,
        border: `0.5px solid ${accent}44`,
        color: T.ink,
        fontFamily: T.body,
        fontSize: 12.5,
        lineHeight: 1.4,
      }}
    >
      {text}
    </div>
  );
}

function PasswordHints({ issues }: { issues: string[] }) {
  const T = PraxiaTokens;
  return (
    <ul
      style={{
        margin: "2px 0 0",
        padding: "8px 12px 8px 26px",
        borderRadius: 12,
        background: "rgba(255,255,255,0.04)",
        border: `0.5px solid ${T.hairline}`,
        color: T.ink70,
        fontFamily: T.body,
        fontSize: 11.5,
        lineHeight: 1.5,
        listStyle: "disc",
      }}
    >
      {issues.map((it) => (
        <li key={it}>{it}</li>
      ))}
    </ul>
  );
}

function ErrorBox({ text }: { text: string }) {
  const T = PraxiaTokens;
  return (
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
      {text}
    </div>
  );
}

function ArrowDot() {
  return (
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

function trailingBtnStyle(): React.CSSProperties {
  return {
    background: "transparent",
    border: "none",
    color: PraxiaTokens.ink50,
    fontFamily: PraxiaTokens.body,
    fontSize: 11.5,
    fontWeight: 600,
    cursor: "pointer",
    padding: 0,
    letterSpacing: 0.2,
  };
}

function linkBtnStyle(color: string): React.CSSProperties {
  return {
    alignSelf: "flex-start",
    background: "transparent",
    border: "none",
    color,
    fontFamily: PraxiaTokens.body,
    fontSize: 12.5,
    fontWeight: 500,
    cursor: "pointer",
    padding: "2px 0",
    textDecoration: "underline",
    textUnderlineOffset: 3,
  };
}

function primaryBtnStyle(accent: string, disabled: boolean): React.CSSProperties {
  const T = PraxiaTokens;
  return {
    marginTop: 6,
    height: 54,
    borderRadius: 999,
    background: disabled ? "rgba(255,255,255,0.08)" : accent,
    color: disabled ? "rgba(255,255,255,0.4)" : "white",
    border: "none",
    fontFamily: T.display,
    fontWeight: 600,
    fontSize: 15,
    cursor: disabled ? "not-allowed" : "pointer",
    boxShadow: disabled ? "none" : `0 16px 36px ${accent}55`,
    letterSpacing: -0.1,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  };
}

function secondaryBtnStyle(T: typeof PraxiaTokens): React.CSSProperties {
  return {
    height: 48,
    borderRadius: 999,
    background: "rgba(255,255,255,0.05)",
    color: T.ink70,
    border: `0.5px solid ${T.hairline}`,
    fontFamily: T.body,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  };
}
