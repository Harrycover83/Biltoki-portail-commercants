import { PennylaneClient } from './client'

export function getPennylaneClientFromServerEnv() {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
  const apiKey = env?.PENNYLANE_API_KEY
  const baseUrl = env?.PENNYLANE_BASE_URL

  if (!apiKey || !baseUrl) {
    throw new Error('PENNYLANE_API_KEY et PENNYLANE_BASE_URL doivent être définies côté serveur')
  }

  return new PennylaneClient(apiKey, baseUrl)
}
