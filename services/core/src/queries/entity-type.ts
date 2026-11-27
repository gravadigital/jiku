/**
 * LA TRADUCCIÓN DE `entityType`, en un solo lugar.
 *
 * `entityType` no es un filtro: es lo que hace que un id TENGA SIGNIFICADO. Los ids de
 * `objective_activity` y `requirement_activity` SE PISAN —el 1234 existe en las dos y son cosas
 * distintas—, así que sin él un `comments.get {id: 1234}` devolvería "algún" comentario y el bug
 * sería silencioso e intermitente: funciona hasta que las dos tablas crecen lo suficiente.
 *
 * VA EN LAS DOS DIRECCIONES (RF-25): se consulta `objective_activity` y se devuelve
 * `entityType: "task"`. En esta story la vuelta se ve en los adjuntos —se filtra
 * `attachments.entity_type = 'objective_comment'` y el comentario vuelve con `"task"`—, y S-027
 * (`attachments.list`) la vuelve a ejercer entera. POR ESO ESTÁ ACÁ Y NO ADENTRO DE UNA FICHA:
 * dos copias de esta tabla pueden divergir sin que nada lo diga.
 *
 * ES UN DATO, NO FUNCIONES: las fichas leen estos nombres al construirse, así `meta.describe`
 * (S-028) puede proyectar el contrato sin ejecutar una traducción.
 *
 * NO IMPORTA NADA DEL MOTOR: es un dato del plano de consultas, no una pieza de `engine/`.
 */

/** Los valores válidos, EN EL ORDEN que viaja en `errorDetails.allowed`. */
export const ENTITY_TYPES = ['task', 'requirement'] as const;

/** El tipo se DERIVA del array: escribirlo a mano dejaría que los dos divergieran. */
export type EntityType = (typeof ENTITY_TYPES)[number];

export interface EntityTables {
  /** Tabla de actividad: comentarios Y cambios de campo (ver la ficha de `activity`). */
  readonly activityTable: string;
  /**
   * OJO CON EL NÚMERO: la de tareas es PLURAL (`objectives_subscriptors`) y la de requisitos
   * SINGULAR (`requirement_subscriptors`). La asimetría es de la base, no del contrato, y copiar
   * una para la otra rompe el SQL sin que nada lo diga hasta que la consulta corre.
   */
  readonly subscriptionTable: string;
  /** Columna que apunta a la entidad dueña: `objective_id` / `requirement_id`. */
  readonly entityColumn: string;
  /** La tabla que SÍ lleva el proyecto: la que el recorte externo alcanza con un EXISTS. */
  readonly ownerTable: string;
  /** `attachments.entity_type` de un COMENTARIO de esta entidad. */
  readonly commentAttachmentType: string;
  /**
   * `attachments.entity_type` de LA ENTIDAD misma (no de su comentario).
   *
   * OJO CON EL NÚMERO, igual que con `subscriptionTable`: la tabla es `objectives` (PLURAL) y el
   * `entity_type` es `objective` (SINGULAR). Derivarlo de `ownerTable` sacándole la `s` sería un
   * truco que se rompe con la primera tabla que no pluralice así.
   */
  readonly entityAttachmentType: string;
}

export const ENTITY_TABLES: Readonly<Record<EntityType, EntityTables>> = {
  task: {
    activityTable: 'objective_activity',
    subscriptionTable: 'objectives_subscriptors',
    entityColumn: 'objective_id',
    ownerTable: 'objectives',
    commentAttachmentType: 'objective_comment',
    entityAttachmentType: 'objective',
  },
  requirement: {
    activityTable: 'requirement_activity',
    subscriptionTable: 'requirement_subscriptors',
    entityColumn: 'requirement_id',
    ownerTable: 'requirements',
    commentAttachmentType: 'requirement_comment',
    entityAttachmentType: 'requirement',
  },
};

/* ---------------------------------------------------------------------------------------------
 * LA TRADUCCIÓN DE `attachments.entity_type` — el mismo mapa, cinco valores (S-027)
 *
 * `comments` traduce DOS valores porque resuelve contra dos tablas; `attachments` traduce CINCO
 * porque es POLIMÓRFICA: su `entity_type` puede apuntar a un proyecto, un requisito, una tarea o
 * un comentario de cualquiera de los dos. La tabla es SIEMPRE `attachments` — no hay variantes —,
 * así que esto NO es un discriminador: es un FILTRO con traducción.
 *
 * VA EN LAS DOS DIRECCIONES, y es el bug más probable del recurso: traducir el filtro
 * (`task_comment` -> `objective_comment`) es evidente; devolver el valor traducido de vuelta se
 * olvida, y el consumidor recibe items con un `entityType` que después no puede volver a usar
 * como filtro.
 *
 * CUATRO DE LOS CINCO SE DERIVAN DE `ENTITY_TABLES`, y esa derivación ES CA-17: dos copias de esta
 * tabla divergen el día que se agregue un sexto tipo de entidad, y el bug aparece en UNO SOLO de
 * los dos caminos —los adjuntos embebidos de `comments` o `attachments.list`—.
 * ------------------------------------------------------------------------------------------- */

/** Los cinco valores del contrato, EN EL ORDEN que viaja en `errorDetails.allowed`. */
export const ATTACHMENT_ENTITY_TYPES = [
  'project',
  'requirement',
  'requirement_comment',
  'task',
  'task_comment',
] as const;

/** El tipo se DERIVA del array: escribirlo a mano dejaría que los dos divergieran. */
export type AttachmentEntityType = (typeof ATTACHMENT_ENTITY_TYPES)[number];

/**
 * Contrato -> base. LA DIRECCIÓN DE ENTRADA (el filtro).
 *
 * Las cuatro de la familia salen de `ENTITY_TABLES`: escribirlas acá sería la segunda copia.
 * `project` no pertenece a la familia de las dos tablas de actividad y por eso va suelto — y es
 * el único de los cinco cuyo nombre coincide en las tres capas.
 */
export const ATTACHMENT_ENTITY_DB: Readonly<Record<AttachmentEntityType, string>> = {
  project: 'project',
  requirement: ENTITY_TABLES.requirement.entityAttachmentType,
  requirement_comment: ENTITY_TABLES.requirement.commentAttachmentType,
  task: ENTITY_TABLES.task.entityAttachmentType,
  task_comment: ENTITY_TABLES.task.commentAttachmentType,
};

/**
 * Base -> contrato. LA DIRECCIÓN DE SALIDA (el valor devuelto), DERIVADA y no escrita a mano.
 *
 * Escribirla a mano sería exactamente la mitad que se olvida: los dos mapas tienen que ser
 * inversos por construcción, no por revisión.
 */
export const ATTACHMENT_ENTITY_CONTRACT: Readonly<Record<string, AttachmentEntityType>> =
  Object.fromEntries(
    Object.entries(ATTACHMENT_ENTITY_DB).map(([contract, db]) => [db, contract])
  ) as Readonly<Record<string, AttachmentEntityType>>;

/**
 * Los cinco valores DE LA BASE, en el mismo orden. Es LA LISTA BLANCA del predicado del recurso.
 *
 * `attachments.entity_type` tiene DOCE valores en el modelo y filas legado con `comment` (la
 * migración `20260729_01` separó `comment` en dos y no migró las viejas). Ninguno de los siete
 * restantes tiene traducción al contrato, así que NO APARECEN: es deny-by-default (ADR-008) y no
 * un bug, pero el síntoma —"un adjunto viejo no aparece"— es indistinguible de uno.
 */
export const ATTACHMENT_DB_TYPES: readonly string[] = ATTACHMENT_ENTITY_TYPES.map(
  (contract) => ATTACHMENT_ENTITY_DB[contract]
);

/**
 * EL DESCRIPTOR DE LA ENTIDAD DUEÑA de un tipo de vínculo: lo que el recorte del modo externo
 * necesita saber para decidir si esa entidad es visible.
 *
 * ES UN DATO Y NO UN PREDICADO: quién arma el SQL es el motor. Acá solo se declara CONTRA QUÉ
 * TABLA mira cada tipo, si hay que saltar al dueño, y qué columnas llevan el proyecto y la
 * visibilidad.
 *
 * VIVE ACÁ Y NO EN `types.ts` porque es un DATO del plano de consultas —del mismo género que
 * `ENTITY_TABLES`— y este archivo no importa nada del motor. `types.ts` lo importa para componer
 * las formas del recorte, y no al revés.
 */
export interface AttachmentOwner {
  /** Tabla que la fila alcanza con el `EXISTS` (`objectives`, `objective_activity`, …). */
  readonly table: string;
  /** Columna de esa tabla contra la que se compara el id del vínculo. */
  readonly key: string;
  /** Visibilidad DE LA FILA ALCANZADA. Su ausencia es "esa tabla no la tiene", nunca "no recortes". */
  readonly ownVisibility?: { readonly column: string; readonly value: string };
  /** EL SALTO AL DUEÑO: la tabla alcanzada no lleva el proyecto y hay que unirla con la que sí. */
  readonly owner?: {
    readonly table: string;
    /** Columna de la tabla alcanzada que apunta al dueño (`objective_id`). */
    readonly foreignKey: string;
    /** Columna del dueño a la que apunta `foreignKey` (`id`). */
    readonly key: string;
  };
  /** Columna que lleva el proyecto: de la tabla del dueño si hay salto, de la alcanzada si no. */
  readonly projectColumn: string;
  /** Visibilidad de la tabla que lleva el proyecto. Opcional con el mismo criterio. */
  readonly visibility?: { readonly column: string; readonly value: string };
}

/**
 * LA ENTIDAD DUEÑA DE CADA TIPO: lo que el recorte del modo externo necesita saber.
 *
 * DOS RAMAS SALTAN: un comentario NO LLEVA el proyecto —lo lleva su entidad dueña—, así que su
 * predicado es un EXISTS con JOIN. Y las DOS visibilidades se exigen (H-8 del plan de S-025):
 * `objective_activity.visibility_level` tiene default `internal`, y sin `ownVisibility` un
 * comentario interno sobre una tarea pública se ve desde el portal de clientes.
 *
 * `project` NO DECLARA VISIBILIDAD y no es un olvido: un proyecto no tiene `visibility_level`, y
 * su recorte es su PROPIA `id` contra los proyectos permitidos. La forma uniforme la absorbe: el
 * día que `projects` gane una columna de visibilidad, se agrega acá y el emisor no cambia.
 */
export const ATTACHMENT_ENTITY_OWNERS: Readonly<Record<string, AttachmentOwner>> = {
  [ATTACHMENT_ENTITY_DB.project]: {
    table: 'projects',
    key: 'id',
    projectColumn: 'id',
  },
  [ATTACHMENT_ENTITY_DB.requirement]: {
    table: ENTITY_TABLES.requirement.ownerTable,
    key: 'id',
    projectColumn: 'project_id',
    visibility: { column: 'visibility_level', value: 'public' },
  },
  [ATTACHMENT_ENTITY_DB.requirement_comment]: {
    table: ENTITY_TABLES.requirement.activityTable,
    key: 'id',
    ownVisibility: { column: 'visibility_level', value: 'public' },
    owner: {
      table: ENTITY_TABLES.requirement.ownerTable,
      foreignKey: ENTITY_TABLES.requirement.entityColumn,
      key: 'id',
    },
    projectColumn: 'project_id',
    visibility: { column: 'visibility_level', value: 'public' },
  },
  [ATTACHMENT_ENTITY_DB.task]: {
    table: ENTITY_TABLES.task.ownerTable,
    key: 'id',
    projectColumn: 'project_id',
    visibility: { column: 'visibility_level', value: 'public' },
  },
  [ATTACHMENT_ENTITY_DB.task_comment]: {
    table: ENTITY_TABLES.task.activityTable,
    key: 'id',
    ownVisibility: { column: 'visibility_level', value: 'public' },
    owner: {
      table: ENTITY_TABLES.task.ownerTable,
      foreignKey: ENTITY_TABLES.task.entityColumn,
      key: 'id',
    },
    projectColumn: 'project_id',
    visibility: { column: 'visibility_level', value: 'public' },
  },
};

export default ENTITY_TABLES;
