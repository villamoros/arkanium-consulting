import { buildApp } from './app.js';
import { createClerkGateway } from './auth/clerk.js';
import { withMembershipCache } from './auth/membership-cache.js';
import { createDb } from './db/client.js';
import { createStripeBilling } from './billing/stripe.js';
import { createN8nCalendar } from './calendar/n8n.js';
import { loadConfig } from './config.js';

// Falla al arrancar si falta configuración: mejor un error claro que un servidor a medias.
const config = loadConfig();

const app = buildApp({
  logger: true,
  identity: withMembershipCache(createClerkGateway({ secretKey: config.clerkSecretKey, authorizedParties: config.corsOrigins })),
  internalOrgId: config.internalOrgId,
  corsOrigins: config.corsOrigins,
  db: config.databaseUrl ? createDb(config.databaseUrl) : undefined,
  leadIntakeToken: config.leadIntakeToken,
  billing: config.stripeSecretKey ? createStripeBilling({ secretKey: config.stripeSecretKey }) : undefined,
  stripeWebhookSecret: config.stripeWebhookSecret,
  calendar: config.n8nWebhookBaseUrl && config.n8nWebhookSecret ? createN8nCalendar({ baseUrl: config.n8nWebhookBaseUrl, secret: config.n8nWebhookSecret }) : undefined,
  internalSecret: config.n8nWebhookSecret,
});

if (!config.databaseUrl) app.log.warn('DATABASE_URL no está definida: las rutas de leads no están disponibles.');
if (!config.stripeSecretKey) app.log.warn('STRIPE_SECRET_KEY no está definida: emitir facturas no está disponible.');
if (!config.n8nWebhookBaseUrl || !config.n8nWebhookSecret) app.log.warn('N8N_WEBHOOK_BASE_URL o N8N_WEBHOOK_SECRET no están definidas: las reuniones se confirman sin tocar el calendario.');

try {
  await app.listen({ port: config.port, host: config.host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
