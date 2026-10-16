export interface ApiConfig {
  port: number;
  host: string;
  /** ID de la organización interna de Arkanium en Clerk (org_…). */
  internalOrgId: string;
  /** Orígenes del navegador permitidos (sitio, app, core y control). */
  corsOrigins: string[];
  /** Clave secreta de Clerk. Solo en el servidor. */
  clerkSecretKey: string;
  /** Conexión a PostgreSQL (local o Supabase). Sin ella, las rutas de leads no se registran. */
  databaseUrl?: string;
  /** Token de servicio del sitio para entregar leads. Sin él, la captación responde 503. */
  leadIntakeToken?: string;
  /** Clave secreta de Stripe (sk_test_… en desarrollo). Sin ella, emitir facturas responde 503. */
  stripeSecretKey?: string;
  /** Secreto del webhook de Stripe (whsec_…). Sin él, el webhook responde 503. */
  stripeWebhookSecret?: string;
}

/** Lee la configuración del entorno. Falla al arrancar si falta lo indispensable, con un mensaje claro. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const required = ['CLERK_SECRET_KEY', 'ARKANIUM_ORG_ID'] as const;
  const missing = required.filter((name) => !env[name]);
  if (missing.length > 0) {
    throw new Error(`Faltan variables de entorno: ${missing.join(', ')}. Revisa services/api/.env.local.`);
  }

  return {
    port: Number(env.PORT ?? 3000),
    host: env.HOST ?? '0.0.0.0',
    internalOrgId: env.ARKANIUM_ORG_ID!,
    corsOrigins: (env.CORS_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean),
    clerkSecretKey: env.CLERK_SECRET_KEY!,
    databaseUrl: env.DATABASE_URL || undefined,
    leadIntakeToken: env.LEAD_INTAKE_TOKEN || undefined,
    stripeSecretKey: env.STRIPE_SECRET_KEY || undefined,
    stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET || undefined,
  };
}
