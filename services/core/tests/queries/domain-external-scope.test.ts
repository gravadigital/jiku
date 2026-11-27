import 'mocha';
import 'should';
import { Reply } from '@jiku/nats-protocol';
import { dispatchQuery } from '../helpers/dispatch';
import {
  PROJECT_MAIN,
  PROJECT_OTHER,
  Q_ADMIN,
  Q_EXTERNAL,
  Q_INTERNAL,
  Q_MIXED,
  createQueryCallers,
  createWorld,
  destroyQueryCallers,
  destroyWorld,
  grantProjects,
} from './task-fixtures';
import {
  CLIENT_FOREIGN,
  CLIENT_MAIN,
  CLIENT_ORPHAN,
  CLIENT_OTHER,
  MISSING_ID,
  REQ_FOREIGN,
  REQ_INTERNAL,
  REQ_VISIBLE,
  createDomainWorld,
  destroyDomainWorld,
} from './domain-fixtures';

/**
 * EL RECORTE DEL MODO EXTERNO DE LOS TRES RECURSOS, END-TO-END (S-024, CA-14 y CA-15).
 *
 * ESTE ARCHIVO NO LO SUSTITUYE `build-sql.test.ts`, y la razón es la misma que hizo nacer a
 * `tasks-external-scope.test.ts`: una implementación que agregara el recorte al objeto `filter` en
 * vez de al SQL devolvería LAS MISMAS FILAS en el caso feliz. Lo que atrapa el recorte puesto en el
 * lugar equivocado es el comportamiento, con un caller externo de verdad.
 *
 * LAS TRES FORMAS DEL RECORTE, con UN MISMO caller:
 *
 *   requirements -> proyecto permitido Y `visibilityLevel = public`   (`kind: 'column'` con visibilidad)
 *   projects     -> su PROPIA `id` entre los permitidos                (`kind: 'column'` sin visibilidad)
 *   clients      -> AL MENOS UN proyecto permitido                     (`kind: 'exists'`, indirecto)
 */

interface Collection {
  items: Record<string, unknown>[];
  page: { limit: number; returned: number; cursor?: string; total?: number };
}

function items(reply: Reply<Collection>): Record<string, unknown>[] {
  reply.status.should.equal('success', JSON.stringify(reply));
  return reply.data!.items;
}

function ids(reply: Reply<Collection>): number[] {
  return items(reply).map((item) => item.id as number);
}

describe('queries/núcleo del dominio — el recorte del modo externo, end-to-end (S-024)', () => {
  before(async () => {
    await createWorld([PROJECT_MAIN, PROJECT_OTHER]);
    await createQueryCallers();
    // PERMISO SOBRE EL 12 Y NINGUNO SOBRE EL 13: es lo que hace observables las tres formas.
    await grantProjects(Q_EXTERNAL, [PROJECT_MAIN]);
    await grantProjects(Q_MIXED, [PROJECT_MAIN]);
    await createDomainWorld();
  });

  after(async () => {
    await destroyDomainWorld();
    await destroyQueryCallers();
    await destroyWorld();
  });

  /* ------------------------------------------------------------------------------------------
   * Las tres formas del recorte
   * ---------------------------------------------------------------------------------------- */

  it('TS-47 · `requirements.list` externo: proyecto permitido Y `public`', async () => {
    const reply = await dispatchQuery<Collection>('requirements.list', {}, Q_EXTERNAL);

    // SE AFIRMA POR PERTENENCIA Y POR INVARIANTE, y no con la lista literal, porque el mundo de
    // fixtures es compartido y tiene MÁS requisitos públicos del proyecto 12 que los tres de este
    // escenario. La propiedad que importa es la misma: entra el visible, no entran ni el interno ni
    // el ajeno, y NINGÚN item devuelto viola las dos mitades del recorte.
    ids(reply).should.containEql(REQ_VISIBLE);
    ids(reply).should.not.containEql(REQ_INTERNAL);
    ids(reply).should.not.containEql(REQ_FOREIGN);
    for (const item of items(reply)) {
      item.projectId!.should.equal(PROJECT_MAIN);
      item.visibilityLevel!.should.equal('public');
    }
  });

  it('TS-48 · `projects.list` externo: solo los proyectos con fila de permiso', async () => {
    const reply = await dispatchQuery<Collection>('projects.list', {}, Q_EXTERNAL);

    ids(reply).should.deepEqual([PROJECT_MAIN]);
  });

  it('TS-49 · `clients.list` externo: solo los actores con AL MENOS UN proyecto permitido', async () => {
    const reply = await dispatchQuery<Collection>('clients.list', {}, Q_EXTERNAL);

    // ESTE ES EL RECORTE QUE SE OLVIDA: un actor no tiene `project_id`, su visibilidad es
    // INDIRECTA. El huérfano (sin ningún proyecto) y el dueño del proyecto ajeno no aparecen.
    ids(reply).should.deepEqual([CLIENT_MAIN]);
    ids(reply).should.not.containEql(CLIENT_ORPHAN);
    ids(reply).should.not.containEql(CLIENT_OTHER);
    ids(reply).should.not.containEql(CLIENT_FOREIGN);
  });

  /* ------------------------------------------------------------------------------------------
   * El recorte no se desactiva, y gobierna también el COUNT
   * ---------------------------------------------------------------------------------------- */

  it('TS-50 · el recorte va ANTES del filtro y NO se desactiva por payload', async () => {
    const reply = await dispatchQuery<Collection>(
      'requirements.list',
      { filter: { visibilityLevel: 'internal' } },
      Q_EXTERNAL
    );

    // Se combina con AND contra `= 'public'` y da CERO FILAS. No un error de autorización, y NO el
    // requisito interno.
    reply.status.should.equal('success');
    items(reply).should.deepEqual([]);
  });

  it('TS-51 · el `count` respeta el recorte: un total sin recortar sería una FUGA', async () => {
    const external = await dispatchQuery<Collection>(
      'requirements.list',
      { count: 'only' },
      Q_EXTERNAL
    );
    const internal = await dispatchQuery<Collection>(
      'requirements.list',
      { count: 'only' },
      Q_INTERNAL
    );
    const visible = await dispatchQuery<Collection>(
      'requirements.list',
      { page: { limit: 200 } },
      Q_EXTERNAL
    );

    // El total del caller externo cuenta EXACTAMENTE lo que su colección devuelve…
    external.data!.page.total!.should.equal(items(visible).length);
    // …y es estrictamente menor que el real: si contara el real, filtraría lo que el recorte
    // esconde.
    external.data!.page.total!.should.be.below(internal.data!.page.total!);

    // Y EL NÚMERO EXACTO, acotando el universo a los tres requisitos del escenario: de esos tres,
    // el caller externo ve UNO. Sin el recorte en el COUNT, este total sería 3.
    const trio = { filter: { id: [REQ_VISIBLE, REQ_INTERNAL, REQ_FOREIGN] }, count: 'only' };
    const scoped = await dispatchQuery<Collection>('requirements.list', trio, Q_EXTERNAL);
    const unscoped = await dispatchQuery<Collection>('requirements.list', trio, Q_INTERNAL);

    scoped.data!.page.total!.should.equal(1);
    unscoped.data!.page.total!.should.equal(3);
  });

  /* ------------------------------------------------------------------------------------------
   * Los tres `*_not_found`: "no existe" y "no lo podés ver" son INDISTINGUIBLES
   * ---------------------------------------------------------------------------------------- */

  it('TS-52/TS-53 · el requisito no visible y el inexistente responden EXACTAMENTE lo mismo', async () => {
    const noVisible = await dispatchQuery('requirements.get', { id: REQ_INTERNAL }, Q_EXTERNAL);
    const ajeno = await dispatchQuery('requirements.get', { id: REQ_FOREIGN }, Q_EXTERNAL);
    const inexistente = await dispatchQuery('requirements.get', { id: MISSING_ID }, Q_EXTERNAL);

    // IDÉNTICAS, no solo "las tres fallan": distinguirlas le confirmaría a un caller externo que el
    // recurso existe, y el oráculo de existencia es la fuga que RF-31 existe para no tener.
    noVisible.should.deepEqual(inexistente);
    ajeno.should.deepEqual(inexistente);
    inexistente.errorCode!.should.equal('requirement_not_found');
    // NO un error de autorización.
    inexistente.errorCode!.should.not.equal('caller_not_authorized');
  });

  it('TS-54 · `projects.get` no visible e inexistente son indistinguibles', async () => {
    const ajeno = await dispatchQuery('projects.get', { id: PROJECT_OTHER }, Q_EXTERNAL);
    const inexistente = await dispatchQuery('projects.get', { id: MISSING_ID }, Q_EXTERNAL);

    ajeno.should.deepEqual(inexistente);
    inexistente.errorCode!.should.equal('project_not_found');
  });

  it('TS-55 · `clients.get` no visible e inexistente son indistinguibles', async () => {
    const huerfano = await dispatchQuery('clients.get', { id: CLIENT_ORPHAN }, Q_EXTERNAL);
    const inexistente = await dispatchQuery('clients.get', { id: MISSING_ID }, Q_EXTERNAL);

    huerfano.should.deepEqual(inexistente);
    inexistente.errorCode!.should.equal('client_not_found');
  });

  it('el `get` del recurso VISIBLE sí responde, con el mismo caller', async () => {
    // El contraste que hace que los tres tests de arriba no pasen por accidente: el recorte no
    // está negando todo.
    const requirement = await dispatchQuery<Record<string, unknown>>(
      'requirements.get',
      { id: REQ_VISIBLE },
      Q_EXTERNAL
    );
    const project = await dispatchQuery<Record<string, unknown>>(
      'projects.get',
      { id: PROJECT_MAIN },
      Q_EXTERNAL
    );
    const client = await dispatchQuery<Record<string, unknown>>(
      'clients.get',
      { id: CLIENT_MAIN },
      Q_EXTERNAL
    );

    requirement.data!.id!.should.equal(REQ_VISIBLE);
    project.data!.id!.should.equal(PROJECT_MAIN);
    client.data!.id!.should.equal(CLIENT_MAIN);
  });

  /* ------------------------------------------------------------------------------------------
   * Las otras clases de caller
   * ---------------------------------------------------------------------------------------- */

  it('TS-56 · las clases interna y admin NO recortan nada', async () => {
    for (const caller of [Q_INTERNAL, Q_ADMIN]) {
      const reply = await dispatchQuery<Collection>(
        'requirements.list',
        { page: { limit: 200 } },
        caller
      );

      // El modo interno no recorta a nivel de fila: es una decisión explícita de la v1 (RF-23).
      ids(reply).should.containEql(REQ_VISIBLE);
      ids(reply).should.containEql(REQ_INTERNAL);
      ids(reply).should.containEql(REQ_FOREIGN);
    }
  });

  it('el caller CONECTOR (el publicador confiable) tampoco recorta', async () => {
    // Autoriza por su cuenta, que es lo que hace la api con `validateProjectPermissions`.
    const reply = await dispatchQuery<Collection>('clients.list', {});

    ids(reply).should.containEql(CLIENT_ORPHAN);
  });

  it('TS-57 · el caller de roles MIXTOS recorta como externo: gana el más restrictivo', async () => {
    const clients = await dispatchQuery<Collection>('clients.list', {}, Q_MIXED);
    const projects = await dispatchQuery<Collection>('projects.list', {}, Q_MIXED);

    // `roles: ['user', 'external-user']` -> clase EXTERNA, no interna.
    ids(clients).should.deepEqual([CLIENT_MAIN]);
    ids(projects).should.deepEqual([PROJECT_MAIN]);
  });
});
