import { useState } from "react";
import { PraxiaTokens } from "../tokens";
import { PraxiaBackground } from "../PraxiaBackground";
import { PraxiaCard } from "../PraxiaCard";
import { SectionHeader } from "../SectionHeader";
import { Icon } from "../Icon";
import { useAuth } from "@/hooks/useAuth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { erasePraxiaLocalKeys } from "@/lib/localKeys";

/**
 * Tela "Excluir minhas informações" — LGPD Art. 18.
 *
 * Fluxo:
 * 1. Se o usuario estiver autenticado em Supabase, chama POST /api/delete-account
 *    com Bearer <access_token>. O servidor apaga todas as linhas vinculadas
 *    (portfolio_stocks, transactions, profiles, preferences) e deleta o auth.user.
 * 2. Independente do resultado (servidor configurado ou nao), limpa localStorage
 *    do dispositivo — chaves canonicas + prefixos dinamicos.
 * 3. Avisa o caller (App.tsx) que pode resetar a UI pro onboarding.
 *
 * Mantemos a operacao localStorage SEMPRE — mesmo se o servidor tiver
 * problemas, o usuario tem garantia de que os dados deste dispositivo sumiram.
 */

interface ScreenDeleteAccountProps {
  accent?: string;
  onBack: () => void;
  /** Acionado após o erase — App.tsx volta pro onboarding/login. */
  onErased: () => void;
}

async function eraseOnServer(accessToken: string): Promise<{ ok: boolean; partial: boolean; error?: string }> {
  try {
    const res = await fetch("/api/delete-account", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (res.status === 200) {
      return { ok: true, partial: false };
    }
    if (res.status === 207) {
      // Sucesso parcial: dados apagados mas auth.user nao.
      return { ok: true, partial: true };
    }
    const body = await res.json().catch(() => ({}));
    return { ok: false, partial: false, error: body.error || `HTTP ${res.status}` };
  } catch (err) {
    return {
      ok: false,
      partial: false,
      error: err instanceof Error ? err.message : "Rede indisponivel.",
    };
  }
}

export function ScreenDeleteAccount({ accent, onBack, onErased }: ScreenDeleteAccountProps) {
  const T = PraxiaTokens;
  const { session, isAuthenticated } = useAuth();
  const accentColor = accent || T.accent;
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverWarning, setServerWarning] = useState<string | null>(null);

  async function handleErase() {
    if (!confirmed || busy) return;
    setBusy(true);
    setServerWarning(null);

    // 1) Tenta apagar no servidor se logado em Supabase.
    if (isSupabaseConfigured && isAuthenticated && session?.access_token) {
      const result = await eraseOnServer(session.access_token);
      if (!result.ok) {
        setServerWarning(
          `Não foi possível remover do servidor (${result.error}). ` +
            "Os dados deste dispositivo serão apagados mesmo assim."
        );
      } else if (result.partial) {
        setServerWarning(
          "Seus dados foram removidos, mas a conta de login ainda existe no servidor. " +
            "Contate o suporte se isso for crítico."
        );
      }
      // Garante que session local nao volte com os dados antigos.
      await supabase.auth.signOut().catch(() => {});
    }

    // 2) Sempre apaga o localStorage local — isto e garantido para o usuario.
    const removidos = erasePraxiaLocalKeys();

    // Pequeno delay pra o usuário ver o estado mudar antes do redirect.
    window.setTimeout(() => {
      onErased();
      console.info(`[lgpd] Excluído. Chaves removidas: ${removidos}`);
    }, 350);
  }

  return (
    <div style={{ position: "relative", paddingBottom: 40 }}>
      <PraxiaBackground accent={accentColor} />

      <div style={{ position: "relative", zIndex: 1, padding: "24px 20px 12px" }}>
        <button
          onClick={onBack}
          aria-label="Voltar"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "transparent",
            border: "none",
            color: T.ink70,
            fontFamily: T.body,
            fontSize: 12.5,
            cursor: "pointer",
            padding: 0,
            marginBottom: 18,
          }}
        >
          <Icon.arrowLeft size={14} color={T.ink70} />
          Voltar
        </button>

        <div
          style={{
            fontFamily: T.mono,
            fontSize: 10.5,
            color: T.ink50,
            letterSpacing: 0.6,
            marginBottom: 6,
          }}
        >
          LGPD ART. 18
        </div>
        <SectionHeader label="Excluir minhas informações" />
      </div>

      <div style={{ padding: "0 20px 24px", position: "relative", zIndex: 1 }}>
        <PraxiaCard>
          <p
            style={{
              margin: 0,
              fontFamily: T.body,
              fontSize: 13.5,
              color: T.ink70,
              lineHeight: 1.55,
            }}
          >
            Esta ação apaga <b style={{ color: T.ink }}>permanentemente</b> tudo que o
            Praxia guarda no seu dispositivo: portfólio, perfil de investidor, transações
            simuladas, conversas com a Pra, alertas, caches de IA, preferências visuais e
            consentimento LGPD.
            {isAuthenticated && isSupabaseConfigured && (
              <>
                {" "}Também <b style={{ color: T.ink }}>remove sua conta e todos os dados
                sincronizados no servidor</b> (carteira, transações, perfil, preferências).
              </>
            )}
          </p>

          <p
            style={{
              marginTop: 12,
              fontFamily: T.body,
              fontSize: 12.5,
              color: T.ink50,
              lineHeight: 1.5,
            }}
          >
            Não é possível reverter. Você precisará fazer o onboarding de novo se quiser
            continuar usando o Praxia depois.
          </p>

          <label
            style={{
              marginTop: 18,
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontFamily: T.body,
              fontSize: 13,
              color: T.ink70,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              aria-label="Confirmar exclusão"
              style={{
                accentColor: T.down,
                width: 16,
                height: 16,
                cursor: "pointer",
              }}
            />
            Entendo que esta ação é permanente.
          </label>

          <button
            onClick={() => void handleErase()}
            disabled={!confirmed || busy}
            style={{
              marginTop: 16,
              width: "100%",
              padding: "13px 16px",
              borderRadius: 999,
              background: !confirmed || busy ? "rgba(200,115,113,0.18)" : T.down,
              color: !confirmed || busy ? "rgba(255,255,255,0.5)" : "white",
              border: "none",
              fontFamily: T.display,
              fontSize: 14,
              fontWeight: 600,
              cursor: !confirmed || busy ? "not-allowed" : "pointer",
              letterSpacing: -0.1,
              boxShadow: !confirmed || busy ? "none" : `0 10px 24px ${T.down}33`,
            }}
          >
            {busy
              ? "Excluindo…"
              : isAuthenticated && isSupabaseConfigured
              ? "Excluir minha conta e todos os dados"
              : "Excluir tudo do meu dispositivo"}
          </button>

          {serverWarning && (
            <div
              style={{
                marginTop: 12,
                padding: "10px 12px",
                borderRadius: 10,
                background: `${T.warn}1a`,
                border: `0.5px solid ${T.warn}55`,
                fontFamily: T.body,
                fontSize: 12,
                color: T.ink70,
                lineHeight: 1.5,
              }}
            >
              {serverWarning}
            </div>
          )}
        </PraxiaCard>
      </div>
    </div>
  );
}
