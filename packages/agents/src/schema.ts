import { z } from 'zod';

/** Ficha de un agente especialista (ARK-AGT-001). */
export const agentSchema = z.object({
  id: z.string().regex(/^(architecture|strategy|product)\.[a-z0-9-]+$/),
  name: z.string().min(1),
  department: z.enum(['architecture', 'strategy', 'product']),
  category: z.string().min(1),
  service: z.object({
    slug: z.string().min(1),
    label: z.string().min(1),
    family: z.enum(['architecture', 'strategy', 'product']),
  }),
  principalDeliverable: z.string().min(1),
  phases: z.array(z.enum(['evaluar', 'arquitectar', 'modernizar', 'escalar'])).min(1),
  // Estado de la ficha: «definido» hasta que se active. Operación: «sin_operacion» hasta el orquestador.
  status: z.enum(['definido', 'activo', 'pausado']),
  operation: z.enum(['sin_operacion', 'operando']),
  // Modelo que lo ejecutará. Hoy: claude, sin llamadas a API; la versión se fija en el orquestador (ARK-AGT-001).
  model: z.string().min(1),
  tools: z.array(z.string()),
  // Toda salida externa requiere aprobación del owner (regla transversal, ARK-ARCH-002).
  approval: z.literal('owner'),
  workspace: z.literal('proyecto'),
});
export type Agent = z.infer<typeof agentSchema>;
