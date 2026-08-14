export const PASSWORD_POLICY_MIN_LENGTH = 12

export function validatePasswordPolicy(password: string): string | null {
  if (password.length < PASSWORD_POLICY_MIN_LENGTH) {
    return `Le mot de passe doit contenir au moins ${PASSWORD_POLICY_MIN_LENGTH} caracteres.`
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
