import { drizzle as drizzleNode } from 'drizzle-orm/node-postgres';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { Pool } from 'pg';
import * as schema from './schema.js';

/** Conexión independiente del driver: node-postgres en producción, PGlite en pruebas. */
export type Db = PgDatabase<any, typeof schema>;

/** Crea la conexión a PostgreSQL (local o Supabase) desde DATABASE_URL. */
export function createDb(connectionString: string): Db {
  const pool = new Pool({ connectionString });
  return drizzleNode(pool, { schema });
}

export { schema };
