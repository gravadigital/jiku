import 'should';

import { ErrorCodeValue } from '../src/index';
import { reload } from './helpers/reload';

/**
 * Los 18 símbolos de runtime de la superficie pública, enumerados uno por uno.
 *
 * La lista es literal y no un conteo: `Object.keys(module).length === 18` pasaría igual si
 * alguien agregara un símbolo y borrara otro.
 *
 * `AuthEvent` NO está acá: es un tipo, se borra al compilar y `module.AuthEvent` es `undefined`.
 * Lo mismo que pasa con `Reply` y `ErrorCodeValue`, que tampoco están.
 */
const PUBLIC_SURFACE = [
  'INSTANCE',
  'PROTOCOL_VERSION',
  'COMMAND_SERVICE',
  'QUERY_SERVICE',
  'commandSubject',
  'querySubject',
  'groupSubject',
  'authEventSubject',
  'endpointName',
  'endpointSubject',
  'methodFromSubject',
  'commandFromSubject',
  'callerFromSubject',
  'inboxPrefix',
  'hashUserId',
  'success',
  'failure',
  'ErrorCode',
];

describe('nats-protocol · el inbox hasheado y el caller', () => {
  const p = reload({});

  it('TS-38: callerFromSubject() intacto con el nombre nuevo', () => {
    p.callerFromSubject('dev.323332022539911171.jiku-commands.v1.clients.new').should.equal(
      '323332022539911171'
    );
  });

  it('TS-39: callerFromSubject() sobre un string sin segundo token', () => {
    p.callerFromSubject('dev').should.equal('');
  });

  // Los tres vectores de hash son LITERALES a propósito, no derivados.
  //
  // Si estos valores cambian, el auth-callout mintea un permiso de inbox distinto del que el
  // cliente usa, y las respuestas se pierden POR TIMEOUT, sin ningún error de permisos: el modo
  // de falla más caro de diagnosticar del sistema. Reimplementar sha256+base32 acá haría pasar
  // el test con cualquier cambio a la implementación, que es lo contrario de lo que se busca.
  //
  // Ante un fallo: NO pegar el valor nuevo. Revisar `hashUserId`, `base32` y `USER_ID_HASH_LEN`.
  it('TS-40: hashUserId() — el user id del ejemplo del contrato', () => {
    p.hashUserId('323332022539911171').should.equal('qxc33kiswhteva5o');
  });

  it('TS-41: hashUserId() — el caller por default de los tests de core', () => {
    p.hashUserId('api').should.equal('ctbffhvujggf2h75');
  });

  it('TS-42: hashUserId() — el service user de tests', () => {
    p.hashUserId('api-service-user-sub').should.equal('mis34glxgppr5oqo');
  });

  it('TS-43: hashUserId() — 16 caracteres base32 en minúscula', () => {
    // base32 RFC 4648 sin padding en minúscula es [a-z2-7].
    /^[a-z2-7]{16}$/.test(p.hashUserId('cualquier-cosa')).should.be.true();
  });

  it('TS-44: inboxPrefix() — valor exacto', () => {
    p.inboxPrefix('323332022539911171').should.equal('_INBOX.qxc33kiswhteva5o');
  });

  it('TS-45: inboxPrefix() no depende del nombre del servicio', () => {
    reload({ NATS_COMMAND_SERVICE: 'otro' })
      .inboxPrefix('323332022539911171')
      .should.equal('_INBOX.qxc33kiswhteva5o');
  });
});

describe('nats-protocol · la superficie pública y el envelope', () => {
  it('TS-48: los 18 símbolos de runtime están exportados', () => {
    const p = reload({});
    const exported = Object.keys(p);
    PUBLIC_SURFACE.forEach((name) => {
      exported.should.containEql(name);
      // Incluido el @deprecated que queda: commandFromSubject.
      ((p as unknown as Record<string, unknown>)[name] === undefined).should.be.false();
    });
    PUBLIC_SURFACE.length.should.equal(18);
  });

  it('TS-49: ErrorCode tiene 27 miembros', () => {
    Object.keys(reload({}).ErrorCode).length.should.equal(27);
  });

  it('TS-50: el envelope intacto', () => {
    const p = reload({});
    p.success().should.eql({ status: 'success' });
    p.success({ id: 7 }).should.eql({ status: 'success', data: { id: 7 } });
    p.failure('client_not_found', 'Client not found').should.eql({
      status: 'failure',
      errorCode: 'client_not_found',
      errorMessage: 'Client not found',
    });
  });

  it('TS-69: CALLER_NOT_AUTHORIZED tiene el valor exacto del contrato', () => {
    // El valor cruza el bus y lo indexa el mapa de la api: un typo acá sale 500 en producción y
    // ningún test de `core` lo atrapa, porque `core` usaría la misma constante equivocada.
    reload({}).ErrorCode.CALLER_NOT_AUTHORIZED.should.equal('caller_not_authorized');
  });

  it('TS-70: la clave es la traducción mecánica del valor', () => {
    // Romper la simetría de los 26 que ya están haría que el próximo código se agregue mal.
    const entries = Object.entries(reload({}).ErrorCode);
    const found = entries.find(([, value]) => value === 'caller_not_authorized');
    (found as [string, string])[0].should.equal('CALLER_NOT_AUTHORIZED');
  });

  it('TS-71: user_not_found sigue existiendo y es un código DISTINTO', () => {
    // Reusarlo era la tentación —ya existe y ya está mapeado— y está descartado por dos razones:
    // sería un oráculo de existencia de identidades, y su 404 es el status equivocado para un
    // rechazo de permisos.
    const E = reload({}).ErrorCode;
    E.USER_NOT_FOUND.should.equal('user_not_found');
    E.CALLER_NOT_AUTHORIZED.should.equal('caller_not_authorized');
    ((E.USER_NOT_FOUND as string) === (E.CALLER_NOT_AUTHORIZED as string)).should.be.false();
  });

  it('TS-72: los 27 valores del catálogo son únicos entre sí', () => {
    // Atrapa el copy-paste que deja dos claves con el mismo valor: un fallo que ninguna otra
    // aserción ve, porque el catálogo se lee siempre por clave.
    const values = Object.values(reload({}).ErrorCode);
    values.length.should.equal(27);
    new Set(values).size.should.equal(27);
  });

  it('TS-73: el envelope de falla con el código nuevo', () => {
    const p = reload({});
    p.failure(p.ErrorCode.CALLER_NOT_AUTHORIZED, 'No autorizado').should.eql({
      status: 'failure',
      errorCode: 'caller_not_authorized',
      errorMessage: 'No autorizado',
    });
  });

  it('TS-74: ErrorCodeValue incluye el valor nuevo sin editar el tipo', () => {
    // La aserción fuerte es de compilación: antes del cambio esta línea es un TS2322. Y prueba que
    // el `as const` sigue en su lugar — sin él el tipo sería `string` y compilaría igual, que es
    // el falso verde a evitar.
    const code: ErrorCodeValue = 'caller_not_authorized';
    code.should.equal('caller_not_authorized');
  });

  // Las dos aserciones negativas usan el cast a Record<string, unknown> y NO acceso tipado: con
  // acceso tipado el archivo dejaría de compilar en el momento del borrado, y la idea es que la
  // aserción exista ANTES —en rojo— y sobreviva al borrado sin tocarse.
  //
  // Cada test afirma DOS cosas, y las dos hacen falta: `=== undefined` atrapa el símbolo borrado,
  // y `Object.keys()` atrapa el caso en que alguien lo redeclare como `export const X = undefined`
  // —presente en la superficie, con valor vacío—, que pasaría la primera y es peor que el original.
  it('TS-57: SERVICE_NAME ya no está exportado', () => {
    // El símbolo era un alias de COMMAND_SERVICE que existía solo para que el consumer viejo de
    // core se renombrara sin tocarse. Muerto el consumer, un alias sin callers es superficie que
    // invita a reusarse: esta aserción es lo que impide que vuelva.
    const p = reload({});
    const surface = p as unknown as Record<string, unknown>;
    (surface.SERVICE_NAME === undefined).should.be.true();
    Object.keys(p).should.not.containEql('SERVICE_NAME');
  });

  it('TS-58: subscriptionSubject ya no está exportado', () => {
    // El prefijo de grupo que el framework micro necesita lo da groupSubject(), SIN el `.>` final:
    // micro arma el subject de cada endpoint por su cuenta. La forma vieja —una suscripción
    // wildcard con `.>`— ya no tiene quién la use.
    const p = reload({});
    const surface = p as unknown as Record<string, unknown>;
    (surface.subscriptionSubject === undefined).should.be.true();
    Object.keys(p).should.not.containEql('subscriptionSubject');
  });
});
