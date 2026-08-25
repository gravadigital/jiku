import { Reply } from '@jiku/nats-protocol';
import { ManyRelationSpec, QueryContext, ResourceSpec } from '../types';
import { selectRows } from './execute-sql';

/**
 * Resolución de las relaciones de COLECCIÓN, por lote de la página.
 *
 * REGLA DURA (RF-36, CA-11): el número de consultas a la base es INDEPENDIENTE de la cantidad de
 * items. Una consulta por relación con `WHERE parent_key IN (:ids)`, nunca una por item: con
 * `page.limit: 200` la diferencia entre las dos formas es 2 consultas contra 400.
 *
 * Las relaciones 1:1 no pasan por acá: vienen por JOIN en la consulta principal.
 */

/** Alias fijos que el motor le da a las tablas de la relación. La ficha los usa en sus `fields`. */
const RELATION = 'r';
const JOINED = 'j';

/** Columna interna con el id del recurso dueño de cada fila del lote. */
const PARENT_ALIAS = '__parent';
/** Columna interna con la posición dentro de la colección de cada item. */
const ROW_NUMBER_ALIAS = '__rn';

interface CollectionRow extends Record<string, unknown> {
  __parent: number | string;
}

/**
 * Completa las relaciones de colección de los items ya proyectados.
 *
 * Muta los items: es lo que permite que la clave de la relación conserve el lugar que le dio el
 * conjunto devuelto. Devuelve un `Reply` de falla solo si la base falló de forma traducible
 * (`query_timeout`); cualquier otro error se propaga al `catch` del despachador.
 */
export async function attachCollections(
  resource: ResourceSpec,
  relations: readonly string[],
  items: Record<string, unknown>[],
  ctx: QueryContext,
  label: string
): Promise<Reply<never> | null> {
  if (items.length === 0 || relations.length === 0) {
    return null;
  }

  const ids = items.map((item) => item.id);

  for (const name of relations) {
    const spec = resource.includable[name];
    if (!spec || spec.kind !== 'relation' || spec.cardinality !== 'many') {
      continue;
    }
    const relation = spec as ManyRelationSpec;

    const fieldNames = Object.keys(relation.fields);
    const columns = fieldNames.map((field) => `${relation.fields[field]} AS "${field}"`);
    const order = relation.order
      .map((criterion) => `${criterion.expr} ${criterion.dir}`)
      .join(', ');
    const join = relation.join
      ? `INNER JOIN ${relation.join.table} ${JOINED} ON ${relation.join.on}`
      : '';
    const where = [`${RELATION}.${relation.parentKey} IN (:ids)`, relation.where]
      .filter((part): part is string => Boolean(part))
      .join(' AND ');

    let sql: string;
    if (relation.cap) {
      // EL TOPE ES POR ITEM, NO POR PÁGINA: una función de ventana particionada por el id del
      // recurso es la única forma de acotar cada colección por separado en UNA consulta.
      //
      // Se pide `cap + 1` y no `cap`: la fila extra es lo que dice si hay que marcar el flag de
      // truncado SIN un COUNT. Es el mismo truco que el `LIMIT limit + 1` de la página.
      sql = [
        'SELECT * FROM (',
        `  SELECT ${RELATION}.${relation.parentKey} AS "${PARENT_ALIAS}", ${columns.join(', ')},`,
        `    ROW_NUMBER() OVER (PARTITION BY ${RELATION}.${relation.parentKey} ORDER BY ${order}) AS "${ROW_NUMBER_ALIAS}"`,
        `  FROM ${relation.table} ${RELATION}`,
        join ? `  ${join}` : '',
        `  WHERE ${where}`,
        `) s WHERE s."${ROW_NUMBER_ALIAS}" <= ${relation.cap + 1}`,
        // EL `ORDER BY` DE AFUERA NO ES REDUNDANTE: PostgreSQL no garantiza que una subconsulta
        // conserve su orden al atravesar el filtro de arriba, y sin él el recorte a `cap` que hace
        // el código de abajo se quedaría con diez filas cualesquiera de las once — no con las diez
        // más recientes. Pasa hoy porque el plan elegido las devuelve en orden; "pasa hoy" no es
        // una garantía del lenguaje.
        `ORDER BY s."${PARENT_ALIAS}", s."${ROW_NUMBER_ALIAS}"`,
      ]
        .filter((line) => line !== '')
        .join('\n');
    } else {
      sql = [
        `SELECT ${RELATION}.${relation.parentKey} AS "${PARENT_ALIAS}", ${columns.join(', ')}`,
        `FROM ${relation.table} ${RELATION}`,
        join,
        `WHERE ${where}`,
        `ORDER BY ${order}`,
      ]
        .filter((line) => line !== '')
        .join('\n');
    }

    const result = await selectRows<CollectionRow>(
      ctx,
      { sql, replacements: { ids } },
      `${label}#${name}`
    );
    if ('error' in result) {
      return result.error;
    }

    const grouped = new Map<string, CollectionRow[]>();
    for (const row of result.rows) {
      const key = String(row[PARENT_ALIAS]);
      const bucket = grouped.get(key);
      if (bucket) {
        bucket.push(row);
      } else {
        grouped.set(key, [row]);
      }
    }

    for (const item of items) {
      const bucket = grouped.get(String(item.id)) ?? [];
      const truncated = relation.cap !== undefined && bucket.length > relation.cap;
      const visible = relation.cap !== undefined ? bucket.slice(0, relation.cap) : bucket;

      item[name] = visible.map((row) => {
        // Lista de escalares y no de objetos cuando la ficha lo declara: `subscriptors` es
        // `[userId]` en el contrato.
        if (relation.scalar) {
          return row[relation.scalar];
        }
        const value: Record<string, unknown> = {};
        for (const field of fieldNames) {
          value[field] = row[field];
        }
        return value;
      });

      if (relation.truncatedFlag) {
        // CLAVE HERMANA de la relación, no un campo anidado: `commentsTruncated` vive al lado de
        // `comments`. Mismo patrón que el truncado por bytes.
        item[relation.truncatedFlag] = truncated;
      }
    }
  }

  return null;
}
