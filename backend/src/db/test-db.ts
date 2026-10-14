import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'

/**
 * In-process PostgreSQL (PGlite) carrying the real schema and row-level-security policies of the project,
 * so access rules are tested against the SQL that ships rather than against mocks.
 * Only what Supabase provides around the database is stubbed: the API roles and `auth.uid()` / `auth.jwt()`.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

const SUPABASE_STUBS = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text);
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.jwt() returns jsonb language sql stable
    as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  create function auth.role() returns text language sql stable as $$ select current_user::text $$;
  grant usage on schema auth, public to anon, authenticated, service_role;
  grant execute on all functions in schema auth to anon, authenticated, service_role;
  -- Supabase's default privileges: every table created later is open to the API roles, and RLS is what restricts it.
  alter default privileges for role postgres in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges for role postgres in schema public grant all on functions to anon, authenticated, service_role;
`

/**
 * Schema order: the Supabase base schema first, then the Prisma migrations. The Prisma baseline is skipped
 * because the base schema already creates the same tables (it only exists to baseline a live database).
 */
function migrationFiles(): string[] {
  const base = join(ROOT, 'supabase', 'migrations')
  const prisma = join(ROOT, 'backend', 'prisma', 'migrations')
  return [
    ...readdirSync(base).filter((name) => name.endsWith('.sql')).sort().map((name) => join(base, name)),
    ...readdirSync(prisma, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.includes('baseline'))
      .map((entry) => entry.name).sort()
      .map((name) => join(prisma, name, 'migration.sql')),
  ]
}

export async function createTestDatabase(): Promise<PGlite> {
  const db = new PGlite()
  await db.exec(SUPABASE_STUBS)
  for (const file of migrationFiles()) {
    // gen_random_uuid() is built into PostgreSQL 13+, and PGlite ships no pgcrypto.
    await db.exec(readFileSync(file, 'utf8').replace(/create extension if not\s+exists pgcrypto;/gi, ''))
  }
  return db
}

export type Caller = { id: string; appMetadata?: Record<string, unknown> } | 'anon'

/** Runs `work` with the privileges of an API caller (RLS applies), then restores the superuser. */
export async function asCaller<T>(db: PGlite, caller: Caller, work: () => Promise<T>): Promise<T> {
  if (caller === 'anon') {
    await db.exec(`set role anon; select set_config('request.jwt.claim.sub', '', false); select set_config('request.jwt.claims', '', false)`)
  } else {
    const claims = JSON.stringify({ sub: caller.id, role: 'authenticated', app_metadata: caller.appMetadata ?? {} })
    await db.query(`set role authenticated`)
    await db.query(`select set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claims', $2, false)`, [caller.id, claims])
  }
  try {
    return await work()
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false); select set_config('request.jwt.claims', '', false)`)
  }
}
