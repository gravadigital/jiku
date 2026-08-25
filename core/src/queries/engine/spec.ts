import {
  BaseSpec,
  EnumSpec,
  IncludableSpec,
  QueryContext,
  RelationSpec,
  ResourceSpec,
} from '../types';

/**
 * LA RESOLUCIÓN DE LA FICHA: la variante del recurso y el spec de un nombre.
 *
 * Son las dos preguntas que el resto del motor NO tiene que volver a responder por su cuenta:
 * "¿contra qué tabla resuelve este recurso?" y "¿qué es este nombre del conjunto devuelto?".
 * Las dos estaban resueltas en varios lugares —la primera implícitamente, en el `resource.table`
 * que cada builder concatenaba; la segunda literalmente, en cuatro archivos— y las dos rompían
 * en silencio cuando aparecía una forma nueva.
 *
 * ESTE ARCHIVO NO CONOCE NINGÚN RECURSO: no nombra `comments`, `activity` ni `subscriptions`, y
 * ese es el criterio que decide si la abstracción quedó bien (TS-83).
 */

/**
 * La ficha EFECTIVA de una variante: una `ResourceSpec` completa, indistinguible de una ficha sin
 * variantes.
 *
 * ES LA PIEZA QUE HACE QUE EL RESTO DEL MOTOR NO SE ENTERE. `validate-query`, `build-sql`,
 * `project`, `include` y `run` siguen operando sobre una `ResourceSpec` común, sin una sola rama
 * nueva por variante. La alternativa —resolver la variante en el archivo del recurso, eligiendo
 * entre dos fichas completas— duplicaría el 90% de la ficha por variante y dejaría la validación
 * de "el discriminador es obligatorio" fuera de la gramática, o sea fuera de lo que
 * `meta.describe` (S-028) va a proyectar.
 */
export function resolveVariant(resource: ResourceSpec, value?: string): ResourceSpec {
  const discriminator = resource.discriminator;
  if (!discriminator) {
    // Un recurso SIN discriminador devuelve la MISMA REFERENCIA: `resolveVariant` es la identidad
    // para las cuatro fichas de S-022 y S-024, y por eso ninguna cambia una línea.
    return resource;
  }

  const variant = value === undefined ? undefined : discriminator.variants[value];
  if (!variant) {
    // NO ES ALCANZABLE: el validador ya rechazó cualquier valor fuera de `values`, y sin valor no
    // hay consulta validada. Lanzar y no devolver un default es lo que mantiene el invariante:
    // NUNCA se resuelve una tabla por omisión. Si este error aparece alguna vez, es que alguien
    // llamó al motor salteándose el validador.
    throw new Error(`[query] variante desconocida de ${resource.name}: ${value}`);
  }

  const base = { ...resource.base, ...variant.base };
  const includable = { ...resource.includable, ...variant.includable };
  const filterable = { ...resource.filterable, ...variant.filterable };

  return {
    ...resource,
    table: variant.table,
    where: variant.where ?? resource.where,
    base,
    includable,
    filterable,
    enums: { ...resource.enums, ...variant.enums },
    externalScope: variant.externalScope ?? resource.externalScope,
    // DERIVADOS, NUNCA COPIADOS: son LA MISMA lista que se acaba de armar, y el validador la
    // devuelve POR REFERENCIA en `errorDetails.allowed`. Escribirlos a mano acá sería reintroducir
    // en el motor la divergencia que las fichas evitan con `Object.keys`.
    //
    // OJO CON EL ORDEN DE LAS CLAVES: `{...a, ...b}` conserva la posición de las claves de `a` que
    // `b` pisa y agrega al final las nuevas. Como `errorDetails.allowed` ES ese orden, una ficha
    // con variantes declara sus campos en la posición que quiere ver en la respuesta y las
    // variantes solo PISAN entradas existentes.
    baseNames: Object.keys(base),
    includableNames: Object.keys(includable),
    fieldNames: [...Object.keys(base), ...Object.keys(includable)],
    filterableNames: Object.keys(filterable),
  };
}

/**
 * El spec de un nombre del conjunto devuelto, mire donde mire.
 *
 * EXISTE PORQUE LA RESOLUCIÓN ESTABA EN CUATRO LUGARES —`selectParts`, `projectRow`,
 * `attachCollections` y `parseProjection`—, cada uno mirando `base` o `includable` por su cuenta.
 * Con una relación en el conjunto base los cuatro tenían que cambiar a la vez, y el que se olvida
 * NO FALLA AL COMPILAR: devuelve el campo vacío.
 */
export function specFor(
  resource: ResourceSpec,
  name: string
): BaseSpec | IncludableSpec | undefined {
  return resource.base[name] ?? resource.includable[name];
}

/**
 * Estrecha a relación mirando `kind`, esté el spec en `base` o en `includable`.
 *
 * Con `'kind' in spec` y no con un `as`: `BaseFieldSpec` y `BaseConstantSpec` no tienen `kind`, y
 * un cast apagaría justo la verificación que las tres formas del conjunto base necesitan.
 */
export function isRelation(spec: BaseSpec | IncludableSpec | undefined): spec is RelationSpec {
  return spec !== undefined && 'kind' in spec && spec.kind === 'relation';
}

/**
 * LOS VALORES DE UN ENUM DE LA FICHA, en orden.
 *
 * ES LA PROYECCIÓN QUE MANTIENE EL CONTRATO DE `errorDetails.allowed`: la ficha puede declarar sus
 * entradas como strings o como `{ value, label }` (S-028), y el rechazo por enum sigue devolviendo
 * una lista de STRINGS. Sin esta función, `allowed` habría pasado a llevar objetos y cada consumidor
 * del catálogo de errores tendría que enterarse de un cambio de forma que no le concierne.
 *
 * DEVUELVE UN ARRAY NUEVO, no la lista de la ficha por referencia. Es el único punto donde el
 * contrato "la lista viaja por referencia" se relaja, y a cambio la ficha no necesita mantener dos
 * listas del mismo enum — que es exactamente la estructura paralela que S-028 existe para evitar.
 */
export function enumValues(entries: EnumSpec | undefined): string[] {
  return (entries ?? []).map((entry) => (typeof entry === 'string' ? entry : entry.value));
}

/**
 * EL ENUM COMPLETO: valor y etiqueta, con el VALOR CRUDO de fallback.
 *
 * Es lo que `meta.describe` proyecta (CA-10). El fallback no es un default perezoso: un
 * `label: undefined` en la respuesta obligaría a cada consumidor a manejar el caso, y el valor crudo
 * es siempre una etiqueta legítima —es lo que la api mostraba antes de que existieran las etiquetas.
 */
export function enumLabeled(
  entries: EnumSpec | undefined
): { value: string; label: string }[] {
  return (entries ?? []).map((entry) =>
    typeof entry === 'string'
      ? { value: entry, label: entry }
      : { value: entry.value, label: entry.label }
  );
}

/**
 * ¿ESTE CALLER NO PUEDE VER NINGUNA FILA DE ESTE RECURSO?
 *
 * Es la pregunta que `runList` y `runGet` hacen ANTES de armar nada. Vive acá y no en `run.ts`
 * porque es RESOLUCIÓN DE LA FICHA, igual que `resolveVariant`: el motor pregunta y no interpreta.
 *
 * El recorte `none` es el único que no es un predicado: las otras tres formas ACOTAN el conjunto y
 * esta lo VACÍA. Devolver `true` acá es lo que hace que el corte sea de CERO SQL, y no un
 * `WHERE FALSE` que pagaría un round-trip a la base por cada request de un portal que no tiene por
 * qué leer nada.
 *
 * NO NOMBRA NINGÚN RECURSO, y ese es el criterio que decide si la abstracción quedó bien.
 */
export function deniesAllRows(resource: ResourceSpec, ctx: QueryContext): boolean {
  return ctx.callerClass === 'external' && resource.externalScope.kind === 'none';
}

export default resolveVariant;
