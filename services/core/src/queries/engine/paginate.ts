import { encodeCursor } from './cursor';
import { ProjectedEntry } from './project';
import { CursorScope } from './types';

/**
 * El presupuesto de bytes, el armado de la página y la emisión del cursor.
 *
 * Acá vive la regla que evita el peor modo de falla del contrato: UN ITEM QUE SOLO NO ENTRA SE
 * DEVUELVE IGUAL, truncado y marcado — NUNCA una página vacía con cursor, que para el cliente es
 * un bucle infinito.
 *
 * Y acá se decide la otra regla que el caller tiene que conocer: LA AUSENCIA DE CURSOR ES LA
 * ÚNICA SEÑAL DE FIN. `returned < limit` no significa nada, porque el corte por bytes es
 * legítimo; por eso el cursor se emite también cuando el corte fue por presupuesto y no por
 * falta de filas.
 */

/**
 * Reserva fija para lo que NO son los items: `{"status":"success","data":{"items":[…],"page":{…}}}`
 * más el cursor, que es lo más pesado de esa envoltura (~130 bytes en base64url).
 *
 * El presupuesto es del MENSAJE COMPLETO, no de la suma de los items: medir solo los items dejaría
 * que la envoltura empujara la respuesta por encima del `max_payload` justo en el caso peor.
 */
const ENVELOPE_OVERHEAD_BYTES = 512;

/**
 * Piso del item que se devuelve truncado.
 *
 * Cuando el presupuesto es tan chico que ni la envoltura entra, la regla de "nunca una página
 * vacía con cursor" GANA sobre el presupuesto: se devuelve un item, recortado a este piso. Un
 * cliente que recibe un item de más es un cliente que avanza; uno que recibe cero items con
 * cursor se queda en el lugar para siempre.
 */
const MIN_TRUNCATED_ITEM_BYTES = 1024;

export interface PageOptions {
  /** `true` si la consulta trajo la fila extra del `LIMIT limit + 1`. */
  hasMore: boolean;
  budgetBytes: number;
  /** Campos de texto sin cota que se pueden recortar. Salen de la ficha. */
  truncatable: readonly string[];
  scope: CursorScope;
}

export interface PageResult {
  items: Record<string, unknown>[];
  cursor?: string;
}

function byteSize(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value) ?? '', 'utf8');
}

/**
 * Recorta un string a lo sumo `maxBytes` SIN partir un carácter multi-byte.
 *
 * Se mide con `Buffer.byteLength` y no con `.length`: la diferencia aparece con acentos y con la
 * `ñ` de `diseño`, que están en los datos reales de este producto, y partir un carácter a la
 * mitad produce un JSON que el cliente no puede decodificar.
 */
function cutToBytes(text: string, maxBytes: number): string {
  if (maxBytes <= 0) {
    return '';
  }
  if (Buffer.byteLength(text, 'utf8') <= maxBytes) {
    return text;
  }
  let cut = text.slice(0, maxBytes);
  while (cut.length > 0 && Buffer.byteLength(cut, 'utf8') > maxBytes) {
    cut = cut.slice(0, -1);
  }
  return cut;
}

/**
 * Trunca los campos de texto sin cota de un item para que entre en `target` bytes.
 *
 * Marca cada campo recortado con su hermana `"<campo>Truncated": true`, que es el mismo patrón
 * que `commentsTruncated`: el cliente tiene que poder distinguir un texto corto de un texto
 * cortado, o va a mostrar el segundo como si fuera el primero.
 */
function truncateItem(
  item: Record<string, unknown>,
  truncatable: readonly string[],
  target: number
): void {
  for (const field of truncatable) {
    const value = item[field];
    if (typeof value !== 'string' || value.length === 0) {
      continue;
    }
    const withoutField = { ...item, [field]: '' };
    // Lo que queda para el texto una vez contado el resto del item. El margen cubre las comillas
    // y la clave del flag de truncado, que se agrega después.
    const allowance = target - byteSize(withoutField) - 40;
    if (Buffer.byteLength(value, 'utf8') <= allowance) {
      continue;
    }
    item[field] = cutToBytes(value, Math.max(allowance, 0));
    item[`${field}Truncated`] = true;
  }
}

/**
 * Arma la página: serializa item por item midiendo bytes y decide el cursor.
 *
 * El `page.limit` de la respuesta NO se decide acá: es el pedido EFECTIVO (tras el tope de 200),
 * no `items.length`. Confundirlos haría indistinguible "te di menos porque no había más" de "te
 * di menos porque no entraba", que es justo la distinción que `returned` existe para mostrar.
 */
export function paginate(entries: readonly ProjectedEntry[], options: PageOptions): PageResult {
  const budget = Math.max(options.budgetBytes - ENVELOPE_OVERHEAD_BYTES, 0);
  const items: Record<string, unknown>[] = [];
  let used = 0;
  let lastKeys: unknown[] | null = null;
  let cutByBudget = false;

  for (const entry of entries) {
    let size = byteSize(entry.item);

    if (used + size > budget) {
      if (items.length > 0) {
        // Ya hay algo que devolver: se corta acá y el resto va en la página siguiente.
        cutByBudget = true;
        break;
      }
      // EL PRIMER ITEM SOLO NO ENTRA. Se trunca y SE DEVUELVE IGUAL: la regla de "nunca una
      // página vacía con cursor" gana sobre el presupuesto.
      truncateItem(entry.item, options.truncatable, Math.max(budget, MIN_TRUNCATED_ITEM_BYTES));
      size = byteSize(entry.item);
    }

    used += size;
    items.push(entry.item);
    lastKeys = entry.keys;
  }

  const more = options.hasMore || cutByBudget;
  const result: PageResult = { items };
  if (more && lastKeys) {
    result.cursor = encodeCursor(lastKeys, options.scope);
  }
  return result;
}
