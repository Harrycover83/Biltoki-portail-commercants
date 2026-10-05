export type HallCategoryMapping = {
  /** Pennylane analytical category that carries the "charges communes" of the hall. */
  categoryId: number
  /** Label stored on imported charges. */
  label: string
}

export type HallCategoryMap = Record<string, HallCategoryMapping>

/**
 * Built-in mapping of Biltoki hall UUIDs to Pennylane analytical categories.
 * One Pennylane token covers one company, so only halls whose invoices live in that company can be mapped.
 * Additional halls are declared through PENNYLANE_HALL_CATEGORIES (JSON) without touching the code.
 */
export const DEFAULT_HALL_CATEGORIES: HallCategoryMap = {
  '29a1b758-07c9-481e-bd54-c72b6a9949c4': { categoryId: 9229710, label: '4105' }, // Halles de Toulon
}

function isMapping(value: unknown): value is HallCategoryMapping {
  if (!value || typeof value !== 'object') {
    return false
  }
  const { categoryId, label } = value as Record<string, unknown>
  return Number.isInteger(categoryId) && (categoryId as number) > 0 && typeof label === 'string' && label.length > 0
}

/**
 * Parses PENNYLANE_HALL_CATEGORIES, e.g. {"<hall-uuid>": {"categoryId": 123, "label": "4105"}}.
 * Entries override the built-in mapping for the same hall.
 */
export function parseHallCategories(raw: string): HallCategoryMap {
  if (!raw.trim()) {
    return {}
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('PENNYLANE_HALL_CATEGORIES must be valid JSON')
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('PENNYLANE_HALL_CATEGORIES must be an object keyed by hall UUID')
  }

  for (const [hallId, mapping] of Object.entries(parsed)) {
    if (!isMapping(mapping)) {
      throw new Error(`PENNYLANE_HALL_CATEGORIES: invalid mapping for hall ${hallId} (expected categoryId and label)`)
    }
  }

  return parsed as HallCategoryMap
}
