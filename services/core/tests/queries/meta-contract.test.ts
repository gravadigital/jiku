import 'mocha';
import 'should';
import { Reply } from '@jiku/nats-protocol';
import { queryRegistry } from '../../src/queries';
import { dispatchQuery } from '../helpers/dispatch';
import { createWorld, destroyWorld } from './task-fixtures';
import { createDomainWorld, destroyDomainWorld } from './domain-fixtures';

/**
 * CA-12 — LA DESCRIPCIÓN Y EL VALIDADOR LEEN LA MISMA ESTRUCTURA.
 *
 * ES EL TEST MÁS VALIOSO DEL REQ ENTERO, y es una PROPIEDAD, no un ejemplo: recorre la respuesta de
 * `meta.describe` y, para CADA recurso y CADA nombre declarado, dispara una consulta real por el
 * despachador. Todo lo que la descripción declara tiene que funcionar; todo lo que no declara tiene
 * que responder `invalid_fields`.
 *
 * CRECE SOLO. Un recurso nuevo entra al registro de fichas, aparece en la descripción, y este
 * archivo lo empieza a ejercitar sin una línea de cambio. Es lo contrario de una lista de casos
 * escrita a mano, que es lo que se desactualiza.
 *
 * LO QUE ATRAPA es una ficha mal escrita: un `sortable` declarado que el validador rechaza, o un
 * `filterable` que la descripción olvidó. Los dos son bugs del servicio, y el peor tipo: el
 * consumidor CONFÍA en la descripción, así que interpreta el error como propio.
 */

/** El nombre que ninguna ficha puede declarar. Si alguna lo declara, el test negativo lo dice. */
const NEVER = 'nombre-que-no-existe-jamas';

interface Described {
  base?: Record<string, any>;
  includable?: Record<string, any>;
  filterable?: Record<string, any>;
  enums?: Record<string, { value: string; label: string }[]>;
  sortable: string[];
  defaults: { sort: string[]; limit: number; maxLimit: number };
  discriminator?: { field: string; values: string[] };
  variants?: Record<string, Described>;
}

/**
 * La ficha EFECTIVA que la descripción publica para un recurso: la del recurso, o la de su PRIMERA
 * variante si tiene discriminador.
 *
 * Se toma UNA variante y no la unión, por la misma razón por la que la descripción no la publica:
 * la unión declararía nombres que la mitad de las variantes rechaza.
 */
function effective(resource: Described): Described {
  if (!resource.discriminator) {
    return resource;
  }
  return { ...resource.variants![resource.discriminator.values[0]], ...resource };
}

/** Un valor del TIPO que la descripción declara para ese filtro. */
function valueFor(resource: Described, name: string, filter: any): unknown {
  if (resource.discriminator && name === resource.discriminator.field) {
    return resource.discriminator.values[0];
  }
  if (filter.contains) {
    // El filtro de contención tiene FORMA PROPIA: un objeto con exactamente las claves del `shape`.
    return Object.fromEntries(filter.contains.shape.map((key: string) => [key, 'x']));
  }
  if (filter.enum) {
    return effective(resource).enums![filter.enum][0].value;
  }
  switch (filter.kind) {
  case 'integer':
    return 1;
  case 'date':
    return '2026-01-01';
  case 'boolean':
    return true;
  default:
    return 'x';
  }
}

/** El endpoint por el que se ejercita el recurso, y el payload mínimo válido de ese endpoint. */
function entryPoint(name: string, resource: Described): { pattern: string; payload: any } | null {
  const patterns = queryRegistry.patterns();
  const discriminator = resource.discriminator
    ? { [resource.discriminator.field]: resource.discriminator.values[0] }
    : {};

  if (patterns.includes(`${name}.list`)) {
    return { pattern: `${name}.list`, payload: { filter: { ...discriminator } } };
  }
  if (patterns.includes(`${name}.get`)) {
    // `files` es el único recurso SIN `list`, y la ausencia es el contrato de S-027: los archivos se
    // listan POR SU VÍNCULO. Un `get` con un id inexistente responde `file_not_found`, que no es
    // `invalid_fields` — que es exactamente lo que estos tests miden.
    return { pattern: `${name}.get`, payload: { id: 1, ...discriminator } };
  }
  return null;
}

function rejectedForFields(reply: Reply<unknown>): boolean {
  return reply.status === 'failure' && reply.errorCode === 'invalid_fields';
}

/**
 * ¿ESTE NOMBRE DECLARADO FUNCIONÓ DE VERDAD?
 *
 * NO ALCANZA CON "no respondió `invalid_fields`". Un `sortable` que declara una columna inexistente
 * pasa el validador y REVIENTA EN EL SQL: la respuesta sería `internal_error`, y medir solo el
 * rechazo de la gramática dejaría pasar el bug más caro de una ficha mal escrita.
 *
 * LA ÚNICA FALLA ACEPTABLE es el "no encontrado" de un `get` con un id que no existe: es la
 * respuesta correcta a esa consulta, y no dice nada del nombre que se estaba probando.
 */
function honored(reply: Reply<unknown>): boolean {
  return reply.status === 'success' || (reply.errorCode ?? '').endsWith('_not_found');
}

describe('queries/meta.describe — CA-12, la descripción no puede mentir (S-028, Task 4)', () => {
  let resources: Record<string, Described>;

  before(async function describeAll() {
    this.timeout(60000);
    await createWorld();
    await createDomainWorld();

    const reply: any = await dispatchQuery('meta.describe', {});
    reply.status.should.equal('success', JSON.stringify(reply));
    resources = reply.data.resources;
  });

  after(async () => {
    await destroyDomainWorld();
    await destroyWorld();
  });

  it('TS-62 · CA-12 positivo: TODO `sortable` declarado se puede usar', async function sortablePositive() {
    this.timeout(60000);
    const offenders: string[] = [];

    for (const [name, resource] of Object.entries(resources)) {
      const entry = entryPoint(name, resource);
      if (!entry || !entry.pattern.endsWith('.list')) {
        continue;
      }

      for (const field of resource.sortable) {
        const reply = await dispatchQuery(entry.pattern, { ...entry.payload, sort: [field] });
        if (!honored(reply)) {
          offenders.push(`${name}.sort[${field}] -> ${reply.errorCode}: ${reply.errorMessage}`);
        }
      }
    }

    offenders.should.deepEqual([]);
  });

  it('TS-63 · CA-12 negativo: un `sort` no declarado falla, y `allowed` ES la lista descrita', async function sortableNegative() {
    this.timeout(60000);
    const offenders: string[] = [];

    for (const [name, resource] of Object.entries(resources)) {
      const entry = entryPoint(name, resource);
      if (!entry || !entry.pattern.endsWith('.list')) {
        continue;
      }

      const reply: any = await dispatchQuery(entry.pattern, { ...entry.payload, sort: [NEVER] });
      if (!rejectedForFields(reply)) {
        offenders.push(`${name}: aceptó un sort inexistente`);
        continue;
      }
      // LISTAS, NO CONJUNTOS: el orden de `errorDetails.allowed` es el de la ficha, y es el mismo
      // que la descripción publica. Comparar conjuntos dejaría pasar una divergencia de orden que
      // el consumidor sí ve.
      if (JSON.stringify(reply.errorDetails.allowed) !== JSON.stringify(resource.sortable)) {
        offenders.push(
          `${name}: allowed=${JSON.stringify(reply.errorDetails.allowed)} ` +
            `describe=${JSON.stringify(resource.sortable)}`
        );
      }
    }

    offenders.should.deepEqual([]);
  });

  it('TS-64 · CA-12 positivo: TODO `filterable` declarado se puede usar', async function filterPositive() {
    this.timeout(120000);
    const offenders: string[] = [];

    for (const [name, resource] of Object.entries(resources)) {
      const entry = entryPoint(name, resource);
      if (!entry || !entry.pattern.endsWith('.list')) {
        continue;
      }

      const spec = effective(resource);
      for (const [field, filter] of Object.entries(spec.filterable!)) {
        const value = valueFor(resource, field, filter);
        const reply: any = await dispatchQuery(entry.pattern, {
          filter: { ...entry.payload.filter, [field]: value },
        });
        if (!honored(reply)) {
          offenders.push(`${name}.filter[${field}] -> ${reply.errorCode}: ${reply.errorMessage}`);
        }
      }
    }

    offenders.should.deepEqual([]);
  });

  it('TS-65 · CA-12 negativo: un filtro no declarado falla, y `allowed` ES la lista descrita', async function filterNegative() {
    this.timeout(60000);
    const offenders: string[] = [];

    for (const [name, resource] of Object.entries(resources)) {
      const entry = entryPoint(name, resource);
      if (!entry || !entry.pattern.endsWith('.list')) {
        continue;
      }

      const reply: any = await dispatchQuery(entry.pattern, {
        filter: { ...entry.payload.filter, [NEVER]: 1 },
      });
      if (!rejectedForFields(reply)) {
        offenders.push(`${name}: aceptó un filtro inexistente`);
        continue;
      }
      const described = Object.keys(effective(resource).filterable!);
      if (JSON.stringify(reply.errorDetails.allowed) !== JSON.stringify(described)) {
        offenders.push(
          `${name}: allowed=${JSON.stringify(reply.errorDetails.allowed)} ` +
            `describe=${JSON.stringify(described)}`
        );
      }
    }

    offenders.should.deepEqual([]);
  });

  it('TS-66 · CA-12 positivo: TODO `includable` declarado se puede incluir', async function includePositive() {
    this.timeout(120000);
    const offenders: string[] = [];

    for (const [name, resource] of Object.entries(resources)) {
      const entry = entryPoint(name, resource);
      if (!entry) {
        continue;
      }

      for (const field of Object.keys(effective(resource).includable!)) {
        const reply: any = await dispatchQuery(entry.pattern, {
          ...entry.payload,
          include: [field],
        });
        if (!honored(reply)) {
          offenders.push(`${name}.include[${field}] -> ${reply.errorCode}: ${reply.errorMessage}`);
        }
      }
    }

    offenders.should.deepEqual([]);
  });

  it('TS-67 · CA-12 negativo: un `include` no declarado falla', async function includeNegative() {
    this.timeout(60000);
    const offenders: string[] = [];

    for (const [name, resource] of Object.entries(resources)) {
      const entry = entryPoint(name, resource);
      if (!entry) {
        continue;
      }

      const reply = await dispatchQuery(entry.pattern, { ...entry.payload, include: [NEVER] });
      if (!rejectedForFields(reply)) {
        offenders.push(`${name}: aceptó un include inexistente`);
      }
    }

    offenders.should.deepEqual([]);
  });

  it('TS-68 · CA-12: `base` ES el conjunto devuelto por defecto', async function baseSet() {
    this.timeout(60000);
    const offenders: string[] = [];

    for (const [name, resource] of Object.entries(resources)) {
      const entry = entryPoint(name, resource);
      if (!entry || !entry.pattern.endsWith('.list')) {
        continue;
      }

      const spec = effective(resource);
      // Las marcas de colección recortada son claves HERMANAS del item, no campos anidados, así que
      // pueden aparecer sin estar en `base`.
      const allowed = new Set([
        ...Object.keys(spec.base!),
        'id',
        ...Object.values<any>(spec.includable!)
          .concat(Object.values<any>(spec.base!))
          .map((entryValue) => entryValue.truncatedFlag)
          .filter(Boolean),
      ]);

      const reply: any = await dispatchQuery(entry.pattern, entry.payload);
      reply.status.should.equal('success', `${name}: ${JSON.stringify(reply)}`);

      for (const item of reply.data.items as Record<string, unknown>[]) {
        for (const key of Object.keys(item)) {
          if (!allowed.has(key)) {
            offenders.push(`${name}.${key} no está en el conjunto base descrito`);
          }
        }
      }
    }

    offenders.should.deepEqual([]);
  });
});
