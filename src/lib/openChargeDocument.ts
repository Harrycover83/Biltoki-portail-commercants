import { getBackendUrl } from './env'
import { getAccessToken } from './session'

/**
 * Opens the Pennylane source document of a charge in a new tab.
 * Must be called straight from a click handler (the tab is opened before any await so popup
 * blockers allow it). Returns an error message, or null on success.
 */
export async function openChargeDocument(chargeId: string): Promise<string | null> {
  const backendUrl = getBackendUrl()
  if (!backendUrl) {
    return 'Service de documents non configure.'
  }

  const documentWindow = window.open('', '_blank')
  if (!documentWindow) {
    return 'Autorisez les fenêtres pop-up pour ouvrir le justificatif.'
  }

  try {
    const token = await getAccessToken()
    if (!token) {
      throw new Error('Session introuvable, reconnectez-vous.')
    }

    const response = await fetch(`${backendUrl}/api/service-charges/${encodeURIComponent(chargeId)}/document`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      throw new Error(body?.error ?? `Justificatif indisponible (HTTP ${response.status})`)
    }

    const documentUrl = URL.createObjectURL(await response.blob())
    documentWindow.location.replace(documentUrl)
    window.setTimeout(() => URL.revokeObjectURL(documentUrl), 60_000)
    return null
  } catch (error) {
    documentWindow.close()
    return error instanceof Error ? error.message : 'Justificatif indisponible.'
  }
}
