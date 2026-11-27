/**
 * Reemplazos con nombre (`:p0`) → parámetros posicionales (`$1`), para que la sentencia viaje
 * PARAMETRIZADA y PostgreSQL pueda reusar su plan.
 *
 * POR QUÉ: con `replacements`, Sequelize interpola los valores en el texto, así que cada request
 * es una sentencia distinta que PostgreSQL planifica desde cero. En las consultas con joins la
 * planificación cuesta más que la ejecución (medido en local: worked-times.list por persona con sus
 * cuatro relaciones, 1,7 ms de planificación contra 0,66 de ejecución). Con el texto parametrizado y
 * la sentencia preparada con nombre (`models/named-statements.ts`) el plan se reusa entre requests.
 *
 * LAS LISTAS: `IN (:lista)` se escribe `= ANY($n)` y `NOT IN (:lista)`, `<> ALL($n)`. Son
 * equivalentes, NULL incluido, y el texto deja de depender de cuántos valores trae la lista —si no,
 * cada tamaño de página sería otra sentencia—. Una lista en CUALQUIER otra posición no se sabe
 * reescribir: `toPositional` devuelve `null` y la sentencia sigue por los `replacements` de siempre.
 *
 * NO TOCA NADA QUE NO SEA UN REEMPLAZO DECLARADO: un `:nombre` que no está en `replacements` queda
 * igual, y los casts `::tipo` de PostgreSQL no matchean (el `:` va precedido de otro `:`).
 */

const LIST = /\b(NOT\s+)?IN\s*\(\s*:([A-Za-z_]\w*)\s*\)/g;
const NAMED = /(?<![:\w]):([A-Za-z_]\w*)/g;

export interface PositionalPlan {
  sql: string;
  bind: unknown[];
}

export function toPositional(
  sql: string,
  replacements: Readonly<Record<string, unknown>>
): PositionalPlan | null {
  const has = (name: string): boolean => Object.prototype.hasOwnProperty.call(replacements, name);
  const bind: unknown[] = [];
  const slots = new Map<string, number>();
  const slot = (name: string): string => {
    let index = slots.get(name);
    if (index === undefined) {
      bind.push(replacements[name]);
      index = bind.length;
      slots.set(name, index);
    }
    return `$${index}`;
  };

  let convertible = true;
  const lists = sql.replace(LIST, (match, not: string | undefined, name: string) => {
    if (!has(name) || !Array.isArray(replacements[name])) {
      return match;
    }
    return not ? `<> ALL(${slot(name)})` : `= ANY(${slot(name)})`;
  });
  const out = lists.replace(NAMED, (match, name: string) => {
    if (!has(name)) {
      return match;
    }
    const value = replacements[name];
    // Una lista fuera de `IN (…)`, o un valor ausente: no se sabe expresar como parámetro sin
    // cambiar el significado. Se deja la sentencia entera por el camino de siempre.
    if (Array.isArray(value) || value === undefined) {
      convertible = false;
      return match;
    }
    return slot(name);
  });
  return convertible ? { sql: out, bind } : null;
}
