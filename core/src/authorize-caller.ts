import { User } from '@jiku/models';
import { ErrorCode, Reply, failure } from '@jiku/nats-protocol';
import { matchesPattern } from './commands/registry';
import { getTrustedPublisherId } from './config';
import logger from './logger';

/**
 * LA COMPUERTA DE AUTORIZACIÓN DEL CALLER: la segunda línea de defensa del producto.
 *
 * `docs/prd/architecture.md` decía hasta REQ-005: "Core no verifica quién actúa... SIN SEGUNDA
 * LÍNEA DE DEFENSA". Esto lo corrige para TODO caller que no sea la api. El hueco que queda es
 * el que ADR-007 ya declara: dentro del canal de la api, core sigue confiando en el
 * `creator`/`author`/`editor` del cuerpo, porque el subject identifica al service user de la api
 * y no a la persona.
 *
 * DOS PLANOS, UNA COMPUERTA. La consumen `bus/dispatcher.ts` (comandos) y `queries/dispatcher.ts`
 * (consultas), en los dos casos ANTES de resolver el método y ANTES de abrir la transacción.
 *
 * VIVE EN `src/` Y NO EN `bus/` NI EN `queries/` por lo mismo que `config.ts` y `logger.ts`: la
 * comparten módulos distintos y no pertenece a ninguno. Dejarla en `bus/` obligaría a `queries/`
 * a importar del módulo del bus — el acoplamiento que `resolve-actor.ts` evitó subiendo un nivel.
 *
 * NO ABRE TRANSACCIÓN, y es una excepción DELIBERADA a la convención `orm` ("toda operación lleva
 * `{ transaction }`, incluidas las lecturas"): acá todavía NO HAY transacción, porque un caller no
 * autorizado no tiene que consumir una conexión de escritura. Mismo criterio con que la validación
 * Joi corre antes de abrirla. Contraste a propósito con `events/auth/user-sync.ts`, que SÍ la
 * pasa: ahí la lectura vive DENTRO de una unidad de trabajo, acá antes de que exista ninguna.
 *
 * LEE POR LA CONEXIÓN DEL DUEÑO, TAMBIÉN EN EL PLANO DE CONSULTAS. `models/read.ts` no registra
 * los modelos a propósito (dos instancias en el mismo proceso se pelean las clases de
 * `@jiku/models` y la segunda las reasigna), así que ahí el ORM no está disponible. La alternativa
 * era SQL explícito contra `ctx.db`, o sea DOS compuertas: la story ya paga un costo de
 * desincronización con la plantilla del callout y no se paga dos veces. Es una lectura POR PK: no
 * hay escritura posible, así que la garantía de ADR-001 —que la api no pueda escribir— no está en
 * juego.
 *
 * DEPENDENCIA IMPLÍCITA: `User` se ata a un Sequelize cuando ALGUIEN importa `src/models`, y lo
 * hacen `src/index.ts` al arrancar y `tests/global-setup.ts` en los tests. Este módulo NO lo
 * importa —igual que `events/auth/user-sync.ts`— porque no abre transacción.
 *
 * SIN CACHE, A PROPÓSITO (CA-17). Cachear reintroduciría los roles obsoletos con una ventana
 * adicional y NO MEDIBLE, para ahorrar un SELECT por PK que el plano caliente NO EJECUTA. Si
 * alguna vez hace falta, el lugar correcto es uno con TTL explícito y documentado, no un
 * diccionario en memoria sin invalidación.
 */

/** Los dos planos con caller en el subject. El de eventos no tiene: no hay a quién autorizar. */
export type Plane = 'commands' | 'queries';

/** TODOS los métodos del plano. Válido en los DOS planos — ver el comentario del mapa. */
const ALL = '*';

interface RolePermissions {
  /**
   * Patrones de comando autorizados, o `ALL`.
   *
   * `ALL` ERA UNA INVARIANTE Y DEJÓ DE SERLO, DELIBERADAMENTE. Hasta que `internal-app` pasó a
   * ser el único rol de conector, este campo era `readonly string[]` a secas y un test lo
   * protegía: *"la escritura se enumera, siempre"*, para que agregar el comando 21 al registry no
   * lo autorizara solo. Se cambió a propósito y hay que saber qué se resignó:
   *
   *   UN COMANDO NUEVO QUEDA AUTORIZADO PARA TODA IDENTIDAD `internal-app` SIN QUE NADIE LO
   *   DECIDA, y no hay ningún test que lo delate.
   *
   * Lo que lo hace tolerable es que la superficie que gobierna hoy es la MISMA que ya autoriza
   * la plantilla del callout: `templates/api.yaml` publica sobre `jiku-commands.v1.>`, un comodín
   * que también cubre el comando 21. Enumerar acá mientras allá hay un `>` era una asimetría que
   * solo el rol difunto `external-publisher` justificaba, porque su plantilla SÍ enumeraba.
   */
  readonly commands: readonly string[] | typeof ALL;
  /** Patrones de consulta autorizados, o `ALL`. */
  readonly queries: readonly string[] | typeof ALL;
}

/**
 * EL MAPA ROL → MÉTODO. Cerrado y DENY-BY-DEFAULT (ADR-008): sin coincidencia, no se autoriza.
 *
 * | Rol                             | Comandos | Consultas | Por qué                                  |
 * |---------------------------------|----------|-----------|------------------------------------------|
 * | internal-app                    |  todos   |   todas   | EL ROL DE CONECTOR (ver abajo)           |
 * | admin · user · external-user    | ninguno  |   todas   | Las reglas de negocio viven en la api    |
 * | core · bus-observer             | ninguno  |  ninguna  | Core no se llama; el observador no publica|
 * | (lista vacía o rol desconocido) | ninguno  |  ninguna  | Sin coincidencia, no se autoriza         |
 *
 * `internal-app` ES AHORA EL ÚNICO ROL DE CONECTOR, y autoriza los DOS planos enteros.
 *
 * Antes autorizaba NADA y la api pasaba solo por la exención del `sub`. La consecuencia era que
 * una SEGUNDA identidad con ese rol —un conector nuevo, o el service user de la api si su `sub`
 * rotara— conectaba al bus, publicaba (la plantilla del callout se lo permite) y se comía un
 * `caller_not_authorized` de core en cada método. Las dos capas decían cosas distintas y solo la
 * exención lo tapaba.
 *
 * LA EXENCIÓN DEL `sub` SIGUE, y no es redundante: es lo que mantiene viva la escritura del
 * producto cuando la api NO TIENE FILA en `users` —evento de autenticación perdido, NATS core sin
 * reintento—. Sin exención ese caso es una caída total y silenciosa de escritura; con ella, la
 * api ni siquiera lee la base. El rol es la red de abajo, para todo caller que no sea la api.
 *
 * EL ROL `external-publisher` SE ELIMINÓ. Enumeraba 9 subjects y espejaba una plantilla propia
 * del callout, para el canal que REQ-001 RF-11 definió: un servicio externo que sube archivos y
 * los vincula sin pasar por la api. Ese rol NUNCA EXISTIÓ EN ZITADEL, así que el canal jamás se
 * usó y las dos enumeraciones eran configuración muerta que había que mantener sincronizada a
 * mano. La CAPACIDAD no desaparece —un servicio externo lleva `internal-app`— pero **cambia de
 * tamaño**: donde antes recibía 9 subjects enumerados, ahora recibe los dos planos completos.
 * Reducirlo otra vez es crear un rol de conector acotado, con su plantilla y su entrada acá.
 *
 * LOS ROLES DE PRODUCTO NO AUTORIZAN NINGÚN COMANDO, Y ES EL CRITERIO QUE ALGUIEN VA A QUERER
 * "ARREGLAR" (CA-4). `core` no tiene las reglas de negocio que dependen del usuario final: están
 * en la api y están enumeradas en su `overview.md` — la ventana de carga de horas (día actual + 10
 * previos), quién puede imputar horas a otra persona, y que no se modifiquen semanas pasadas de
 * asignación. Si una persona con rol `user` pudiera publicar `worked-times.new` directo al bus,
 * SALTEARÍA TRES REGLAS que no tienen dónde vivir del lado del escritor. Habilitar comandos para
 * personas es un requerimiento propio (FG-4), no un renglón acá.
 *
 * `core` Y `bus-observer` FIGURAN CON LISTAS VACÍAS en vez de estar ausentes. Autorizan lo mismo
 * (nada), pero así este mapa es la TABLA COMPLETA de los roles que pueden conectar al bus, que es
 * lo que alguien va a leer para auditarlo.
 *
 * `queries: ALL` PARA LOS TRES ROLES DE PRODUCTO, y lo autoriza el contrato: `docs/apis/core.yaml`
 * dice "the product roles get EVERY QUERY and no command". La consecuencia —una consulta futura
 * queda autorizada para esos tres sin tocar este mapa— ES la intención de "todas las consultas".
 *
 * UN ROL NUEVO CON ACCESO AL BUS DEBE DECLARARSE ACÁ **Y** EN SU PLANTILLA DEL CALLOUT. Un rol
 * ausente no autoriza nada, que es el default correcto — pero el síntoma es "le di el rol y no
 * puede hacer nada", así que conviene saber dónde mirar.
 */
export const ROLE_METHODS: Readonly<Record<string, RolePermissions>> = {
  'internal-app': { commands: ALL, queries: ALL },
  admin: { commands: [], queries: ALL },
  user: { commands: [], queries: ALL },
  'external-user': { commands: [], queries: ALL },
  core: { commands: [], queries: [] },
  'bus-observer': { commands: [], queries: [] },
};

/**
 * EL MENSAJE ES UNO SOLO, Y ESO ES PARTE DEL CRITERIO. CA-9 pide el mismo `errorCode` para "no
 * hay fila" y "hay fila pero ningún rol autoriza": si el MENSAJE difiriera, el mensaje sería el
 * oráculo de existencia que el código evita. En español (convención `error-handling`) y SIN datos
 * internos: ni el caller, ni el método, ni si la fila existe.
 */
const DENIED_MESSAGE = 'El caller no está autorizado a ejecutar este método';

/**
 * ¿Alguno de los roles del caller autoriza este método en este plano?
 *
 * UNIÓN, NO PRECEDENCIA: alcanza con que UN rol lo autorice. Difiere a propósito de `rules.yaml`
 * del callout, que evalúa las reglas EN ORDEN y gana la primera que matchea. Acá un rol es un
 * permiso, no una clase, así que `['internal-app','external-user']` publica todos los comandos:
 * el rol de MENOR privilegio no puede recortar lo que otro ya autorizó. Ojo con la asimetría — la
 * CLASE del caller (`queries/caller-class.ts`) resuelve al revés, con el más restrictivo ganando,
 * porque ahí la pregunta es cuánto recortar y no qué permitir.
 *
 * Un rol que no está en el mapa se SALTEA (no autoriza y no rompe): es el deny-by-default de
 * ADR-008, y es lo que hace aceptable guardar `roles` sin validar contra ningún catálogo — un rol
 * inventado en Zitadel no autoriza nada.
 */
export function rolesAuthorize(roles: readonly string[], method: string, plane: Plane): boolean {
  for (const role of roles) {
    const permissions = ROLE_METHODS[role];
    if (!permissions) {
      continue;
    }

    const allowed = permissions[plane];
    if (allowed === ALL) {
      return true;
    }
    if (allowed.some((pattern) => matchesPattern(pattern, method))) {
      return true;
    }
  }

  return false;
}

/**
 * LA LECTURA, SOLA. Extraída para que el plano de CONSULTAS pueda hacer UN SOLO SELECT y
 * alimentar con él las DOS compuertas (S-023, CA-5): la de método —esta— y la de clase del
 * caller, que vive en `queries/caller-class.ts` y responde otra pregunta.
 *
 * `roles` es JSONB SIN CHECK y la tabla es escribible por SQL, así que un valor que no sea un
 * array es alcanzable. La guarda lo convierte en "sin roles" y no en un `internal_error`: fallar
 * cerrado también acá.
 *
 * NO CAPTURA, y es deliberado: quien la llama decide qué hacer con el fallo. En los dos planos
 * ese "quien" ya tiene su try/catch, y la compuerta que no puede decidir DENIEGA. Capturar acá
 * devolvería `[]` —o sea, un rechazo mudo— y perdería la distinción entre "no autorizado" y "la
 * base no contesta", que son `caller_not_authorized` e `internal_error`.
 */
export async function readCallerRoles(caller: string): Promise<readonly string[]> {
  // SIN TRANSACCIÓN (ver el bloque de arriba) y POR PK, contra una tabla de decenas de filas.
  const user = await User.findByPk(caller);
  return Array.isArray(user?.roles) ? user.roles : [];
}

/**
 * LA DECISIÓN, SOLA: ¿puede este caller ejecutar este método en este plano?
 *
 * NO TOCA LA BASE. Recibe los `roles` ya leídos, que es lo que permite que el despachador de
 * consultas pague UN SOLO `SELECT` para las dos compuertas.
 *
 * VUELVE A COMPARAR CONTRA `getTrustedPublisherId()` aunque `authorizeCaller` ya lo hizo antes de
 * leer. No es una repetición ociosa: son dos cosas distintas. La comparación de allá arriba
 * existe para NO LEER; esta existe para DECIDIR. Manteniéndola acá, la exención es una propiedad
 * de la COMPUERTA y no del orden en que alguien encadene las llamadas — y el plano de consultas,
 * que lee SIEMPRE (CA-8), la conserva sin tener que reimplementarla.
 *
 * @returns `null` si está autorizado, o el `Reply` de falla que el despachador debe devolver.
 */
export function authorizeWithRoles(
  caller: string,
  roles: readonly string[],
  method: string,
  plane: Plane
): Reply<never> | null {
  if (caller === getTrustedPublisherId()) {
    return null;
  }

  if (rolesAuthorize(roles, method, plane)) {
    return null;
  }

  // UN SOLO CÓDIGO Y UN SOLO MENSAJE para "sin fila" y "rol sin permiso" (CA-9): distinguirlos
  // le diría a un caller no autorizado si una identidad existe en la base, que es un oráculo
  // gratis. `user_not_found` NO se reusa por eso mismo, y porque ya mapea a 404 en la api — el
  // status equivocado para un rechazo de permisos.
  //
  // SE LOGUEAN EL CALLER Y EL MÉTODO, NUNCA EL PAYLOAD (que este módulo ni recibe). `warn` y no
  // `error`: es entrada inválida que el servicio maneja bien, y un `failure` no es un error.
  // Prefijo `[auth]` para que TODO rechazo de autorización de los dos planos se grepee con una
  // sola línea.
  //
  // EL CAMINO AUTORIZADO NO LOGUEA NADA, y no es preferencia: `attachments.test.ts` afirma
  // `warn.called === false` en un despacho de caller externo. Un log acá rompe esa aserción.
  logger.warn(`[auth] ${plane}: caller no autorizado: ${caller} -> ${method}`);
  return failure(ErrorCode.CALLER_NOT_AUTHORIZED, DENIED_MESSAGE);
}

/**
 * Autoriza —o no— al caller de un subject a ejecutar un método.
 *
 *   caller === CORE_TRUSTED_PUBLISHER_ID  -> pasa SIN consultar la base
 *   si no                                 -> User.findByPk(caller)
 *                                              sin fila                       -> rechazo
 *                                              con fila, ningún rol autoriza  -> el MISMO rechazo
 *
 * @returns `null` si está autorizado, o el `Reply` de falla que el despachador debe devolver.
 *
 * DESDE S-023 ES LA COMPOSICIÓN DE LAS DOS FUNCIONES DE ARRIBA, y su comportamiento no cambió ni
 * en un carácter: el suite de comandos pasa sin tocar una sola aserción (CA-6). Quien la sigue
 * usando es el plano de COMANDOS; el de consultas ahora encadena `readCallerRoles` +
 * `authorizeWithRoles` por su cuenta, porque necesita esos mismos `roles` para resolver la clase.
 *
 * NUNCA RECHAZA, y no es una precaución: `getTrustedPublisherId()` lanza si `loadConfig()` no
 * corrió, y `findByPk` puede rechazar (base caída, pool agotado). Los dos ocurrirían ANTES del
 * `try` de cada despachador, así que ESCAPARÍAN de `dispatch()`, y "el despachador nunca lanza"
 * (ADR-003) no admite un camino donde sí. Mismo razonamiento que el `try` propio de
 * `sequelize.transaction()` en `events/dispatcher.ts`.
 *
 * Y FALLA CERRADA: ante lo inesperado devuelve `internal_error`, NO `null`. Una compuerta que no
 * puede decidir DENIEGA; dejar pasar convertiría una base caída en un bypass de autorización.
 * `internal_error` y no `caller_not_authorized` porque no es culpa del caller — lo que importa es
 * que el comando no se ejecuta.
 */
export async function authorizeCaller(
  caller: string,
  method: string,
  plane: Plane
): Promise<Reply<never> | null> {
  try {
    // LA EXENCIÓN DEL CANAL DE LA API (CA-1, CA-2). Una comparación de strings, sin base: es el
    // 100% del tráfico de hoy y no paga ni una consulta ni un milisegundo.
    //
    // ESTE CORTOCIRCUITO ES EL QUE TIENE QUE QUEDAR ANTES DE LA LECTURA, y es la diferencia
    // deliberada con el plano de consultas: allá la clase del caller la necesita TODO caller —la
    // api incluida (CA-8)—, así que allá se lee siempre. Acá no hay clase que resolver, y leer
    // sería pagar un SELECT por cada escritura del producto.
    //
    // REUSA `getTrustedPublisherId()`, LA MISMA FUNCIÓN QUE `resolve-actor.ts` YA USA, sobre la
    // misma constante y con el mismo argumento (la api ya autenticó a la persona contra Zitadel
    // por JWT, y ya autorizó por rol con `hasAnyRole` ANTES de publicar). Consultar `users.roles`
    // del service user de la api sería autorizar dos veces la misma cosa por dos fuentes
    // distintas, con la peor de las dos decidiendo.
    //
    // Y SIN ESTA RAMA HAY UNA CAÍDA TOTAL Y SILENCIOSA DE ESCRITURA: si la api conecta al bus
    // antes de que core esté suscripto, su evento de autenticación se PIERDE (NATS core, sin
    // reintento y sin registro), la api queda conectada y funcional SIN FILA EN `users`, y core
    // rechaza LOS 20 COMANDOS. El síntoma es un 403 en cada escritura del producto y la causa es
    // un mensaje perdido hace horas, que se corrige sola "cuando la api reconecte" — con un token
    // de ~1 h renovado en caliente, potencialmente en DÍAS.
    if (caller === getTrustedPublisherId()) {
      return null;
    }

    const roles = await readCallerRoles(caller);

    return authorizeWithRoles(caller, roles, method, plane);
  } catch (error: any) {
    logger.error(`[auth] ${plane}: no se pudo autorizar ${method}: ${error.message}`);
    return failure(ErrorCode.INTERNAL_ERROR, 'Internal error');
  }
}

export default authorizeCaller;
