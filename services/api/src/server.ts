import { buildApp } from './app.js';
import { createClerkGateway } from './auth/clerk.js';
import { createDb } from './db/client.js';
import { loadConfig } from './config.js';

// Falla al arrancar si falta configuración: mejor un error claro que un servidor a medias.
const config = loadConfig();

const app = buildApp({
  logger: true,
  identity: createClerkGateway({ secretKey: config.clerkSecretKey, authorizedParties: config.corsOrigins }),
  internalOrgId: config.internalOrgId,
  corsOrigins: config.corsOrigins,
  db: config.databaseUrl ? createDb(config.databaseUrl) : undefined,
  leadIntakeToken: config.leadIntakeToken,
});

if (!config.databaseUrl) app.log.warn('DATABASE_URL no está definida: las rutas de leads no están disponibles.');

try {
  await app.listen({ port: config.port, host: config.host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
