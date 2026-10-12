import dotenv from 'dotenv'
import { PopinaClient } from '../integrations/popina/client.js'
import { addDays, compareRevenue, parisDate, previousYear } from '../integrations/popina/revenue.js'

dotenv.config({ path: '.env.local' })
dotenv.config()

async function main() {
  const client = new PopinaClient(process.env.POPINA_API_KEY ?? '')
  const location = await client.getLocation()
  console.log(JSON.stringify({ location }, null, 2))
  console.log('Vérifiez que cet établissement est bien Toulon avant de configurer POPINA_LOCATION_ID avec son id.')
  if (process.argv.includes('--revenue')) {
    if (process.env.POPINA_LOCATION_ID !== location.id) throw new Error('POPINA_LOCATION_ID does not match the API key')
    const until = addDays(parisDate(new Date()), -1)
    const since = `${until.slice(0, 7)}-01`
    const previousSince = previousYear(since)
    const previousUntil = previousYear(until) ?? addDays(`${Number(until.slice(0, 4)) - 1}-03-01`, -1)
    if (!previousSince) throw new Error('Invalid previous period')
    const [current, previous] = await Promise.all([
      client.getReports(addDays(since, -1), addDays(until, 1), location.id),
      client.getReports(addDays(previousSince, -1), addDays(previousUntil, 1), location.id),
    ])
    console.log(JSON.stringify(compareRevenue(since, until, current, previous), null, 2))
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Popina inspection failed')
  process.exitCode = 1
})
