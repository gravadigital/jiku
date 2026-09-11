/**
 * `diffResponsibles()` — el diff de responsables compartido por `requirement.assigned` y
 * `task.assigned` (REQ-014 / S-066, D-1). FUNCIÓN PURA: sin Sequelize, sin transacción, sin
 * conocimiento del bus — solo aritmética de listas de `number`.
 *
 * COMPARTIDO, A DIFERENCIA DE LOS LECTORES (`readResponsiblePersonIds` /
 * `readTaskResponsiblePersonIds`, D-3 de S-065, que S-065 decidió NO unificar). Ahí la asimetría
 * era real: cada lector lee un modelo Sequelize distinto (`PersonRequirement` vs
 * `PersonObjective`). Acá no hay ningún símbolo de `@jiku/models`: el diff es idéntico para las
 * dos entidades, y duplicarlo en dos archivos duplicaría también la trampa de `changed` de abajo
 * — la copia es la que se olvida de crecer.
 *
 * LA TRAMPA DE `changed` (D-5 de la planificación): `from` viene NORMALIZADO por el lector (líder
 * primero, el resto por `personId` ascendente) mientras que `to` viene en el ORDEN CRUDO del
 * payload. Un predicado que compare las listas completas (`from.join(',') !== to.join(',')`, o
 * un `deepEqual` de arrays) reporta un cambio cada vez que el payload manda los mismos ids en
 * otro orden — que es casi siempre, porque el orden de los NO líderes que el lector inventa
 * (`personId` asc) no es el orden con que el usuario los asignó. El resultado sería un
 * `requirement.assigned` / `task.assigned` espurio, con `added: []` y `removed: []`, en cada
 * `edit` que solo reenvía el mismo formulario: ruido puro para el conector. Por eso `changed`
 * compara el CONJUNTO (vía `added`/`removed`, calculados con `Set`) y el LÍDER (`to[0]` vs
 * `from[0]`) POR SEPARADO, nunca las listas completas.
 *
 * LIMITACIÓN ACEPTADA: para un requisito cuyas filas `people_requirements` tienen TODAS
 * `is_leader NULL` (filas heredadas de la api, antes de que `core` escribiera), `from[0]` es el
 * `personId` más bajo, no un líder real. Si el `edit` manda una lista con otro elemento primero,
 * `changed` da `true` y se emite un evento cuyo `leaderId` "cambió" respecto de algo que nunca
 * estuvo seteado. Es el comportamiento correcto disponible: el evento reporta lo mismo que
 * reporta el lector, y un evento de más es preferible a uno de menos. Detectar el caso
 * requeriría distinguir "sin líder" de "líder = el id más bajo", y la tabla no da esa
 * información (sin PK, sin columna de orden).
 */
export interface ResponsiblesDiff {
  /** La lista ANTERIOR, tal como la devolvió el lector (líder primero, resto por id asc). */
  from: number[];
  /** La lista NUEVA, en el ORDEN DEL PAYLOAD. No se reordena: el orden es información
   * (ADR-004 / `contract-translation.md`). */
  to: number[];
  /** Ids que entraron. Deduplicado y ordenado asc para que un `deepEqual` de test no dependa
   * del orden que salga del `Set`. */
  added: number[];
  /** Ids que salieron. Idem. */
  removed: number[];
  /** El líder resultante = `to[0]`. `null` si la lista nueva quedó vacía. */
  leaderId: number | null;
  /** `true` si cambió el CONJUNTO de ids o cambió el líder. Ver la nota de cabecera. */
  changed: boolean;
}

export function diffResponsibles(from: number[], to: number[]): ResponsiblesDiff {
  const fromSet = new Set(from);
  const toSet = new Set(to);

  const added = [...toSet].filter((id) => !fromSet.has(id)).sort((a, b) => a - b);
  const removed = [...fromSet].filter((id) => !toSet.has(id)).sort((a, b) => a - b);
  const leaderId = to[0] ?? null;

  const changed = added.length > 0 || removed.length > 0 || leaderId !== (from[0] ?? null);

  return { from, to, added, removed, leaderId, changed };
}

export default diffResponsibles;
