import {
  Attachment,
  AttachmentEntityType,
  File,
  Objective,
  ObjectiveActivity,
  Project,
  Requirement,
  RequirementActivity,
  UserProjectPermission,
} from '@jiku/models';
import { ErrorCode, Reply, failure } from '@jiku/nats-protocol';
import logger from './logger';

/**
 * LA CORRESPONDENCIA ENTIDAD → PROYECTO, y el mapa COMANDO → ENTIDAD que la usa.
 *
 * ES LA TRADUCCIÓN A `core` DE LA CAPA 3 DE LA API (`api/lib/utils/attachments-access.ts`), no una
 * regla nueva: los MISMOS 9 tipos de entidad, con la MISMA cadena hasta el proyecto que
 * `canUserViewEntity` recorre hoy. Se traduce, no se reinventa — CA-8 de S-030 pide literalmente
 * *"la misma correspondencia entidad → proyecto que la api usa hoy"*.
 *
 * LO QUE **NO** SE ESPEJA, Y ES UNA DECISIÓN (D-5): las reglas finas de `canUserAccessObjective`
 * —`admin` siempre, o ser creador, o estar asignado a la tarea—. CA-8 pide la correspondencia a
 * proyecto y CA-7 pide la fila en `user_project_permissions`: eso es la forma de
 * `canUserViewEntity`, no la de `canUserAccessObjective`. Las reglas finas SIGUEN EN LA API, que
 * las aplica delante (CA-14: esta story no elimina nada). LA CONSECUENCIA HAY QUE ESCRIBIRLA: para
 * `attachments.{id}.delete` sobre un `objective`, el chequeo de `core` es MÁS PERMISIVO que el de
 * la api. Nada se abre, porque la api sigue corriendo primero. EL DÍA QUE LA API DEJE DE AUTORIZAR
 * (S-034) alguien tiene que decidir si esas reglas se mudan o se resignan.
 *
 * VIVE EN `src/` —no en `bus/` ni en `queries/`— por el mismo criterio que `authorize-caller.ts` y
 * `caller-class.ts`: lo consume la compuerta, que es de los dos planos. NO IMPORTA NADA DE
 * `queries/` NI DE `bus/`.
 *
 * NO ABRE TRANSACCIÓN, heredando la excepción DELIBERADA a la convención `orm` que la compuerta de
 * S-017 ya declaró: acá TODAVÍA NO HAY transacción, porque un caller sin permiso no tiene que
 * consumir una conexión del pool de escritura. Son lecturas POR PK por la conexión del DUEÑO, con
 * `attributes` acotado — el mismo precedente de `authorize-caller.ts`, y por el mismo motivo no se
 * importa `src/models`.
 *
 * ES UN DATO MÁS UNA FUNCIÓN, con la forma que `queries/entity-type.ts` ya sienta: la tabla es un
 * dato y quien la consume es otro. Así los 9 tipos se testean uno por uno sin arrastrar el
 * despachador.
 *
 * NINGÚN COMANDO IMPORTA ESTE MÓDULO, Y HAY UN GATE QUE LO VERIFICA (CA-15): el chequeo vive en la
 * compuerta y los 20 `execute()` no se tocan. Es lo que permite saber si un bug es de la compuerta
 * o del comando.
 */

/**
 * LOS 9 TIPOS DE ENTIDAD, COMO DATO. Las claves se escriben con los valores del enum compartido
 * `AttachmentEntityType` y NO con literales sueltos: un tipo nuevo en el enum que no aparezca acá
 * NO SE AUTORIZA, que es ADR-008 aplicado (*"Un tipo no contemplado NO SE AUTORIZA, que es el
 * comportamiento correcto"*).
 *
 * SON 10 CLAVES PARA 9 RENGLONES de `api/conventions/authorization.md`, porque el renglón
 * *"`objective_draft`, `requirement_draft`"* declara dos tipos con la misma resolución.
 *
 * LOS DOS VALORES DEL ENUM QUE **NO** ESTÁN —`AttachmentEntityType.ObjectiveCommentDraft` y
 * `AttachmentEntityType.RequirementCommentDraft`— tampoco los resuelve la api, así que deniegan.
 * Es deny-by-default y no un olvido.
 *
 * SE LOS NOMBRA POR SU MIEMBRO DEL ENUM Y NO POR SU VALOR, acá y en todo el archivo. Además de ser
 * la forma correcta de referirse a ellos, hay un gate del plano de consultas (`TS-102`) que exige
 * que el valor crudo de un `entity_type` aparezca en UN SOLO archivo de `core/src/` — el mapa de
 * traducción de `queries/entity-type.ts`—, y este módulo no es una segunda copia de ese mapa:
 * resuelve un proyecto, no traduce un nombre.
 *
 * CADA RESOLUTOR DEVUELVE `null` CUANDO LA CADENA SE CORTA en cualquier eslabón, y `null` DENIEGA.
 * Es el precedente literal de `hasProjectPermission`: `if (!projectId) return false`.
 */
type ProjectResolver = (entityId: number) => Promise<number | null>;

/** `Requirement.projectId` por PK, o `null` si el requisito no existe. */
async function projectOfRequirement(requirementId: number): Promise<number | null> {
  const requirement = await Requirement.findByPk(requirementId, { attributes: ['projectId'] });
  return requirement?.projectId ?? null;
}

/** `Objective.projectId` por PK, o `null` si la tarea no existe. */
async function projectOfObjective(objectiveId: number): Promise<number | null> {
  const objective = await Objective.findByPk(objectiveId, { attributes: ['projectId'] });
  return objective?.projectId ?? null;
}

/** `RequirementActivity` → su requisito → el proyecto. Dos saltos, como en la api. */
async function projectOfRequirementComment(activityId: number): Promise<number | null> {
  const activity = await RequirementActivity.findByPk(activityId, {
    attributes: ['requirementId'],
  });
  return activity ? projectOfRequirement(activity.requirementId) : null;
}

/** `ObjectiveActivity` → su tarea → el proyecto. */
async function projectOfObjectiveComment(activityId: number): Promise<number | null> {
  const activity = await ObjectiveActivity.findByPk(activityId, { attributes: ['objectiveId'] });
  return activity ? projectOfObjective(activity.objectiveId) : null;
}

export const ENTITY_PROJECT_RESOLVERS: Readonly<Record<string, ProjectResolver>> = {
  /**
   * EL `entityId` **ES** EL `projectId`. Se verifica que el proyecto exista igual: un id de
   * proyecto borrado o inventado no puede resolver a sí mismo y pasar el chequeo por casualidad
   * si alguien cargara una fila de permiso huérfana.
   */
  [AttachmentEntityType.Project]: async (entityId) => {
    const project = await Project.findByPk(entityId, { attributes: ['id'] });
    return project ? entityId : null;
  },

  [AttachmentEntityType.Requirement]: projectOfRequirement,

  /**
   * `Objective.projectId`, Y NADA MÁS. La api aplica además creador y asignación
   * (`canUserAccessObjective`); acá no — ver D-5 en el bloque de arriba.
   */
  [AttachmentEntityType.Objective]: projectOfObjective,

  [AttachmentEntityType.RequirementComment]: projectOfRequirementComment,

  [AttachmentEntityType.ObjectiveComment]: projectOfObjectiveComment,

  /**
   * LEGADO: solo filas no migradas. PRUEBA LAS DOS CADENAS —tarea primero, requisito después—
   * EN ESE ORDEN, igual que la api, porque los ids de `objective_activity` y
   * `requirement_activity` SE PISAN y sin el tipo no hay forma de saber cuál es.
   *
   * Se remueve cuando **S-096** confirme que no quedan `attachments` con
   * `entity_type = 'comment'` en producción.
   */
  [AttachmentEntityType.Comment]: async (entityId) => {
    const fromObjective = await projectOfObjectiveComment(entityId);
    return fromObjective ?? projectOfRequirementComment(entityId);
  },

  /**
   * El `entityId` puede ser un requisito O una tarea, según el origen del borrador. PRUEBA
   * REQUISITO Y DESPUÉS TAREA, en ese orden, igual que `hasProjectPermission`.
   */
  [AttachmentEntityType.CommentDraft]: async (entityId) => {
    const fromRequirement = await projectOfRequirement(entityId);
    return fromRequirement ?? projectOfObjective(entityId);
  },

  /** Para los borradores de entidad, el `entityId` **es** el `projectId` (`canUserViewEntity`). */
  [AttachmentEntityType.ObjectiveDraft]: async (entityId) => {
    const project = await Project.findByPk(entityId, { attributes: ['id'] });
    return project ? entityId : null;
  },
  [AttachmentEntityType.RequirementDraft]: async (entityId) => {
    const project = await Project.findByPk(entityId, { attributes: ['id'] });
    return project ? entityId : null;
  },

  /**
   * DENIEGA SIEMPRE, Y ESTÁ DECLARADO A PROPÓSITO EN VEZ DE ESTAR AUSENTE. El concepto de etapa
   * se eliminó: LA TABLA YA NO EXISTE, así que los adjuntos históricos con este `entity_type`
   * quedan sin proyecto que verificar. Es literalmente lo que hace `hasProjectPermission` en la
   * api (`return false`), y declararlo acá deja escrito que la decisión se tomó — un lector que
   * lo encontrara ausente no sabría si fue eso o un olvido.
   */
  [AttachmentEntityType.Stage]: async () => null,
};

/**
 * El proyecto de una entidad, o `null` si no se puede resolver.
 *
 * NUNCA LANZA POR UN TIPO O UN ID INVÁLIDO, y `null` DENIEGA en los tres casos que lo producen:
 * el tipo no está en la tabla, la entidad no existe, o la cadena se corta en un eslabón. Un fallo
 * de la BASE sí propaga: quien llama lo traduce a `internal_error`, que es una respuesta distinta
 * de "no tenés permiso" y no puede confundirse con ella.
 *
 * EL `entityId` SE VALIDA ANTES DE CONSULTAR: `params` del registry llega SIEMPRE como string y
 * un valor no numérico haría que PostgreSQL lance por tipo inválido en vez de devolver `null` —
 * y el despachador lo traduciría a `internal_error`, que es justo lo que un id mal formado NO
 * tiene que producir. Es el mismo criterio que `files-request-download.ts` ya aplica.
 */
export async function resolveEntityProject(
  entityType: string,
  entityId: number | null
): Promise<number | null> {
  if (entityId === null || !Number.isInteger(entityId) || entityId <= 0) {
    return null;
  }

  const resolver = ENTITY_PROJECT_RESOLVERS[entityType];
  if (!resolver) {
    return null;
  }

  return resolver(entityId);
}

/**
 * De dónde sale el id de la entidad que el comando toca.
 *
 *   params  -> el `{id}` del subject, extraído por el registry. SIEMPRE STRING.
 *   payload -> un campo del payload YA VALIDADO por Joi, así que ya es del tipo declarado.
 */
type EntitySource =
  | { readonly from: 'params'; readonly key: string }
  | { readonly from: 'payload'; readonly key: string };

export interface CommandEntity {
  /**
   * Tipo fijo, o `'polymorphic'` cuando LA FILA MISMA dice de qué entidad es: `attachments` no
   * tiene claves foráneas hacia las entidades (`docs/db-schemas/jiku.md`), así que su
   * `entity_type` se lee de la fila y no se puede declarar acá.
   */
  readonly entityType: AttachmentEntityType | 'polymorphic';
  readonly source: EntitySource;
}

/**
 * EL MAPA COMANDO → ENTIDAD. CERRADO, y LAS TRES COSAS QUE PUEDE DECIR NO SON DOS:
 *
 *   descriptor -> hay entidad: resolvé el proyecto y exigí la fila en `user_project_permissions`
 *   null       -> NO HAY entidad que chequear: **PASA**. Es la paridad exacta con la api, donde la
 *                 ruta simplemente NO LLEVA `validateProjectPermissions`
 *   ausente    -> **DENIEGA**. Es ADR-008 para un comando que nadie declaró
 *
 * CONFUNDIR `null` CON AUSENTE ES UN BUG DE SEGURIDAD EN LAS DOS DIRECCIONES. Tratar `null` como
 * ausente rompe `POST /api/opus/attachments`, cuyo test afirma que un `external-user` SIN NINGÚN
 * permiso de proyecto recibe 201 (*"`canUserAccessEntity` no tiene sobre qué operar"*,
 * `api/lib/routes/attachments-post.ts`). Tratar ausente como `null` dejaría pasar en modo externo
 * el comando 21 —que todavía no existe— sin que nadie lo decidiera.
 *
 * LAS 20 CLAVES SON LAS DE `registry.patterns()`, ni una más ni una menos, y hay un gate que lo
 * verifica contra el registry en vez de contra una lista a mano.
 *
 * DE DÓNDE SALE ESTE MAPA: de QUÉ RUTA DE ESCRITURA APLICA HOY LA CAPA 3 de la api, verificado con
 * `grep` sobre `api/lib/routes/`. Los `null` llevan el archivo de ruta que NO la aplica: ese dato
 * es lo que hace auditable la decisión, y sin él la lista parece arbitraria.
 */
export const COMMAND_ENTITY: Readonly<Record<string, CommandEntity | null>> = {
  // ── Los 12 que NO chequean entidad ──────────────────────────────────────────────────────────
  //
  // NINGUNA de sus rutas lleva `validateProjectPermissions` ni `canUserAccessEntity` hoy.
  //
  // `projects.{id}.edit`, `tasks.*` y `worked-times.*` LLEVAN `null` AUNQUE SÍ TOCAN UN PROYECTO,
  // y es deliberado: declararles el chequeo sería ENDURECER, y esta story MIGRA reglas, no las
  // inventa. Si alguien quiere endurecerlas, es una decisión de producto con su propio REQ.
  'clients.new': null, //                    api/lib/routes/clients-post.ts — sin capa 3
  'clients.{id}.edit': null, //              api/lib/routes/clients-id-patch.ts — sin capa 3
  'projects.new': null, //                   api/lib/routes/projects-post.ts — sin capa 3
  'projects.{id}.edit': null, //             api/lib/routes/projects-id-patch.ts — sin capa 3
  'tasks.new': null, //                      api/lib/routes/objectives-post.ts — sin capa 3
  'tasks.{id}.edit': null, //                api/lib/routes/objectives-id-patch.ts — sin capa 3
  'tasks.{id}.comment': null, //             api/lib/routes/objectives-id-comments-post.ts — idem
  // `attachments-post.ts:44` NO aplica capa 3 DELIBERADAMENTE: al pedir el ticket de subida
  // todavía no hay vínculo, así que "`canUserAccessEntity` no tiene sobre qué operar".
  'files.request-upload': null,
  'worked-times.new': null, //               api/lib/routes/worked-times-post.ts — sin capa 3
  'worked-times.{id}.delete': null, //       api/lib/routes/worked-times-id-delete.ts — sin capa 3
  'unworked-times.new': null, //             api/lib/routes/unworked-times-post.ts — sin capa 3
  'unworked-times.{id}.delete': null, //     api/lib/routes/unworked-times-id-delete.ts — sin capa 3

  // ── Los 6 de requisitos, que sus rutas de opus SÍ chequean ──────────────────────────────────
  //
  // `opus-requirements-*.ts` llevan `validateProjectPermissions`.
  //
  // `requirements.new` ES EL ÚNICO DE LOS SEIS QUE NO SACA EL ID DEL SUBJECT: el requisito
  // todavía no existe, así que el proyecto viene DEL PAYLOAD (`projectId`, ya validado por Joi
  // como entero requerido) y el tipo de entidad es `project`, no `requirement`.
  'requirements.new': {
    entityType: AttachmentEntityType.Project,
    source: { from: 'payload', key: 'projectId' },
  },
  'requirements.{id}.edit': {
    entityType: AttachmentEntityType.Requirement,
    source: { from: 'params', key: 'id' },
  },
  // Ninguna ruta HTTP lo publica (la resolución entra por `.edit`), así que no hereda una capa 3
  // de nadie: se declara como el GEMELO SEMÁNTICO de `.edit`, que es lo que es.
  'requirements.{id}.resolve': {
    entityType: AttachmentEntityType.Requirement,
    source: { from: 'params', key: 'id' },
  },
  'requirements.{id}.comment': {
    entityType: AttachmentEntityType.Requirement,
    source: { from: 'params', key: 'id' },
  },
  'requirements.{id}.subscriptors.new': {
    entityType: AttachmentEntityType.Requirement,
    source: { from: 'params', key: 'id' },
  },
  'requirements.{id}.subscriptors.{userId}.delete': {
    entityType: AttachmentEntityType.Requirement,
    source: { from: 'params', key: 'id' },
  },

  // ── Los 2 polimórficos ──────────────────────────────────────────────────────────────────────
  //
  // `attachments-delete.ts` llama a `canUserAccessEntity(user, roles, attachment.entityType,
  // attachment.entityId)`: el tipo sale DE LA FILA, no del comando.
  'attachments.{id}.delete': {
    entityType: 'polymorphic',
    source: { from: 'params', key: 'id' },
  },
  // `attachments-download.ts` · `attachments-preview.ts` · `opus-attachments-preview.ts` llaman a
  // `canUserViewEntity(...)` sobre el vínculo. Acá el id es del ARCHIVO y los vínculos son varios:
  // ver `resolveFileProjects`.
  'files.{fileId}.request-download': {
    entityType: 'polymorphic',
    source: { from: 'params', key: 'fileId' },
  },
};

/** El id que el descriptor señala, ya convertido a entero, o `null` si no se puede. */
export function readEntityId(
  source: EntitySource,
  params: Record<string, string>,
  payload: unknown
): number | null {
  const raw =
    source.from === 'params'
      ? params[source.key]
      : (payload as Record<string, unknown> | null)?.[source.key];

  // `params` llega SIEMPRE como string; el payload ya pasó por Joi. `Number(undefined)` es `NaN`
  // y `Number('')` es 0, así que los dos caen en la guarda de abajo y DENIEGAN — nunca explotan.
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * EL MENSAJE DE `access_denied`. En español (convención `error-handling`) y SIN DATOS INTERNOS:
 * no nombra el proyecto, ni la entidad, ni la tabla, ni el subject —que transporta el user id
 * (CA-32 del REQ)—.
 *
 * ES DISTINTO DEL DE `caller_not_authorized`, Y LA DIFERENCIA ES EL CRITERIO (CA-10):
 *
 *   caller_not_authorized -> "¿tu rol habilita este método?"   lo decide EL MAPA, antes del dominio
 *   access_denied         -> "¿podés tocar ESTA entidad?"      lo decide LA COMPUERTA, con la fila
 *                                                              delante
 *
 * NO SE FUSIONAN: obligaría a un futuro consumidor a mapear un código a dos causas, y
 * `access_denied` es además EL CÓDIGO QUE LOS DOS FRONTENDS YA CONOCEN para este caso, que es lo
 * que mantiene el contrato HTTP sin tocar una línea de UI.
 */
const ACCESS_DENIED_MESSAGE = 'No tenés permiso sobre esta entidad';

/**
 * ¿Existe la fila `(userId, projectId)` en `user_project_permissions`?
 *
 * El acceso es por el unique `uk_user_project_permissions (user_id, project_id)` de la migración
 * `20260529_07`. `attributes: ['id']` porque la pregunta es de EXISTENCIA: no hace falta traer la
 * fila entera para responderla.
 */
async function hasProjectPermission(userId: string, projectId: number): Promise<boolean> {
  const permission = await UserProjectPermission.findOne({
    where: { userId, projectId },
    attributes: ['id'],
  });
  return permission !== null;
}

/**
 * EL POLIMÓRFICO DE `attachments.{id}.delete`: el tipo y el id salen DE LA FILA.
 *
 * `attachments` NO TIENE CLAVES FORÁNEAS hacia las entidades (`docs/db-schemas/jiku.md`), así que
 * la resolución es un `switch` sobre `entity_type` —el de `ENTITY_PROJECT_RESOLVERS`— y no un
 * `include`. Es exactamente lo que hace `attachments-delete.ts` en la api, que llama a
 * `canUserAccessEntity(user, roles, attachment.entityType, attachment.entityId)`.
 *
 * NO FILTRA POR `deleted_at`: si la fila ya está borrada, quien decide qué responder es el comando
 * —que tiene su propio `attachment_not_found`—, no la compuerta. La compuerta solo resuelve el
 * proyecto de lo que haya; si no hay fila, devuelve `null` y deniega.
 */
async function projectOfAttachment(attachmentId: number): Promise<number | null> {
  const attachment = await Attachment.findByPk(attachmentId, {
    attributes: ['entityType', 'entityId'],
  });
  if (!attachment) {
    return null;
  }
  return resolveEntityProject(attachment.entityType, attachment.entityId);
}

/** El vínculo del adjunto resuelve a un proyecto Y el caller tiene la fila para ese proyecto. */
async function canTouchAttachment(userId: string, attachmentId: number): Promise<boolean> {
  const projectId = await projectOfAttachment(attachmentId);
  return projectId !== null && hasProjectPermission(userId, projectId);
}

/**
 * EL POLIMÓRFICO DE `files.{fileId}.request-download`, con la doctrina del recorte `bridge` que el
 * recurso `files` del plano de lectura ya usa (S-027). Un archivo no tiene proyecto propio: lo
 * tienen sus VÍNCULOS, y son varios.
 *
 *   1. ¿hay algún vínculo VIVO del file cuyo proyecto esté permitido?  -> pasa
 *   2. ¿el file NO tiene NINGÚN vínculo vivo y `uploaded_by` es el caller?  -> pasa
 *   3. si no  -> access_denied
 *
 * LA RAMA 2 NO ES UN `orSelfColumn`: entra SOLO cuando la 1 no encontró nada. Si entrara siempre,
 * un archivo vinculado a una entidad que el caller NO PUEDE VER se le filtraría a quien lo subió.
 *
 * @returns `true` si el caller puede pedir el archivo.
 */
async function canDownloadFile(userId: string, fileId: number): Promise<boolean> {
  const links = await Attachment.findAll({
    where: { fileId, deletedAt: null },
    attributes: ['entityType', 'entityId'],
  });

  for (const link of links) {
    const projectId = await resolveEntityProject(link.entityType, link.entityId);
    if (projectId !== null && (await hasProjectPermission(userId, projectId))) {
      return true;
    }
  }

  // RAMA 2, y SOLO acá: el archivo huérfano propio. Un archivo CON vínculos que el caller no
  // alcanza ya se rechazó arriba, aunque lo haya subido él.
  if (links.length > 0) {
    return false;
  }

  const file = await File.findByPk(fileId, { attributes: ['uploadedBy'] });
  return file?.uploadedBy === userId;
}

/**
 * LA COMPUERTA DE ENTIDAD: ¿este caller puede tocar la entidad que este comando toca?
 *
 * SE LLAMA **SOLO EN MODO EXTERNO** (`callerClass === 'external'`), y esa palabra es el criterio
 * entero de la story. `validateProjectPermissions` de la api hace literalmente:
 *
 *     if (!req.decodedTokenRoles.includes('external-user')) { return next(); }
 *
 * LOS USUARIOS INTERNOS NO TIENEN FILAS en `user_project_permissions`: la tabla sostiene el
 * aislamiento del portal de clientes y NO SE ADMINISTRA DESDE NINGUNA INTERFAZ. Llamar a esta
 * función para `admin` y `user` rechazaría CADA COMANDO SOBRE UNA ENTIDAD DE PROYECTO, y el
 * síntoma sería "nadie puede hacer nada". Es H-3 del REQ y el error más caro que S-030 podía
 * cometer. Hay un test de regresión con nombre explícito que falla ruidosamente si alguien lo
 * "endurece".
 *
 * FALLA CERRADA Y TRAE SU PROPIO `try` (ADR-003, *"una compuerta que no puede decidir DENIEGA"*):
 * un fallo de la base durante el chequeo devuelve `internal_error`, NUNCA deja pasar. Está acá y
 * no en el despachador para que el criterio viva en un solo lugar, igual que en `authorizeCaller`.
 *
 * @param command el PATRÓN del comando (`registry.patterns()`), no el método con ids resueltos
 * @param identity el ACTOR: `actor.id` con sobre, el caller del subject sin sobre — nunca el
 *   service user de la api. Es la misma identidad que `resolveActor` elige y que la api usaba en
 *   `req.user.id`
 * @returns `null` si puede, o el `Reply` de falla que el despachador debe devolver
 */
export async function authorizeEntityAccess(
  command: string,
  identity: string,
  params: Record<string, string>,
  payload: unknown
): Promise<Reply<never> | null> {
  try {
    // AUSENTE DEL MAPA -> DENIEGA (ADR-008): un comando que nadie declaró no se autoriza en modo
    // externo. Es distinto de `null`, que es "no hay entidad que chequear" y PASA.
    if (!(command in COMMAND_ENTITY)) {
      return denied(command, identity);
    }

    const descriptor = COMMAND_ENTITY[command];
    if (descriptor === null) {
      return null;
    }

    const entityId = readEntityId(descriptor.source, params, payload);
    if (entityId === null) {
      return denied(command, identity);
    }

    if (descriptor.entityType === 'polymorphic') {
      // Los dos polimórficos resuelven distinto: uno lee el tipo de la fila del vínculo, el otro
      // recorre los vínculos vivos del archivo. Se distinguen por el comando y no por una tercera
      // clave del descriptor, porque son DOS casos y no una familia.
      const allowed =
        command === 'files.{fileId}.request-download'
          ? await canDownloadFile(identity, entityId)
          : await canTouchAttachment(identity, entityId);
      return allowed ? null : denied(command, identity);
    }

    const projectId = await resolveEntityProject(descriptor.entityType, entityId);
    // SIN PROYECTO RESOLUBLE -> DENIEGA, nunca `internal_error` y nunca que pase. Es el precedente
    // literal de `hasProjectPermission` en la api: `if (!projectId) return false`.
    if (projectId === null) {
      return denied(command, identity);
    }

    return (await hasProjectPermission(identity, projectId)) ? null : denied(command, identity);
  } catch (error: any) {
    logger.error(`[auth] commands: no se pudo chequear la entidad de ${command}: ${error.message}`);
    return failure(ErrorCode.INTERNAL_ERROR, 'Internal error');
  }
}

/**
 * El rechazo, en un solo lugar: UN `warn` con prefijo `[auth]`, con el caller y el método y NADA
 * MÁS. Sin el payload —que esta función ni recibe entero—, sin el subject, sin el proyecto y sin
 * el id de la entidad. `warn` y no `error`: es un rechazo que el servicio maneja bien.
 */
function denied(command: string, identity: string): Reply<never> {
  logger.warn(`[auth] commands: sin permiso sobre la entidad: ${identity} -> ${command}`);
  return failure(ErrorCode.ACCESS_DENIED, ACCESS_DENIED_MESSAGE);
}
