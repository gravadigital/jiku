export interface RelationValue {
  clients: number[];
  projects: number[];
}

/** Reemplaza el principal (el primero) conservando el resto en su orden; `null` lo quita. */
export function setPrincipal(list: readonly number[], id: number | null): number[] {
  if (id === null) return list.slice(1);
  return [id, ...list.slice(1).filter((x) => x !== id)];
}

/** Elegir un proyecto completa el cliente. */
export function chooseProject(
  value: RelationValue,
  project: { id: number; clientId: number | null }
): RelationValue {
  return {
    clients:
      project.clientId === null ? value.clients : setPrincipal(value.clients, project.clientId),
    projects: setPrincipal(value.projects, project.id),
  };
}

/** Cambiar el cliente vacía el proyecto principal si no es de ese cliente; "Sin cliente" lo vacía siempre. */
export function chooseClient(
  value: RelationValue,
  clientId: number | null,
  projectClientOf: (projectId: number) => number | null
): RelationValue {
  const clients = setPrincipal(value.clients, clientId);
  const principalProject = value.projects[0];
  const keepProject =
    clientId !== null &&
    principalProject !== undefined &&
    projectClientOf(principalProject) === clientId;
  return {
    clients,
    projects:
      keepProject || principalProject === undefined
        ? value.projects
        : setPrincipal(value.projects, null),
  };
}
