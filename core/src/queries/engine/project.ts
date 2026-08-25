import { OneRelationSpec, ResourceSpec } from '../types';
import { relationFieldAlias, sortKeyAlias } from './build-sql';
import { specFor } from './spec';

/**
 * Proyección: de la fila cruda de PostgreSQL al item del contrato.
 *
 * Acá vive la traducción de vocabulario de ADR-004 en la dirección de LECTURA: `created_at` es
 * `createdAt`, `objectives` es `tasks`, y `priority` se lee de dos formas. El mapa columna ->
 * campo SALE DE LA FICHA y no de un `switch` local: si se duplicara, agregar un campo a la ficha
 * dejaría de alcanzar, que es exactamente el modo de falla que la ficha existe para evitar.
 */

export interface ProjectedEntry {
  /** El item del contrato, listo para serializar. */
  item: Record<string, unknown>;
  /** Los valores de las claves de orden, para emitir el cursor. */
  keys: unknown[];
}

/**
 * Proyecta UNA fila al conjunto devuelto, ni un campo más.
 *
 * Las relaciones de colección NO se resuelven acá: llegan por lote en `include.ts`. Las 1:1 sí,
 * porque vinieron por JOIN en la misma fila.
 */
export function projectRow(
  resource: ResourceSpec,
  fields: readonly string[],
  sortLength: number,
  row: Record<string, unknown>
): ProjectedEntry {
  const item: Record<string, unknown> = {};

  for (const name of fields) {
    // LA MISMA RESOLUCIÓN QUE `selectParts`, y por eso el mismo helper: las dos ramas tienen que
    // coincidir campo por campo, y con dos búsquedas separadas la que se olvida NO FALLA AL
    // COMPILAR — devuelve el campo vacío.
    const spec = specFor(resource, name);
    if (!spec) {
      continue;
    }

    // EL CAMPO CONSTANTE SE RESUELVE SIN MIRAR LA FILA: el valor lo decide la ficha —o sea, la
    // variante— y la columna no existe.
    if ('constant' in spec) {
      item[name] = spec.constant;
      continue;
    }

    if (!('kind' in spec)) {
      const raw = row[name];
      item[name] = spec.transform ? spec.transform(raw) : raw;
      continue;
    }

    const includable = spec;

    // COLUMNA Y EXPRESIÓN SE PROYECTAN IGUAL: en los dos casos el SELECT ya dejó el valor bajo el
    // alias del campo del contrato, y lo único que queda es la traducción de lectura. Un
    // calculado la necesita más que una columna: `SUM(integer)` vuelve como STRING (`bigint`).
    if (includable.kind === 'field' || includable.kind === 'computed') {
      const raw = row[name];
      item[name] = includable.transform ? includable.transform(raw) : raw;
      continue;
    }

    if (includable.cardinality === 'one') {
      const relation = includable as OneRelationSpec;
      const nested: Record<string, unknown> = {};
      let present = false;
      for (const field of Object.keys(relation.fields)) {
        const value = row[relationFieldAlias(name, field)];
        if (value !== null && value !== undefined) {
          present = true;
        }
        nested[field] = value === undefined ? null : value;
      }
      // Con LEFT JOIN y sin fila del otro lado, TODAS las columnas vienen en NULL: la relación es
      // `null`, no un objeto de nulls. La tarea SE DEVUELVE IGUAL.
      item[name] = relation.optional && !present ? null : nested;
      continue;
    }

    // Relación de colección: se completa por lote. Se deja la clave para que el orden del item
    // sea el del conjunto devuelto y no dependa de cuándo llegó el lote. Vale igual esté declarada
    // en `includable` o en `base` (`comments.attachments`).
    item[name] = [];
  }

  const keys: unknown[] = [];
  for (let index = 0; index < sortLength; index += 1) {
    keys.push(row[sortKeyAlias(index)]);
  }

  return { item, keys };
}
