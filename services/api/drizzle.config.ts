import { defineConfig } from 'drizzle-kit';

// Las migraciones se generan desde el esquema. Se aplican con `pnpm db:migrate` (DATABASE_URL en .env.local).
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
});
