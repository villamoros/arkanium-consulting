/**
 * F-05: proyectos e hitos. El owner los crea, los actualiza y los archiva. El cliente ve solo hitos y avances (ARK-ARCH-001 §4.2).
 * Cambiar la fecha prevista de un hito deja marca para avisar al cliente (D-21).
 * Archivar no borra: el proyecto deja de aparecer en las listas, pero su historial se conserva.
 */
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { audit } from '../audit.js';
import type { Db } from '../db/client.js';
import { milestones, organizations, projects } from '../db/schema.js';
import { ServiceError } from '../errors.js';
import type { MilestoneCreate, MilestoneUpdate, ProjectArchive, ProjectCreate, ProjectUpdate } from '@arkanium/contracts';

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

/** Proyecto visible: los archivados no existen para la app. */
export async function findProject(db: Db, id: string): Promise<Project> {
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), isNull(projects.archivedAt)));
  if (!project) throw new ServiceError(404, 'not_found', 'Proyecto no encontrado.');
  return project;
}

export async function listProjects(db: Db, organizationId: string): Promise<Project[]> {
  return db
    .select()
    .from(projects)
    .where(and(eq(projects.organizationId, organizationId), isNull(projects.archivedAt)))
    .orderBy(asc(projects.createdAt));
}

/** Core: todos los proyectos visibles, con el nombre de su cliente. */
export async function listAllProjects(db: Db) {
  const rows = await db
    .select({ project: projects, organizationName: organizations.name })
    .from(projects)
    .innerJoin(organizations, eq(projects.organizationId, organizations.id))
    .where(isNull(projects.archivedAt))
    .orderBy(desc(projects.createdAt));
  return rows.map((row) => ({ ...row.project, organizationName: row.organizationName }));
}

/** El owner corrige nombre, familia, fase, avance o siguiente paso. Solo cambian los campos enviados. */
export async function updateProject(db: Db, id: string, input: ProjectUpdate, actor: string): Promise<Project> {
  await findProject(db, id);
  const changes: Partial<typeof projects.$inferInsert> = {};
  if (input.name !== undefined) changes.name = input.name;
  if (input.serviceFamily !== undefined) changes.serviceFamily = input.serviceFamily;
  if (input.phase !== undefined) changes.phase = input.phase;
  if (input.progress !== undefined) changes.progress = input.progress;
  if (input.nextStep !== undefined) changes.nextStep = input.nextStep;

  const [updated] = await db.update(projects).set(changes).where(eq(projects.id, id)).returning();
  await audit(db, { actor, action: 'project.updated', subjectType: 'project', subjectId: id, detail: { fields: Object.keys(changes) } });
  return updated!;
}

/** Archiva el proyecto con su motivo. Deja de aparecer en las listas; su historial se conserva. */
export async function archiveProject(db: Db, id: string, input: ProjectArchive, actor: string): Promise<void> {
  await findProject(db, id);
  await db.update(projects).set({ archivedAt: new Date() }).where(eq(projects.id, id));
  await audit(db, { actor, action: 'project.archived', subjectType: 'project', subjectId: id, detail: { reason: input.reason } });
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
