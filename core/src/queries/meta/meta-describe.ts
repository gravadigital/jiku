import { ErrorCode, Reply, failure, success } from '@jiku/nats-protocol';
import { Query } from '../types';
import { IDENTITY_PAYLOAD_FIELDS } from '../engine/validate-query';
import { RESOURCES_BY_NAME, RESOURCE_NAMES, RESOURCE_SPECS } from '../resources';
import { ResourceDescription, describeResource } from './describe-spec';

/**
 * `meta.describe` — EL CONTRATO EN DATOS.
 *
 * ES EL ENDPOINT QUE LE DA SENTIDO A LA DECISIÓN DE S-022 —la ficha como DATO— y la vuelve
 * verificable: proyecta LAS MISMAS ESTRUCTURAS que el validador usa para rechazar nombres, así que
 * si la descripción declara un `sortable`, ordenar por él no puede responder `invalid_fields`; y un
 * nombre que no declara sí tiene que responderlo.
 *
 * DERIVADO, NO MANTENIDO (CA-12). Es la diferencia entre una descripción que puede mentir y una que
 * no. Una estructura paralela —"total son pocos recursos"— se desincroniza en el primer campo nuevo,
 * y el modo de falla es el peor de todos: el consumidor CONFÍA en la descripción, así que un
 * `sortable` declarado que responde `invalid_fields` le parece un bug de su propio código.
 *
 * NO TOCA LA BASE. Es la consulta más barata del contrato y la única que no depende de PostgreSQL.
 *
 * ES IGUAL PARA TODOS LOS CALLERS (CA-14), y eso es CORRECTO: describe el CONTRATO, no los datos.
 * Saber que existe un campo `email` incluible no da acceso a ningún email —el recorte de filas y la
 * lista blanca de campos siguen operando en cada consulta—, y un portal que no puede leer `settings`
 * igual necesita saber que el recurso existe para entender el error que recibe. `execute` IGNORA
 * `ctx.callerClass` a propósito: es lo que hace que CA-14 salga gratis en vez de depender de que
 * nadie agregue una rama.
 *
 * NO ES UN RECURSO Y NO TIENE FICHA: `meta` no aparece en `meta.describe`, no tiene `list`, y
 * publicar `meta.list` responde `unknown_command` porque el patrón no está en el registro.
 */

/** El payload de `meta.describe` DESPUÉS de validar. */
export interface MetaDescribePayload {
  /** Ausente = LOS DIECISÉIS. Ver la nota de `resources.ts` sobre el conteo. */
  readonly resources?: readonly string[];
}

/** La única palanca de primer nivel. Ni `filter`, ni `sort`, ni `page`: no es una colección. */
const TOP_LEVEL_KEYS = ['resources'];

function invalid(message: string, details: Record<string, unknown>): { error: Reply<never> } {
  return { error: failure(ErrorCode.INVALID_FIELDS, message, details) };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateDescribe(
  payload: unknown
): { value: MetaDescribePayload } | { error: Reply<never> } {
  const raw = payload === undefined || payload === null ? {} : payload;
  if (!isPlainObject(raw)) {
    return invalid('La consulta espera un objeto', { field: 'payload', value: raw });
  }

  // LA MISMA LISTA CERRADA QUE EL MOTOR, importada y no reescrita. Acá no hay ningún dato que un
  // campo de identidad pudiera afectar —la descripción es la misma para todos—, y precisamente por
  // eso aceptarlo en silencio sería peor: sugeriría que existe un modo "describime lo de aquel".
  for (const key of Object.keys(raw)) {
    if (IDENTITY_PAYLOAD_FIELDS.includes(key)) {
      return invalid(
        `El campo "${key}" no se acepta: quién pregunta sale del subject, no del cuerpo`,
        { field: 'payload', value: key }
      );
    }
  }

  for (const key of Object.keys(raw)) {
    if (!TOP_LEVEL_KEYS.includes(key)) {
      return invalid(`El campo "${key}" no existe en esta consulta`, {
        field: 'payload',
        value: key,
        allowed: TOP_LEVEL_KEYS,
      });
    }
  }

  if (raw.resources === undefined || raw.resources === null) {
    return { value: {} };
  }

  if (!Array.isArray(raw.resources)) {
    return invalid('El campo "resources" espera una lista de nombres de recurso', {
      field: 'resources',
      value: raw.resources,
      allowed: RESOURCE_NAMES,
    });
  }

  // UN ARRAY VACÍO NO ES "TODOS", y aceptarlo en silencio devolvería los dieciséis a quien pidió
  // cero. Para "todos" se OMITE la clave, que es la única forma que no tiene dos lecturas.
  if (raw.resources.length === 0) {
    return invalid('El campo "resources" no acepta una lista vacía: omitilo para describir todos', {
      field: 'resources',
      value: raw.resources,
      allowed: RESOURCE_NAMES,
    });
  }

  for (const name of raw.resources) {
    if (typeof name !== 'string' || !RESOURCES_BY_NAME.has(name)) {
      // UN NOMBRE INVÁLIDO RECHAZA LA CONSULTA ENTERA, no devuelve una respuesta parcial: una
      // descripción con un recurso menos y sin decir cuál es indistinguible de un recurso que
      // dejó de existir.
      return invalid(`El recurso "${String(name)}" no existe en este contrato`, {
        field: 'resources',
        value: name,
        allowed: RESOURCE_NAMES,
      });
    }
  }

  return { value: { resources: raw.resources as string[] } };
}

export const metaDescribe: Query<MetaDescribePayload> = {
  pattern: 'meta.describe',

  validate: validateDescribe,

  execute: (payload) => {
    // SE RECORREN LAS FICHAS, no una lista de nombres escrita acá: el orden de la respuesta es el
    // del registro, y un recurso nuevo aparece sin tocar este archivo.
    const specs = payload.resources
      ? payload.resources.map((name) => RESOURCES_BY_NAME.get(name)!)
      : RESOURCE_SPECS;

    const resources: Record<string, ResourceDescription> = {};
    for (const spec of specs) {
      resources[spec.name] = describeResource(spec);
    }

    return Promise.resolve(success({ resources }));
  },
};

export default metaDescribe;
