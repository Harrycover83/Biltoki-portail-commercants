# Backend Pennylane Sync - Technologie & Plan

## Stack
- **Runtime:** Node.js 20 (LTS)
- **Framework:** Express.js
- **Database:** Supabase (PostgreSQL)
- **Scheduler:** node-cron (nightly)
- **Language:** TypeScript
- **Hosting:** Railway
- **Client Library:** @supabase/supabase-js (Admin SDK)

---

## Architecture

### Directory Structure
```
backend/
├── src/
│   ├── main.ts                 # Entry point
│   ├── server.ts               # Express app
│   ├── config.ts               # Env vars
│   ├── scheduler.ts            # Cron jobs
│   ├── integrations/
│   │   └── pennylane/
│   │       ├── client.ts       # Mock Pennylane API
│   │       └── types.ts        # Type defs
│   ├── services/
│   │   └── sync.service.ts     # Sync logic
│   ├── db/
│   │   └── supabase.ts         # Supabase client
│   └── utils/
│       └── logger.ts           # Logging
├── package.json
├── tsconfig.json
├── Dockerfile (Railway)
└── README.md
```

---

## Environment Variables

```env
# Supabase (required)
VITE_SUPABASE_URL=https://ocgesbspdhxisnrzotfx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Pennylane (when available)
PENNYLANE_API_KEY=sk_live_...     # Will replace mock later
PENNYLANE_API_URL=https://api.pennylane.io

# Server
NODE_ENV=production
PORT=3000

# Biltoki config
HALL_ID=<uuid-toulon>              # Fixed Hall Toulon
SYNC_CRON_SCHEDULE=0 2 * * *      # Every day at 2 AM

# Logging
LOG_LEVEL=info
```

---

## API Endpoints

### POST /api/sync/pennylane
```
Trigger sync manually (for testing/admin)

Request: 
  (empty body, hall_id from env)

Response 200:
  {
    "syncId": "uuid",
    "status": "running|success|error",
    "recordsProcessed": 15,
    "errors": []
  }
```

### GET /api/sync/pennylane/:syncId
```
Check sync status

Response 200:
  {
    "id": "uuid",
    "status": "success",
    "startedAt": "2026-08-14T02:00:00Z",
    "completedAt": "2026-08-14T02:03:45Z",
    "recordsProcessed": 15
  }
```

### GET /health
```
Health check (used by Railway)

Response 200:
  { "status": "ok" }
```

---

## Sync Flow

### Phase 1: Fetch Pennylane
```typescript
const charges = await pennylaneClient.fetchServiceCharges(HALL_ID);
// Mock returns: [{id, label, amount, taxAmount, ...}, ...]
```

### Phase 2: Upsert Charges
```typescript
// Upsert on (hall_id, pennylane_id)
for (const charge of charges) {
  const existing = await db.service_charges
    .where({ hall_id, pennylane_id: charge.id })
    .first();

  if (existing) {
    // Update if amount changed
    await db.service_charges.update(existing.id, {
      label: charge.label,
      amount_excl_tax: charge.amountExclTax,
      amount_tax: charge.taxAmount,
      amount_incl_tax: charge.amountInclTax,
    });
  } else {
    // Create new
    await db.service_charges.insert({
      hall_id,
      period_id,
      label: charge.label,
      pennylane_id: charge.id,
      amount_excl_tax: charge.amountExclTax,
      amount_tax: charge.taxAmount,
      amount_incl_tax: charge.amountInclTax,
      source: 'pennylane',
    });
  }
}
```

### Phase 3: Calculate & Upsert Allocations
```typescript
// For each charge:
const merchants = await db.merchants.where({ hall_id }).all();
const stands = await db.stands.where({ hall_id }).all();

const allocation = calculateAllocations(
  chargeAmountCents,
  merchants.map(m => ({
    merchantId: m.id,
    linearMetersMilli: getActiveMeterageForMerchant(m, stands, period) * 1000,
  }))
);

for (const result of allocation.results) {
  const merchant = merchants.find(m => m.id === result.merchantId);
  await db.allocations.upsert({
    period_id,
    service_charge_id: charge.id,
    merchant_id: result.merchantId,
    stand_id: merchant.activeStand.id,
    allocation_percentage: result.allocationBps / 10000,
    allocated_amount: result.allocatedCents / 100,
  });
}
```

### Phase 4: Log Sync
```typescript
await db.pennylane_syncs.insert({
  hall_id,
  sync_type: 'service_charges',
  status: 'success',
  records_processed: chargesCount,
});
```

---

## Idempotency

**Key:** Service charges identified by `(hall_id, pennylane_id)`

**If sync runs twice:**
1. First run: Create 15 charges
2. Second run: Detects same `pennylane_id`, updates if changed
3. Result: 15 charges (no duplicates)

**Allocations:** Recalculated each sync (so no duplicates either)

---

## Testing Strategy

### Local Mock Testing (No Railway needed)
```bash
cd backend
npm install
npm run dev
# Runs Express + mock Pennylane client
# http://localhost:3000/api/sync/pennylane
```

### Integration Tests
- Mock Pennylane responses
- Test upsert logic
- Verify allocation calculation
- Check database state after sync

### Load Test
- Simulate 100+ charges
- Verify performance

---

## Deployment: Railway

### 1. Connect repo → Railway
```bash
# Railway CLI
railway link
railway up
```

### 2. Set env vars in Railway dashboard
```
SUPABASE_SERVICE_ROLE_KEY=eyJh...
VITE_SUPABASE_URL=https://...
HALL_ID=<uuid>
PORT=3000
```

### 3. Cron job setup
Option A: Railway cron service (if available)
Option B: External cron (EasyCron, healthchecks.io with your endpoint)
Option C: node-cron within app (always running)

We'll use `node-cron` embedded = simpler.

---

## Later: Replace Mock with Real API
```
When you have PENNYLANE_API_KEY:

1. Update src/integrations/pennylane/client.ts
2. Change from mock data to real HTTP calls
3. Update PennylaneClient constructor to use API key
4. Test on Railway staging
5. Deploy to production
```

No code changes needed elsewhere! Just swap the client.

---

## Next Steps
1. Create backend folder structure (Express template)
2. Implement Pennylane mock client
3. Implement Sync service
4. Create local tests
5. Deploy to Railway
6. Test nightly cron
