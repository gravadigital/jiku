import 'mocha';
import 'should';
import { peopleSpec } from '../../src/queries/people/people-spec';
import { projectPermissionsSpec } from '../../src/queries/project-permissions/project-permissions-spec';
import { unworkedTimesSpec } from '../../src/queries/unworked-times/unworked-times-spec';
import { usersSpec } from '../../src/queries/users/users-spec';
import { weekAssignedTimesSpec } from '../../src/queries/week-assigned-times/week-assigned-times-spec';
import { workedTimesSpec } from '../../src/queries/worked-times/worked-times-spec';
import { dispatchQuery } from '../helpers/dispatch';
import { createQueryCallers, createWorld, destroyQueryCallers, destroyWorld } from './task-fixtures';
import { createTeamWorld, destroyTeamWorld } from './team-fixtures';

/**
 * LAS PROPIEDADES TRANSVERSALES DE LOS SEIS RECURSOS DE S-026 (Task 9).
 *
 * LOS TRES BUCLES SON UN BUCLE Y NO SEIS COPIAS, y eso es lo que hace que el recurso 19 herede la
 * verificación: una copia por recurso se olvida en el séptimo.
 */

/** Los seis recursos, con un filtro IMPOSIBLE por recurso. */
const S026: [string, unknown][] = [
  ['people.list', { filter: { id: 999999 } }],
  ['users.list', { filter: { id: 'no-existe' } }],
  ['worked-times.list', { filter: { personId: 999999 } }],
  ['unworked-times.list', { filter: { personId: 999999 } }],
  ['week-assigned-times.list', { filter: { personId: 999999 } }],
  ['project-permissions.list', { filter: { userId: 'no-existe' } }],
];

const S026_SPECS = [
  ['people', peopleSpec],
  ['users', usersSpec],
  ['worked-times', workedTimesSpec],
  ['unworked-times', unworkedTimesSpec],
  ['week-assigned-times', weekAssignedTimesSpec],
  ['project-permissions', projectPermissionsSpec],
] as const;

describe('queries/S-026 — las transversales de los seis recursos', () => {
  before(async () => {
    await createWorld();
    await createQueryCallers();
    await createTeamWorld();
  });

  after(async () => {
    await destroyTeamWorld();
    await destroyQueryCallers();
    await destroyWorld();
  });

  it('TS-71 · CA-15 · los seis `.get` responden `unknown_command`', async () => {
    for (const [method] of S026) {
      const get = method.replace('.list', '.get');
      const reply: any = await dispatchQuery(get, { id: 1 });

      // EL PATRÓN NO ESTÁ REGISTRADO, y con eso alcanza: el registry es un `Map` exacto y el
      // despachador responde `unknown_command` sin código propio. `get` existe SOLO donde hay
      // pantalla de detalle (RF-2).
      reply.status.should.equal('failure', `${get}: ${JSON.stringify(reply)}`);
      reply.errorCode.should.equal('unknown_command', get);
      reply.errorMessage.should.startWith('Unknown query: ');
    }
  });

  it('TS-72 · CA-16 · un filtro que no matchea es `success` con `items: []`, nunca `*_not_found`', async () => {
    for (const [method, payload] of S026) {
      const reply: any = await dispatchQuery(method, payload);

      reply.status.should.equal('success', `${method}: ${JSON.stringify(reply)}`);
      reply.data.items.should.deepEqual([], method);
    }
  });

  it('TS-73 · CA-17 · un nombre no declarado en las CUATRO palancas', async () => {
    const levers: [string, unknown][] = [
      ['filter', { filter: { noExiste: 1 } }],
      ['sort', { sort: ['noExiste'] }],
      ['fields', { fields: ['noExiste'] }],
      ['include', { include: ['noExiste'] }],
    ];

    for (const [method] of S026) {
      for (const [lever, payload] of levers) {
        const reply: any = await dispatchQuery(method, payload);
        const label = `${method} · ${lever}`;

        reply.status.should.equal('failure', `${label}: ${JSON.stringify(reply)}`);
        reply.errorCode.should.equal('invalid_fields', label);
        reply.errorDetails.field.should.equal(lever, label);
        reply.errorDetails.value.should.equal('noExiste', label);
        reply.errorDetails.allowed.length.should.be.above(0, label);
      }
    }
  });

  it('TS-74 · NINGUNA de las seis fichas declara `notFoundCode` ni `notFoundMessage`', () => {
    for (const [name, spec] of S026_SPECS) {
      // Es lo que hace ESTRUCTURALMENTE IMPOSIBLE que un `list` devuelva `*_not_found`: ese código
      // solo sale de `runGet`, y ninguno de los seis tiene `get`. Los dos campos son opcionales
      // desde S-025 exactamente por esto.
      (spec.notFoundCode === undefined).should.be.true(name);
      (spec.notFoundMessage === undefined).should.be.true(name);
    }
  });

  it('las seis fichas derivan sus cuatro arrays de nombres de sus mapas, nunca a mano', () => {
    for (const [name, spec] of S026_SPECS) {
      [...spec.baseNames].should.deepEqual(Object.keys(spec.base), name);
      [...spec.includableNames].should.deepEqual(Object.keys(spec.includable), name);
      [...spec.fieldNames].should.deepEqual(
        [...Object.keys(spec.base), ...Object.keys(spec.includable)],
        name
      );
      [...spec.filterableNames].should.deepEqual(Object.keys(spec.filterable), name);
      [...spec.sortableNames].should.deepEqual(Object.keys(spec.sortable), name);
    }
  });

  it('CA-7 · `roles` e `identityType` no aparecen en NINGUNA lista de `users`', () => {
    // La única protección es NO DECLARARLOS (ADR-008): no hay código que los excluya, así que la
    // única forma de romper CA-7 es escribirlos.
    for (const forbidden of ['roles', 'identityType']) {
      [
        ...usersSpec.fieldNames,
        ...usersSpec.filterableNames,
        ...usersSpec.sortableNames,
        ...usersSpec.includableNames,
      ].should.not.containEql(forbidden);
    }
  });
});
