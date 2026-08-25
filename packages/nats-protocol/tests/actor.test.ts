import 'should';

import { Actor, AuthEvent } from '../src/index';
import { reload } from './helpers/reload';

/**
 * El sobre de identidad, en un archivo propio.
 *
 * NO va dentro de `events.test.ts`, y es el descarte más importante: ese archivo es "el subject
 * del evento y el tipo de su payload", y existe justamente porque el evento es lo que NO sigue la
 * gramática. `Actor` viaja POR la gramática, en el cuerpo de un comando request/reply. Y hay una
 * razón más fuerte: la mitad del valor de estos tests es la DIFERENCIA entre `Actor` y
 * `AuthEvent`, y meterlos en el mismo `describe` sugeriría que son variantes de lo mismo — que es
 * exactamente la confusión que TS-95 previene.
 *
 * Tampoco va en `inbox.test.ts`: su segundo `describe` es "la superficie pública y el envelope", y
 * ese envelope es el de RESPUESTA (`Reply`, `success`, `failure`, `ErrorCode`). El sobre de
 * identidad es del mensaje de ENTRADA.
 *
 * CASI TODO LO QUE ESTOS TESTS VERIFICAN LO VERIFICA `tsc`, no `should`. `Actor` es una
 * `interface`: se borra al compilar, así que lo que de verdad falla ante un tipo mal declarado es
 * la compilación bajo `ts-node` —una clave que falte es un TS2739, una de más es un
 * excess-property error, y un `@ts-expect-error` que deje de ser necesario es un error él mismo—.
 * Las aserciones existen para que mocha tenga qué reportar Y para que el test no pase por no
 * haber ejecutado nada. UN CAMBIO QUE LOS HAGA "PASAR MÁS RÁPIDO" BORRANDO LOS LITERALES TIPADOS
 * LOS VACÍA DE CONTENIDO.
 */
describe('nats-protocol · el sobre de identidad', () => {
  it('TS-90: Actor declara exactamente los cinco campos del contrato', () => {
    // `Record<keyof Actor, true>` es la aserción FUERTE, y es de COMPILACIÓN: una clave que falte
    // es un error de tsc, y una de más es un excess-property error. El `length` es solo la parte
    // que mocha puede reportar.
    const KEYS: Record<keyof Actor, true> = {
      id: true,
      roles: true,
      name: true,
      username: true,
      email: true,
    };
    Object.keys(KEYS).length.should.equal(5);
  });

  it('TS-91: los tres campos de perfil son opcionales', () => {
    // `{ id, roles }` solo ya es un Actor válido: es CA-11 expresado en el tipo. Si alguien le
    // saca el `?` a cualquiera de los tres, esta línea deja de compilar.
    const minimo: Actor = { id: '323332022539911171', roles: ['user'] };

    minimo.id.should.equal('323332022539911171');
    minimo.roles.should.eql(['user']);
    (minimo.name === undefined).should.be.true();
    (minimo.username === undefined).should.be.true();
    (minimo.email === undefined).should.be.true();
  });

  it('TS-92: el sobre completo de la api, los cinco campos, es válido', () => {
    const completo: Actor = {
      id: '323332022539911171',
      roles: ['user'],
      name: 'Ana Pérez',
      username: 'ana@grava.digital',
      email: 'ana@grava.digital',
    };

    completo.id.should.equal('323332022539911171');
    completo.roles.should.eql(['user']);
    completo.name!.should.equal('Ana Pérez');
    completo.username!.should.equal('ana@grava.digital');
    completo.email!.should.equal('ana@grava.digital');
  });

  it('TS-93: roles es una lista ABIERTA: un rol que no está en ningún mapa tipa igual', () => {
    // Un rol desconocido es un valor LEGÍTIMO DEL CABLE que no autoriza nada (ADR-008), no un tipo
    // imposible. Cerrar `roles` en una unión movería una decisión de autorización al compilador de
    // este paquete, que es exactamente el lugar donde nadie la va a buscar: el catálogo de roles
    // vive en el mapa de core y en el `rules.yaml` del auth-callout.
    const desconocido: Actor = { id: '99', roles: ['rol-que-no-existe', 'admin'] };

    desconocido.roles.should.eql(['rol-que-no-existe', 'admin']);
  });

  it('TS-94: roles vacío es un Actor válido: el tipo no decide la política', () => {
    // CA-2 exige que `roles` ESTÉ Y SEA UN ARRAY, no que tenga elementos. Una fila con `roles: []`
    // es precisamente el caso que CA-9 corrige: el espejo la deja al día con el claim del sobre.
    const sinRoles: Actor = { id: '99', roles: [] };

    sinRoles.roles.length.should.equal(0);
  });

  it('TS-95: Actor.email es string | undefined y NO string | null', () => {
    // LA ASIMETRÍA CON AuthEvent.email ES DELIBERADA Y NO HAY QUE HOMOGENEIZARLAS. En el evento,
    // `null` es un valor NORMALIZADO por el esquema Joi de core y significa "identidad de
    // servicio"; acá la ausencia es AUSENCIA, porque la api arma el sobre del claim y no hay
    // esquema que la normalice. Es la única diferencia parametrizada del handler compartido
    // (CA-12), y este test es lo único que la protege.
    const a: Actor = { id: '1', roles: [], email: undefined };
    const e: AuthEvent = {
      type: 'authenticated',
      version: 1,
      instance: 'dev',
      id: '1',
      name: 'n',
      username: 'u',
      email: null,
      roles: [],
      identity_type: 'service',
    };

    (a.email === undefined).should.be.true();
    (e.email === null).should.be.true();

    // La aserción negativa NO es un cast. Con `as unknown as Actor` pasaría siempre y no
    // atraparía nada. `@ts-expect-error` es lo contrario: si algún día `Actor.email` aceptara
    // `null`, la directiva DEJA DE SER NECESARIA y tsc la reporta como error — el test cae solo,
    // sin que nadie tenga que acordarse de venir a mirar.
    // @ts-expect-error `Actor.email` es `string | undefined`; `null` es la forma de AuthEvent.
    const invalido: Actor = { id: '1', roles: [], email: null };
    void invalido;
  });

  it('TS-96: el mensaje real se separa en sobre + payload de dominio sin mezclar claves', () => {
    // Es el literal del paso 3 del Escenario 1 de la story: un sobre completo conviviendo con un
    // payload de dominio de seis campos en el mismo objeto. Es la forma exacta que el despachador
    // de core va a extraer ANTES de `registry.resolve()`, verificada del lado del contrato.
    const mensaje: { actor?: Actor } & Record<string, unknown> = {
      actor: {
        id: '323332022539911171',
        roles: ['user'],
        name: 'Ana Pérez',
        username: 'ana@grava.digital',
        email: 'ana@grava.digital',
      },
      date: '2026-08-25',
      minutes: 120,
      projectId: 12,
      taskId: 45,
      requirementId: null,
      personId: 7,
    };
    Object.keys(mensaje).length.should.equal(7);

    const { actor, ...payload } = mensaje;

    actor!.id.should.equal('323332022539911171');
    Object.keys(payload).length.should.equal(6);
    ('actor' in payload).should.be.false();
  });

  it('TS-97: Actor no es un símbolo de runtime', () => {
    // Un tipo se borra al compilar. Si apareciera, alguien lo exportó como constante y
    // PUBLIC_SURFACE (TS-48) quedó desactualizada. NO AGREGAR 'Actor' A PUBLIC_SURFACE: esa lista
    // es de símbolos de runtime, y este test es la aserción de que sigue sin serlo.
    const surface = reload({}) as unknown as Record<string, unknown>;

    Object.keys(surface).should.not.containEql('Actor');
    (surface.Actor === undefined).should.be.true();
  });
});
