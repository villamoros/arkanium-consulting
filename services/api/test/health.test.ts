import { describe, expect, it } from 'vitest';
import { healthResponseSchema } from '@arkanium/contracts';
import { buildApp } from '../src/app.js';

describe('GET /health', () => {
  it('responde ok con la forma del contrato', async () => {
    const app = buildApp();
    const response = await app.inject({ method: 'GET', url: '/health' });
    await app.close();

    expect(response.statusCode).toBe(200);
    const body = healthResponseSchema.parse(response.json());
    expect(body.status).toBe('ok');
    expect(body.service).toBe('arkanium-api');
  });
});

describe('rutas inexistentes', () => {
  it('responden 404', async () => {
    const app = buildApp();
    const response = await app.inject({ method: 'GET', url: '/no-existe' });
    await app.close();

    expect(response.statusCode).toBe(404);
  });
});
