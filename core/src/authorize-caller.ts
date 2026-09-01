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
  /**
   * Patrones de comando autorizados cuando el comando llega CON SOBRE, o sea publicado por la api
   * en nombre de una persona (S-029). AUSENTE SIGNIFICA "los mismos que `commands`", y por eso
   * cinco de los seis roles no lo declaran.
   *
   * LO DECLARAN DOS ROLES, Y LOS DOS POR LA MISMA RAZÓN: HAY COMANDOS QUE UNA PERSONA ALCANZA
   * SOLO PORQUE LA API LOS PUBLICA EN SU NOMBRE, y que NO tiene por qué poder publicar sola.
   *
   * `user` suma uno —`requirements.{id}.subscriptors.new`, el comando secundario de
   * `POST /api/opus/requirements`— y su canal directo NO lo lleva: ver `USER_ENVELOPE_COMMANDS`.
   *
   * `external-user` es el caso extremo, y LA ASIMETRÍA *ES* LA DECISIÓN DEL PRODUCTO:
   *
   *   un `external-user` NO ESCRIBE POR EL BUS (REQ-007 §20, CA-3). Su plantilla del callout no
   *   le da permiso de publicación, y este mapa es la SEGUNDA DEFENSA INDEPENDIENTE que el REQ
   *   exige para el caso de que esa plantilla se equivocara.
   *
   *   pero SÍ ESCRIBE POR EL PORTAL, y eso no cambió: seis endpoints de la superficie opus
   *   declaran `hasAnyRole([... 'external-user'])` y publican un comando. Desde S-029 esa
   *   escritura llega acá CON SOBRE y con `actor.roles: ['external-user']`, y desde S-030 el rol
   *   que decide es el del ACTOR (CA-2) y ya no el de la api.
   *
   * CON UN SOLO CAMPO HAY QUE ELEGIR ENTRE ROMPER EL PORTAL O ABRIR EL BUS. Con `commands: []` a
   * secas, los seis caminos vivos del portal empiezan a responder 403 —el `FakeBus` de la api
   * ejecuta `core` REAL, así que hay cinco archivos de test que lo demuestran— y eso contradice
   * RF-1 del REQ ("los `external-user` siguen escribiendo únicamente por el portal vía HTTP"),
   * CA-11 ("sin tocar una línea de UI") y CA-14 ("la duplicación transitoria es la red"). Con los
   * seis en `commands`, se pierde la segunda defensa. Con dos campos, no hay que elegir.
   *
   * DESAPARECE si algún día `external-user` deja de escribir por el portal, o si su plantilla del
   * callout gana publicación — que es un cambio de seguridad por ADR-007, no un renglón acá.
   */
  readonly envelopeCommands?: readonly string[] | typeof ALL;
  /** Patrones de consulta autorizados, o `ALL`. */
  readonly queries: readonly string[] | typeof ALL;
}

/**
 * POR QUÉ CANAL LLEGÓ EL MÉTODO. Solo el plano de COMANDOS tiene sobre: las consultas no lo
 * llevan (REQ-006 §19), así que el plano de lectura no elige canal y siempre lee `queries`.
 *
 *   direct   -> el caller publicó DIRECTO al bus, sin sobre. Su identidad es el segundo token del
 *               subject y sus roles salen de `users`
 *   envelope -> el comando lo publicó el publicador de confianza EN NOMBRE DE UNA PERSONA, y los
 *               roles que deciden son los del sobre (CA-2)
 *
 * EL DEFAULT ES `'direct'` Y ES LA ELECCIÓN SEGURA: un llamador que se olvide del parámetro
 * obtiene la lista MÁS RESTRICTIVA, nunca la del sobre.
 */
export type Channel = 'direct' | 'envelope';

/**
 * Qué lista de patrones aplica, según el plano y el canal.
 *
 * `?? commands` Y NO UN `if`: la AUSENCIA de `envelopeCommands` SIGNIFICA "los mismos que
 * `commands`", así que cinco de los seis roles no declaran nada y el mapa no repite seis líneas.
 */
function allowedFor(
  permissions: RolePermissions,
  plane: Plane,
  channel: Channel
): readonly string[] | typeof ALL {
  if (plane === 'queries') {
    return permissions.queries;
  }
  return channel === 'envelope'
    ? (permissions.envelopeCommands ?? permissions.commands)
    : permissions.commands;
}

/**
 * EL MAPA ROL → MÉTODO. Cerrado y DENY-BY-DEFAULT (ADR-008): sin coincidencia, no se autoriza.
 *
 * | Rol                | Comandos DIRECTOS | Comandos CON SOBRE | Consultas | Por qué                      |
 * |--------------------|-------------------|--------------------|-----------|------------------------------|
 * | internal-app       | todos             | todos              | todas     | EL ROL DE CONECTOR           |
 * | admin              | los 18 enumerados | (los mismos 18)    | todas     | paridad con su `hasAnyRole`  |
 * | user               | los 18 enumerados | esos 18 + 1        | todas     | paridad con su `hasAnyRole`  |
 * | external-user      | NINGUNO           | los 6 del portal   | todas     | no escribe POR EL BUS (D-1)  |
 * | core · bus-observer| ninguno           | ninguno            | ninguna   | Core no se llama; el observador no publica |
 * | (vacío o desconocido) | ninguno        | ninguno            | ninguna   | Sin coincidencia, no se autoriza |
 *
 * ============================================================================================
 * DE DÓNDE SALE LA ENUMERACIÓN, Y POR QUÉ NO SE EDITA A MANO
 * ============================================================================================
 *
 * SALE DEL `x-roles` DE `docs/apis/api.yaml`, ENDPOINT POR ENDPOINT: es literalmente la lista que
 * `hasAnyRole` aplica hoy sobre HTTP. Traducirla en vez de escribirla de memoria es lo que hace
 * que la paridad sea VERIFICABLE en vez de declarada, y HAY UN TEST QUE LA VERIFICA CONTRA EL
 * SPEC (`tests/auth/role-map-parity.test.ts`). Si tocás una línea de estas listas sin tocar el
 * spec, ese test se pone rojo. Es a propósito.
 *
 * La regla de derivación, escrita para que un test la pueda correr. Un rol `R` de
 * `{admin, user, external-user}` autoriza el comando `C` si y solo si:
 *
 *   (a) algún endpoint con `x-bus-command: C` declara `x-roles` que contiene `R`; o
 *   (b) algún endpoint que publica `C` NO declara `x-roles` y `R` es `admin` o `user`; o
 *   (c) `C` no tiene NINGÚN endpoint que lo publique y `R` es `admin` o `user`.
 *
 * POR QUÉ (b) RECORTA A `external-user`. Un endpoint sin `hasAnyRole` "es alcanzable por
 * cualquier usuario autenticado, incluido un `external-user`", y el propio spec lo llama DEUDA:
 * "La ausencia no es una convención, es deuda". Traducir esa deuda a un permiso DECLARADO del bus
 * le daría a `external-user` escritura sobre clientes, proyectos, objetivos, horas y ausencias —
 * trece comandos que ninguna pantalla del portal usa. SE TRADUCE LA INTENCIÓN, NO LA DEUDA.
 *
 * POR QUÉ (c). `requirements.{id}.resolve` es el único comando que NINGUNA ruta HTTP publica
 * (`docs/apis/core.yaml`: "NO HTTP ROUTE PUBLISHES IT — but the rule IS enforced"), así que no
 * tiene `x-roles` del que derivar. Se lo dan `admin` y `user` por dos razones convergentes: RF-1
 * del REQ dice que ellos publican los 20 comandos, y el canal es el gemelo semántico de
 * `requirements.{id}.edit`, cuyo `x-roles` es `[user, admin]`. Como ninguna ruta lo publica,
 * incluirlo o no NO CAMBIA NADA HOY.
 *
 * ============================================================================================
 * LAS TRES COSAS QUE ALGUIEN VA A LEER COMO ERROR Y NO LO SON
 * ============================================================================================
 *
 * 1. `admin` Y `user` TIENEN LOS MISMOS 18 EN EL CANAL DIRECTO. La única diferencia entre ellos
 *    está en el canal DEL SOBRE, donde `user` suma `requirements.{id}.subscriptors.new` — ver el
 *    comentario de `USER_ENVELOPE_COMMANDS`. Ningún OTRO endpoint los distingue entre las
 *    escrituras que ya pasan por el bus: la única combinación `['admin']` sola es
 *    `PUT /api/week-assigned-times`, que publica el COMANDO 21 y que S-032 YA ENTREGÓ — por eso
 *    ese comando va en `ADMIN_COMMANDS` y no en la lista de 18. Es coherente con que
 *    `CLASS_BY_ROLE` los meta en la misma CLASE (`internal`): la clase dice qué se les recorta a
 *    nivel de fila —nada, a los dos—, no qué métodos alcanzan.
 *
 * 2. `requirements.{id}.subscriptors.{userId}.delete` NO LO TIENE NINGÚN ROL INTERNO. Su único
 *    endpoint es de la superficie opus y declara `hasAnyRole(['external-user'])`, y ninguna ruta
 *    lo publica como comando secundario. Un `admin` NO PUEDE desuscribir a nadie por HTTP hoy,
 *    así que dárselo por el bus sería AMPLIAR, no migrar. Queda anotado como observación para
 *    S-034/S-035, no como bug.
 *
 * 3. `week-assigned-times.replace` APARECE, Y SOLO PARA `admin` (C-38, S-032). Es el ÚNICO
 *    comando enumerado para un rol de producto sin estar en `INTERNAL_COMMANDS`, y eso NO es una
 *    inconsistencia: esa constante la COMPARTEN `admin` y `user` a propósito —para que no
 *    diverjan—, así que meter el comando 21 ahí se lo daría también a `user`. Su ruta,
 *    `PUT /api/week-assigned-times`, es la única del producto con `x-roles: [admin]` sola. Hay un
 *    gate que verifica que esté para `admin` y NO para `user` ni `external-user`, por los dos
 *    canales.
 *
 * ============================================================================================
 *
 * `internal-app` ES EL ÚNICO ROL DE CONECTOR, y autoriza los DOS planos enteros.
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
 * PERO `internal-app` YA NO ES EL ROL QUE AUTORIZA LAS ESCRITURAS DE LAS PERSONAS (CA-2). Sigue
 * exento como PUBLICADOR —es lo que le permite MANDAR el sobre—, y desde S-030 el rol que decide
 * si un comando se ejecuta es el del ACTOR que viaja en ese sobre. Alguien va a leer esto como
 * que `internal-app` "perdió permisos": no perdió ninguno; lo que cambió es quién decide cuando
 * publica en nombre de otro.
 *
 * EL ROL `external-publisher` SE ELIMINÓ. Enumeraba 9 subjects y espejaba una plantilla propia
 * del callout, para el canal que REQ-001 RF-11 definió: un servicio externo que sube archivos y
 * los vincula sin pasar por la api. Ese rol NUNCA EXISTIÓ EN ZITADEL, así que el canal jamás se
 * usó y las dos enumeraciones eran configuración muerta que había que mantener sincronizada a
 * mano. La CAPACIDAD no desaparece —un servicio externo lleva `internal-app`— pero **cambia de
 * tamaño**: donde antes recibía 9 subjects enumerados, ahora recibe los dos planos completos.
 * Reducirlo otra vez es crear un rol de conector acotado, con su plantilla y su entrada acá.
 *
 * LOS ROLES DE PRODUCTO YA AUTORIZAN COMANDOS, Y ESO ES LO QUE S-030 CAMBIÓ. Hasta esta story
 * este mapa decía "ninguno" para `admin` y `user`, porque las reglas de negocio que dependen del
 * usuario final —la ventana de carga de horas, quién imputa horas a otra persona, las semanas
 * pasadas de asignación— viven en la api y no tenían dónde vivir del lado del escritor. Siguen
 * ahí: REQ-007 las MUDA en S-031, S-032 y S-033, y hasta entonces LA API SIGUE APLICÁNDOLAS (la
 * duplicación transitoria es la red, CA-14). Este mapa no es lo que las reemplaza; es la cerradura
 * que tiene que existir ANTES de que la puerta se abra (la plantilla del callout es S-035).
 *
 * `core` Y `bus-observer` FIGURAN CON LISTAS VACÍAS en vez de estar ausentes. Autorizan lo mismo
 * (nada), pero así este mapa es la TABLA COMPLETA de los roles que pueden conectar al bus, que es
 * lo que alguien va a leer para auditarlo.
 *
 * `queries: ALL` PARA LOS TRES ROLES DE PRODUCTO, y lo autoriza el contrato: `docs/apis/core.yaml`
 * dice que los roles de producto reciben TODAS las consultas. La consecuencia —una consulta futura
 * queda autorizada para esos tres sin tocar este mapa— ES la intención de "todas las consultas".
 *
 * UN ROL NUEVO CON ACCESO AL BUS DEBE DECLARARSE ACÁ **Y** EN SU PLANTILLA DEL CALLOUT. Un rol
 * ausente no autoriza nada, que es el default correcto — pero el síntoma es "le di el rol y no
 * puede hacer nada", así que conviene saber dónde mirar. Y SI EL ROL NUEVO AUTORIZA COMANDOS,
 * TAMBIÉN NECESITA ENTRADA EN `CLASS_BY_ROLE` (`caller-class.ts`): las dos tablas son
 * deliberadamente independientes y hay un gate que verifica que no se desincronicen.
 */

/**
 * LOS 20 COMANDOS DE LOS ROLES INTERNOS. `admin` y `user` reciben LA MISMA LISTA — ver el punto 1
 * de arriba— así que se declara UNA VEZ y se referencia dos: dos copias divergirían en cuanto
 * alguien editara una.
 *
 * SON LOS 22 DEL REGISTRY MENOS LOS DOS DE SUSCRIPTORES, que son exclusivos de `external-user`.
 * El orden sigue al del registry, para que el diff contra `registry.patterns()` se lea de arriba
 * abajo.
 */
const INTERNAL_COMMANDS: readonly string[] = [
  'clients.new', //                                    (b) POST /api/clients — sin `x-roles`
  'clients.{id}.edit', //                              (b) PATCH /api/clients/{id} — sin `x-roles`
  'projects.new', //                                   (b) POST /api/projects — sin `x-roles`
  'projects.{id}.edit', //                             (b) PATCH /api/projects/{id} — sin `x-roles`
  'tasks.new', //                                      (b) POST /api/objectives — sin `x-roles`
  'tasks.{id}.edit', //                                (b) PATCH /api/objectives/{id} — sin `x-roles`
  'tasks.{id}.comment', //                             (b) POST /api/objectives/{id}/comments
  'tasks.{id}.comment.{cid}.edit', //                  (a) [user, admin] — PATCH /api/objectives/{id}/comment/{cid}
  'requirements.new', //                               (a) [user, admin]
  'requirements.{id}.edit', //                         (a) [user, admin]
  'requirements.{id}.resolve', //                      (c) ninguna ruta lo publica — ver arriba
  'requirements.{id}.comment', //                      (a) [user, admin]
  'requirements.{id}.comment.{cid}.edit', //           (a) [user, admin] — PATCH /api/requirements/{reqid}/comments/{cid}
  'attachments.{id}.delete', //                        (b) attachments-delete.ts — sin `hasAnyRole`
  'files.request-upload', //                           (b) attachments-post.ts — sin `hasAnyRole`
  'files.{fileId}.request-download', //                (b) attachments-download/preview — sin rol
  'worked-times.new', //                               (a) [user, admin]
  'worked-times.{id}.delete', //                       (a) [user, admin]
  'unworked-times.new', //                             (b) POST /api/unworked-times — sin `x-roles`
  'unworked-times.{id}.delete', //                     (b) DELETE /api/unworked-times/{id}
];

/**
 * EL COMANDO 21, Y ES DE `admin` SOLO (C-38, S-032).
 *
 * NO VA EN `INTERNAL_COMMANDS`, y esa es la decisión, no un descuido: esa constante la COMPARTEN
 * `admin` y `user` —a propósito, para que no diverjan— así que meterlo ahí se lo daría también a
 * `user`, y C-38 dice justo lo contrario. `PUT /api/week-assigned-times` es la ÚNICA ruta del
 * producto con `x-roles: [admin]` sola, y por eso el comando 21 es el único que rompe la simetría
 * de los 18.
 *
 * `admin` NO NECESITA `envelopeCommands`: su ausencia significa "los mismos que `commands`"
 * (`allowedFor()` hace `envelopeCommands ?? commands`), y `admin` alcanza el comando por los dos
 * canales. Declararlo sería repetir la lista para que después diverja.
 */
const ADMIN_COMMANDS: readonly string[] = [
  ...INTERNAL_COMMANDS,
  'week-assigned-times.replace', //                     (a) PUT /api/week-assigned-times — [admin]
];

/**
 * LO QUE `user` ALCANZA **SOLO POR EL SOBRE**, Y POR QUÉ NO ESTÁ EN SU CANAL DIRECTO.
 *
 * `POST /api/opus/requirements` declara `hasAnyRole(['user','external-user'])` y publica DOS
 * comandos, no uno: `requirements.new` y después `requirements.{id}.subscriptors.new`, porque el
 * creador queda suscripto siempre (`opus-requirements-post.ts`). El `x-bus-command` del spec
 * documenta la correspondencia 1:1 endpoint → comando y por eso solo declara el primero: EL
 * SEGUNDO NO APARECE EN NINGUNA PARTE DEL SPEC.
 *
 * ESO ES EL "RIESGO CRÍTICO" DE LA STORY MANIFESTÁNDOSE: derivar la enumeración solo de los
 * `x-bus-command` deja afuera los comandos que una ruta publica como EFECTO SECUNDARIO, y el
 * síntoma es que un `user` no puede crear un requisito por el portal. Lo detectó la suite de la
 * api —cuyo `FakeBus` ejecuta `core` REAL— y por eso esa suite es parte del criterio de la story.
 *
 * VA EN `envelopeCommands` Y NO EN `commands`, Y LA DISTINCIÓN ES DE SEGURIDAD. Un `user` alcanza
 * este comando ÚNICAMENTE porque la api lo publica EN SU NOMBRE al crear un requisito. Publicando
 * DIRECTO al bus no lo alcanza por ninguna vía: el endpoint de suscripción
 * (`POST /api/opus/requirements/{reqid}/subscriptors`) es `external-user` ONLY. Ponerlo en
 * `commands` le daría a cualquier `user` conectado al bus la capacidad de suscribir A CUALQUIERA
 * a CUALQUIER requisito — MÁS de lo que su superficie HTTP permite hoy. Eso es AMPLIAR, y esta
 * story migra reglas, no las inventa.
 *
 * `admin` NO LO RECIBE POR NINGÚN CANAL, y es correcto: no alcanza ese endpoint (su `hasAnyRole`
 * no lo incluye) y la ruta interna `POST /api/requirements` NO publica el comando de suscripción.
 */
const USER_ENVELOPE_COMMANDS: readonly string[] = [
  ...INTERNAL_COMMANDS,
  // (a) POST /api/opus/requirements — `[user, external-user]`, publicado como comando SECUNDARIO
  'requirements.{id}.subscriptors.new',
];

/**
 * LOS 6 COMANDOS QUE `external-user` ALCANZA POR EL PORTAL, y SOLO con sobre (D-1).
 *
 * Son exactamente los seis endpoints de la superficie opus que declaran `external-user` en su
 * `hasAnyRole` y publican un comando. CERO AMPLIACIÓN respecto de lo que puede hacer hoy: si un
 * comando entra o sale de esta lista, un camino del portal se abre o se rompe.
 *
 * NINGUNO DE ESTOS SEIS ES ALCANZABLE PUBLICANDO DIRECTO AL BUS: para eso está `commands: []`.
 */
const EXTERNAL_ENVELOPE_COMMANDS: readonly string[] = [
  'requirements.new', //                               POST /api/opus/requirements
  'requirements.{id}.comment', //                      POST /api/opus/requirements/{reqid}/comments
  'requirements.{id}.subscriptors.new', //             POST   …/{reqid}/subscriptors
  'requirements.{id}.subscriptors.{userId}.delete', // DELETE …/{reqid}/subscriptors/{userId}
  'files.request-upload', //                           POST /api/opus/attachments
  'files.{fileId}.request-download', //                GET  /api/opus/attachments/{id}/preview
];

export const ROLE_METHODS: Readonly<Record<string, RolePermissions>> = {
  'internal-app': { commands: ALL, queries: ALL },
  admin: { commands: ADMIN_COMMANDS, queries: ALL },
  user: { commands: INTERNAL_COMMANDS, envelopeCommands: USER_ENVELOPE_COMMANDS, queries: ALL },
  // `commands: []` NO ES UN OLVIDO: es la segunda defensa de CA-3. Ver `envelopeCommands` arriba.
  'external-user': { commands: [], envelopeCommands: EXTERNAL_ENVELOPE_COMMANDS, queries: ALL },
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
 * CLASE del caller (`caller-class.ts`) resuelve al revés, con el más restrictivo ganando,
 * porque ahí la pregunta es cuánto recortar y no qué permitir.
 *
 * Un rol que no está en el mapa se SALTEA (no autoriza y no rompe): es el deny-by-default de
 * ADR-008, y es lo que hace aceptable guardar `roles` sin validar contra ningún catálogo — un rol
 * inventado en Zitadel no autoriza nada.
 */
export function rolesAuthorize(
  roles: readonly string[],
  method: string,
  plane: Plane,
  // EL DEFAULT ES `'direct'` Y ES LA ELECCIÓN SEGURA (ver `Channel`): quien se olvide del
  // parámetro obtiene la lista MÁS RESTRICTIVA. El plano de consultas ni lo mira.
  channel: Channel = 'direct'
): boolean {
  for (const role of roles) {
    const permissions = ROLE_METHODS[role];
    if (!permissions) {
      continue;
    }

    const allowed = allowedFor(permissions, plane, channel);
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
 * caller, que vive en `caller-class.ts` (subió de `queries/` en S-030) y responde otra pregunta.
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
  plane: Plane,
  // POR QUÉ CANAL LLEGÓ (S-030, D-1). Con default `'direct'`: el plano de consultas no lo pasa y
  // no tiene por qué, y un llamador distraído del plano de comandos obtiene la lista restrictiva.
  channel: Channel = 'direct'
): Reply<never> | null {
  // LA EXENCIÓN DEL `sub` VALE EN LOS DOS CANALES, y por eso está acá y no en el despachador: así
  // es una propiedad de LA COMPUERTA y no del orden en que alguien encadene las llamadas.
  if (caller === getTrustedPublisherId()) {
    return null;
  }

  if (rolesAuthorize(roles, method, plane, channel)) {
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
 * en un carácter.
 *
 * DESDE S-030 NINGÚN DESPACHADOR LA LLAMA, Y SIGUE EXPORTADA A PROPÓSITO. Los dos planos encadenan
 * ahora `readCallerRoles` + `authorizeWithRoles` por su cuenta, porque los dos necesitan esos
 * MISMOS `roles` para resolver además la clase del caller y no quieren pagar dos `SELECT`
 * (S-023 CA-5, S-030 CA-13). Queda porque es API pública del módulo, está en el catálogo de
 * código reutilizable, y es la forma correcta para cualquier plano futuro que necesite decidir
 * SOLO el método: trae su propio try/catch, falla cerrada y conserva la exención del `sub`.
 *
 * OJO SI LA VOLVÉS A USAR EN EL PLANO DE COMANDOS: no conoce el CANAL (`direct` / `envelope`), así
 * que evalúa siempre por el más restrictivo. Un comando con sobre de un `external-user` que
 * pasara por acá recibiría `caller_not_authorized`, y eso rompería los seis caminos vivos del
 * portal. Ver `Channel` y el comentario de `envelopeCommands`.
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
