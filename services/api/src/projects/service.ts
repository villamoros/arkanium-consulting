/**
 * F-05: proyectos e hitos. El owner los crea y los actualiza. El cliente ve solo hitos y avances (ARK-ARCH-001 §4.2).
 * Cambiar la fecha prevista de un hito deja marca para avisar al cliente (D-21).
 */
import { asc, eq } from 'drizzle-orm';
import { audit } from '../audit.js';
import type { Db } from '../db/client.js';
import { milestones, projects } from '../db/schema.js';
import { ServiceError } from '../errors.js';
import type { MilestoneCreate, MilestoneUpdate, ProjectCreate } from '@arkanium/contracts';

export type Project = typeof projects.$inferSelect;
export type Milestone = typeof milestones.$inferSelect;

export async function createProject(db: Db, organizationId: string, input: ProjectCreate, actor: string): Promise<Project> {
  const [project] = await db
    .insert(projects)
    .values({
      organizationId,
      name: input.name,
      serviceFamily: input.serviceFamily,
      phase: input.phase,
      progress: input.progress,
      nextStep: input.nextStep,
    })
    .returning();
  await audit(db, { actor, action: 'project.created', subjectType: 'project', subjectId: project!.id, detail: { organizationId } });
  return project!;
}

export async function findProject(db: Db, id: string): Promise<Project> {
  const [project] = await db.select().from(projects).where(eq(projects.id, id));
  if (!project) throw new ServiceError(404, 'not_found', 'Proyecto no encontrado.');
  return project;
}

export async function listProjects(db: Db, organizationId: string): Promise<Project[]> {
  return db.select().from(projects).where(eq(projects.organizationId, organizationId)).orderBy(asc(projects.createdAt));
}

export async function addMilestone(db: Db, projectId: string, input: MilestoneCreate, actor: string): Promise<Milestone> {
  await findProject(db, projectId);
  const existing = await db.select().from(milestones).where(eq(milestones.projectId, projectId));
  const [milestone] = await db
    .insert(milestones)
    .values({
      projectId,
      name: input.name,
      plannedDate: input.plannedDate ? new Date(input.plannedDate) : null,
      position: existing.length + 1,
    })
    .returning();
  await audit(db, { actor, action: 'milestone.created', subjectType: 'milestone', subjectId: milestone!.id, detail: { projectId } });
  return milestone!;
}

export async function updateMilestone(db: Db, milestoneId: string, input: MilestoneUpdate, actor: string): Promise<Milestone> {
  const [current] = await db.select().from(milestones).where(eq(milestones.id, milestoneId));
  if (!current) throw new ServiceError(404, 'not_found', 'Hito no encontrado.');

  const changes: Partial<typeof milestones.$inferInsert> = {};
  if (input.status !== undefined) changes.status = input.status;
  if (input.plannedDate !== undefined) {
    const next = input.plannedDate ? new Date(input.plannedDate) : null;
    changes.plannedDate = next;
    // Solo cuenta como cambio si había una fecha previa y es distinta.
    if (current.plannedDate && next?.getTime() !== current.plannedDate.getTime()) changes.dateChangedAt = new Date();
  }

  const [updated] = await db.update(milestones).set(changes).where(eq(milestones.id, milestoneId)).returning();
  await audit(db, {
    actor,
    action: 'milestone.updated',
    subjectType: 'milestone',
    subjectId: milestoneId,
    detail: { status: input.status ?? null, dateChanged: changes.dateChangedAt !== undefined },
  });
  return updated!;
}

export async function listMilestones(db: Db, projectId: string): Promise<Milestone[]> {
  return db.select().from(milestones).where(eq(milestones.projectId, projectId)).orderBy(asc(milestones.position));
}
