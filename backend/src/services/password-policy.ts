export const PASSWORD_MIN_LENGTH = 12

/** Server-side password policy (mirrors the one shown in the browser). Returns an error message or null. */
export function validatePassword(password: unknown): string | null {
  if (typeof password !== 'string' || password.length > 128) {
    return 'Mot de passe invalide.'
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caracteres.`
  }
  if (!/[a-z]/.test(password)) {
    return 'Le mot de passe doit contenir au moins une lettre minuscule.'
  }
  if (!/[A-Z]/.test(password)) {
    return 'Le mot de passe doit contenir au moins une lettre majuscule.'
  }
  if (!/[0-9]/.test(password)) {
    return 'Le mot de passe doit contenir au moins un chiffre.'
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'Le mot de passe doit contenir au moins un caractere special.'
  }
  return null
}
