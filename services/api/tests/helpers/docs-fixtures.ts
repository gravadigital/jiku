import { Client, Objective, Person, Project, ProjectPerson, Requirement, User } from '@jiku/models';

/**
 * Fixtures de base de S-094 (clientes, proyectos, personas, requisito y tarea) sobre los `sub` del
 * mock de JWT. Se crean en `before` y se borran en `after` (nada queda para el test siguiente).
 */
export async function createDocsFixtures(): Promise<void> {
  for (const n of ['01', '02', '03', '09']) {
    await User.create({ id: `zitadel-sub-${n}`, name: `User ${n}`, username: `user${n}`, email: `user${n}@mail.com` } as any);
  }
  await Client.create({ id: 4, name: 'EXO' } as any);
  await Client.create({ id: 5, name: 'Acme' } as any);
  const project = (id: number, name: string, code: string, clientId: number | null, status: string) =>
    Project.create({
      id, name, code, clientId, status, type: 'comercial', initDate: new Date(), createdBy: 'zitadel-sub-01',
    } as any);
  await project(12, 'Videoconferencia', 'VID', 4, 'activo');
  await project(31, 'Video Wall', 'VWL', 4, 'finalizado');
  await project(40, 'Videoteca', 'VTK', 5, 'activo');
  await project(50, 'Interno', 'INT', null, 'activo');
  const person = (id: number, firstName: string, lastName: string, userId: string | null, enabled: boolean) =>
    Person.create({ id, firstName, lastName, userId, enabled, initDate: new Date() } as any);
  await person(1, 'Ana', 'Pérez', 'zitadel-sub-01', true);
  await person(2, 'Victor', 'Vidal', 'zitadel-sub-02', true);
  await person(3, 'Vidalia', 'Ruiz', null, true);
  await person(4, 'Vicente', 'Vidart', 'zitadel-sub-09', false);
  for (const projectId of [12, 31, 50]) await ProjectPerson.create({ projectId, personId: 1 } as any);
  await Requirement.create({
    id: 7, title: 'Login con SSO', description: 'd', type: 'funcionalidad', priority: 'media', state: 'analisis',
    projectId: 12, createdBy: 'zitadel-sub-01',
  } as any);
  await Objective.create({
    id: 9, title: 'Migrar a Postgres 16', description: 'd', state: 'activo', area: 'diseño', priority: 1,
    projectId: 12, createdBy: 'zitadel-sub-01',
  } as any);
}

export async function destroyDocsFixtures(): Promise<void> {
  await ProjectPerson.destroy({ where: {} });
  await Objective.destroy({ where: {} });
  await Requirement.destroy({ where: {} });
  await Person.destroy({ where: {} });
  await Project.destroy({ where: {} });
  await Client.destroy({ where: {} });
  await User.destroy({ where: {} });
}
