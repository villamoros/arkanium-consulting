import { z } from 'zod';

/** Respuesta de GET /health de la API. Sirve también para comprobar el gateway. */
export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.string(),
  version: z.string(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
