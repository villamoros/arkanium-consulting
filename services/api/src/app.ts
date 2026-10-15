import Fastify, { type FastifyInstance } from 'fastify';
import { healthResponseSchema, type HealthResponse } from '@arkanium/contracts';

export const SERVICE_NAME = 'arkanium-api';
export const SERVICE_VERSION = '0.1.0';

/**
 * Construye la aplicación sin escuchar en un puerto.
 * Así las pruebas la usan con inject() y no levantan el servidor.
 */
export function buildApp(options: { logger?: boolean } = {}): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? false });

  app.get('/health', async (): Promise<HealthResponse> => {
    return healthResponseSchema.parse({ status: 'ok', service: SERVICE_NAME, version: SERVICE_VERSION });
  });

  return app;
}
