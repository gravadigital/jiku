import 'should';

import { reload } from './helpers/reload';

/**
 * Los 19 símbolos de runtime de la superficie pública, enumerados uno por uno.
 *
 * La lista es literal y no un conteo: `Object.keys(module).length === 19` pasaría igual si
 * alguien agregara un símbolo y borrara otro.
 */
const PUBLIC_SURFACE = [
  'INSTANCE',
  'PROTOCOL_VERSION',
  'COMMAND_SERVICE',
  'QUERY_SERVICE',
  'SERVICE_NAME',
  'commandSubject',
  'querySubject',
  'groupSubject',
  'subscriptionSubject',
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
  it('TS-48: los 19 símbolos de runtime están exportados', () => {
    const p = reload({});
    const exported = Object.keys(p);
    PUBLIC_SURFACE.forEach((name) => {
      exported.should.containEql(name);
      // Incluidos los tres @deprecated: SERVICE_NAME, subscriptionSubject, commandFromSubject.
      ((p as unknown as Record<string, unknown>)[name] === undefined).should.be.false();
    });
    PUBLIC_SURFACE.length.should.equal(19);
  });

  it('TS-49: ErrorCode tiene 26 miembros', () => {
    Object.keys(reload({}).ErrorCode).length.should.equal(26);
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
});
