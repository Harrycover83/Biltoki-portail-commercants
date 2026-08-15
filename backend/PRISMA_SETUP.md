# Prisma Setup Guide

## Step 1: Get Your Database Connection String

To use Prisma migrations, you need a `DATABASE_URL` that connects to your Supabase PostgreSQL database.

### Get Connection String from Supabase:
1. Go to your Supabase project → **Project Settings** → **Database**
2. Find the **Connection Pooler** section (under "Connection string")
3. Copy the **URI** (looks like: `postgresql://postgres.xxx:password@xxx.pooler.supabase.com:6543/postgres`)
4. **Replace `[YOUR-PASSWORD]` with your actual Supabase database password**

### Add to `.env.local`:
```bash
# In backend/.env.local
DATABASE_URL="postgresql://postgres.xxx:YOUR_PASSWORD@xxx.pooler.supabase.com:6543/postgres"
```

## Step 2: Create and Apply Migrations

### Generate initial migration from schema:
```bash
cd backend
npm run prisma:migrate
# When prompted, name it something like "init" or "create_schema"
```

This will:
- ✅ Create a new migration file in `prisma/migrations/`
- ✅ Apply it to your database
- ✅ Generate Prisma Client
- ✅ Run the seed script (auto-populates all 10 Biltoki halls)

### View data in Prisma Studio:
```bash
npm run prisma:studio
# Opens browser UI to inspect your database
```

## Step 3: Get HALLS_TO_SYNC Configuration

After seeding, the script will output:
```
HALLS_TO_SYNC=uuid1,uuid2,uuid3,uuid4,uuid5,uuid6,uuid7,uuid8,uuid9,uuid10
```

Copy this entire string and paste into your Railway environment variables.

## Common Commands

```bash
# View the database with interactive UI
npm run prisma:studio

# Reset database (deletes everything + re-runs migrations + re-seeds)
npm run prisma:migrate:reset

# Manually run seed script (adds/updates data)
npm run prisma:seed

# Generate Prisma Client after schema changes
npm run prisma:generate

# Deploy migrations to production (without reset)
npm run db:setup
```

## What Happens Automatically?

When you run `npm run prisma:migrate`:
1. Creates migration file from schema changes
2. Applies migration to database
3. Generates updated Prisma Client
4. Runs seed script → **creates all 10 Biltoki halls**
5. Outputs `HALLS_TO_SYNC` as environment variable hint

## Next: Use Prisma in Code

Once setup is complete, you can use Prisma Client in your backend code:

```typescript
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Query data
const halls = await prisma.hall.findMany();
const merchants = await prisma.merchant.findUnique({
  where: { id: merchantId },
  include: { stands: true },
});

// Create/update data
const period = await prisma.serviceChargePeriod.create({
  data: {
    hallId,
    label: "January 2025",
    periodStart: new Date("2025-01-01"),
    periodEnd: new Date("2025-01-31"),
    status: "draft",
  },
});

// Complex queries with filtering
const charges = await prisma.serviceCharge.findMany({
  where: {
    period: { id: periodId },
    hall: { id: hallId },
  },
  include: {
    period: true,
    hall: true,
  },
  orderBy: { createdAt: "desc" },
});
```

All queries are **type-safe** and **auto-completed** by TypeScript.

## Troubleshooting

**Q: "DATABASE_URL not set"**
- Make sure `.env.local` has `DATABASE_URL=...` before running any Prisma commands

**Q: "FATAL: Too many connections"**
- Use Connection Pooler URI (not direct connection), usually ending in `:6543`
- Or upgrade Railway database tier

**Q: "Migration conflicts"**
- Run `npm run prisma:migrate:reset` to reset (caution: deletes all data)
- Then redeploy in Railway (auto-runs migrations)

**Q: "Seed script fails"**
- Check that Prisma Client is generated: `npm run prisma:generate`
- Verify DATABASE_URL is correct
- Check seed script logs for specific errors
