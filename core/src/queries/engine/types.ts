import { FilterableSpec } from '../types';

/**
 * La consulta YA VALIDADA: nombres resueltos contra la ficha, valores tipados, operadores
 * decididos. Es lo único que el constructor de SQL recibe, y es la razón estructural por la que
 * un nombre del payload NO PUEDE llegar al SQL: para este punto ya fue rechazado (CA-29).
 */

/** Los seis operadores del filtro, decididos por la FORMA del valor. */
export type FilterOperator =
  /** `"campo": valor` y `"campo": [v1, v2]` — uno o varios valores, igualdad o `IN`. */
  | { readonly op: 'eq'; readonly values: readonly unknown[] }
  /** `"campo": null` */
  | { readonly op: 'isNull' }
  /** `"campo": {"not": valor}` */
  | { readonly op: 'not'; readonly values: readonly unknown[] }
  /** `"campo": {"gte": a, "lte": b}` — los cuatro comparadores son combinables entre sí. */
  | { readonly op: 'range'; readonly bounds: Readonly<Partial<Record<RangeKey, unknown>>> }
  /** `"q": "texto"` — búsqueda sobre las columnas que declara la ficha. */
  | { readonly op: 'search'; readonly text: string }
  /**
   * `"tag": {"key": "modulo", "value": "facturacion"}` — contención sobre una columna `jsonb`.
   *
   * Los objetos vienen YA NORMALIZADOS en el orden de `shape`: el valor que llega al SQL es un
   * string JSON, y dos requests con el mismo par y las claves al revés tienen que producir el
   * mismo texto.
   */
  | { readonly op: 'contains'; readonly values: readonly Record<string, unknown>[] };

export type RangeKey = 'gt' | 'gte' | 'lt' | 'lte';

export const RANGE_KEYS: readonly RangeKey[] = ['gt', 'gte', 'lt', 'lte'];

export interface FilterCondition {
  /** Nombre del campo EN EL CONTRATO. Solo para mensajes: al SQL va `spec`. */
  readonly field: string;
  /** La entrada de la ficha. Las columnas del SQL salen de acá y de ningún otro lado. */
  readonly spec: FilterableSpec;
  readonly operator: FilterOperator;
}

/** Un grupo de condiciones unidas con `AND`. */
export interface FilterGroup {
  readonly conditions: readonly FilterCondition[];
}

/**
 * El filtro completo: las claves de primer nivel con `AND`, y `or` como UN SOLO nivel de grupos
 * unidos entre sí con `OR` y con el resto con `AND`.
 */
export interface ParsedFilter {
  readonly conditions: readonly FilterCondition[];
  readonly or?: readonly FilterGroup[];
}

export interface SortCriterion {
  readonly field: string;
  /** Columna real. Sale de la ficha. */
  readonly column: string;
  readonly dir: 'ASC' | 'DESC';
  /** La columna admite NULL: el predicado keyset necesita la rama consciente de los NULL. */
  readonly nullable: boolean;
}

/** Lo que se hashea en el cursor: el filtro y el orden NORMALIZADOS, nunca el texto recibido. */
export interface CursorScope {
  readonly filter: unknown;
  readonly sort: readonly string[];
}

export interface ValidatedListQuery {
  readonly kind: 'list';
  readonly filter: ParsedFilter;
  /** En orden, con `id` SIEMPRE como último criterio. */
  readonly sort: readonly SortCriterion[];
  /** El límite EFECTIVO: ya con el default y el tope de 200 aplicados. */
  readonly limit: number;
  readonly cursor?: string;
  /** El conjunto devuelto: `( fields ?? base ) ∪ include ∪ { id }`, en orden. */
  readonly fields: readonly string[];
  /** Las relaciones del conjunto devuelto, en orden. */
  readonly relations: readonly string[];
  readonly count: boolean | 'only';
  readonly scope: CursorScope;
}

export interface ValidatedGetQuery {
  readonly kind: 'get';
  readonly id: number;
  readonly fields: readonly string[];
  readonly relations: readonly string[];
}

/** Un SQL listo para ejecutar: el string por un lado, los VALORES por otro. Siempre. */
export interface SqlPlan {
  readonly sql: string;
  readonly replacements: Record<string, unknown>;
}
