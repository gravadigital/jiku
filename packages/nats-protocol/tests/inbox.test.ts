import 'should';

import * as fs from 'node:fs';
import * as path from 'node:path';

import { ErrorCodeValue, Reply } from '../src/index';
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

  it('TS-49: ErrorCode tiene 32 miembros', () => {
    Object.keys(reload({}).ErrorCode).length.should.equal(32);
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

  // ---------------------------------------------------------------------------------------
  // REQ-006 / S-020 · el envelope gana `errorDetails`, y lo importante es cuándo NO aparece.
  //
  // Un `errorDetails: undefined` explícito desaparece al serializar a JSON —por el cable el
  // envelope sería idéntico— pero EXISTE como clave propia, y las aserciones `should.deepEqual`
  // de `core` y de la api comparan claves propias. Poner la clave siempre pintaría de rojo al
  // menos cinco aserciones de los consumidores SIN que el comportamiento haya cambiado.
  // ---------------------------------------------------------------------------------------

  it('TS-75: failure() de dos argumentos NO tiene la clave errorDetails', () => {
    // Las dos aserciones hacen falta: `in` atrapa la clave con valor `undefined`, y
    // `Object.keys()` atrapa además el orden y cualquier clave de más.
    const r = reload({}).failure('client_not_found', 'Client not found');
    Object.keys(r).should.eql(['status', 'errorCode', 'errorMessage']);
    ('errorDetails' in r).should.be.false();
  });

  it('TS-76: failure() de tres argumentos lleva el objeto en errorDetails', () => {
    // La forma que va a usar el plano de consultas desde su primera línea: qué campo, qué valor
    // y qué se aceptaba, como DATOS y no como texto a parsear con un regex.
    const p = reload({});
    p.failure(p.ErrorCode.INVALID_FIELDS, 'Campo no declarado en filter', {
      field: 'nombreInventado',
      value: 1,
      allowed: ['id', 'title'],
    }).should.deepEqual({
      status: 'failure',
      errorCode: 'invalid_fields',
      errorMessage: 'Campo no declarado en filter',
      errorDetails: { field: 'nombreInventado', value: 1, allowed: ['id', 'title'] },
    });
  });

  it('TS-77: errorDetails vacío SÍ aparece: la ausencia es de undefined, no de "vacío"', () => {
    // Descarta la implementación con `details &&`: `{}` es truthy, pero generalizar ese patrón
    // descartaría también valores legítimos. La comparación es contra `undefined`, y nada más.
    const r = reload({}).failure('invalid_cursor', 'Cursor inválido', {});
    r.should.deepEqual({
      status: 'failure',
      errorCode: 'invalid_cursor',
      errorMessage: 'Cursor inválido',
      errorDetails: {},
    });
    ('errorDetails' in r).should.be.true();
  });

  it('TS-78: un undefined explícito se comporta como no pasar el tercer argumento', () => {
    const r = reload({}).failure('internal_error', 'Error interno', undefined);
    Object.keys(r).should.eql(['status', 'errorCode', 'errorMessage']);
    ('errorDetails' in r).should.be.false();
  });

  it('TS-79: el envelope con errorDetails sobrevive el ida y vuelta por el cable', () => {
    // `null` y `[]` adentro son los dos valores que un round trip mal hecho pierde o transforma.
    const p = reload({});
    const wire = JSON.parse(
      JSON.stringify(p.failure('invalid_fields', 'x', { field: 'a', value: null, allowed: [] })),
    );
    wire.should.deepEqual({
      status: 'failure',
      errorCode: 'invalid_fields',
      errorMessage: 'x',
      errorDetails: { field: 'a', value: null, allowed: [] },
    });
  });

  it('TS-80: el envelope de éxito no gana ninguna clave', () => {
    const p = reload({});
    p.success().should.deepEqual({ status: 'success' });
    p.success({ id: 7 }).should.deepEqual({ status: 'success', data: { id: 7 } });
    ('errorDetails' in p.success()).should.be.false();
  });

  it('TS-87: un Reply sin errorDetails sigue siendo un Reply válido', () => {
    // Aserción de COMPILACIÓN: el campo es opcional, así que los envelopes que ya existen —los de
    // los 20 comandos— siguen tipando bajo `strict` sin tocarse.
    const r: Reply = { status: 'failure', errorCode: 'internal_error', errorMessage: 'x' };
    const r2: Reply<{ id: number }> = { status: 'success', data: { id: 1 } };
    r.status.should.equal('failure');
    (r2.data as { id: number }).id.should.equal(1);
  });

  it('TS-88: errorDetails acepta cualquier objeto, y SOLO un objeto', () => {
    // Aserción de COMPILACIÓN en las dos direcciones. El `@ts-expect-error` además falla si algún
    // día ESA línea sí compilara —si el tipo se aflojara a `any`—, que es lo que hay que detectar.
    const r: Reply = { status: 'failure', errorDetails: { a: 1, b: 'x', c: [1, 2] } };
    ((r.errorDetails as Record<string, unknown>).a as number).should.equal(1);

    // @ts-expect-error errorDetails es un objeto: un string no tipa
    const bad: Reply = { status: 'failure', errorDetails: 'texto' };
    bad.status.should.equal('failure');
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

  it('TS-72: los 32 valores del catálogo son únicos entre sí', () => {
    // Atrapa el copy-paste que deja dos claves con el mismo valor: un fallo que ninguna otra
    // aserción ve, porque el catálogo se lee siempre por clave.
    const values = Object.values(reload({}).ErrorCode);
    values.length.should.equal(32);
    new Set(values).size.should.equal(32);
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

  // ---------------------------------------------------------------------------------------
  // REQ-006 / S-020 · los CINCO códigos del plano de consultas.
  //
  // Al terminar esta story los cinco EXISTEN Y NADIE LOS EMITE, y está bien: son el vocabulario
  // que las stories del contrato de consultas usan desde su primera línea. Sin ellos declarados,
  // `ErrorCode.INVALID_CURSOR` no es un `undefined` en runtime: es un TS2339 que no compila.
  // ---------------------------------------------------------------------------------------

  it('TS-81: los cinco literales exactos, uno por uno', () => {
    // El valor cruza el bus: un typo acá sale 500 en producción y NINGÚN test de `core` lo
    // atrapa, porque `core` usaría la misma constante equivocada. Por eso se comparan literales
    // escritos a mano contra el catálogo, y no el catálogo contra sí mismo.
    const E = reload({}).ErrorCode;
    E.UNKNOWN_CALLER.should.equal('unknown_caller');
    E.QUERY_TIMEOUT.should.equal('query_timeout');
    E.INVALID_CURSOR.should.equal('invalid_cursor');
    E.COMMENT_NOT_FOUND.should.equal('comment_not_found');
    E.TASK_NOT_FOUND.should.equal('task_not_found');
  });

  it('TS-82: las cinco claves son la traducción mecánica del valor', () => {
    // Romper la simetría de los 27 que ya están haría que el próximo código se agregue mal.
    const entries = Object.entries(reload({}).ErrorCode);
    const keyOf = (value: string): string => {
      const found = entries.find(([, v]) => v === value);
      return (found as [string, string])[0];
    };
    keyOf('unknown_caller').should.equal('UNKNOWN_CALLER');
    keyOf('query_timeout').should.equal('QUERY_TIMEOUT');
    keyOf('invalid_cursor').should.equal('INVALID_CURSOR');
    keyOf('comment_not_found').should.equal('COMMENT_NOT_FOUND');
    keyOf('task_not_found').should.equal('TASK_NOT_FOUND');
  });

  it('TS-83: objective_not_found sigue existiendo y es DISTINTO de task_not_found', () => {
    // La convivencia es la decisión, no un olvido (ADR-004): el recurso del bus se llama `tasks`,
    // así que su "no encontrado" es `task_not_found`; `objective_not_found` SE QUEDA en los
    // comandos, porque retirarlo obligaría a tocar comandos que REQ-006 declara intactos.
    const E = reload({}).ErrorCode;
    E.OBJECTIVE_NOT_FOUND.should.equal('objective_not_found');
    E.TASK_NOT_FOUND.should.equal('task_not_found');
    ((E.OBJECTIVE_NOT_FOUND as string) === (E.TASK_NOT_FOUND as string)).should.be.false();
  });

  it('TS-84: unknown_caller y caller_not_authorized coexisten y son distintos', () => {
    // Dos compuertas, una detrás de la otra: "¿puede ejecutar este método?" ->
    // caller_not_authorized; "¿qué clase de caller es?" -> unknown_caller. Fusionarlas borraría
    // la regla de que un caller SIN FILA recibe un ERROR y nunca `items: []`.
    const E = reload({}).ErrorCode;
    E.CALLER_NOT_AUTHORIZED.should.equal('caller_not_authorized');
    E.UNKNOWN_CALLER.should.equal('unknown_caller');
    ((E.CALLER_NOT_AUTHORIZED as string) === (E.UNKNOWN_CALLER as string)).should.be.false();
  });

  it('TS-85: los 27 códigos anteriores siguen exactamente iguales', () => {
    // El cambio es ADITIVO: ninguno de los 27 previos cambió de clave ni de valor. La lista está
    // escrita a mano a propósito — comparar el catálogo contra sí mismo no probaría nada.
    const PREVIOS: Record<string, string> = {
      INVALID_FIELDS: 'invalid_fields',
      INTERNAL_ERROR: 'internal_error',
      UNKNOWN_COMMAND: 'unknown_command',
      CALLER_NOT_AUTHORIZED: 'caller_not_authorized',
      CLIENT_NOT_FOUND: 'client_not_found',
      PROJECT_NOT_FOUND: 'project_not_found',
      OBJECTIVE_NOT_FOUND: 'objective_not_found',
      REQUIREMENT_NOT_FOUND: 'requirement_not_found',
      USER_NOT_FOUND: 'user_not_found',
      PERSON_NOT_FOUND: 'person_not_found',
      INVALID_RESPONSIBLE_PERSON: 'invalid_responsible_person',
      INVALID_ATTACHMENT_ID: 'invalid_attachment_id',
      REQUIREMENT_PROJECT_MISMATCH: 'requirement_project_mismatch',
      DAILY_LIMIT_EXCEEDED: 'daily_limit_exceeded',
      INVALID_DATE_RANGE: 'invalid_date_range',
      ALREADY_SUBSCRIBED: 'already_subscribed',
      SUBSCRIPTION_NOT_FOUND: 'subscription_not_found',
      INVALID_STATE_TRANSITION: 'invalid_state_transition',
      STAGE_NOT_FOUND: 'stage_not_found',
      RESOLUTION_REQUIRED: 'resolution_required',
      WORKED_TIME_NOT_FOUND: 'worked_time_not_found',
      UNWORKED_TIME_NOT_FOUND: 'unworked_time_not_found',
      FILE_TYPE_NOT_ALLOWED: 'file_type_not_allowed',
      FILE_TOO_LARGE: 'file_too_large',
      FILE_NOT_OWNED: 'file_not_owned',
      FILE_NOT_FOUND: 'file_not_found',
      FILE_NOT_AVAILABLE: 'file_not_available',
    };
    Object.keys(PREVIOS).length.should.equal(27);

    const actual = reload({}).ErrorCode as unknown as Record<string, string>;
    Object.entries(PREVIOS).forEach(([key, value]) => {
      actual[key].should.equal(value);
    });
  });

  it('TS-86: ErrorCodeValue incluye los cinco valores sin editar el tipo', () => {
    // Aserción de COMPILACIÓN: antes del cambio cada literal es un TS2322. Y prueba que el
    // `as const` sigue en su lugar — sin él el tipo colapsa a `string`, todo compila igual y el
    // verde es falso.
    const codes: ErrorCodeValue[] = [
      'unknown_caller',
      'query_timeout',
      'invalid_cursor',
      'comment_not_found',
      'task_not_found',
    ];
    codes.length.should.equal(5);
  });

  it('TS-89: el catálogo del paquete es EXACTAMENTE el enum del contrato', () => {
    // `docs/apis/core.yaml` es la fuente de verdad del valor, y el paquete se le alinea. Este
    // test es lo que impide que las dos listas se separen sin que nadie se entere.
    //
    // Se lee el archivo y se recorta el bloque a mano, SIN parser de YAML: el paquete no gana
    // dependencias, ni de runtime ni de test (ADR-005).
    //
    // ANTE UN FALLO ACÁ NO PEGAR LA LISTA NUEVA A CIEGAS: revisar cuál de los dos lados cambió.
    // Si cambió el contrato, manda el contrato. Si cambió el paquete sin que el contrato lo
    // declare, el cambio está mal.
    const contrato = path.join(__dirname, '../../../docs/apis/core.yaml');
    const lines = fs.readFileSync(contrato, 'utf8').split('\n');

    const schemaIdx = lines.findIndex((l) => l === '    ErrorCode:');
    schemaIdx.should.be.above(-1);
    const enumIdx = lines.findIndex((l, i) => i > schemaIdx && l === '      enum:');
    enumIdx.should.be.above(-1);

    const values: string[] = [];
    for (let i = enumIdx + 1; i < lines.length; i++) {
      const line = lines[i];
      // Los comentarios `#` intercalados se saltean; la primera línea que no es ni item ni
      // comentario cierra el bloque.
      if (/^\s*#/.test(line)) continue;
      const item = /^        - (\S+)$/.exec(line);
      if (!item) break;
      values.push(item[1]);
    }

    const delPaquete = Object.values(reload({}).ErrorCode) as string[];
    values.length.should.equal(32);
    delPaquete.length.should.equal(32);
    Array.from(new Set(values)).sort().should.eql(Array.from(new Set(delPaquete)).sort());
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
