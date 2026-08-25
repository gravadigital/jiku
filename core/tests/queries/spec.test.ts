import 'mocha';
import 'should';
import { ErrorCode } from '@jiku/nats-protocol';
import { isRelation, resolveVariant, specFor } from '../../src/queries/engine/spec';
import { activitySpec } from '../../src/queries/activity/activity-spec';
import { commentsSpec } from '../../src/queries/comments/comments-spec';
import { subscriptionsSpec } from '../../src/queries/subscriptions/subscriptions-spec';
import { tasksSpec } from '../../src/queries/tasks/tasks-spec';
import {
  BaseFieldSpec,
  ManyRelationSpec,
  ResourceSpec,
  ResourceVariant,
} from '../../src/queries/types';

/**
 * LA RESOLUCIÓN DE LA FICHA: la variante del recurso y el spec de un nombre (S-025, Tasks 1 y 2).
 *
 * LA FICHA DE PRUEBA ES LOCAL Y NO `commentsSpec` A PROPÓSITO: lo que se verifica es la CAPACIDAD
 * GENÉRICA del motor, y acoplar estos tests a la ficha de un recurso haría que un cambio del
 * contrato de `comments` rompiera tests que no hablan de `comments`.
 */

/** Dos variantes sobre dos tablas inventadas, con todo lo que una variante puede sobreescribir. */
function variant(prefix: string, extra: Partial<ResourceVariant> = {}): ResourceVariant {
  return {
    table: `${prefix}_things`,
    where: `t.kind = '${prefix}'`,
    base: { entityId: { column: `${prefix}_id` } },
    filterable: { entityId: { column: `${prefix}_id`, kind: 'integer' } },
    enums: { flavour: [`${prefix}-uno`, `${prefix}-dos`] },
    externalScope: {
      kind: 'exists',
      table: `${prefix}_owners`,
      foreignKey: 'id',
      localKey: `${prefix}_id`,
      projectColumn: 'project_id',
    },
    ...extra,
  };
}

const BASE = {
  id: { column: 'id' },
  // El campo CONSTANTE: el valor lo decide la variante y ninguna columna lo lleva.
  entityType: { constant: 'alpha' },
  entityId: { column: 'placeholder_id' },
  body: { column: 'new_value' },
};

const VARIANT_SPEC: ResourceSpec = {
  name: 'things',
  table: 'placeholder',
  discriminator: {
    field: 'entityType',
    values: ['alpha', 'beta'],
    variants: {
      alpha: variant('alpha', { base: { entityType: { constant: 'alpha' }, entityId: { column: 'alpha_id' } } }),
      beta: variant('beta', { base: { entityType: { constant: 'beta' }, entityId: { column: 'beta_id' } } }),
    },
  },
  base: BASE,
  baseNames: Object.keys(BASE),
  includable: { author: { kind: 'field', column: 'changed_by' } },
  includableNames: ['author'],
  fieldNames: [...Object.keys(BASE), 'author'],
  filterable: { entityType: { column: 'kind', kind: 'string' }, entityId: { column: 'placeholder_id', kind: 'integer' } },
  filterableNames: ['entityType', 'entityId'],
  sortable: { createdAt: { column: 'created_at' } },
  sortableNames: ['createdAt'],
  defaults: { sort: ['createdAt'] },
  enums: {},
  truncatable: ['body'],
  externalScope: { kind: 'column', projectColumn: 'project_id' },
  notFoundCode: ErrorCode.COMMENT_NOT_FOUND,
  notFoundMessage: 'No existe',
};

describe('queries/engine/spec — la variante del recurso (S-025, Task 1)', () => {
  it('TS-86 · la variante resuelve tabla, columna de entidad y predicado fijo', () => {
    const alpha = resolveVariant(VARIANT_SPEC, 'alpha');
    const beta = resolveVariant(VARIANT_SPEC, 'beta');

    alpha.table.should.equal('alpha_things');
    (alpha.filterable.entityId.column as string).should.equal('alpha_id');
    alpha.where!.should.equal("t.kind = 'alpha'");

    beta.table.should.equal('beta_things');
    (beta.filterable.entityId.column as string).should.equal('beta_id');
    beta.where!.should.equal("t.kind = 'beta'");
  });

  it('TS-87 · la ficha efectiva es una `ResourceSpec` COMPLETA, indistinguible de una sin variantes', () => {
    const effective = resolveVariant(VARIANT_SPEC, 'alpha');

    // Todas las claves de una ficha corriente están: el resto del motor no puede distinguirla.
    for (const key of Object.keys(tasksSpec)) {
      effective.should.have.property(key);
    }
  });

  it('TS-94 · los cuatro arrays de nombres se DERIVAN de los mapas efectivos', () => {
    const effective = resolveVariant(VARIANT_SPEC, 'beta');

    [...effective.baseNames].should.deepEqual(Object.keys(effective.base));
    [...effective.includableNames].should.deepEqual(Object.keys(effective.includable));
    [...effective.filterableNames].should.deepEqual(Object.keys(effective.filterable));
    [...effective.fieldNames].should.deepEqual([
      ...Object.keys(effective.base),
      ...Object.keys(effective.includable),
    ]);
  });

  it('el orden de las claves SE CONSERVA: `errorDetails.allowed` ES ese orden', () => {
    // `{...a, ...b}` conserva la posición de las claves de `a` que `b` pisa. La variante solo pisa
    // `entityType` y `entityId`, así que el orden declarado en la ficha sobrevive.
    [...resolveVariant(VARIANT_SPEC, 'alpha').baseNames].should.deepEqual([
      'id',
      'entityType',
      'entityId',
      'body',
    ]);
  });

  it('la variante hereda lo que NO sobreescribe: sort, defaults, truncatable y el no-encontrado', () => {
    const effective = resolveVariant(VARIANT_SPEC, 'alpha');

    // Son del RECURSO y no de la tabla: si dos variantes pudieran declarar contratos distintos,
    // `meta.describe` tendría que describir dos recursos.
    [...effective.sortableNames].should.deepEqual(['createdAt']);
    [...effective.defaults.sort].should.deepEqual(['createdAt']);
    [...effective.truncatable].should.deepEqual(['body']);
    effective.notFoundCode!.should.equal(ErrorCode.COMMENT_NOT_FOUND);
    effective.name.should.equal('things');
  });

  it('una ficha SIN discriminador devuelve LA MISMA REFERENCIA', () => {
    // Es lo que hace que las cuatro fichas de S-022 y S-024 no cambien una línea.
    resolveVariant(tasksSpec, undefined).should.equal(tasksSpec);
    resolveVariant(tasksSpec, 'lo-que-sea').should.equal(tasksSpec);
  });

  it('un valor desconocido LANZA: nunca se resuelve una tabla por omisión', () => {
    // NO ES ALCANZABLE —el validador ya rechazó el valor— y lanzar lo deja visible si alguna vez
    // lo fuera. Un default acá sería el bug silencioso que toda la story existe para prevenir.
    (() => resolveVariant(VARIANT_SPEC, 'gamma')).should.throw(/variante desconocida de things/);
    (() => resolveVariant(VARIANT_SPEC, undefined)).should.throw(/variante desconocida de things/);
  });

  it('la variante puede sobreescribir el recorte externo y los enums', () => {
    const alpha = resolveVariant(VARIANT_SPEC, 'alpha');
    const beta = resolveVariant(VARIANT_SPEC, 'beta');

    (alpha.externalScope as any).table.should.equal('alpha_owners');
    (beta.externalScope as any).table.should.equal('beta_owners');
    [...alpha.enums.flavour].should.deepEqual(['alpha-uno', 'alpha-dos']);
    [...beta.enums.flavour].should.deepEqual(['beta-uno', 'beta-dos']);
  });
});

describe('queries/engine/spec — `specFor` y `isRelation` (S-025, Task 2)', () => {
  const RELATION: ManyRelationSpec = {
    kind: 'relation',
    cardinality: 'many',
    table: 'attachments',
    parentKey: 'entity_id',
    order: [{ expr: 'r.id', dir: 'ASC' }],
    fields: { id: 'r.id' },
  };
  const WITH_BASE_RELATION: ResourceSpec = {
    ...VARIANT_SPEC,
    base: { ...BASE, attachments: RELATION },
    baseNames: [...Object.keys(BASE), 'attachments'],
  };

  it('resuelve un nombre del conjunto BASE y uno del INCLUIBLE con la misma llamada', () => {
    ((specFor(VARIANT_SPEC, 'body') as BaseFieldSpec).column).should.equal('new_value');
    (specFor(VARIANT_SPEC, 'author') as any).kind.should.equal('field');
    (specFor(VARIANT_SPEC, 'no-existe') === undefined).should.be.true();
  });

  it('`isRelation` reconoce una relación esté en `base` o en `includable`', () => {
    isRelation(specFor(WITH_BASE_RELATION, 'attachments')).should.be.true();
    // Un campo constante y una columna NO son relaciones, y no tienen `kind`: estrecharlas con un
    // `as` apagaría justo la verificación que las tres formas del conjunto base necesitan.
    isRelation(specFor(WITH_BASE_RELATION, 'entityType')).should.be.false();
    isRelation(specFor(WITH_BASE_RELATION, 'body')).should.be.false();
    isRelation(specFor(WITH_BASE_RELATION, 'author')).should.be.false();
    isRelation(undefined).should.be.false();
  });
});

/**
 * TS-94 SOBRE LAS TRES FICHAS REALES, VARIANTE POR VARIANTE.
 *
 * Los tests de arriba verifican la CAPACIDAD sobre una ficha sintética; este verifica que las tres
 * fichas de S-025 la usan bien. Recorre las SEIS fichas efectivas —tres recursos por dos
 * variantes— y comprueba la propiedad que `meta.describe` (S-028) va a necesitar: los cuatro
 * arrays de nombres son EXACTAMENTE las claves de sus mapas, también después de resolver.
 */
describe('queries/engine/spec — las tres fichas de S-025, resueltas (TS-94)', () => {
  const SPECS: [string, ResourceSpec][] = [
    ['comments', commentsSpec],
    ['activity', activitySpec],
    ['subscriptions', subscriptionsSpec],
  ];

  it('las tres declaran el MISMO discriminador, con los dos valores en el orden del contrato', () => {
    for (const [name, spec] of SPECS) {
      spec.discriminator!.field.should.equal('entityType', name);
      [...spec.discriminator!.values].should.deepEqual(['task', 'requirement'], name);
      Object.keys(spec.discriminator!.variants).should.deepEqual(['task', 'requirement'], name);
    }
  });

  it('las SEIS fichas efectivas derivan sus cuatro arrays de nombres de sus mapas', () => {
    for (const [name, spec] of SPECS) {
      for (const variant of ['task', 'requirement']) {
        const effective = resolveVariant(spec, variant);
        const label = `${name}/${variant}`;

        [...effective.baseNames].should.deepEqual(Object.keys(effective.base), label);
        [...effective.includableNames].should.deepEqual(Object.keys(effective.includable), label);
        [...effective.filterableNames].should.deepEqual(Object.keys(effective.filterable), label);
        [...effective.sortableNames].should.deepEqual(Object.keys(effective.sortable), label);
        [...effective.fieldNames].should.deepEqual(
          [...Object.keys(effective.base), ...Object.keys(effective.includable)],
          label
        );
      }
    }
  });

  it('resolver la variante NO cambia el orden de las claves del conjunto base', () => {
    // `errorDetails.allowed` ES ese orden: si una variante AGREGARA una clave en vez de PISARLA,
    // el contrato de la respuesta cambiaría según el `entityType` pedido.
    for (const [name, spec] of SPECS) {
      const task = resolveVariant(spec, 'task');
      const requirement = resolveVariant(spec, 'requirement');

      [...task.baseNames].should.deepEqual([...requirement.baseNames], name);
      [...task.baseNames].should.deepEqual([...spec.baseNames], name);
      [...task.filterableNames].should.deepEqual([...spec.filterableNames], name);
    }
  });

  it('NINGUNA ficha efectiva conserva un placeholder sin resolver', () => {
    // EL PLACEHOLDER ES `__variante_sin_resolver__` y NO el nombre de una tabla real: un camino que
    // llegara al motor sin resolver la variante tiene que fallar RUIDOSO —`relation does not
    // exist`— y no leer `objective_activity` en silencio, que es el bug que la story previene.
    for (const [name, spec] of SPECS) {
      for (const variant of ['task', 'requirement']) {
        const effective = resolveVariant(spec, variant);
        JSON.stringify({ label: `${name}/${variant}`, effective }).should.not.containEql(
          '__variante_sin_resolver__'
        );
        effective.table.should.not.containEql('__variante');
      }
      // Y la ficha SIN resolver sí los lleva: es lo que la hace fallar en vez de mentir.
      spec.table.should.equal('__variante_sin_resolver__', name);
    }
  });
});

/** Se exporta para que los tests del motor reusen la MISMA ficha de prueba y no inventen otra. */
export { VARIANT_SPEC, BASE as VARIANT_BASE };
