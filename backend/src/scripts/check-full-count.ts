import dotenv from 'dotenv'
dotenv.config()

import { PennylaneClient, PENNYLANE_API_URL } from '../integrations/pennylane/client.js'
import { createLogger } from '../utils/logger.js'
import type { Config } from '../config.js'

async function main() {
  const logger = createLogger({
    logging: { level: 'error' },
    server: { nodeEnv: 'development' },
  } as Config)
  const client = new PennylaneClient(process.env.PENNYLANE_API_KEY!, PENNYLANE_API_URL, logger)

  const all = await client.listSupplierInvoices({ categoryIds: [9229710], maxItems: 5000 })
  console.log('raw invoices matching category 9229710 (all statuses, no date filter):', all.length)

  const byStatus = new Map<string, number>()
  for (const inv of all) {
    byStatus.set(inv.accounting_status, (byStatus.get(inv.accounting_status) ?? 0) + 1)
  }
  console.log('by status:', Object.fromEntries(byStatus))

  const dates = all.map((i) => i.date).filter(Boolean).sort()
  console.log('earliest date:', dates[0])
  console.log('latest date:', dates[dates.length - 1])
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
