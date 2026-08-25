import { Reply, failure, success } from '@jiku/nats-protocol';
import { DEFAULT_PAYLOAD_BUDGET_BYTES } from '../dispatcher';
import { QueryContext, ResourceSpec } from '../types';
import { buildCountSql, buildGetSql, buildRowsSql } from './build-sql';
import { decodeCursor } from './cursor';
import { selectRows } from './execute-sql';
import { attachCollections } from './include';
import { paginate } from './paginate';
import { projectRow } from './project';
import { ValidatedGetQuery, ValidatedListQuery } from './types';

/**
 * EL MOTOR, en su forma ejecutable: dos funciones que sirven a CUALQUIER recurso con ficha.
 *
 * Es lo que hace que las 17 fichas que vienen después sean DATOS que se escriben y no motores que
 * se reimplementan. Si un recurso necesitara agregar lógica acá para funcionar, la ficha se
 * quedó corta: el arreglo va en la ficha o en el motor, nunca en el archivo del recurso.
 */

interface CountRow extends Record<string, unknown> {
  total: string | number;
}

/** `COUNT(*)` vuelve como string por el driver de PostgreSQL (`bigint`). */
function totalFrom(row: CountRow | undefined): number {
  return row ? Number(row.total) : 0;
}

export async function runList(
  resource: ResourceSpec,
  query: ValidatedListQuery,
  ctx: QueryContext
): Promise<Reply> {
  const label = `${resource.name}.list`;
  // El presupuesto llega POR EL CONTEXTO, resuelto por request desde `nc.info.max_payload`. El
  // motor no conoce la conexión, y el default cubre al despachador construido sin proveedor.
  const budgetBytes = ctx.budgetBytes ?? DEFAULT_PAYLOAD_BUDGET_BYTES;

  // `count: 'only'` NO EJECUTA LA CONSULTA DE FILAS. Es la razón de existir del tercer valor: un
  // caller que solo quiere el total no tiene por qué pagar el scan de la página.
  if (query.count === 'only') {
    const plan = buildCountSql(resource, query);
    const counted = await selectRows<CountRow>(ctx, plan, label);
    if ('error' in counted) {
      return counted.error;
    }
    return success({
      items: [],
      page: { limit: query.limit, returned: 0, total: totalFrom(counted.rows[0]) },
    });
  }

  let keys: unknown[] | undefined;
  if (query.cursor) {
    // EL CURSOR NO AUTORIZA NADA: acá solo se saca de él la clave de orden. Identidad y filtros
    // se reaplican abajo, en el mismo SQL de siempre.
    const decoded = decodeCursor(query.cursor, query.scope, query.sort.length);
    if ('error' in decoded) {
      return decoded.error;
    }
    keys = decoded.keys;
  }

  const rowsPlan = buildRowsSql(resource, query, keys);
  const selected = await selectRows<Record<string, unknown>>(ctx, rowsPlan, label);
  if ('error' in selected) {
    return selected.error;
  }

  // La fila extra del `LIMIT limit + 1` NO SE DEVUELVE: solo dice que hay página siguiente.
  const hasMore = selected.rows.length > query.limit;
  const rows = hasMore ? selected.rows.slice(0, query.limit) : selected.rows;
  const entries = rows.map((row) => projectRow(resource, query.fields, query.sort.length, row));

  const failed = await attachCollections(
    resource,
    query.relations,
    entries.map((entry) => entry.item),
    ctx,
    label
  );
  if (failed) {
    return failed;
  }

  const page = paginate(entries, {
    hasMore,
    budgetBytes,
    truncatable: resource.truncatable,
    scope: query.scope,
  });

  const meta: Record<string, unknown> = {
    // El EFECTIVO tras el tope silencioso de 200, no `items.length`: es lo que el caller pidió y
    // lo que va a recibir mientras el presupuesto no corte.
    limit: query.limit,
    // Explícito para que el recorte por bytes sea VISIBLE.
    returned: page.items.length,
  };
  if (page.cursor) {
    meta.cursor = page.cursor;
  }

  if (query.count === true) {
    const counted = await selectRows<CountRow>(ctx, buildCountSql(resource, query), label);
    if ('error' in counted) {
      return counted.error;
    }
    // Solo si se pidió: un `COUNT` cuesta un scan completo con el mismo filtro.
    meta.total = totalFrom(counted.rows[0]);
  }

  // `items` SIEMPRE PRESENTE, y `[]` no es un error: un `list` pregunta por un conjunto, y el
  // conjunto vacío es una respuesta válida. Ver el contraste con `runGet`.
  return success({ items: page.items, page: meta });
}

export async function runGet(
  resource: ResourceSpec,
  query: ValidatedGetQuery,
  ctx: QueryContext
): Promise<Reply> {
  const label = `${resource.name}.get`;
  const plan = buildGetSql(resource, query);
  const selected = await selectRows<Record<string, unknown>>(ctx, plan, label);
  if ('error' in selected) {
    return selected.error;
  }

  if (selected.rows.length === 0) {
    // LA ASIMETRÍA CON `list` ES INTENCIONAL: un `get` pregunta por UN recurso identificado y su
    // ausencia es un error; un `list` pregunta por un conjunto y el conjunto vacío es una
    // respuesta. Confundirlas haría que un filtro sin coincidencias pareciera un 404.
    return failure(resource.notFoundCode, resource.notFoundMessage);
  }

  const { item } = projectRow(resource, query.fields, 0, selected.rows[0]);

  const failed = await attachCollections(resource, query.relations, [item], ctx, label);
  if (failed) {
    return failed;
  }

  // `data` ES EL RECURSO, sin envoltorio de colección ni `page`.
  return success(item);
}
