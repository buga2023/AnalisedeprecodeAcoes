/**
 * Humaniza mensagens de erro de auth do Supabase (que vem em ingles e tecnicas)
 * para portugues claro, na voz do app. Mensagens nao mapeadas sao repassadas
 * como estao — melhor mostrar algo especifico do que esconder.
 */

const MIN_PASSWORD = 8;

export function humanizeAuthError(raw: string): string {
  const msg = raw.trim();
  if (!msg) return "Nao foi possivel concluir. Tente de novo.";

  const lower = msg.toLowerCase();

  if (lower.includes("invalid login credentials")) {
    return "Email ou senha incorretos.";
  }
  if (lower.includes("already registered")) {
    return "Este email ja tem uma conta. Use “Entrar”.";
  }
  if (lower.includes("email not confirmed")) {
    return "Confirme seu email antes de entrar.";
  }
  if (lower.includes("password should be at least")) {
    return `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`;
  }
  if (lower.includes("unable to validate email") || lower.includes("invalid email")) {
    return "Email invalido.";
  }
  if (lower.includes("for security purposes") || lower.includes("rate limit")) {
    return "Muitas tentativas. Aguarde alguns segundos e tente de novo.";
  }
  if (lower.includes("failed to fetch") || lower.includes("network")) {
    return "Sem conexao com o servidor. Verifique sua internet e tente de novo.";
  }

  return msg;
}
