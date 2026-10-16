import { defineConfig } from 'drizzle-kit';

// Carga services/api/.env.local (DATABASE_URL) sin depender de herramientas externas. Si no existe, se ignora.
try {
  process.loadEnvFile('.env.local');
} catch {
  // Sin archivo local: DATABASE_URL puede venir del entorno.
}

// Las migraciones se generan desde el esquema. Se aplican con `pnpm db:migrate` (DATABASE_URL en .env.local).
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
});
