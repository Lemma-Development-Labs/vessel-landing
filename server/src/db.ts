import { createHash } from "node:crypto";
import pg from "pg";
import { config } from "./config.js";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  // Railway's managed Postgres terminates TLS with a self-signed chain.
  ssl: /\bsslmode=disable\b/.test(config.databaseUrl) || /localhost|127\.0\.0\.1/.test(config.databaseUrl)
    ? undefined
    : { rejectUnauthorized: false },
});

pool.on("error", (err) => {
  // A pooled client died in the background; pg will replace it.
  console.error("[db] idle client error:", err.message);
});

/** Idempotent schema bootstrap, run once on boot. */
export async function initSchema(): Promise<void> {
  await pool.query(`CREATE EXTENSION IF NOT EXISTS citext;`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS crew (
      id bigserial primary key,
      email citext unique not null,
      created_at timestamptz default now(),
      source text default 'landing',
      ip_hash text
    );
  `);
  // Added after launch: the v2 landing collects an optional handle. Additive
  // and idempotent, so existing rows and older deploys are unaffected.
  await pool.query(`ALTER TABLE crew ADD COLUMN IF NOT EXISTS handle text;`);
}

export async function dbHealthy(): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

/**
 * Crew number for a row: how many rows were created at or before it.
 * For a fresh insert this equals COUNT(*), and for an email that already
 * exists it returns the same number that signup originally reported —
 * which is what the landing page promises ("same if duplicate").
 */
async function crewNumber(id: string | number): Promise<number> {
  const { rows } = await pool.query<{ n: string }>(
    "SELECT COUNT(*)::bigint AS n FROM crew WHERE id <= $1",
    [id],
  );
  return Number(rows[0]?.n ?? 0);
}

export interface SignupResult {
  n: number;
  duplicate: boolean;
}

/**
 * Insert an email, or recognise one already present.
 * ON CONFLICT DO NOTHING makes concurrent signups of the same address safe.
 */
export async function addToWaitlist(
  email: string,
  source: string,
  ipHash: string | null,
  handle: string | null = null,
): Promise<SignupResult> {
  const inserted = await pool.query<{ id: string }>(
    `INSERT INTO crew (email, source, ip_hash, handle)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO NOTHING
     RETURNING id`,
    [email, source, ipHash, handle],
  );

  const newRow = inserted.rows[0];
  if (newRow) return { n: await crewNumber(newRow.id), duplicate: false };

  const existing = await pool.query<{ id: string }>(
    "SELECT id FROM crew WHERE email = $1",
    [email],
  );
  const row = existing.rows[0];
  // Only reachable if the row vanished between the two statements.
  if (!row) return { n: await countCrew(), duplicate: false };

  return { n: await crewNumber(row.id), duplicate: true };
}

export async function countCrew(): Promise<number> {
  const { rows } = await pool.query<{ n: string }>(
    "SELECT COUNT(*)::bigint AS n FROM crew",
  );
  return Number(rows[0]?.n ?? 0);
}

export interface CrewRow {
  email: string;
  created_at: string;
  handle: string | null;
}

export async function listCrew(limit = 2000): Promise<CrewRow[]> {
  const { rows } = await pool.query<CrewRow>(
    `SELECT email, created_at, handle
       FROM crew
      ORDER BY id DESC
      LIMIT $1`,
    [limit],
  );
  return rows;
}

/**
 * Store a salted digest, never the address itself. Without a salt an IPv4
 * hash is trivially reversible, so IP_HASH_SALT should be set in production.
 */
export function hashIp(ip: string | undefined): string | null {
  if (!ip) return null;
  return createHash("sha256").update(`${config.ipHashSalt}:${ip}`).digest("hex");
}

/**
 * Remove one address. Required to honour deletion/unsubscribe requests — an
 * email list you cannot delete from is a liability, not a feature.
 * Returns how many rows went (0 or 1); citext makes the match case-insensitive.
 */
export async function removeFromWaitlist(email: string): Promise<number> {
  const res = await pool.query("DELETE FROM crew WHERE email = $1", [email]);
  return res.rowCount ?? 0;
}
