/**
 * Pausas de emergencia (ARK-ARCH-003, sección 4). Pausar detiene a los agentes en su siguiente paso seguro y no
 * borra trabajo ni cancela lo ya aprobado. Cada pausa y cada reanudación queda en la bitácora con el motivo.
 *
 * Dos niveles:
 *  - Pausa global: bloquea a todos los agentes sin cambiar sus estados individuales.
 *  - Pausa por agente o departamento: solo cambia agentes activos a pausado; al reanudar vuelven a activo.
 */
import { and, asc, eq } from 'drizzle-orm';
import { audit } from '../audit.js';
import { AGENT_CATALOG, AGENT_DEPARTMENTS, type AgentDepartmentId } from '../agents/catalog.js';
import type { Db } from '../db/client.js';
import { agents, emergencyState } from '../db/schema.js';
import { ServiceError } from '../errors.js';

export type Agent = typeof agents.$inferSelect;

const STATE_ID = 1;

/** Carga el catálogo y la fila de estado. Es idempotente: no duplica ni pisa estados existentes. */
export async function ensureEmergencyCatalog(db: Db): Promise<void> {
  await db
    .insert(agents)
    .values(AGENT_CATALOG.map((spec) => ({ code: spec.code, name: spec.name, service: spec.service, department: spec.department })))
    .onConflictDoNothing({ target: agents.code });
  await db.insert(emergencyState).values({ id: STATE_ID, paused: false }).onConflictDoNothing({ target: emergencyState.id });
}

async function currentState(db: Db) {
  await ensureEmergencyCatalog(db);
  const [state] = await db.select().from(emergencyState).where(eq(emergencyState.id, STATE_ID));
  return state!;
}

async function findAgent(db: Db, id: string): Promise<Agent> {
  const [agent] = await db.select().from(agents).where(eq(agents.id, id));
  if (!agent) throw new ServiceError(404, 'not_found', 'Agente no encontrado.');
  return agent;
}

/** Un agente puede trabajar solo si la pausa global está apagada y su propio estado es activo. */
export function canAct(globalPaused: boolean, agent: Pick<Agent, 'status'>): boolean {
  return !globalPaused && agent.status === 'activo';
}

/** Estado completo para la pantalla: pausa global, totales por departamento y agentes. */
export async function emergencyOverview(db: Db) {
  const state = await currentState(db);
  const rows = await db.select().from(agents).orderBy(asc(agents.department), asc(agents.name));

  const departments = AGENT_DEPARTMENTS.map((department) => {
    const own = rows.filter((agent) => agent.department === department.id);
    return {
      id: department.id,
      name: department.name,
      total: own.length,
      active: own.filter((agent) => agent.status === 'activo').length,
      paused: own.filter((agent) => agent.status === 'pausado').length,
      defined: own.filter((agent) => agent.status === 'definido').length,
    };
  });

  return {
    paused: state.paused,
    reason: state.paused ? state.reason : null,
    pausedAt: state.paused && state.changedAt ? state.changedAt.toISOString() : null,
    totals: {
      total: rows.length,
      active: rows.filter((agent) => agent.status === 'activo').length,
      paused: rows.filter((agent) => agent.status === 'pausado').length,
      operating: rows.filter((agent) => agent.operation === 'operando').length,
    },
    departments,
    agents: rows.map((agent) => ({
      id: agent.id,
      code: agent.code,
      name: agent.name,
      service: agent.service,
      department: agent.department,
      status: agent.status,
      operation: agent.operation,
      pauseReason: agent.pauseReason,
      pausedAt: agent.pausedAt?.toISOString() ?? null,
    })),
  };
}

export async function pauseAll(db: Db, reason: string, actor: string) {
  const state = await currentState(db);
  if (state.paused) throw new ServiceError(409, 'invalid_state', 'Todo ya está en pausa.');
  await db.update(emergencyState).set({ paused: true, reason, changedBy: actor, changedAt: new Date() }).where(eq(emergencyState.id, STATE_ID));
  await audit(db, { actor, action: 'emergency.paused_all', subjectType: 'emergency', subjectId: null, detail: { reason } });
}

export async function resumeAll(db: Db, reason: string | undefined, actor: string) {
  const state = await currentState(db);
  if (!state.paused) throw new ServiceError(409, 'invalid_state', 'La operación ya está en marcha.');
  await db
    .update(emergencyState)
    .set({ paused: false, reason: null, changedBy: actor, changedAt: new Date() })
    .where(eq(emergencyState.id, STATE_ID));
  await audit(db, { actor, action: 'emergency.resumed_all', subjectType: 'emergency', subjectId: null, detail: { reason: reason ?? null } });
}

/** Pausa a los agentes activos de un departamento. Los definidos y los ya pausados no cambian. */
export async function pauseDepartment(db: Db, department: AgentDepartmentId, reason: string, actor: string): Promise<number> {
  await ensureEmergencyCatalog(db);
  const active = await db.select().from(agents).where(and(eq(agents.department, department), eq(agents.status, 'activo')));
  if (active.length === 0) throw new ServiceError(409, 'invalid_state', 'No hay agentes activos en este departamento.');
  await db
    .update(agents)
    .set({ status: 'pausado', pauseReason: reason, pausedAt: new Date() })
    .where(and(eq(agents.department, department), eq(agents.status, 'activo')));
  await audit(db, { actor, action: 'department.paused', subjectType: 'agent_department', subjectId: null, detail: { department, count: active.length, reason } });
  return active.length;
}

export async function resumeDepartment(db: Db, department: AgentDepartmentId, reason: string | undefined, actor: string): Promise<number> {
  await ensureEmergencyCatalog(db);
  const paused = await db.select().from(agents).where(and(eq(agents.department, department), eq(agents.status, 'pausado')));
  if (paused.length === 0) throw new ServiceError(409, 'invalid_state', 'No hay agentes en pausa en este departamento.');
  await db
    .update(agents)
    .set({ status: 'activo', pauseReason: null, pausedAt: null })
    .where(and(eq(agents.department, department), eq(agents.status, 'pausado')));
  await audit(db, { actor, action: 'department.resumed', subjectType: 'agent_department', subjectId: null, detail: { department, count: paused.length, reason: reason ?? null } });
  return paused.length;
}

export async function pauseAgent(db: Db, id: string, reason: string, actor: string): Promise<Agent> {
  const agent = await findAgent(db, id);
  if (agent.status !== 'activo') throw new ServiceError(409, 'invalid_state', 'Solo se pausa un agente activo.');
  const [updated] = await db
    .update(agents)
    .set({ status: 'pausado', pauseReason: reason, pausedAt: new Date() })
    .where(eq(agents.id, id))
    .returning();
  await audit(db, { actor, action: 'agent.paused', subjectType: 'agent', subjectId: id, detail: { code: agent.code, reason } });
  return updated!;
}

export async function resumeAgent(db: Db, id: string, reason: string | undefined, actor: string): Promise<Agent> {
  const agent = await findAgent(db, id);
  if (agent.status !== 'pausado') throw new ServiceError(409, 'invalid_state', 'Solo se reanuda un agente en pausa.');
  const [updated] = await db
    .update(agents)
    .set({ status: 'activo', pauseReason: null, pausedAt: null })
    .where(eq(agents.id, id))
    .returning();
  await audit(db, { actor, action: 'agent.resumed', subjectType: 'agent', subjectId: id, detail: { code: agent.code, reason: reason ?? null } });
  return updated!;
}

/** Para los agentes y para Control: qué puede hacer cada agente ahora mismo. Sin sesión, con el secreto interno. */
export async function internalEmergencyStatus(db: Db) {
  const state = await currentState(db);
  const rows = await db.select({ code: agents.code, status: agents.status }).from(agents);
  return {
    paused: state.paused,
    agents: rows.map((row) => ({ code: row.code, status: row.status, allowed: canAct(state.paused, row) })),
  };
}
