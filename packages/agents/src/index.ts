import { agentSchema, type Agent } from './schema.js';
import registryJson from './registry.json' with { type: 'json' };

export type { Agent };

/** Registro completo de agentes, validado al cargar. Si un agente no cumple la ficha, falla aquí. */
export const agents: Agent[] = agentSchema.array().parse(registryJson);

export function findAgent(id: string): Agent | undefined {
  return agents.find((agent) => agent.id === id);
}

export function agentsByDepartment(department: Agent['department']): Agent[] {
  return agents.filter((agent) => agent.department === department);
}
