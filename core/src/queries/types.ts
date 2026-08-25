import { Sequelize } from 'sequelize-typescript';
import { Reply } from '@jiku/nats-protocol';

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
export type IncludableSpec = IncludableFieldSpec | RelationSpec;

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
 * El recorte del modo externo: proyectos permitidos MÁS `visibilityLevel = public`.
 *
 * Se DECLARA acá y NO SE APLICA en esta story: quien lo enchufa al motor es S-023, junto con la
 * clase del caller. Mientras tanto el motor construye SQL sin recorte de filas, y por eso S-022 y
 * S-023 no se despliegan por separado a un entorno con callers `external-user`.
 */
export interface ExternalScopeSpec {
  /** Siempre `false` en esta story. S-023 lo pasa a `true` cuando el recorte existe. */
  readonly applied: boolean;
  /** La story que lo aplica. */
  readonly appliedBy: string;
  /** Columna del recurso que tiene que estar entre los proyectos permitidos del caller. */
  readonly projectColumn: string;
  /** Campo del contrato y valor que el caller externo puede ver. */
  readonly visibility: { readonly field: string; readonly value: string };
}

/** La ficha de un recurso: todo lo que el motor necesita saber, como dato. */
export interface ResourceSpec {
  /** Nombre EN EL CONTRATO (`tasks`), que no es el de la tabla. */
  readonly name: string;
  /** Tabla real (`objectives`). La traducción vive acá, no en `@jiku/models` (ADR-004). */
  readonly table: string;
  readonly base: Readonly<Record<string, BaseFieldSpec>>;
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
  /** Código de "no encontrado" del recurso: `tasks` -> `task_not_found`, no `objective_not_found`. */
  readonly notFoundCode: string;
  /** Mensaje en español del "no encontrado". Va en la ficha para que el motor no conozca recursos. */
  readonly notFoundMessage: string;
}
