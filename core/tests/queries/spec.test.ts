import 'mocha';
import 'should';
import { ErrorCode } from '@jiku/nats-protocol';
import { Sequelize } from 'sequelize-typescript';
import {
  deniesAllRows,
  isRelation,
  resolveVariant,
  specFor,
} from '../../src/queries/engine/spec';
import { activitySpec } from '../../src/queries/activity/activity-spec';
import { attachmentsSpec } from '../../src/queries/attachments/attachments-spec';
import { filesSpec } from '../../src/queries/files/files-spec';
import { commentsSpec } from '../../src/queries/comments/comments-spec';
import { subscriptionsSpec } from '../../src/queries/subscriptions/subscriptions-spec';
import { tasksSpec } from '../../src/queries/tasks/tasks-spec';
import { runGet } from '../../src/queries/engine/run';
import { validateGet } from '../../src/queries/engine/validate-query';
import { ValidatedGetQuery } from '../../src/queries/engine/types';
import {
  BaseFieldSpec,
  CallerClass,
  ExternalScopeSpec,
  ManyRelationSpec,
  PolymorphicExternalScope,
  QueryContext,
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

/**
 * LAS DOS FICHAS SIN DISCRIMINADOR DE S-027 (Tasks 5, 6 y 7).
 *
 * ES UN BUCLE HERMANO al de S-025 y no una extensión de aquel: `attachments` y `files` NO TIENEN
 * VARIANTES —la tabla de cada uno es una sola—, así que el bucle sobre `['task', 'requirement']`
 * no aplica. Lo que sí aplica es la propiedad que `meta.describe` (S-028) va a necesitar: los
 * cinco arrays de nombres son EXACTAMENTE las claves de sus mapas.
 */
describe('queries/engine/spec — las dos fichas planas de S-027 (TS-97 a TS-100)', () => {
  const SPECS: [string, ResourceSpec][] = [
    ['attachments', attachmentsSpec],
    ['files', filesSpec],
  ];

  it('TS-97 · los cinco arrays de nombres se DERIVAN de sus mapas', () => {
    // El validador los devuelve POR REFERENCIA en `errorDetails.allowed`: una copia escrita a mano
    // divergiría del contrato sin fallar al compilar.
    for (const [name, spec] of SPECS) {
      [...spec.baseNames].should.deepEqual(Object.keys(spec.base), name);
      [...spec.includableNames].should.deepEqual(Object.keys(spec.includable), name);
      [...spec.filterableNames].should.deepEqual(Object.keys(spec.filterable), name);
      [...spec.sortableNames].should.deepEqual(Object.keys(spec.sortable), name);
      [...spec.fieldNames].should.deepEqual(
        [...Object.keys(spec.base), ...Object.keys(spec.includable)],
        name
      );
    }
  });

  it('TS-98 · ninguna de las dos declara discriminador, y `resolveVariant` es la identidad', () => {
    for (const [name, spec] of SPECS) {
      (spec.discriminator === undefined).should.be.true(name);
      // LA MISMA REFERENCIA, no una copia: es lo que hace que el resto del motor no se entere.
      resolveVariant(spec).should.equal(spec, name);
      resolveVariant(spec, 'lo-que-sea').should.equal(spec, name);
    }
  });

  it('TS-99 · CA-7: los cuatro nombres prohibidos NO APARECEN en ninguna de las dos fichas', () => {
    // NO SE "EXCLUYEN": NO SE ESCRIBEN. La lista blanca es el mecanismo, e `invalid_fields` es la
    // consecuencia automática. Publicar la clave del storage es publicar la estructura del bucket,
    // y con ella un acceso directo que saltea el comando de descarga y su auditoría.
    const forbidden = [
      'storage_key',
      'storageKey',
      'storage_bucket',
      'storageBucket',
      'storage_region',
      'storageRegion',
      'ticket_slug',
      'ticketSlug',
    ];

    for (const [name, spec] of SPECS) {
      const serialized = JSON.stringify(spec);
      for (const term of forbidden) {
        serialized.includes(term).should.be.false(`${name} contiene "${term}"`);
      }
    }
  });

  it('TS-100 · CA-8: ninguna de las dos fichas contiene nada con forma de URL', () => {
    // Mintear una prefirmada es un EFECTO, con vencimiento y con auditoría, y ya tiene su comando
    // (`files.{fileId}.request-download`). Una consulta es idempotente y sin efectos.
    for (const [name, spec] of SPECS) {
      const serialized = JSON.stringify(spec).toLowerCase();
      for (const term of ['http', 'url', 'signed', 'presigned', 'disposition']) {
        serialized.includes(term).should.be.false(`${name} contiene "${term}"`);
      }
    }
  });

  it('la ficha de `attachments` declara `include` VACÍO y la de `files` solo `checksum`', () => {
    // `include: ninguno` es el contrato de CA-2: los datos del archivo ya vienen APLANADOS, y la
    // entidad dueña es polimórfica sin FK. `checksum` es incluible y no base (RF-17): 64
    // caracteres por fila que nadie mira salvo que los pida, Y LO DECLARA QUIEN SUBE — nadie lo
    // verifica.
    [...attachmentsSpec.includableNames].should.deepEqual([]);
    [...filesSpec.includableNames].should.deepEqual(['checksum']);
  });

  it('`attachments` NO declara "no encontrado" y `files` SÍ: es la diferencia de tener `get`', () => {
    (attachmentsSpec.notFoundCode === undefined).should.be.true();
    (attachmentsSpec.notFoundMessage === undefined).should.be.true();
    filesSpec.notFoundCode!.should.equal(ErrorCode.FILE_NOT_FOUND);
    filesSpec.notFoundMessage!.should.equal('No existe un archivo con ese id');
  });
});

/** Se exporta para que los tests del motor reusen la MISMA ficha de prueba y no inventen otra. */
export { VARIANT_SPEC, BASE as VARIANT_BASE };

/**
 * TS-2 · `deniesAllRows` — LA PREGUNTA QUE `runList` Y `runGet` HACEN ANTES DE ARMAR NADA (S-026).
 *
 * Vive en `engine/spec.ts` porque es RESOLUCIÓN DE LA FICHA, igual que `resolveVariant`: el motor
 * pregunta y no interpreta. La tabla completa —`none` × las tres clases y las otras tres formas ×
 * `external`— es lo que fija que la única combinación verdadera sea `(none, external)`.
 */
describe('queries/engine/spec — el corte SIN ACCESO (S-026, Task 1)', () => {
  /** Las SEIS formas del recorte. Las dos últimas las agrega S-027 y ninguna vacía el conjunto. */
  const POLY: PolymorphicExternalScope = {
    kind: 'polymorphic',
    typeColumn: 'entity_type',
    idColumn: 'entity_id',
    branches: { project: { table: 'projects', key: 'id', projectColumn: 'id' } },
  };

  const SCOPES: [string, ExternalScopeSpec][] = [
    ['none', { kind: 'none' }],
    ['column', { kind: 'column', projectColumn: 'project_id' }],
    [
      'exists',
      { kind: 'exists', table: 'projects', foreignKey: 'id', localKey: 'project_id', projectColumn: 'id' },
    ],
    ['owner', { kind: 'owner', userColumn: 'user_id' }],
    // TS-29 · las dos de S-027: ACOTAN el conjunto, no lo vacían. `deniesAllRows` sigue siendo
    // verdadero SOLO para `none`, y por eso las dos fichas nuevas nunca cortan antes de consultar.
    ['polymorphic', POLY],
    [
      'bridge',
      {
        kind: 'bridge',
        table: 'attachments',
        foreignKey: 'file_id',
        localKey: 'id',
        liveWhere: 'br_.deleted_at IS NULL',
        through: POLY,
        orOrphanColumn: 'uploaded_by',
      },
    ],
  ];

  function ctxWith(callerClass: CallerClass): QueryContext {
    return { caller: 'sub-q-external', callerClass, db: {} as unknown as Sequelize };
  }

  function specWith(externalScope: ExternalScopeSpec): ResourceSpec {
    return { ...tasksSpec, externalScope };
  }

  it('TS-2 · es verdadero SOLO con `none` + clase externa', () => {
    for (const [label, scope] of SCOPES) {
      for (const callerClass of ['external', 'internal', 'connector'] as CallerClass[]) {
        const expected = label === 'none' && callerClass === 'external';

        deniesAllRows(specWith(scope), ctxWith(callerClass)).should.equal(
          expected,
          `${label} × ${callerClass}`
        );
      }
    }
  });

  it('TS-2 · no nombra ningún recurso: la respuesta depende SOLO de la ficha y de la clase', () => {
    // La misma ficha con dos recortes distintos da dos respuestas distintas; el `name` no
    // interviene. Es el criterio que decide si la abstracción quedó bien (TS-76).
    const external = ctxWith('external');

    deniesAllRows({ ...tasksSpec, name: 'cualquiera', externalScope: { kind: 'none' } }, external)
      .should.be.true();
    deniesAllRows({ ...tasksSpec, name: 'worked-times' }, external).should.be.false();
  });
});

/**
 * TS-11 · EL CORTE TAMBIÉN EN `runGet`: "sin acceso" NUNCA TOCA LA BASE.
 *
 * Hoy no es alcanzable —ninguna ficha `none` tiene `get` registrado— y se verifica igual: la
 * propiedad que el contrato promete es que no se consulta, y tiene que valer en TODOS los caminos
 * y no solo en el que hoy tiene consumidor.
 */
describe('queries/engine/run — el corte SIN ACCESO en `get` (S-026, Task 1)', () => {
  it('TS-11 · devuelve el `notFoundCode` de la ficha con CERO llamadas a `ctx.db.query`', async () => {
    const calls: unknown[] = [];
    const db = {
      query: (...args: unknown[]) => {
        calls.push(args);
        return Promise.resolve([]);
      },
    } as unknown as Sequelize;

    const spec: ResourceSpec = {
      ...tasksSpec,
      externalScope: { kind: 'none' },
      notFoundCode: ErrorCode.TASK_NOT_FOUND,
      notFoundMessage: 'No existe una tarea con ese id',
    };
    const validated = validateGet(spec, { id: 1 }) as { value: ValidatedGetQuery };

    const reply = await runGet(spec, validated.value, {
      caller: 'sub-q-external',
      callerClass: 'external',
      db,
    });

    reply.status.should.equal('failure');
    (reply as any).errorCode.should.equal(ErrorCode.TASK_NOT_FOUND);
    calls.should.deepEqual([]);
  });
});
