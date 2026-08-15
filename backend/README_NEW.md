# Biltoki Pennylane Sync Backend

Node.js backend service for syncing charges from Pennylane to Supabase database.

**Features:**
- ✅ Multi-hall support (sync Toulon, Marseille, Lyon, etc. from one backend)
- ✅ Nightly cron scheduler (2 AM by default)
- ✅ Idempotent upserts (no duplicates)
- ✅ Simple transparency tool (charges only, no auto-allocation)
- ✅ Mock Pennylane client included (real API in 10 days)

---

## Quick Start

### Prerequisites
- Node.js 20+
- Supabase project configured
- Environment variables set

### Setup

1. **Copy environment template:**
   ```bash
   cp .env.example .env
   ```

2. **Fill in required vars:**
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...                # From Supabase > Settings > API Keys
   HALLS_TO_SYNC=uuid-toulon,uuid-marseille            # Comma-separated hall UUIDs
   ```

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Run in development:**
   ```bash
   npm run dev
   ```

---

## Available Commands

- `npm run dev` - Start with hot reload
- `npm run build` - Build TypeScript
- `npm start` - Run compiled version
- `npm test` - Run tests
- `npm run lint` - Lint code

---

## API Endpoints

### POST /api/sync/pennylane/:hallId
Trigger a manual sync for a specific hall.

```bash
curl -X POST http://localhost:3000/api/sync/pennylane/uuid-toulon
```

Response:
```json
{
  "syncId": "sync_1692048000000_abc123",
  "hallId": "uuid-toulon",
  "status": "success",
  "recordsProcessed": 5,
  "errors": []
}
```

### GET /api/sync/pennylane/:syncId
Check sync status.

```bash
curl http://localhost:3000/api/sync/pennylane/sync_1692048000000_abc123
```

### GET /api/halls
List all configured halls.

```bash
curl http://localhost:3000/api/halls
```

### GET /health
Health check (used by Railway).

```bash
curl http://localhost:3000/health
```

---

## Multi-Hall Configuration

Set `HALLS_TO_SYNC` with comma-separated hall UUIDs:

```env
# Example: Sync 3 Biltoki halls
HALLS_TO_SYNC=uuid-toulon,uuid-marseille,uuid-lyon
```

Each night at 2 AM:
1. Loop through all configured halls
2. Fetch charges from Pennylane for each hall
3. Upsert into `service_charges` (deduplicated by `pennylane_id`)
4. Track each sync in `pennylane_syncs` table

---

## Cron Schedule

By default, sync runs at **2:00 AM every day** (configurable via `SYNC_CRON_SCHEDULE`).

Cron format: `minute hour day month dayOfWeek`

Examples:
- `0 2 * * *` - Every day at 2:00 AM
- `0 */4 * * *` - Every 4 hours
- `0 10 * * 1` - Every Monday at 10:00 AM

---

## Deployment on Railway

1. **Connect repo to Railway:**
   ```bash
   railway link
   railway up
   ```

2. **Set environment variables in Railway dashboard:**
   - Copy values from `.env`

3. **Railway automatically:**
   - Detects Node.js
   - Runs `npm install`
   - Runs `npm run build`
   - Starts with `npm start`

---

## Database Schema

### service_charges
```sql
id              uuid PRIMARY KEY
hall_id         uuid (which hall)
period_id       uuid (which month)
pennylane_id    text (external reference, unique per hall)
label           text (ex: "Nettoyage")
category        text (ex: "operations")
amount_excl_tax decimal
amount_tax      decimal
amount_incl_tax decimal (what to display)
source          text = 'pennylane'
created_at      timestamptz
```

### service_charge_periods
```sql
id              uuid PRIMARY KEY
hall_id         uuid
label           text (ex: "Août 2026")
period_start    date
period_end      date
status          text
created_at      timestamptz
```

### pennylane_syncs
```sql
id              uuid PRIMARY KEY
hall_id         uuid
sync_type       text = 'service_charges'
status          text ('running', 'success', 'error')
started_at      timestamptz
completed_at    timestamptz
records_processed integer
error_message   text
created_at      timestamptz
```

---

## Sync Flow

**Each cron night (2 AM):**

```
For each hall in HALLS_TO_SYNC:
  ├─ Fetch charges from Pennylane
  ├─ Get current service_charge_period
  ├─ For each Pennylane charge:
  │   └─ Upsert into service_charges
  │       (conflict key: hall_id, pennylane_id)
  └─ Log sync record
```

**Idempotency:**
- Same `pennylane_id` = update amounts if changed
- No duplicates even if sync runs multiple times

---

## Replacing Mock with Real Pennylane API

**When you have PENNYLANE_API_KEY (in ~10 days):**

1. Update `.env`:
   ```env
   PENNYLANE_API_KEY=sk_live_...
   ```

2. Replace mock in `src/integrations/pennylane/client.ts`:
   ```typescript
   async fetchServiceCharges(hallId: string) {
     const response = await fetch(
       `${this.apiUrl}/v1/charges?hall_id=${hallId}`,
       { headers: { 'Authorization': `Bearer ${this.apiKey}` } }
     )
     return response.json()
   }
   ```

3. Test locally, deploy to Railway.

**No other code changes needed!**

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "HALLS_TO_SYNC must contain at least one hall" | Set comma-separated UUIDs in `.env` |
| "Hall not in configured sync list" | Check hallId parameter matches HALLS_TO_SYNC |
| "No active service charge period found" | Create a `service_charge_periods` entry for today's hall |
| Sync never runs | Check Railway logs, verify cron syntax |

---

## Logging

**Local:**
```bash
npm run dev
# See logs in terminal
```

**Railway:**
```bash
railway logs --follow
```

---

## Frontend Integration (Next Steps)

Once backend is deployed:

1. **ChargesPage** - Display `service_charges` for merchant's hall
2. **Period filter** - Show charges by month
3. **Detail view** - Each line item + total
4. **Admin filter** - Dropdown to select hall
5. **RLS policies** - Merchants see only their hall

---

**Ready to deploy!** 🚀
