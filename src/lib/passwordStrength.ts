/**
 * Validação de força de senha — defesa-em-profundidade no client.
 *
 * A fonte de verdade da segurança de senha é o Supabase Auth (bcrypt + salt +
 * leaked-password protection no painel). Esta validação só dá feedback claro
 * antes de mandar a senha pra rede e evita criar conta com senha trivial.
 *
 * Regras (todas devem passar): ≥8 caracteres, ≥1 letra, ≥1 dígito. Sem exigir
 * símbolo/maiúscula de propósito (entropia real fica com a proteção de senha
 * vazada do Supabase).
 */

export const MIN_PASSWORD_LENGTH = 8;

export interface PasswordCheck {
  valid: boolean;
  /** Mensagens em PT-BR das regras quebradas, na ordem: comprimento, letra, dígito. */
  issues: string[];
}

export function validatePasswordStrength(password: string): PasswordCheck {
  const issues: string[] = [];

  if (password.length < MIN_PASSWORD_LENGTH) {
    issues.push(`Use pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  }
  if (!/\p{L}/u.test(password)) {
    issues.push("Inclua pelo menos uma letra.");
  }
  if (!/\d/.test(password)) {
    issues.push("Inclua pelo menos um número.");
  }

  return { valid: issues.length === 0, issues };
}
