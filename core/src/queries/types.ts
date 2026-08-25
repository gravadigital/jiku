import { Sequelize } from 'sequelize-typescript';
import { Reply } from '@jiku/nats-protocol';

/**
 * LA CLASE DEL CALLER: qué le recorta el servicio a nivel de fila.
 *
 * Vive acá y no en `caller-class.ts` porque `QueryContext` la lleva y este es el archivo de tipos
 * del plano de consultas; el mapa rol → clase y la precedencia viven allá. UNA SOLA DEFINICIÓN en
 * el repo, y el módulo que la resuelve la importa de acá.
 *
 *   connector -> nada. El caller autoriza por su cuenta (hoy, la api con `validateProjectPermissions`)
 *   internal  -> nada a nivel de fila. Decisión explícita de la v1 (RF-23)
 *   external  -> lo que declare la ficha del recurso (`ResourceSpec.externalScope`)
 */
export type CallerClass = 'connector' | 'internal' | 'external';

/**
 * Contexto de una consulta.
 *
 * NO tiene `transaction`, y la ausencia es el contrato: el despachador de consultas no abre
 * ninguna (RF-9). Una lectura no necesita atomicidad, y una transacción por request tomaría y
 * sostendría un snapshot por cada consulta. Una consulta que necesite consistencia entre varias
 * lecturas abre una transacción `READ ONLY` explícita DENTRO de sí misma.
 *
 * NO tiene `params`: los patrones de consulta no llevan `{param}` —el id del recurso viaja en el
 * payload, por el cache de subjects del server— así que un `params` acá estaría siempre vacío y
 * sugeriría que se puede agregar un `{id}` al patrón. No se puede.
 */
export interface QueryContext {
  /** Servicio que publicó el mensaje, leído del subject. */
  caller: string;
  /**
   * Qué le recorta el servicio a este caller. Se resuelve UNA SOLA VEZ en el despachador, desde
   * `users.roles`, y viaja acá: NINGUNA ficha vuelve a consultar `users` para saberla (CA-4).
   *
   * OBLIGATORIA, y la obligatoriedad es el contrato: un contexto sin clase sería un contexto sin
   * recorte, o sea el fallo abierto que esta story existe para no tener.
   */
  callerClass: CallerClass;
  /** Conexión de SOLO LECTURA. Se inyecta para que el módulo no importe `models/read`. */
  db: Sequelize;
  /**
   * Presupuesto de bytes de la página, resuelto POR REQUEST desde `nc.info.max_payload`.
   *
   * OPCIONAL, y la opcionalidad es deliberada: un `QueryDispatcher` construido sin proveedor de
   * presupuesto —la forma que entregó S-013, y la que siguen usando los tests que afirman sobre
   * la forma exacta del contexto— produce EL MISMO contexto de siempre. El motor resuelve la
   * ausencia con `DEFAULT_PAYLOAD_BUDGET_BYTES`, así que nunca queda sin presupuesto.
   */
  budgetBytes?: number;
}

/**
 * Una consulta: valida su payload, lee y devuelve.
 *
 * `validate()` tiene LA MISMA FORMA que la de `Command` (convención `validation`): devuelve
 * `{ value }` o `{ error: Reply<never> }`, no lanza, y NO TOCA LA BASE. El despachador la llama
 * antes de `execute`, que es el mismo criterio por el que en el plano de comandos corre antes de
 * abrir la transacción: un payload inválido no puede costar una conexión del pool.
 */
export interface Query<TPayload = any, TData = unknown> {
  /** Patrón del método, SIN `{param}`: `projects.list`, `tasks.get`. */
  readonly pattern: string;

  /** Valida y normaliza el payload. Devuelve el error del protocolo si no es válido. */
  validate(payload: unknown): { value: TPayload } | { error: Reply<never> };

  execute(payload: TPayload, ctx: QueryContext): Promise<Reply<TData>>;
}

/* -------------------------------------------------------------------------------------------
 * LA FICHA DE RECURSO
 *
 * Una ficha es un DATO, no código imperativo (CA-30). El validador lee estas mismas listas para
 * validar, el constructor de SQL lee estos mismos nombres de columna para armar el SQL, y
 * `meta.describe` (S-028) las va a proyectar sin una segunda copia. Si la ficha fuera código, la
 * garantía de que la descripción del contrato no miente no sería verificable.
 *
 * Las listas blancas están DUPLICADAS a propósito en dos formas: el mapa (`filterable`) para
 * resolver un nombre, y el array de nombres (`filterableNames`) para responderlo en
 * `errorDetails.allowed`. El array se DERIVA del mapa con `Object.keys` al construir la ficha, no
 * se escribe a mano: es LA MISMA lista, y por eso el validador puede devolverla por referencia.
 * ------------------------------------------------------------------------------------------- */

/** Tipo del valor que acepta un filtro. Decide la forma, nunca el nombre de la columna. */
export type FieldKind = 'integer' | 'string' | 'enum' | 'date' | 'boolean';

/** Un campo del conjunto base: columna real más, si hace falta, su traducción de lectura. */
export interface BaseFieldSpec {
  /** Columna real de la tabla. Es lo ÚNICO que puede llegar al SQL. */
  readonly column: string;
  /** Traducción columna -> valor del contrato. Sin ella, el valor viaja tal cual. */
  readonly transform?: (raw: any) => unknown;
}

/** Un campo incluible que es una columna más de la tabla del recurso. */
export interface IncludableFieldSpec extends BaseFieldSpec {
  readonly kind: 'field';
}

/**
 * UN CAMPO DEL CONJUNTO BASE CUYO VALOR LO FIJA LA FICHA, no una columna.
 *
 * `entityType` es el caso: el valor lo decide LA VARIANTE y la fila no lo lleva. Se resuelve EN LA
 * PROYECCIÓN y no en el SELECT a propósito: meter un literal en el SQL funcionaría, pero pondría
 * un valor de la ficha en el string de la consulta sin necesidad, y la regla del módulo es que al
 * SQL solo llegan NOMBRES de la ficha.
 *
 * DECLARARLO NO LO HACE FILTRABLE NI ORDENABLE: para eso tendría que estar además en
 * `filterable` / `sortable`, que son listas INDEPENDIENTES.
 */
export interface BaseConstantSpec {
  readonly constant: unknown;
}

/** Relación 1:1: se resuelve con JOIN en la consulta principal. */
export interface OneRelationSpec {
  readonly kind: 'relation';
  readonly cardinality: 'one';
  readonly table: string;
  /** Columna del recurso que apunta a la relación. */
  readonly localKey: string;
  /** Columna de la tabla relacionada. */
  readonly targetKey: string;
  /** `true` -> LEFT JOIN. La fila del recurso se devuelve igual, con la relación en `null`. */
  readonly optional: boolean;
  /** Campo del contrato -> columna de la tabla relacionada. */
  readonly fields: Readonly<Record<string, string>>;
}

/**
 * Relación de colección: se resuelve con UNA consulta por relación sobre los ids de la página ya
 * resuelta (`WHERE parent_key IN (:ids)`), NUNCA una consulta por item (RF-36).
 *
 * Las expresiones de `fields` usan dos alias fijos que pone el motor: `r` para `table` y `j` para
 * la tabla de `join`.
 */
export interface ManyRelationSpec {
  readonly kind: 'relation';
  readonly cardinality: 'many';
  readonly table: string;
  /** Columna de `table` que apunta al recurso. */
  readonly parentKey: string;
  /** JOIN opcional para traer los campos expuestos desde otra tabla. */
  readonly join?: { readonly table: string; readonly on: string };
  /** Condición fija de la relación. Sale de la ficha, NUNCA del payload. */
  readonly where?: string;
  /** Orden dentro de la colección de cada item. */
  readonly order: readonly { readonly expr: string; readonly dir: 'ASC' | 'DESC' }[];
  /** Tope por item. Con más elementos, se marca `truncatedFlag`. */
  readonly cap?: number;
  /** Clave HERMANA de la relación en el item: `commentsTruncated`, no un campo anidado. */
  readonly truncatedFlag?: string;
  /** Campo del contrato -> expresión SQL (con los alias `r` y `j`). */
  readonly fields: Readonly<Record<string, string>>;
  /** Si está, la relación devuelve una lista de escalares de ese campo, no de objetos. */
  readonly scalar?: string;
}

export type RelationSpec = OneRelationSpec | ManyRelationSpec;

/**
 * Las TRES formas de un campo del conjunto base.
 *
 * Hasta S-024 el conjunto base era siempre una columna, y cuatro lugares del motor lo asumían
 * mirando `resource.base[name].column`. Desde S-025 puede ser además un VALOR CONSTANTE
 * (`entityType`) o una RELACIÓN (`comments.attachments`, que CA-6 pone en la base y no en
 * `include`). Los cuatro lugares resuelven el nombre por `specFor()` — ver `engine/spec.ts`.
 */
export type BaseSpec = BaseFieldSpec | BaseConstantSpec | RelationSpec;

/**
 * Un incluible que NO es una columna ni una relación: una EXPRESIÓN evaluada por fila.
 *
 * Es la TERCERA forma de incluible, y existe porque hay campos del contrato que no viven en
 * ninguna columna: `requirements.totalMinutes` son dos subconsultas correlacionadas sobre
 * `worked_times`, y los tiempos de S-026 son el mismo género de cálculo.
 *
 * `expr` se escribe con el alias `t` de la tabla del recurso y SALE DE LA FICHA, nunca del
 * payload: es la misma regla que ya gobierna `ManyRelationSpec.where`, y es lo que permite que
 * llegue al SQL sin escaparse. Un dato del cuerpo del mensaje NO PUEDE llegar acá.
 *
 * `transform` NO ES OPCIONAL POR COMODIDAD: `SUM(integer)` en PostgreSQL devuelve `bigint`, y el
 * driver `pg` lo entrega como STRING. Un campo calculado que suma minutos sin transform viaja
 * como `"180"` en vez de `180`, y el caller no tiene forma de saber cuál de los dos esperar.
 *
 * DECLARARLO INCLUIBLE NO LO HACE FILTRABLE NI ORDENABLE: para eso tendría que estar además en
 * `filterable` / `sortable`, que son listas INDEPENDIENTES. Un calculado que se ordenara
 * obligaría a evaluar la expresión por fila del universo, no de la página.
 */
export interface IncludableComputedSpec {
  readonly kind: 'computed';
  /** Expresión SQL con el alias `t`. De la ficha, JAMÁS del payload. */
  readonly expr: string;
  /** Traducción del valor crudo al del contrato. Ver la nota del `bigint`. */
  readonly transform?: (raw: any) => unknown;
}

export type IncludableSpec = IncludableFieldSpec | IncludableComputedSpec | RelationSpec;

/** Filtro declarado. `column`, `via` o `search`: uno de los tres resuelve el `WHERE`. */
export interface FilterableSpec {
  /** Columna real de la tabla del recurso. */
  readonly column?: string;
  readonly kind?: FieldKind;
  /** Nombre del enum de `enums` cuyos valores acepta. */
  readonly enum?: string;
  /**
   * Traducción valor del contrato -> valores de base. Un array con más de un elemento significa
   * "cualquiera de estos": `priority: 'urgente'` matchea el 4 Y el 5.
   */
  readonly values?: Readonly<Record<string, readonly unknown[]>>;
  /** El filtro no vive en la tabla del recurso: se resuelve con una subconsulta. */
  readonly via?: {
    readonly table: string;
    /** Columna de `table` que apunta al recurso. */
    readonly parentKey: string;
    /** Columna de `table` contra la que se compara el valor. */
    readonly column: string;
  };
  /** Búsqueda libre: columnas sobre las que se hace `ILIKE`, unidas con `OR`. */
  readonly search?: readonly string[];
  /**
   * LA COLUMNA A LA QUE SE DESVÍA LA BÚSQUEDA cuando el texto es SOLO DÍGITOS.
   *
   * Sin esto, buscar `"8140"` hace `ILIKE '%8140%'` sobre las columnas de texto y NO encuentra el
   * recurso 8140, que es el caso de uso más frecuente de un buscador: pegar un número de
   * requisito. La regla es del CONTRATO —va a sorprender, y por eso se declara acá para que
   * `meta.describe` la exponga— y no una heurística del motor.
   *
   * Solo tiene efecto junto a `search`. Una ficha que no lo declara se comporta exactamente igual
   * que antes de existir.
   */
  readonly searchNumericColumn?: string;
  /**
   * CONTENCIÓN SOBRE UNA COLUMNA `jsonb`: el filtro tiene FORMA PROPIA, declarada por la ficha.
   *
   * `column` es la columna `jsonb` real; `shape` son las claves que el objeto del payload tiene
   * que traer —todas, y ninguna de más—. El payload acepta un objeto o una LISTA de objetos, y la
   * lista se combina con `AND` (RF-7): "los que tienen ESTE par Y ESTE OTRO", no "cualquiera".
   *
   * ES GENÉRICO Y NO DE UN RECURSO: `requirements.tags` es el primer caso, y cualquier recurso con
   * una columna `jsonb` de pares lo declara igual. Sin esta forma, `parseCondition` leería el
   * objeto del payload como un mapa de OPERADORES (`not`, `gt`, …) y respondería que no conoce el
   * operador "key".
   *
   * Se resuelve con el contains de `jsonb`, que es lo que usa el índice GIN.
   */
  readonly contains?: {
    readonly column: string;
    readonly shape: readonly string[];
  };
}

export interface SortableSpec {
  /** Columna real por la que se ordena. Puede no coincidir con el campo del contrato. */
  readonly column: string;
  /**
   * La columna admite NULL.
   *
   * NO ES DECORATIVO: el predicado keyset de la página siguiente compara contra la última clave
   * devuelta, y una comparación con NULL da NULL —o sea, ninguna fila—. Ordenar por una columna
   * NULL-able con el predicado ingenuo CORTA EL RECORRIDO en el primer NULL y devuelve datos de
   * menos, en silencio. El motor usa una rama consciente de los NULL cuando esto está en `true`.
   */
  readonly nullable?: boolean;
}

/**
 * EL RECORTE DEL MODO EXTERNO, en sus CUATRO FORMAS.
 *
 * DECLARAR EL RECORTE ES APLICARLO, y por eso no hay ningún booleano acá. Hasta S-023 esta ficha
 * llevaba un `applied` que el motor no miraba, y esa forma tiene un problema que no es de estilo:
 * mientras exista, un recurso puede declarar su recorte y desactivarlo con un `false` olvidado, y
 * los 17 recursos que vienen después lo copian del primero. Sacando el campo, el estado peligroso
 * deja de ser REPRESENTABLE — y esa propiedad es lo que la unión de S-024 tiene que conservar:
 * NINGUNA variante significa "no recortes", y ningún campo opcional desactiva la compuerta.
 *
 * TODOS LOS NOMBRES SON COLUMNAS DE LA BASE, no campos del contrato: al SQL solo llegan nombres
 * que la ficha declara como columnas (ADR-004), así que el motor no tiene que resolver
 * `visibilityLevel` contra `base`/`filterable` en tiempo de armado — una búsqueda que puede
 * fallar y que solo fallaría en producción.
 *
 * LA CUARTA FORMA NO ES UN PREDICADO: `none` VACÍA el conjunto en vez de acotarlo, y por eso el
 * motor CORTA ANTES DE CONSULTAR (`deniesAllRows` en `engine/spec.ts`) en vez de armar un SQL que
 * no puede devolver nada. Conserva la misma propiedad que las otras tres: declararla es aplicarla,
 * no tiene ningún campo que la desactive, y ninguna variante significa "no recortes".
 */

/**
 * LA FILA LLEVA EL PROYECTO en una de sus columnas.
 *
 * `requirements` la usa con visibilidad (`project_id` permitido Y `visibility_level = 'public'`) y
 * `projects` sin ella, recortando por su PROPIA `id`.
 */
export interface ColumnExternalScope {
  readonly kind: 'column';
  /** Columna del recurso que tiene que estar entre los proyectos permitidos del caller. */
  readonly projectColumn: string;
  /**
   * Columna de visibilidad y el ÚNICO valor que un caller externo puede ver.
   *
   * OPCIONAL, y su ausencia significa "este recurso NO TIENE columna de visibilidad", nunca "no
   * recortes": el predicado de proyectos permitidos se emite siempre. `projects` es el caso — un
   * proyecto no tiene `visibility_level`.
   */
  readonly visibility?: { readonly column: string; readonly value: string };
}

/**
 * LA FILA NO LLEVA EL PROYECTO: es ALCANZABLE desde una tabla que sí lo lleva.
 *
 * `clients` es el caso, y es el recorte más fácil de olvidar de todos: un actor no tiene
 * `project_id`, su visibilidad depende de TENER AL MENOS UN PROYECTO PERMITIDO. Es un `EXISTS`
 * sobre la tabla que sí lo lleva, y NO un `IN` sobre una columna del propio recurso —que no
 * existe—.
 */
export interface ExistsExternalScope {
  readonly kind: 'exists';
  /** Tabla que sí lleva el proyecto (`projects` para un actor, `objectives` para un comentario). */
  readonly table: string;
  /** Columna de `table` que apunta al recurso (`client_id`, `id`). */
  readonly foreignKey: string;
  /** Columna del recurso a la que apunta `foreignKey` (`id`, `objective_id`). */
  readonly localKey: string;
  /** Columna de `table` que tiene que estar entre los proyectos permitidos (`id`, `project_id`). */
  readonly projectColumn: string;
  /**
   * Visibilidad EN LA TABLA ALCANZADA: la entidad dueña tiene que ser pública.
   *
   * OPCIONAL, y su ausencia significa "la tabla alcanzada NO TIENE columna de visibilidad", nunca
   * "no recortes": el predicado de proyectos permitidos se emite siempre. `clients` es el caso —
   * un proyecto alcanzado desde un actor no aporta visibilidad al actor.
   */
  readonly visibility?: { readonly column: string; readonly value: string };
  /**
   * Visibilidad EN LA FILA DEL PROPIO RECURSO, además de la de la entidad dueña.
   *
   * `comments` y `activity` son el caso y las dos se exigen (H-8 del plan de S-025):
   * `objective_activity.visibility_level` existe exactamente para esto —el comentario es el único
   * tipo de actividad cuya visibilidad ELIGE EL USUARIO— y su default es `internal`. Sin esta
   * mitad, un comentario interno sobre una tarea pública se ve desde el portal de clientes.
   *
   * OPCIONAL con el mismo criterio que `visibility`: su ausencia es "este recurso no tiene columna
   * de visibilidad", jamás "no recortes".
   */
  readonly ownVisibility?: { readonly column: string; readonly value: string };
  /**
   * LA FILA DEL PROPIO CALLER ENTRA SIEMPRE, aunque el EXISTS no la alcance.
   *
   * `users` es el caso, y es CA-14 de S-026: el recorte es "usuarios con permiso sobre algún
   * proyecto que veo, MÁS YO MISMO". Sin esta mitad, un caller externo sin ningún permiso de
   * proyecto no puede ni resolver SU PROPIO NOMBRE — que es el estado de un cliente recién dado de
   * alta, no un caso raro.
   *
   * ES UNA CLÁUSULA CON NOMBRE Y NO UNA COMPOSICIÓN ABIERTA DE RECORTES, y la diferencia importa:
   * `OR` es un operador AMPLIADOR. Un `any: [scopeA, scopeB]` genérico haría representable un
   * recorte que ENSANCHA el acceso, y la propiedad que S-023 dejó sentada es que el estado
   * peligroso no sea representable. Acotada a "la fila del caller", no lo es.
   *
   * Es un nombre de COLUMNA DEL PROPIO RECURSO, como todos los de `ExternalScopeSpec`.
   *
   * OJO CON LOS PARÉNTESIS al emitirla: el recorte se une al resto del WHERE con AND, y un OR de
   * primer nivel se lo come por precedencia. Ver `externalScopeSql`.
   */
  readonly orSelfColumn?: string;
}

/**
 * LA FILA ES DEL CALLER: el recorte es su propia identidad.
 *
 * `subscriptions` es el caso, y NO LLEVA PROYECTO A PROPÓSITO: saber a qué se suscribió uno mismo
 * no depende de tener permiso sobre el proyecto de la entidad. Agregarle el predicado de proyectos
 * permitidos "por simetría" ESCONDERÍA DATOS PROPIOS, que es un modo de falla tan malo como el
 * contrario y bastante más difícil de notar —no hay error ni log: la fila simplemente no está—.
 *
 * Y AL REVÉS: saber QUIÉN MÁS está suscripto a un requisito es información del equipo interno, y
 * por eso el recorte no es "las de los proyectos que veo" sino "las mías".
 */
export interface OwnerExternalScope {
  readonly kind: 'owner';
  /** Columna del recurso con el id del usuario dueño de la fila. */
  readonly userColumn: string;
}

/**
 * SIN ACCESO EXTERNO: el recorte que NO es un predicado.
 *
 * Las otras tres formas acotan el conjunto; esta lo VACÍA, y por eso el motor CORTA ANTES DE
 * CONSULTAR en vez de armar un SQL que no puede devolver nada. `worked-times`, `unworked-times` y
 * `week-assigned-times` son los tres primeros casos y `settings` (S-028) el cuarto.
 *
 * NO ES UN ERROR, Y LA DIFERENCIA ES DEL CONTRATO: un `caller_not_authorized` acá diría "el recurso
 * existe y te está vedado" y un `unknown_caller` diría "no existís"; `items: []` dice "no hay nada
 * para vos", que es lo que el portal de clientes tiene que escuchar y lo único que no filtra la
 * existencia del recurso. Además evita que el consumidor tenga que ramificar por clase de caller
 * para saber si `[]` significa "vacío" o "prohibido".
 *
 * SIN NINGÚN CAMPO: no hay nada que parametrizar, y no haberlo es la propiedad. Un `enabled` o un
 * `except` harían representable un "sin acceso" que sí da acceso.
 */
export interface NoneExternalScope {
  readonly kind: 'none';
}

export type ExternalScopeSpec =
  | ColumnExternalScope
  | ExistsExternalScope
  | OwnerExternalScope
  | NoneExternalScope;

/**
 * UNA VARIANTE DEL RECURSO: lo que cambia cuando el discriminador cambia.
 *
 * Sobreescribe SOLO lo que depende de la TABLA. `name`, `defaults`, `sortable`, `truncatable` y los
 * dos campos de "no encontrado" son del RECURSO y no están acá a propósito: si dos variantes
 * pudieran declarar contratos distintos, `meta.describe` (S-028) tendría que describir dos recursos
 * y el caller tendría que saber cuál le toca antes de preguntar.
 */
export interface ResourceVariant {
  readonly table: string;
  /** Predicado FIJO de la variante. Sale de la ficha, JAMÁS del payload. */
  readonly where?: string;
  readonly base?: Readonly<Record<string, BaseSpec>>;
  readonly includable?: Readonly<Record<string, IncludableSpec>>;
  readonly filterable?: Readonly<Record<string, FilterableSpec>>;
  readonly enums?: Readonly<Record<string, readonly string[]>>;
  readonly externalScope?: ExternalScopeSpec;
}

/**
 * EL DISCRIMINADOR: el campo OBLIGATORIO que elige contra qué tabla se resuelve el recurso.
 *
 * NO ES UN FILTRO CON UN DEFAULT, y la diferencia no es de estilo: los ids de las dos tablas de
 * actividad SE PISAN. Un default haría que `comments.get {id: 1234}` devolviera "algún" comentario
 * con ese id, y el bug sería SILENCIOSO E INTERMITENTE — funciona hasta que las dos tablas crecen
 * lo suficiente. Por eso no hay `default` en este tipo: el estado peligroso no es representable.
 *
 * En un `list` viaja dentro de `filter`; en un `get`, como CLAVE DE PRIMER NIVEL del payload. Su
 * ausencia es `invalid_fields` en los dos casos.
 */
export interface DiscriminatorSpec {
  /** El nombre EN EL CONTRATO (`entityType`). */
  readonly field: string;
  /** Los valores válidos, EN EL ORDEN que viaja en `errorDetails.allowed`. */
  readonly values: readonly string[];
  readonly variants: Readonly<Record<string, ResourceVariant>>;
}

/** La ficha de un recurso: todo lo que el motor necesita saber, como dato. */
export interface ResourceSpec {
  /** Nombre EN EL CONTRATO (`tasks`), que no es el de la tabla. */
  readonly name: string;
  /** Tabla real (`objectives`). La traducción vive acá, no en `@jiku/models` (ADR-004). */
  readonly table: string;
  /**
   * EL PREDICADO FIJO DEL RECURSO. Sale de la ficha, JAMÁS del payload, y por eso llega al SQL sin
   * escaparse — la misma regla que ya gobierna `ManyRelationSpec.where` e `IncludableComputedSpec.expr`.
   *
   * NO SE PUEDE RESOLVER CON UN FILTRO: un filtro se pisa desde el payload y el predicado del
   * recurso no es negociable. `comments` es `objective_activity` con `type_of_activity = 'comment'`
   * y `activity` es ESA MISMA TABLA sin el predicado: toda la diferencia entre los dos recursos es
   * este campo.
   *
   * Se emite en LOS TRES SQL —filas, COUNT y get—: olvidarlo en el COUNT haría que el total cuente
   * filas que la colección no devuelve, y olvidarlo en el `get` haría que `comments.get` resolviera
   * una fila de `state`.
   */
  readonly where?: string;
  /**
   * El discriminador, si el recurso resuelve contra más de una tabla. Ver `DiscriminatorSpec`.
   *
   * La ficha efectiva de cada variante la arma `resolveVariant()` (`engine/spec.ts`) ANTES de que
   * el resto del motor vea nada: `validate-query`, `build-sql`, `project`, `include` y `run`
   * operan siempre sobre una `ResourceSpec` común y no saben que hubo variantes.
   */
  readonly discriminator?: DiscriminatorSpec;
  readonly base: Readonly<Record<string, BaseSpec>>;
  readonly baseNames: readonly string[];
  readonly includable: Readonly<Record<string, IncludableSpec>>;
  readonly includableNames: readonly string[];
  /** `base ∪ includable`: lo que `fields` acepta nombrar. */
  readonly fieldNames: readonly string[];
  readonly filterable: Readonly<Record<string, FilterableSpec>>;
  readonly filterableNames: readonly string[];
  readonly sortable: Readonly<Record<string, SortableSpec>>;
  readonly sortableNames: readonly string[];
  readonly defaults: { readonly sort: readonly string[] };
  readonly enums: Readonly<Record<string, readonly string[]>>;
  /** Campos de texto SIN COTA que el presupuesto de bytes puede truncar (RF-14). */
  readonly truncatable: readonly string[];
  readonly externalScope: ExternalScopeSpec;
  /**
   * Código de "no encontrado" del recurso: `tasks` -> `task_not_found`, no `objective_not_found`.
   *
   * OPCIONALES LOS DOS desde S-025: `activity` y `subscriptions` NO TIENEN `get` —no hay pantalla
   * de detalle de una entrada de historial ni de una suscripción— y no tienen ningún código que
   * declarar. Un recurso con `get` registrado los declara siempre; ver el fallback de `runGet`.
   */
  readonly notFoundCode?: string;
  /** Mensaje en español del "no encontrado". Va en la ficha para que el motor no conozca recursos. */
  readonly notFoundMessage?: string;
}
