import 'mocha';
import 'should';
import sinon from 'sinon';
import { readFileSync } from 'fs';
import { join } from 'path';
import { readDb } from '../../src/models/read';
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from '../../src/queries/engine/validate-query';
import { describeResource } from '../../src/queries/meta/describe-spec';
import { RESOURCE_NAMES } from '../../src/queries/resources';
import { queryRegistry } from '../../src/queries';
import { dispatchQuery } from '../helpers/dispatch';
import {
  Q_EXTERNAL,
  Q_INTERNAL,
  createQueryCallers,
  createWorld,
  destroyQueryCallers,
  destroyWorld,
} from './task-fixtures';

/**
 * `meta.describe` — EL CONTRATO EN DATOS (S-028, Task 4).
 *
 * Lo que estos tests fijan es la FORMA de la descripción y lo que NO puede llevar. La propiedad de
 * CA-12 —"todo lo que declara funciona, y lo que no declara falla"— vive en `meta-contract.test.ts`,
 * porque es de otra naturaleza: recorre la respuesta entera y dispara una consulta por nombre.
 */

interface Describe {
  resources: Record<string, any>;
}

function describeOf(reply: any): Record<string, any> {
  reply.status.should.equal('success', JSON.stringify(reply));
  return (reply.data as Describe).resources;
}

describe('queries/meta.describe — la descripción derivada (S-028, Task 4)', () => {
  before(async () => {
    await createWorld();
    await createQueryCallers();
  });

  after(async () => {
    await destroyQueryCallers();
    await destroyWorld();
  });

  afterEach(() => sinon.restore());

  /* ------------------------------------------------------------------------------------------
   * LA FORMA
   * ---------------------------------------------------------------------------------------- */

  it('TS-49 · describe un recurso con las seis claves del contrato (CA-10)', async () => {
    const resources = describeOf(await dispatchQuery('meta.describe', { resources: ['tasks'] }));

    Object.keys(resources).should.deepEqual(['tasks']);
    Object.keys(resources.tasks).should.containDeep([
      'base',
      'includable',
      'filterable',
      'sortable',
      'defaults',
      'enums',
    ]);
  });

  it('TS-50 · cada incluible declara su `kind` (CA-10)', async () => {
    const resources = describeOf(await dispatchQuery('meta.describe', { resources: ['tasks'] }));

    for (const entry of Object.values<any>(resources.tasks.includable)) {
      ['field', 'relation', 'computed'].should.containEql(entry.kind);
    }
    resources.tasks.includable.description.kind.should.equal('field');
    resources.tasks.includable.project.kind.should.equal('relation');
  });

  it('TS-51 · una colección con tope expone `cap` y su `truncatedFlag` (CA-10)', async () => {
    const resources = describeOf(await dispatchQuery('meta.describe', { resources: ['tasks'] }));

    resources.tasks.includable.comments.should.deepEqual({
      kind: 'relation',
      cardinality: 'many',
      fields: ['id', 'body', 'authorId', 'createdAt'],
      cap: 10,
      truncatedFlag: 'commentsTruncated',
    });
  });

  it('TS-52 · una relación SIN tope no lo declara (CA-10)', async () => {
    const resources = describeOf(await dispatchQuery('meta.describe', { resources: ['comments'] }));

    // `comments.attachments` está en el conjunto BASE —la excepción declarada a RF-17— y su ficha no
    // declara tope. Declarar un `cap` "por defecto" prometería un recorte que el motor no aplica.
    const attachments = resources.comments.variants.task.base.attachments;
    attachments.kind.should.equal('relation');
    Object.keys(attachments).should.not.containEql('cap');
    Object.keys(attachments).should.not.containEql('truncatedFlag');
  });

  it('TS-53 · `defaults` trae el orden, el `limit` y el TOPE (CA-10)', async () => {
    const resources = describeOf(await dispatchQuery('meta.describe', { resources: ['tasks'] }));

    resources.tasks.defaults.should.deepEqual({
      sort: ['-createdAt'],
      limit: DEFAULT_PAGE_LIMIT,
      // El tope está porque un pedido mayor SE RECORTA SIN AVISAR: sin este número, un consumidor
      // pide 500 y recibe 200 sin ninguna señal de por qué.
      maxLimit: MAX_PAGE_LIMIT,
    });
  });

  /* ------------------------------------------------------------------------------------------
   * LOS ENUMS CON ETIQUETAS
   * ---------------------------------------------------------------------------------------- */

  it('TS-54 · los enums vienen con ETIQUETAS (CA-10, CA-13)', async () => {
    const resources = describeOf(
      await dispatchQuery('meta.describe', { resources: ['unworked-times'] })
    );

    resources['unworked-times'].enums.reason.should.deepEqual([
      { value: 'tramite', label: 'Trámite' },
      { value: 'corte_servicios', label: 'Cortes de servicios' },
      { value: 'vacaciones', label: 'Vacaciones' },
      { value: 'dia_no_laborable', label: 'Día no laborable' },
      { value: 'personal', label: 'Personal' },
      { value: 'medico', label: 'Médico' },
      { value: 'estudio', label: 'Estudio' },
      { value: 'enfermedad', label: 'Enfermedad' },
      { value: 'otro', label: 'Otro' },
    ]);
  });

  it('TS-55 · CA-13: reemplaza funcionalmente a `GET /unworked-times/reasons`', async () => {
    const resources = describeOf(
      await dispatchQuery('meta.describe', { resources: ['unworked-times'] })
    );

    const source = readFileSync(
      join(__dirname, '..', '..', '..', 'api', 'lib', 'routes', 'unworked-times-reasons-get.ts'),
      'utf8'
    );
    const fromApi = [...source.matchAll(/\{\s*value:\s*'([^']+)',\s*label:\s*'([^']+)'\s*\}/g)].map(
      ([, value, label]) => ({ value, label })
    );

    // IGUALES EN VALOR, ETIQUETA Y ORDEN. La ruta HTTP NO se elimina en REQ-006 —tiene consumidores
    // en los dos frontends—, pero deja de ser el único lugar donde vive esta traducción.
    resources['unworked-times'].enums.reason.should.deepEqual(fromApi);
  });

  it('un enum SIN etiquetas declaradas cae al valor crudo', async () => {
    const resources = describeOf(await dispatchQuery('meta.describe', { resources: ['tasks'] }));

    resources.tasks.enums.state.should.deepEqual([
      { value: 'backlog', label: 'backlog' },
      { value: 'activo', label: 'activo' },
      { value: 'en_revision', label: 'en_revision' },
      { value: 'finalizado', label: 'finalizado' },
      { value: 'cancelado', label: 'cancelado' },
    ]);
  });

  /* ------------------------------------------------------------------------------------------
   * SIN `resources`: TODOS
   * ---------------------------------------------------------------------------------------- */

  it('TS-56 · sin `resources` describe LOS DIECISÉIS (CA-11)', async () => {
    const resources = describeOf(await dispatchQuery('meta.describe', {}));

    // DIECISÉIS, no dieciocho: `requirements.tags` es una OPERACIÓN de `requirements` y `meta` es el
    // describidor. Ninguno de los dos tiene conjunto base ni listas blancas que describir.
    Object.keys(resources).should.have.length(16);
  });

  it('TS-57 · la lista de recursos es DERIVADA del registro de fichas (CA-11, CA-12)', async () => {
    const resources = describeOf(await dispatchQuery('meta.describe', {}));

    Object.keys(resources).should.deepEqual([...RESOURCE_NAMES]);
  });

  it('cada recurso descrito tiene su endpoint en el registro, y al revés', async () => {
    const resources = describeOf(await dispatchQuery('meta.describe', {}));
    const patterns = queryRegistry.patterns();

    for (const name of Object.keys(resources)) {
      patterns
        .some((pattern) => pattern.startsWith(`${name}.`))
        .should.be.true(`el recurso ${name} no tiene ningún endpoint registrado`);
    }
  });

  /* ------------------------------------------------------------------------------------------
   * LOS RECHAZOS
   * ---------------------------------------------------------------------------------------- */

  it('TS-58 · un recurso inexistente es `invalid_fields` (CA-20)', async () => {
    const reply: any = await dispatchQuery('meta.describe', { resources: ['inventado'] });

    reply.status.should.equal('failure');
    reply.errorCode.should.equal('invalid_fields');
    reply.errorDetails.field.should.equal('resources');
    reply.errorDetails.allowed.should.deepEqual([...RESOURCE_NAMES]);
  });

  it('TS-59 · uno válido junto a uno inválido rechaza TODO (CA-20)', async () => {
    const reply: any = await dispatchQuery('meta.describe', { resources: ['tasks', 'inventado'] });

    // Una respuesta parcial con un recurso menos y sin decir cuál sería indistinguible de un
    // recurso que dejó de existir.
    reply.status.should.equal('failure');
    reply.errorCode.should.equal('invalid_fields');
  });

  it('TS-60 · `resources: []` es `invalid_fields`, no "todos" (CA-20)', async () => {
    const reply: any = await dispatchQuery('meta.describe', { resources: [] });

    reply.status.should.equal('failure');
    reply.errorCode.should.equal('invalid_fields');
    reply.errorDetails.field.should.equal('resources');
  });

  it('TS-61 · una palanca no declarada es `invalid_fields` (CA-20)', async () => {
    const reply: any = await dispatchQuery('meta.describe', { filter: {} });

    reply.status.should.equal('failure');
    reply.errorCode.should.equal('invalid_fields');
    reply.errorDetails.allowed.should.deepEqual(['resources']);
  });

  it('un campo de identidad en el payload se rechaza', async () => {
    const reply: any = await dispatchQuery('meta.describe', { userId: 'otro' });

    reply.status.should.equal('failure');
    reply.errorCode.should.equal('invalid_fields');
    reply.errorMessage.should.containEql('subject');
  });

  it('TS-75 · NO devuelve ningún `*_not_found` (CA-20)', async () => {
    const reply: any = await dispatchQuery('meta.describe', { resources: ['inventado'] });

    JSON.stringify(reply).should.not.containEql('_not_found');
  });

  it('TS-77 · `meta.list` NO existe (CA-20)', async () => {
    const reply: any = await dispatchQuery('meta.list', {});

    reply.errorCode.should.equal('unknown_command');
  });

  /* ------------------------------------------------------------------------------------------
   * EL RECURSO CON DISCRIMINADOR
   * ---------------------------------------------------------------------------------------- */

  it('TS-69 · un recurso con discriminador se describe POR VARIANTE (CA-10, CA-12)', async () => {
    const resources = describeOf(await dispatchQuery('meta.describe', { resources: ['activity'] }));

    resources.activity.discriminator.should.deepEqual({
      field: 'entityType',
      values: ['task', 'requirement'],
    });

    const task = resources.activity.variants.task.enums.type;
    const requirement = resources.activity.variants.requirement.enums.type;

    // DOS LISTAS DISTINTAS, no la unión: declarar la unión sería declarar un `type` que en la mitad
    // de las variantes responde `invalid_fields`, que es exactamente lo que CA-12 prohíbe.
    task.should.not.deepEqual(requirement);
    task.length.should.be.above(0);
    requirement.length.should.be.above(0);
  });

  it('lo que la variante NO puede pisar va al nivel del recurso', async () => {
    const resources = describeOf(await dispatchQuery('meta.describe', { resources: ['activity'] }));

    // `ResourceVariant` no declara `sortable` ni `defaults`: publicarlos por variante sugeriría una
    // libertad que la ficha no tiene.
    Object.keys(resources.activity).should.containDeep(['sortable', 'defaults']);
    Object.keys(resources.activity).should.not.containEql('base');
    Object.keys(resources.activity.variants.task).should.deepEqual([
      'base',
      'includable',
      'filterable',
      'enums',
    ]);
  });

  /* ------------------------------------------------------------------------------------------
   * IGUAL PARA TODOS, Y SIN BASE
   * ---------------------------------------------------------------------------------------- */

  it('TS-70 · CA-14: la respuesta es BYTE A BYTE idéntica para un externo y un interno', async () => {
    const external = await dispatchQuery('meta.describe', {}, Q_EXTERNAL);
    const internal = await dispatchQuery('meta.describe', {}, Q_INTERNAL);

    JSON.stringify(external).should.equal(JSON.stringify(internal));
  });

  it('TS-71 · CA-14: describe `settings` aunque el externo no pueda leerlo', async () => {
    const resources = describeOf(
      await dispatchQuery('meta.describe', { resources: ['settings'] }, Q_EXTERNAL)
    );

    // Describe el CONTRATO, no los datos. Un portal que no puede leer `settings` igual necesita
    // saber que el recurso existe para entender la colección vacía que recibe.
    Object.keys(resources.settings.base).should.deepEqual(['id', 'key', 'value']);
  });

  it('TS-72 · NO toca la base: cero invocaciones a `ctx.db.query` (CA-10)', async () => {
    const spy = sinon.spy(readDb, 'query');

    await dispatchQuery('meta.describe', {});

    spy.called.should.be.false();
  });

  /* ------------------------------------------------------------------------------------------
   * LO QUE LA DESCRIPCIÓN NO PUEDE LLEVAR
   * ---------------------------------------------------------------------------------------- */

  it('TS-73 · la descripción NO filtra nombres de tabla ni de columna (CA-10, CA-14)', async () => {
    const reply = await dispatchQuery('meta.describe', {});
    const serialized = JSON.stringify(reply);

    for (const name of [
      'objectives',
      'objective_activity',
      'requirement_activity',
      'objectives_subscriptors',
      'new_value',
      'changed_by',
      'objective_id',
      'project_id',
      'visibility_level',
      'user_project_permissions',
      'system_settings',
      'hours_per_day',
      'first_name',
      'created_at',
    ]) {
      serialized.should.not.containEql(name);
    }
  });

  it('TS-74 · NO expone `externalScope`, `where`, `table` ni `joins` (CA-14)', async () => {
    const resources = describeOf(
      await dispatchQuery('meta.describe', { resources: ['requirements', 'settings'] })
    );

    for (const name of ['externalScope', 'where', 'table', 'joins']) {
      Object.keys(resources.requirements).should.not.containEql(name);
      Object.keys(resources.settings).should.not.containEql(name);
    }
  });

  it('la expresión SQL de un incluible calculado NO viaja', async () => {
    const resources = describeOf(
      await dispatchQuery('meta.describe', { resources: ['requirements'] })
    );

    resources.requirements.includable.totalMinutes.should.deepEqual({ kind: 'computed' });
    JSON.stringify(resources.requirements).should.not.containEql('COALESCE');
  });

  it('un filtro de búsqueda declara QUÉ hace, no DÓNDE busca', async () => {
    const resources = describeOf(
      await dispatchQuery('meta.describe', { resources: ['requirements'] })
    );

    // `search: true` y `searchNumeric: true`: la regla que va a sorprender —`q` con texto de solo
    // dígitos busca POR ID— queda declarada, y las columnas sobre las que busca no.
    resources.requirements.filterable.q.should.deepEqual({
      kind: 'string',
      search: true,
      searchNumeric: true,
    });
    resources.requirements.filterable.tag.should.deepEqual({
      kind: 'string',
      contains: { shape: ['key', 'value'] },
    });
  });

  /* ------------------------------------------------------------------------------------------
   * EL PRESUPUESTO
   * ---------------------------------------------------------------------------------------- */

  it('TS-76 · la respuesta completa entra en el presupuesto de bytes (CA-11)', async () => {
    const reply = await dispatchQuery('meta.describe', {});

    // Si dejara de entrar, la respuesta correcta es documentar el pedido POR LOTES con `resources`,
    // no truncar la descripción: una descripción truncada miente igual que una desactualizada.
    Buffer.byteLength(JSON.stringify(reply)).should.be.below(524288);
  });

  /* ------------------------------------------------------------------------------------------
   * LA PROYECCIÓN, SOBRE UNA FICHA SINTÉTICA
   * ---------------------------------------------------------------------------------------- */

  it('la proyección es una función pura de la ficha: no conoce ningún recurso', () => {
    const synthetic: any = {
      name: 'inventado',
      table: 'tabla_secreta',
      where: "t.oculto = 'si'",
      joins: [{ table: 'otra', alias: 'x', on: 'x.id = t.x_id' }],
      base: { id: { column: 'id' }, marca: { constant: 'valor-secreto' } },
      baseNames: ['id', 'marca'],
      includable: { calculado: { kind: 'computed', expr: 'SELECT secreto FROM oculta' } },
      includableNames: ['calculado'],
      fieldNames: ['id', 'marca', 'calculado'],
      filterable: { id: { column: 'id_oculto', kind: 'integer' } },
      filterableNames: ['id'],
      sortable: { id: { column: 'id_oculto' } },
      sortableNames: ['id'],
      defaults: { sort: ['id'] },
      enums: { estado: ['uno'] },
      truncatable: [],
      externalScope: { kind: 'column', projectColumn: 'columna_oculta' },
    };

    const described = describeResource(synthetic);

    JSON.stringify(described).should.not.containEql('tabla_secreta');
    JSON.stringify(described).should.not.containEql('oculto');
    JSON.stringify(described).should.not.containEql('valor-secreto');
    JSON.stringify(described).should.not.containEql('SELECT');
    described.base!.marca.should.deepEqual({ kind: 'constant' });
    described.enums!.estado.should.deepEqual([{ value: 'uno', label: 'uno' }]);
  });
});
