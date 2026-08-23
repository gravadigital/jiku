import { Query } from './types';

/**
 * Registro de consultas: resuelve el nombre de un método a la consulta que lo atiende.
 *
 * No reusa `CommandRegistry`, y el motivo importa: su matching por segmentos existe para extraer
 * `{param}` de subjects con ids embebidos, y los patrones de consulta NO TIENEN PARAMS —el id del
 * recurso viaja en el payload, por el cache de subjects del server—. Un `resolve()` por `Map` es
 * exacto, más corto y, lo importante, no sugiere que un patrón de consulta pueda llevar `{id}`.
 */
export class QueryRegistry {
  private entries = new Map<string, Query>();

  register(query: Query): this {
    // Ruidoso a propósito: con un `Map` la sobreescritura silenciosa es el default, y dos
    // consultas sobre el mismo patrón dejarían una de las dos inalcanzable sin un solo error.
    // Mismo espíritu que la verificación de duplicados de `registerService`.
    if (this.entries.has(query.pattern)) {
      throw new Error(`[query] patrón de consulta duplicado: ${query.pattern}`);
    }
    this.entries.set(query.pattern, query);
    return this;
  }

  registerAll(queries: Query[]): this {
    queries.forEach((query) => this.register(query));
    return this;
  }

  /** La consulta que atiende `method`, o `null`. Match EXACTO: no hay params que extraer. */
  resolve(method: string): Query | null {
    return this.entries.get(method) ?? null;
  }

  /** Patrones registrados, en orden de registro. Los usa el spec del servicio micro. */
  patterns(): string[] {
    return [...this.entries.keys()];
  }
}
