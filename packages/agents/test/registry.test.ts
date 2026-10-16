import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { agents, agentsByDepartment, findAgent } from '../src/index.js';

const catalogDir = fileURLToPath(new URL('../../../apps/web/content/services/es', import.meta.url));

describe('registro de agentes (ARK-ARCH-003)', () => {
  it('hay 42 agentes: 13 de Arquitectura, 14 de Estrategia y 15 de Producto', () => {
    expect(agents).toHaveLength(42);
    expect(agentsByDepartment('architecture')).toHaveLength(13);
    expect(agentsByDepartment('strategy')).toHaveLength(14);
    expect(agentsByDepartment('product')).toHaveLength(15);
  });

  it('cada servicio del catálogo tiene exactamente un agente especialista', async () => {
    const { readdirSync } = await import('node:fs');
    const slugs = readdirSync(catalogDir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => JSON.parse(readFileSync(`${catalogDir}/${f}`, 'utf8')).value as string);
    const covered = agents.map((agent) => agent.service.slug);
    expect(new Set(covered).size).toBe(covered.length);
    expect(covered.sort()).toEqual(slugs.sort());
  });

  it('ningún agente opera: todos están definidos y sin operación', () => {
    expect(agents.every((agent) => agent.status === 'definido')).toBe(true);
    expect(agents.every((agent) => agent.operation === 'sin_operacion')).toBe(true);
    expect(agents.every((agent) => agent.model === 'claude')).toBe(true);
  });

  it('toda salida externa de todos los agentes requiere aprobación del owner', () => {
    expect(agents.every((agent) => agent.approval === 'owner')).toBe(true);
  });

  it('cada agente trabaja solo en el espacio de su proyecto', () => {
    expect(agents.every((agent) => agent.workspace === 'proyecto')).toBe(true);
  });

  it('los identificadores son únicos y se pueden buscar', () => {
    expect(new Set(agents.map((a) => a.id)).size).toBe(agents.length);
    expect(findAgent('architecture.architecture-assessment')?.name).toBe('Agente de evaluación de arquitectura');
    expect(findAgent('no-existe')).toBeUndefined();
  });

  it('Estrategia y Producto cubren Evaluar y Arquitectar; Arquitectura cubre las cuatro fases (ARK-FW-001, sección 12)', () => {
    expect(agentsByDepartment('architecture').every((a) => a.phases.length === 4)).toBe(true);
    expect(agentsByDepartment('strategy').every((a) => a.phases.join() === 'evaluar,arquitectar')).toBe(true);
    expect(agentsByDepartment('product').every((a) => a.phases.join() === 'evaluar,arquitectar')).toBe(true);
  });
});
