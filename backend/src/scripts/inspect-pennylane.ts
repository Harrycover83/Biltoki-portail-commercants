/**
 * Read-only exploration of a Pennylane company account.
 *
 * Answers three questions before we commit to a sync mapping:
 *   1. Which company does this token actually open?
 *   2. How is the account structured (analytical category groups / categories)?
 *   3. What do the supplier invoices look like, and are they the "frais" we want?
 *
 * Writes nothing, neither to Pennylane nor to Supabase.
 *
 * Usage:
 *   npm run pennylane:inspect                 # last 90 days, 50 invoices
 *   npm run pennylane:inspect -- --days 365 --limit 200
 *   npm run pennylane:inspect -- --json > pennylane-snapshot.json
 */

import dotenv from 'dotenv'
import type { Config } from '../config.js'
import { PennylaneClient, PENNYLANE_API_URL } from '../integrations/pennylane/client.js'
import { createLogger } from '../utils/logger.js'

dotenv.config()

type Args = { days: number; limit: number; json: boolean }

function parseArgs(): Args {
  const argv = process.argv.slice(2)
  const read = (flag: string, fallback: number): number => {
    const index = argv.indexOf(flag)
    if (index === -1) {
      return fallback
    }
    const value = Number(argv[index + 1])
    return Number.isFinite(value) && value > 0 ? value : fallback
  }

  return {
    days: read('--days', 90),
    limit: read('--limit', 50),
    json: argv.includes('--json'),
  }
}

function isoDaysAgo(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString().slice(0, 10)
}

function euros(value: string | null | undefined): number {
  return Number(value ?? 0)
}

function formatEuros(value: number): string {
  return value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
}

async function main() {
  const args = parseArgs()
  const apiKey = process.env.PENNYLANE_API_KEY
  const apiUrl = process.env.PENNYLANE_API_URL || PENNYLANE_API_URL

  if (!apiKey) {
    console.error('PENNYLANE_API_KEY is not set. Add it to backend/.env before running this script.')
    process.exit(1)
  }

  // Silence the client logger unless something goes wrong: this script owns the output.
  const logger = createLogger({
    logging: { level: 'error' },
    server: { nodeEnv: 'development' },
  } as Config)
  const client = new PennylaneClient(apiKey, apiUrl, logger)

  const from = isoDaysAgo(args.days)
  const to = new Date().toISOString().slice(0, 10)

  const me = await client.getMe()
  const [groups, categories] = await Promise.all([
    client.listCategoryGroups().catch(() => []),
    client.listCategories().catch(() => []),
  ])

  const invoices = await client.listSupplierInvoices({ from, to, maxItems: args.limit })

  // Analytical categories live on a separate endpoint, one call per invoice.
  const invoiceCategories = new Map<number, string[]>()
  for (const invoice of invoices) {
    try {
      const linked = await client.listSupplierInvoiceCategories(invoice.id)
      invoiceCategories.set(
        invoice.id,
        linked.map((category) => `${category.label ?? category.id} (${category.weight})`),
      )
    } catch {
      invoiceCategories.set(invoice.id, [])
    }
  }

  if (args.json) {
    console.log(
      JSON.stringify(
        {
          me,
          categoryGroups: groups,
          categories,
          window: { from, to },
          invoices: invoices.map((invoice) => ({
            ...invoice,
            linkedCategories: invoiceCategories.get(invoice.id) ?? [],
          })),
        },
        null,
        2,
      ),
    )
    return
  }

  console.log('\n=== COMPTE ===')
  console.log(`Societe    : ${me.company?.name ?? 'inconnue'} (id ${me.company?.id ?? '?'})`)
  console.log(`Reg. no    : ${me.company?.reg_no ?? '-'}`)
  console.log(`Utilisateur: ${me.user?.email ?? '?'} (${me.user?.first_name ?? ''} ${me.user?.last_name ?? ''})`)
  console.log(`API        : ${apiUrl}`)

  console.log(`\n=== AXES ANALYTIQUES (${groups.length} groupes / ${categories.length} categories) ===`)
  if (groups.length === 0 && categories.length === 0) {
    console.log('Aucune categorie analytique. Les halles ne sont donc pas modelisees par axe analytique.')
  }
  for (const group of groups) {
    const members = categories.filter((category) => category.category_group?.id === group.id)
    console.log(`\n[${group.id}] ${group.name} — ${members.length} categorie(s)`)
    for (const member of members) {
      console.log(`    - [${member.id}] ${member.label}`)
    }
  }
  const orphans = categories.filter((category) => !category.category_group)
  if (orphans.length > 0) {
    console.log('\nSans groupe:')
    for (const orphan of orphans) {
      console.log(`    - [${orphan.id}] ${orphan.label}`)
    }
  }

  console.log(`\n=== FACTURES FOURNISSEURS du ${from} au ${to} (${invoices.length}) ===`)
  for (const invoice of invoices) {
    const linked = invoiceCategories.get(invoice.id) ?? []
    console.log(
      [
        invoice.date ?? '????-??-??',
        formatEuros(euros(invoice.amount)).padStart(12),
        `TVA ${formatEuros(euros(invoice.tax))}`.padStart(16),
        invoice.accounting_status.padEnd(17),
        (invoice.label ?? invoice.invoice_number).slice(0, 40).padEnd(40),
        linked.length > 0 ? `cat: ${linked.join(', ')}` : 'cat: -',
      ].join(' | '),
    )
  }

  const totalInclTax = invoices.reduce((sum, invoice) => sum + euros(invoice.amount), 0)
  const byMonth = new Map<string, number>()
  const byStatus = new Map<string, number>()
  for (const invoice of invoices) {
    const month = (invoice.date ?? '????-??').slice(0, 7)
    byMonth.set(month, (byMonth.get(month) ?? 0) + euros(invoice.amount))
    byStatus.set(invoice.accounting_status, (byStatus.get(invoice.accounting_status) ?? 0) + 1)
  }

  console.log('\n=== SYNTHESE ===')
  console.log(`Total TTC sur la periode : ${formatEuros(totalInclTax)}`)
  console.log(`Factures sans categorie  : ${invoices.filter((i) => (invoiceCategories.get(i.id) ?? []).length === 0).length}`)
  console.log(`Statuts                  : ${[...byStatus].map(([key, count]) => `${key}=${count}`).join(', ')}`)
  console.log('Par mois:')
  for (const [month, total] of [...byMonth].sort()) {
    console.log(`    ${month}  ${formatEuros(total)}`)
  }
  console.log('')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
