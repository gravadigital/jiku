import { ErrorCode, Reply, failure, success } from '@jiku/nats-protocol';
import { DEFAULT_PAYLOAD_BUDGET_BYTES } from '../dispatcher';
import { QueryContext, ResourceSpec } from '../types';
import { buildCountSql, buildGetSql, buildRowsSql } from './build-sql';
import { decodeCursor } from './cursor';
import { selectRows } from './execute-sql';
import { attachCollections } from './include';
import { paginate } from './paginate';
import { projectRow } from './project';
import { deniesAllRows, resolveVariant } from './spec';
import { ValidatedGetQuery, ValidatedListQuery } from './types';

/**
 * EL MOTOR, en su forma ejecutable: dos funciones que sirven a CUALQUIER recurso con ficha.
 *
 * Es lo que hace que las 16 fichas del contrato sean DATOS que se escriben y no motores que
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
  // LA VARIANTE, PRIMERO: de acá en adelante `spec` es la ficha EFECTIVA y el resto del motor no
  // sabe que hubo variantes. Para un recurso sin discriminador es la identidad.
  const spec = resolveVariant(resource, query.variant);
  const label = `${spec.name}.list`;
  // El presupuesto llega POR EL CONTEXTO, resuelto por request desde `nc.info.max_payload`. El
  // motor no conoce la conexión, y el default cubre al despachador construido sin proveedor.
  const budgetBytes = ctx.budgetBytes ?? DEFAULT_PAYLOAD_BUDGET_BYTES;

  // EL CORTE DE "SIN ACCESO": cero SQL, cero filas, cero error.
  //
  // VA ANTES DE TODO LO DEMÁS —del `count`, del cursor y del SQL de filas— porque la propiedad que
  // el contrato promete es que NO SE CONSULTA. Un `WHERE FALSE` daría el mismo resultado y pagaría
  // un round-trip a la base por cada request de un portal que no tiene por qué leer nada.
  //
  // Y VA DESPUÉS DE `validate()`, que corre en el despachador: la gramática es la MISMA para las
  // tres clases, así que un nombre no declarado sigue siendo `invalid_fields` y no `items: []`.
  //
  // NO ES UN ERROR, y la diferencia es del contrato: un `caller_not_authorized` diría "el recurso
  // existe y te está vedado"; `items: []` dice "no hay nada para vos".
  if (deniesAllRows(spec, ctx)) {
    // `limit` es el EFECTIVO, ya con el default y el tope silencioso de 200 aplicados. NUNCA se
    // emite `cursor`: la ausencia es la única señal de fin de colección.
    const page: Record<string, unknown> = { limit: query.limit, returned: 0 };
    if (query.count !== false) {
      // `count: true` y `count: 'only'` devuelven `total: 0`, coherentemente: el conjunto vacío
      // tiene cardinal cero.
      page.total = 0;
    }
    return success({ items: [], page });
  }

  // `count: 'only'` NO EJECUTA LA CONSULTA DE FILAS. Es la razón de existir del tercer valor: un
  // caller que solo quiere el total no tiene por qué pagar el scan de la página.
  if (query.count === 'only') {
    const plan = buildCountSql(spec, query, ctx);
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

  const rowsPlan = buildRowsSql(spec, query, ctx, keys);
  const selected = await selectRows<Record<string, unknown>>(ctx, rowsPlan, label);
  if ('error' in selected) {
    return selected.error;
  }

  // La fila extra del `LIMIT limit + 1` NO SE DEVUELVE: solo dice que hay página siguiente.
  const hasMore = selected.rows.length > query.limit;
  const rows = hasMore ? selected.rows.slice(0, query.limit) : selected.rows;
  const entries = rows.map((row) => projectRow(spec, query.fields, query.sort.length, row));

  const failed = await attachCollections(
    spec,
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
    truncatable: spec.truncatable,
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
    const counted = await selectRows<CountRow>(ctx, buildCountSql(spec, query, ctx), label);
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
  // Ídem `runList`: la ficha efectiva primero. En un `get` la variante es lo que decide CONTRA QUÉ
  // TABLA se resuelve el id, y los ids de las dos tablas de actividad SE PISAN.
  const spec = resolveVariant(resource, query.variant);
  const label = `${spec.name}.get`;

  // EL MISMO CORTE QUE EN `runList`, SIN TOCAR LA BASE.
  //
  // HOY NO ES ALCANZABLE —ninguna ficha que declara "sin acceso" tiene `get` registrado— y existe
  // igual para que la propiedad "sin acceso nunca toca la base" valga en TODOS los caminos y no
  // solo en el que hoy tiene consumidor. La respuesta es la misma que la de un id inexistente:
  // decir "no existe" no filtra que el recurso sí exista y le esté vedado.
  if (deniesAllRows(spec, ctx)) {
    return failure(
      spec.notFoundCode ?? ErrorCode.INTERNAL_ERROR,
      spec.notFoundMessage ?? 'No existe un recurso con ese id'
    );
  }

  const plan = buildGetSql(spec, query, ctx);
  const selected = await selectRows<Record<string, unknown>>(ctx, plan, label);
  if ('error' in selected) {
    return selected.error;
  }

  if (selected.rows.length === 0) {
    // LA ASIMETRÍA CON `list` ES INTENCIONAL: un `get` pregunta por UN recurso identificado y su
    // ausencia es un error; un `list` pregunta por un conjunto y el conjunto vacío es una
    // respuesta. Confundirlas haría que un filtro sin coincidencias pareciera un 404.
    // EL FALLBACK NO ES UN CAMINO ALCANZABLE: un recurso sin `notFoundCode` es un recurso SIN
    // `get` registrado (`activity`, `subscriptions`), así que nadie puede invocar esta función
    // sobre él. Existe para que el tipo sea honesto —los dos campos son opcionales en la ficha— y
    // no para cubrir un caso real.
    return failure(
      spec.notFoundCode ?? ErrorCode.INTERNAL_ERROR,
      spec.notFoundMessage ?? 'No existe un recurso con ese id'
    );
  }

  const { item } = projectRow(spec, query.fields, 0, selected.rows[0]);

  const failed = await attachCollections(spec, query.relations, [item], ctx, label);
  if (failed) {
    return failed;
  }

  // `data` ES EL RECURSO, sin envoltorio de colección ni `page`.
  return success(item);
}
