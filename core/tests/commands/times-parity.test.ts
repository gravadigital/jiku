import 'mocha';
import 'should';
import { Person, Project, UnworkedTime, User, WorkedTime } from '@jiku/models';
import { ErrorCode, Reply } from '@jiku/nats-protocol';
import { dispatch } from '../helpers/dispatch';
import { HOY, HOY_M11 } from '../helpers/dates';

/**
 * LA MATRIZ DE PARIDAD (CA-14, RF-6): la misma operación por los DOS canales de identidad tiene
 * que producir EL MISMO reply.
 *
 * NO SE SOLAPA con los tests de cada regla (`times-rules.test.ts`): aquéllos verifican QUÉ decide
 * cada regla; éste verifica que las dos rutas de identidad —el SOBRE de la api y el SUBJECT de una
 * persona publicando al bus— LLEGAN A LA MISMA DECISIÓN. Es lo que hace innecesario leer los dos
 * codebases para creerle a RF-6.
 *
 * ÉSTA ES LA MITAD DE `core`. La otra mitad —la misma regla por HTTP, con el `FakeBus` que ejecuta
 * `core` real— vive en la suite de la api y es del plan de S-031 (api).
 *
 * LA DIFERENCIA QUE LA MATRIZ TIENE QUE ANULAR: con sobre mandan `actor.roles` y NO se lee la
 * base; sin sobre, los roles salen de `users.roles`. Por eso el criterio de comparabilidad es que
 * el `sub` sea el MISMO y los roles sean LOS MISMOS en los dos lados — si no, no se está
 * comparando la misma persona.
 */

/** Una persona con rol `user`, con fila real en `users` y Persona vinculada. */
const ANA = 'sub-s031-par-ana';
/** Una persona con rol `admin`, con fila real en `users` y Persona vinculada. */
const BETO = 'sub-s031-par-beto';
/** El dueño de los fixtures con FK a `users`. */
const OWNER = 'sub-s031-par-owner';

/** El reply reducido a lo que CA-14 compara: la DECISIÓN, no la redacción. */
type Decision = [string, string | null];

function decision(reply: Reply<unknown>): Decision {
  return [reply.status, reply.errorCode ?? null];
}

describe('S-031 · la matriz de paridad de canales (CA-14)', () => {
  let projectId: number;
  let P_ANA: number;
  let P_BETO: number;

  before(async () => {
    await User.bulkCreate([
      { id: OWNER, name: 'Owner', username: 's031p-owner', email: 's031p-owner@t.local' },
      { id: ANA, name: 'Ana', username: 's031p-ana', email: 's031p-ana@t.local', roles: ['user'] },
      {
        id: BETO, name: 'Beto', username: 's031p-beto',
        email: 's031p-beto@t.local', roles: ['admin'],
      },
    ]);

    const project = await Project.create({
      name: 'Proyecto S031 paridad', code: 'S031P', status: 'activo', type: 'comercial',
      description: 'x', initDate: new Date(), createdBy: OWNER,
    });
    projectId = project.id;

    const pAna = await Person.create({
      firstName: 'Ana', lastName: 'Paridad', enabled: true,
      initDate: new Date('2026-01-01'), userId: ANA,
    });
    P_ANA = pAna.id;

    const pBeto = await Person.create({
      firstName: 'Beto', lastName: 'Paridad', enabled: true,
      initDate: new Date('2026-01-01'), userId: BETO,
    });
    P_BETO = pBeto.id;
  });

  after(async () => {
    await WorkedTime.destroy({ where: {} });
    await UnworkedTime.destroy({ where: {} });
    await Person.destroy({ where: {} });
    await Project.destroy({ where: {} });
    await User.destroy({ where: { id: [OWNER, ANA, BETO] } });
  });

  afterEach(async () => {
    await WorkedTime.destroy({ where: {} });
    await UnworkedTime.destroy({ where: {} });
  });

  /**
   * Ejerce el mismo caso por los dos canales y devuelve el PAR.
   *
   * `comando` es una FUNCIÓN y no un string porque los borrados necesitan SU PROPIA FILA por
   * canal: el primer despacho borra la del segundo, y el par dejaría de comparar lo mismo.
   */
  async function porLosDosCanales(
    comando: () => string | Promise<string>,
    payload: Record<string, unknown>,
    sub: string,
    roles: string[]
  ): Promise<{ conSobre: Reply<unknown>; directo: Reply<unknown> }> {
    const conSobre = await dispatch(await comando(), { ...payload, actor: { id: sub, roles } });
    const directo = await dispatch(await comando(), { ...payload }, sub);
    return { conSobre, directo };
  }

  /** Crea una hora de la Persona indicada y devuelve el comando de borrado que le corresponde. */
  async function borradoDeHora(personId: number, date: string = HOY): Promise<string> {
    const worked = await WorkedTime.create({ date, minutes: 60, projectId, personId });
    return `worked-times.${worked.id}.delete`;
  }

  /** Ídem para una ausencia. */
  async function borradoDeAusencia(personId: number): Promise<string> {
    const unworked = await UnworkedTime.create({
      date: HOY, minutes: 60, reason: 'otro', personId,
    });
    return `unworked-times.${unworked.id}.delete`;
  }

  it('TS-42.1 · la VENTANA EN EL ALTA produce el mismo reply por los dos canales', async () => {
    const { conSobre, directo } = await porLosDosCanales(
      () => 'worked-times.new', { date: HOY_M11, minutes: 60, projectId }, ANA, ['user']
    );

    // SE AFIRMA EL PAR, no dos valores sueltos: si mañana una rama cambia de código, lo que el
    // test señala es LA DIVERGENCIA, no solo el valor nuevo.
    decision(conSobre).should.deepEqual(decision(directo));
    conSobre.errorCode!.should.equal(ErrorCode.INVALID_DATE_RANGE);
  });

  it('TS-42.2 · la VENTANA EN EL BORRADO produce el mismo reply por los dos canales', async () => {
    const { conSobre, directo } = await porLosDosCanales(
      () => borradoDeHora(P_ANA, HOY_M11), {}, ANA, ['user']
    );

    decision(conSobre).should.deepEqual(decision(directo));
    conSobre.errorCode!.should.equal(ErrorCode.INVALID_DATE_RANGE);
  });

  it('TS-42.3 · C-41 (imputar a terceros) produce el mismo reply por los dos canales', async () => {
    const { conSobre, directo } = await porLosDosCanales(
      () => 'worked-times.new',
      { date: HOY, minutes: 60, projectId, personId: P_BETO },
      ANA,
      ['user']
    );

    decision(conSobre).should.deepEqual(decision(directo));
    conSobre.errorCode!.should.equal(ErrorCode.ACCESS_DENIED);
  });

  it('TS-42.4 · la TITULARIDAD AL BORRAR UNA HORA produce el mismo reply', async () => {
    const { conSobre, directo } = await porLosDosCanales(
      () => borradoDeHora(P_BETO), {}, ANA, ['user']
    );

    decision(conSobre).should.deepEqual(decision(directo));
    conSobre.errorCode!.should.equal(ErrorCode.ACCESS_DENIED);
  });

  it('TS-42.5 · la TITULARIDAD EN AUSENCIAS produce el mismo reply', async () => {
    const alta = await porLosDosCanales(
      () => 'unworked-times.new',
      { date: HOY, minutes: 60, reason: 'otro', personId: P_BETO },
      ANA,
      ['user']
    );

    decision(alta.conSobre).should.deepEqual(decision(alta.directo));
    alta.conSobre.errorCode!.should.equal(ErrorCode.ACCESS_DENIED);

    const borrado = await porLosDosCanales(
      () => borradoDeAusencia(P_BETO), {}, ANA, ['user']
    );

    decision(borrado.conSobre).should.deepEqual(decision(borrado.directo));
    borrado.conSobre.errorCode!.should.equal(ErrorCode.ACCESS_DENIED);
  });

  it('TS-42.6 · CA-4: un `admin` imputa a un tercero y ACEPTA por los dos canales', async () => {
    const { conSobre, directo } = await porLosDosCanales(
      () => 'worked-times.new',
      { date: HOY, minutes: 60, projectId, personId: P_ANA },
      BETO,
      ['admin']
    );

    decision(conSobre).should.deepEqual(decision(directo));
    conSobre.status.should.equal('success');
    // LAS DOS ESCRIBIERON, y sobre la MISMA Persona: la paridad no es solo del código de error.
    (await WorkedTime.count({ where: { personId: P_ANA } })).should.equal(2);
  });
});
