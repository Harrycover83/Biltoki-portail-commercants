# Biltoki Pennylane Sync Backend

Node.js backend service for syncing charges from Pennylane to Supabase database.

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
   HALL_ID=<uuid>                                      # From Supabase > public.halls
   ```

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Run in development:**
   ```bash
   npm run dev
   ```

## Available Commands

- `npm run dev` - Start with hot reload
- `npm run build` - Build TypeScript
- `npm start` - Run compiled version
- `npm test` - Run tests
- `npm run lint` - Lint code

## API Endpoints

### POST /api/sync/pennylane
Trigger a manual sync.

```bash
curl -X POST http://localhost:3000/api/sync/pennylane
```

Response:
```json
{
  "syncId": "sync_1692048000000_abc123",
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

### GET /health
Health check (used by Railway).

```bash
curl http://localhost:3000/health
```

## Cron Schedule

By default, sync runs at **2:00 AM every day** (can be changed via `SYNC_CRON_SCHEDULE` env var).

Cron format: `minute hour day month dayOfWeek`

Examples:
- `0 2 * * *` - Every day at 2:00 AM
- `0 */4 * * *` - Every 4 hours
- `0 10 * * 1` - Every Monday at 10:00 AM

## Deployment on Railway

1. **Push to GitHub**
2. **Connect repo to Railway:**
   ```bash
   railway link
   railway up
   ```
3. **Set environment variables in Railway dashboard:**
   - Copy values from `.env`
4. **Railway automatically:**
   - Detects Node.js
   - Runs `npm install`
   - Runs `npm run build`
   - Starts with `npm start`

## Replacing Mock Pennylane Client

When you have the real API key:

1. Update `.env`:
   ```env
   PENNYLANE_API_KEY=sk_live_...
   ```

2. Replace `getMockServiceCharges()` in `src/integrations/pennylane/client.ts` with real HTTP calls:
   ```typescript
   async fetchServiceCharges(hallId: string): Promise<PennylaneServiceChargesResponse> {
     const response = await fetch(`${this.apiUrl}/v1/service-charges?hall=${hallId}`, {
       headers: { 'Authorization': `Bearer ${this.apiKey}` }
     })
     return response.json()
   }
   ```

3. Test locally, then deploy.

## Troubleshooting

### "Missing environment variable"
Make sure all required vars in `.env` are set.

### "No active service charge period found"
You need at least one `service_charge_periods` entry in Supabase for today's date.

### "No merchants found"
Make sure merchants are created in Supabase with the correct `hall_id`.

### Sync never runs
Check Railway logs. Make sure `SYNC_CRON_SCHEDULE` is valid.

## Logs

Logs stream to stdout in JSON format. Use Railway dashboard or:

```bash
railway logs --follow
```

## Architecture Diagram

```
Pennylane API (or mock)
        ↓
  PennylaneClient
        ↓
  PennylaneSync Service
        ↓
  Supabase Database
  ├─ service_charges (upserted)
  ├─ allocations (recalculated)
  └─ pennylane_syncs (tracked)
        ↓
  Frontend reads via Supabase RLS Policies
```
