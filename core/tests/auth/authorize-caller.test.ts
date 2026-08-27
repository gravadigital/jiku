import 'mocha';
import 'should';
import * as fs from 'fs';
import * as path from 'path';
import sinon from 'sinon';
import { Sequelize } from 'sequelize-typescript';
import { Client, File, User } from '@jiku/models';
import { ErrorCode, querySubject, success } from '@jiku/nats-protocol';
import {
  ROLE_METHODS,
  authorizeWithRoles,
  readCallerRoles,
  rolesAuthorize,
} from '../../src/authorize-caller';
import { Dispatcher } from '../../src/bus/dispatcher';
import { CLASS_BY_ROLE } from '../../src/caller-class';
import { registry } from '../../src/commands';
import { getTrustedPublisherId } from '../../src/config';
import { matchesPattern } from '../../src/commands/registry';
import logger from '../../src/logger';
import { sequelize } from '../../src/models';
import { readDb } from '../../src/models/read';
import { queryRegistry } from '../../src/queries';
import { QueryDispatcher } from '../../src/queries/dispatcher';
import { QueryRegistry } from '../../src/queries/registry';
import { dispatch, dispatchQuery } from '../helpers/dispatch';
import { S3Double, installS3Double, uninstallS3Double } from '../helpers/s3-double';

/**
 * ESTE ARCHIVO TIENE QUE CORRER PRIMERO, Y EL NOMBRE DE LA CARPETA ES LO QUE LO GARANTIZA.
 * `.mocharc.json` levanta los `*.test.ts` de `tests/` recursivamente, y `tests/auth/` ordena
 * alfabéticamente antes que `tests/bus/`, `tests/commands/`, `tests/events/`, `tests/models/` y
 * `tests/queries/`. Importa porque CA-1
 * exige despachar con la tabla `users` COMPLETAMENTE VACÍA, y lo único que la deja vacía es el
 * `TRUNCATE ... RESTART IDENTITY CASCADE` de `tests/global-setup.ts`, que corre una vez al
 * arrancar la corrida.
 *
 * El `before` de CA-1 lo verifica en vez de suponerlo: si otro archivo dejó filas, el `destroy`
 * falla por las FK (`files.uploaded_by`, `projects.created_by`, …) o el `count` no da 0, y el
 * error dice exactamente qué pasó en vez de fallar por una causa confusa.
 */

describe('matchesPattern — el matcher por segmentos extraído del registry', () => {
  it('TS-7 · un patrón sin params es match exacto', () => {
    matchesPattern('clients.new', 'clients.new').should.be.true();
    matchesPattern('clients.new', 'clients.edit').should.be.false();
  });

  it('TS-8 · el segmento variable captura cualquier token', () => {
    matchesPattern('files.{fileId}.request-download', 'files.7.request-download').should.be.true();
    matchesPattern('requirements.{id}.comment', 'requirements.999.comment').should.be.true();
    // El id puede ser un número o un string de Zitadel, y ESA es la razón por la que el matching
    // es por segmentos y no por regex.
    matchesPattern('tasks.{id}.edit', 'tasks.abc-DEF_123.edit').should.be.true();
  });

  it('TS-9 · distinta cantidad de segmentos NUNCA matchea', () => {
    matchesPattern('tasks.{id}.edit', 'tasks.new').should.be.false();
    matchesPattern('tasks.new', 'tasks.7.edit').should.be.false();
    matchesPattern(
      'requirements.{id}.subscriptors.{userId}.delete',
      'requirements.7.comment'
    ).should.be.false();
  });

  it('TS-10 · el literal no matchea en la posición del param, ni al revés', () => {
    matchesPattern('tasks.{id}.edit', 'tasks.7.comment').should.be.false();
    matchesPattern('files.request-upload', 'files.7.request-upload').should.be.false();
  });
});

/**
 * El mapa rol → método, ejercitado PURO: sin base, sin despachador y sin config cargada. Los
 * tests de `authorizeCaller` —que sí tocan la base— entran por los despachadores más abajo,
 * como manda la convención `testing`.
 */
describe('ROLE_METHODS / rolesAuthorize — el mapa, puro y sin base', () => {
  /** Un patrón con `{param}` no es un método: se sustituye por un token concreto. */
  const asMethod = (pattern: string): string => pattern.replace(/\{[^}]+\}/g, '7');

  const COMMANDS = registry.patterns();
  const QUERIES = queryRegistry.patterns();

  /*
   * ACÁ VIVÍA `templateSubjects()`, que leía los nueve subjects de
   * `templates/external-publisher.yaml` en vez de escribirlos a mano. Era la única mitigación
   * del riesgo que S-017 registró sin mitigación técnica —los nueve enumerados en DOS archivos,
   * sin nada que los sincronizara— y desapareció con el rol: ya no hay dos enumeraciones que
   * puedan divergir, porque `internal-app` autoriza con `'*'` y su plantilla publica con `>`.
   *
   * Si vuelve a existir un rol de conector ACOTADO, este helper es el patrón a recuperar.
   */

  it('TS-11 · internal-app autoriza LOS 21 comandos registrados, uno por uno', () => {
    // Los 21 salen de `registry.patterns()` y no de una lista a mano. Eran 20 hasta que S-032
    // registró `week-assigned-times.replace`, el comando 21.
    COMMANDS.length.should.equal(21);
    for (const pattern of COMMANDS) {
      rolesAuthorize(['internal-app'], asMethod(pattern), 'commands').should.be.true();
    }
  });

  it('TS-12 · internal-app autoriza el comando 21 SIN QUE NADIE LO DECIDA', () => {
    // ES EL COSTO EXPLÍCITO DEL SENTINELA, y este test existe para que esté escrito y no se
    // descubra en producción. Antes `commands` era una lista y agregar un comando al registry
    // NO lo autorizaba solo: había que sumarlo al mapa en el mismo commit. Con `'*'` eso ya no
    // pasa, ni para `internal-app` ni para ningún conector futuro con ese rol.
    //
    // Si algún día hay que volver a acotarlo, es un rol nuevo con su lista y su plantilla.
    rolesAuthorize(['internal-app'], 'comando.que.no.existe.todavia', 'commands').should.be.true();
  });

  it('TS-13 · internal-app autoriza TODAS las consultas registradas', () => {
    for (const query of QUERIES) {
      rolesAuthorize(['internal-app'], query, 'queries').should.be.true();
    }
  });

  it('TS-14 · admin, user y external-user siguen autorizando TODAS las consultas', () => {
    // LA MITAD DE COMANDOS DE ESTE TEST DESAPARECIÓ EN S-030 y su premisa con ella: hasta esa
    // story el mapa decía "ningún comando" para los tres roles de producto. Ahora `admin` y
    // `user` enumeran 18 (TS-1 / TS-2 de S-030) y `external-user` sigue sin ninguno POR EL BUS
    // pero gana 6 POR EL SOBRE (TS-4 / TS-5). Lo que se conserva intacto es esta mitad.
    for (const role of ['admin', 'user', 'external-user']) {
      for (const query of QUERIES) {
        rolesAuthorize([role], query, 'queries').should.be.true();
      }
    }
  });

  it('S-030 TS-1/TS-2 · admin y user autorizan LOS MISMOS 18 por el canal DIRECTO', () => {
    // LOS DOS COMANDOS DE SUSCRIPTORES SON LA EXCEPCIÓN EN EL CANAL DIRECTO: sus endpoints
    // declaran `hasAnyRole(['external-user'])`, así que un rol interno no puede suscribir a nadie
    // por HTTP. Dárselos para publicar SOLO sería AMPLIAR, no migrar.
    const SOLO_EXTERNAS = [
      'requirements.{id}.subscriptors.new',
      'requirements.{id}.subscriptors.{userId}.delete',
    ];

    // EL COMANDO 21 ES LA TERCERA EXCEPCIÓN, Y ES LA ÚNICA QUE ROMPE LA SIMETRÍA ENTRE LOS DOS
    // ROLES INTERNOS (S-032, C-38): `PUT /api/week-assigned-times` es la única ruta del producto
    // con `x-roles: [admin]` sola, así que `admin` lo tiene y `user` NO. Por eso no está en
    // `INTERNAL_COMMANDS` —la constante que los dos comparten— sino en `ADMIN_COMMANDS`. Su gate
    // propio, con las dos direcciones y los dos canales, es `S-032 · el comando 21 es de admin
    // SOLO`, más abajo.
    const SOLO_ADMIN = ['week-assigned-times.replace'];

    for (const role of ['admin', 'user']) {
      for (const pattern of COMMANDS) {
        const esperado =
          !SOLO_EXTERNAS.includes(pattern) &&
          (role === 'admin' || !SOLO_ADMIN.includes(pattern));
        rolesAuthorize([role], asMethod(pattern), 'commands').should.equal(
          esperado,
          `${role} -> ${pattern}`
        );
      }
    }
  });

  it('S-030 · `user` suma UN comando por el canal del SOBRE, y `admin` ninguno', () => {
    // `requirements.{id}.subscriptors.new` es el comando SECUNDARIO de
    // `POST /api/opus/requirements` (`['user','external-user']`): un `user` lo alcanza SOLO
    // porque la api lo publica en su nombre al crear el requisito. Publicando directo al bus NO
    // lo alcanza, y esa asimetría es de seguridad — ver `USER_ENVELOPE_COMMANDS`.
    const SUSCRIBIR = 'requirements.{id}.subscriptors.new';

    rolesAuthorize(['user'], asMethod(SUSCRIBIR), 'commands', 'envelope').should.be.true();
    rolesAuthorize(['user'], asMethod(SUSCRIBIR), 'commands', 'direct').should.be.false();

    // `admin` no lo tiene por NINGÚN canal: no alcanza ese endpoint.
    rolesAuthorize(['admin'], asMethod(SUSCRIBIR), 'commands', 'envelope').should.be.false();
    rolesAuthorize(['admin'], asMethod(SUSCRIBIR), 'commands', 'direct').should.be.false();

    // Y el resto del canal del sobre de `user` es idéntico al directo.
    for (const pattern of COMMANDS.filter((p) => p !== SUSCRIBIR)) {
      rolesAuthorize(['user'], asMethod(pattern), 'commands', 'envelope').should.equal(
        rolesAuthorize(['user'], asMethod(pattern), 'commands', 'direct'),
        pattern
      );
    }
  });

  it('S-030 TS-4 · external-user NO autoriza NINGÚN comando por el canal DIRECTO', () => {
    // ES LA SEGUNDA DE LAS DOS DEFENSAS INDEPENDIENTES que CA-3 del REQ exige, y sigue en pie
    // aunque la plantilla del callout se equivocara y le diera permiso de publicación.
    for (const pattern of COMMANDS) {
      rolesAuthorize(['external-user'], asMethod(pattern), 'commands').should.be.false(pattern);
      // El default del canal es `direct`, así que omitirlo tiene que dar lo mismo que pedirlo.
      rolesAuthorize(['external-user'], asMethod(pattern), 'commands', 'direct').should.be.false(
        pattern
      );
    }
  });

  it('S-030 TS-5 · external-user autoriza EXACTAMENTE 6 comandos por el canal del SOBRE', () => {
    // Son los seis endpoints de la superficie opus que declaran `external-user` y publican un
    // comando. Si esta lista cambia, un camino vivo del portal se abre o se rompe.
    ROLE_METHODS['external-user'].envelopeCommands!.should.deepEqual([
      'requirements.new',
      'requirements.{id}.comment',
      'requirements.{id}.subscriptors.new',
      'requirements.{id}.subscriptors.{userId}.delete',
      'files.request-upload',
      'files.{fileId}.request-download',
    ]);

    for (const pattern of ROLE_METHODS['external-user'].envelopeCommands!) {
      rolesAuthorize(['external-user'], asMethod(pattern), 'commands', 'envelope').should.be.true(
        pattern
      );
    }
  });

  it('S-030 TS-11 · (gate) `envelopeCommands` lo declaran EXACTAMENTE dos roles', () => {
    // LOS DOS POR LA MISMA RAZÓN: hay comandos que una persona alcanza SOLO porque la api los
    // publica en su nombre, y que no tiene por qué poder publicar sola. Un TERCER rol con el
    // campo significa que alguien resolvió otro conflicto copiando estos, y hay que verlo: el
    // campo AMPLÍA lo que un rol puede hacer por el sobre, así que no se agrega sin decisión.
    Object.entries(ROLE_METHODS)
      .filter(([, permissions]) => permissions.envelopeCommands !== undefined)
      .map(([role]) => role)
      .sort()
      .should.deepEqual(['external-user', 'user']);
  });

  it('S-032 · (gate) el comando 21 es de `admin` SOLO', () => {
    // ESTE GATE SE INVIRTIÓ EN S-032. Antes afirmaba la AUSENCIA del comando 21 en el mapa —el
    // comando no existía todavía— con un `includes` sobre el JSON serializado. Ahora el comando
    // está, y la propiedad que hay que proteger es OTRA: que sea de `admin` y NO de `user`. Un
    // `includes` sobre el JSON no distingue de quién es, así que se pregunta a `rolesAuthorize`,
    // que es la función que la compuerta usa de verdad.
    for (const channel of ['direct', 'envelope'] as const) {
      rolesAuthorize(['admin'], 'week-assigned-times.replace', 'commands', channel)
        .should.be.true();
      rolesAuthorize(['user'], 'week-assigned-times.replace', 'commands', channel)
        .should.be.false();
      rolesAuthorize(['external-user'], 'week-assigned-times.replace', 'commands', channel)
        .should.be.false();
    }
  });

  it('S-030 · (gate) todo rol con comandos tiene clase en CLASS_BY_ROLE', () => {
    // LAS DOS TABLAS SON DELIBERADAMENTE INDEPENDIENTES, y el despachador de comandos depende de
    // que no se desincronicen: un rol con comandos y SIN clase revienta en la compuerta (falla
    // cerrada, `internal_error`). Este gate lo delata acá en vez de en producción.
    for (const [role, permissions] of Object.entries(ROLE_METHODS)) {
      const escribe =
        permissions.commands === '*' ||
        (permissions.commands as readonly string[]).length > 0 ||
        permissions.envelopeCommands !== undefined;
      if (escribe) {
        CLASS_BY_ROLE.should.have.property(role);
      }
    }
  });

  it('TS-15 · core y bus-observer no autorizan nada en ningún plano', () => {
    for (const role of ['core', 'bus-observer']) {
      for (const pattern of COMMANDS) {
        rolesAuthorize([role], asMethod(pattern), 'commands').should.be.false();
      }
      for (const query of QUERIES) {
        rolesAuthorize([role], query, 'queries').should.be.false();
      }
    }
  });

  it('TS-16 · internal-app autoriza POR SU ROL, y la exención del `sub` ya no es lo único', () => {
    // ERA EL TEST INVERSO: hasta que `internal-app` pasó a ser el rol de conector, autorizaba
    // NADA y la api pasaba solo por la exención del `sub`. La consecuencia era que un SEGUNDO
    // conector con ese rol conectaba al bus, publicaba —la plantilla se lo permite— y se comía
    // un `caller_not_authorized` en cada método.
    rolesAuthorize(['internal-app'], 'clients.new', 'commands').should.be.true();
    rolesAuthorize(['internal-app'], 'tasks.list', 'queries').should.be.true();
  });

  it('TS-16b · la exención del `sub` sigue siendo necesaria, y no por el rol', () => {
    // Lo que la exención cubre es el caller SIN FILA en `users` —evento de autenticación
    // perdido, NATS core sin reintento—, donde no hay roles que leer. El rol es la red de
    // abajo; la exención es la que evita la caída total y silenciosa de escritura.
    rolesAuthorize([], 'clients.new', 'commands').should.be.false();
  });

  it('TS-17 · roles: [] no autoriza nada', () => {
    rolesAuthorize([], 'clients.new', 'commands').should.be.false();
    rolesAuthorize([], 'tasks.list', 'queries').should.be.false();
  });

  it('S-030 TS-6 · una lista de roles VACÍA no autoriza nada EN NINGÚN CANAL', () => {
    // Las dos mitades: sin el canal del sobre, un `roles: []` que llegara por el embudo de la api
    // quedaría sin afirmación a nivel de mapa puro.
    rolesAuthorize([], 'clients.new', 'commands').should.be.false();
    rolesAuthorize([], 'clients.new', 'commands', 'envelope').should.be.false();
    rolesAuthorize([], 'requirements.new', 'commands', 'envelope').should.be.false();
    rolesAuthorize([], 'tasks.list', 'queries').should.be.false();
  });

  it('S-030 TS-7 · un rol desconocido no autoriza nada EN NINGÚN CANAL', () => {
    rolesAuthorize(['wizard'], 'clients.new', 'commands').should.be.false();
    rolesAuthorize(['wizard'], 'clients.new', 'commands', 'envelope').should.be.false();
    rolesAuthorize(['wizard'], 'requirements.new', 'commands', 'envelope').should.be.false();
  });

  it('S-030 TS-8 · la UNIÓN se conserva: `["user","external-user"]` publica lo de `user`', () => {
    // ES EL CALLER QUE HACE ALCANZABLE EL MODO EXTERNO POR EL CANAL DIRECTO: la unión lo autoriza
    // en los 18 de `user`, y la PRECEDENCIA de `resolveCallerClass` lo pone en clase `external`.
    // Las dos tablas responden preguntas distintas y resuelven al revés a propósito.
    const mixto = ['user', 'external-user'];

    rolesAuthorize(mixto, 'clients.new', 'commands').should.be.true();
    rolesAuthorize(mixto, 'requirements.7.comment', 'commands').should.be.true();
    // Y no le suma nada que `user` no tenga: la unión no inventa permisos.
    rolesAuthorize(mixto, 'requirements.7.subscriptors.8.delete', 'commands').should.be.false();
  });

  it('TS-18 · un rol DESCONOCIDO no autoriza nada (deny-by-default)', () => {
    // Es lo que hace aceptable guardar `roles` sin validar contra ningún catálogo.
    rolesAuthorize(['wizard'], 'clients.new', 'commands').should.be.false();
    rolesAuthorize(['wizard'], 'tasks.list', 'queries').should.be.false();
  });

  it('TS-19 · varios roles son una UNIÓN, no una precedencia', () => {
    // El de MENOR privilegio no recorta lo que el otro autoriza: es lo contrario de cómo
    // resuelve la CLASE del caller, que elige la más restrictiva. Dos preguntas distintas.
    const both = ['external-user', 'internal-app'];
    rolesAuthorize(both, 'files.request-upload', 'commands').should.be.true();
    rolesAuthorize(both, 'clients.new', 'commands').should.be.true();
    rolesAuthorize(both, 'tasks.list', 'queries').should.be.true();

    // La unión no inventa permisos: dos roles que no escriben siguen sin escribir.
    const neither = ['external-user', 'bus-observer'];
    rolesAuthorize(neither, 'clients.new', 'commands').should.be.false();
  });

  it('TS-20 · (gate) el mapa declara EXACTAMENTE 6 roles', () => {
    Object.keys(ROLE_METHODS)
      .sort()
      .should.deepEqual([
        'admin',
        'bus-observer',
        'core',
        'external-user',
        'internal-app',
        'user',
      ]);
  });

  it('TS-20c · (gate) el sentinela en commands lo tiene SOLO internal-app', () => {
    // ACÁ HABÍA UN GATE MÁS FUERTE: `'*'` estaba PROHIBIDO en el plano de comandos —"la
    // escritura se enumera, siempre"— y se resignó al hacer de `internal-app` el rol de
    // conector. Lo que queda es acotar el daño: que el sentinela no se filtre a ningún OTRO rol
    // sin que alguien lo vea, y en particular a ninguno de los tres de PRODUCTO, que es donde
    // convertiría a cualquier persona en escritora del bus.
    const withSentinel = Object.entries(ROLE_METHODS)
      .filter(([, permissions]) => !Array.isArray(permissions.commands))
      .map(([role]) => role);
    withSentinel.should.deepEqual(['internal-app']);

    for (const role of ['admin', 'user', 'external-user', 'core', 'bus-observer']) {
      Array.isArray(ROLE_METHODS[role].commands).should.be.true();
    }
  });

  it('TS-20b · (gate) el mapa NO tiene cache ni estado', () => {
    const source = fs.readFileSync(path.join(__dirname, '../../src/authorize-caller.ts'), 'utf8');
    // Cachear reintroduciría los roles obsoletos con una ventana no medible (CA-17). La prosa
    // del comentario que explica por qué no hay cache queda fuera: solo se mira el código.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    /new Map|cache|Cache|ttl|TTL|memo/.test(code).should.be.false();
  });
});

/**
 * Los callers de los tests con base. `SIN_FILA` no se crea nunca: es el caso de CA-7.
 */
const EXT = 'sub-conector-externo';
const ADM = 'sub-persona-admin';
const VACIO = 'sub-sin-roles';
const MUTABLE = 'sub-roles-mutables';
const SIN_FILA = 'sub-sin-fila';

/** El payload mínimo válido de `files.request-upload`. */
const uploadPayload = { fileName: 'informe.pdf', mimeType: 'application/pdf', fileSize: 1024 };

describe('la compuerta de autorización · plano de comandos', () => {
  describe('CA-1 · la exención con la tabla `users` VACÍA', () => {
    before(async () => {
      // Idempotente y de diagnóstico: con este archivo corriendo primero es un no-op. Si otro
      // archivo dejó filas, esto falla por las FK y el error dice exactamente qué pasó, en vez
      // de que TS-21 falle por una causa confusa.
      await User.destroy({ where: {} });
    });

    after(async () => {
      await Client.destroy({ where: {} });
    });

    it('TS-21 · con `users` vacía, el caller exento pasa SIN consultar la base', async () => {
      (await User.count()).should.equal(0);
      const findByPk = sinon.spy(User, 'findByPk');
      try {
        const reply = await dispatch<{ id: number }>('clients.new', { name: 'Acme' });

        reply.status.should.equal('success');
        (typeof reply.data!.id).should.equal('number');
        // Ni una consulta: es la exención, no la base. Es el test que impide reintroducir el
        // deadlock de arranque, y el estado que ejercita —`users` vacía— no lo cubría ninguno.
        findByPk.callCount.should.equal(0);
        (await Client.count()).should.equal(1);
      } finally {
        findByPk.restore();
      }
    });

    it('TS-22 · con `users` vacía, ninguno de los 21 devuelve caller_not_authorized', async () => {
      (await User.count()).should.equal(0);

      for (const pattern of registry.patterns()) {
        const method = pattern.replace(/\{[^}]+\}/g, '1');
        const reply = await dispatch(method, {});

        // La mayoría contesta `invalid_fields` (Joi), y ESO es la prueba de que la compuerta las
        // dejó pasar hasta la validación.
        (reply.errorCode === ErrorCode.CALLER_NOT_AUTHORIZED).should.be.false();
      }
    });
  });

  describe('los rechazos y los pasos, con filas en `users`', () => {
    let s3: S3Double;

    before(async () => {
      await User.bulkCreate([
        {
          id: EXT,
          name: 'Conector',
          username: 'conector-auth',
          email: 'conector-auth@test.local',
          // UN CONECTOR QUE NO ES LA API: su `sub` no es el `CORE_TRUSTED_PUBLISHER_ID`, así
          // que no lo exime nada y su autorización sale ENTERAMENTE de esta lista.
          roles: ['internal-app'],
        },
        {
          id: ADM,
          name: 'Persona Admin',
          username: 'admin-auth',
          email: 'admin-auth@test.local',
          roles: ['admin'],
        },
        // `roles: []` es el default de la columna, y se declara igual para que el caso se lea.
        { id: VACIO, name: 'Sin Roles', username: 'vacio-auth', email: 'vacio-auth@test.local' },
        {
          id: MUTABLE,
          name: 'Roles Mutables',
          username: 'mutable-auth',
          email: 'mutable-auth@test.local',
        },
      ]);
    });

    after(async () => {
      await File.destroy({ where: {} });
      await User.destroy({ where: {} });
      await Client.destroy({ where: {} });
    });

    beforeEach(() => {
      s3 = installS3Double();
    });

    afterEach(async () => {
      sinon.restore();
      uninstallS3Double();
      await File.destroy({ where: {} });
    });

    it('TS-23 · CA-7: un caller SIN fila se rechaza y no escribe nada', async () => {
      const before = await Client.count();

      const reply = await dispatch('clients.new', { name: 'Fantasma' }, SIN_FILA);

      reply.should.deepEqual({
        status: 'failure',
        errorCode: 'caller_not_authorized',
        errorMessage: 'El caller no está autorizado a ejecutar este método',
      });
      (await Client.count()).should.equal(before);
    });

    it('TS-23b · un subject SIN caller (segundo segmento vacío) se rechaza', async () => {
      // `callerFromSubject` devuelve `''`, que no es el publicador confiable —`loadConfig()`
      // garantiza que no sea vacío— y no tiene fila. Cae en el rechazo, que es lo correcto.
      const reply = await new Dispatcher(registry).dispatch('dev..jiku-commands.v1.clients.new', {
        name: 'X',
      });

      reply.errorCode!.should.equal(ErrorCode.CALLER_NOT_AUTHORIZED);
    });

    it('TS-24 · un conector que NO es la api pasa en CUALQUIER comando', async () => {
      const before = await Client.count();

      // ESTE TEST AFIRMABA LO CONTRARIO, y el cambio es el ensanchamiento que hay que ver:
      // `clients.new` estaba FUERA de los 9 subjects que enumeraba el rol `external-publisher`
      // y se rechazaba con `caller_not_authorized`. Con `internal-app` como único rol de
      // conector, todo comando queda autorizado para cualquier identidad que lo lleve.
      const reply = await dispatch<{ id: number }>('clients.new', { name: 'X' }, EXT);

      reply.status.should.equal('success');
      (await Client.count()).should.equal(before + 1);
      await Client.destroy({ where: { id: reply.data!.id } });
    });

    it('TS-25 · CA-10: con fila y roles vacíos, todo se rechaza', async () => {
      const upload = await dispatch('files.request-upload', uploadPayload, VACIO);
      const client = await dispatch('clients.new', { name: 'X' }, VACIO);

      upload.errorCode!.should.equal(ErrorCode.CALLER_NOT_AUTHORIZED);
      client.errorCode!.should.equal(ErrorCode.CALLER_NOT_AUTHORIZED);
      (await File.count()).should.equal(0);
    });

    it('TS-26 · S-030 invirtió este test: con roles admin, la COMPUERTA ya no rechaza', async () => {
      // HASTA S-030 ESTE TEST AFIRMABA LO CONTRARIO —"con roles admin, un comando se rechaza"—
      // porque el mapa decía "ningún comando" para los roles de producto. S-030 enumera los 18 de
      // `admin`, así que la premisa desapareció y lo que queda por verificar es su INVERSO: la
      // compuerta lo deja pasar.
      //
      // PUEDE FALLAR DESPUÉS POR UNA REGLA DE DOMINIO, Y ES OTRA COSA: la ventana de carga de
      // horas y quién imputa a otra persona SIGUEN EN LA API hasta S-031, así que acá el comando
      // llega al dominio y responde lo que corresponda. Lo único que se afirma es que el rechazo
      // YA NO ES de la compuerta.
      const reply = await dispatch(
        'worked-times.new',
        { date: '2026-08-24', minutes: 480, projectId: 1, personId: 1 },
        ADM
      );

      // Se compara el BOOLEANO: si el comando saliera exitoso no habría `errorCode` y
      // `undefined.should` explotaría antes de afirmar nada.
      (reply.errorCode === ErrorCode.CALLER_NOT_AUTHORIZED).should.be.false();
    });

    it('TS-27 · CA-11: un conector PASA leyendo sus roles de la base, no por exención', async () => {
      const reply = await dispatch<{ id: number }>('files.request-upload', uploadPayload, EXT);

      reply.status.should.equal('success');
      const file = await File.findByPk(reply.data!.id);
      // La rama externa de `resolveActor`, sin cambios: el actor es el caller del subject.
      file!.uploadedBy.should.equal(EXT);
      s3.callsOf('PutObject').length.should.equal(1);
    });

    it('TS-28 · CA-6: la compuerta corre ANTES de registry.resolve()', async () => {
      // Un comando INEXISTENTE con un caller no autorizado: si la compuerta corriera después,
      // el registry contestaría `unknown_command` primero. Es la única aserción del orden.
      const reply = await dispatch('widgets.explode', {}, SIN_FILA);

      reply.errorCode!.should.equal(ErrorCode.CALLER_NOT_AUTHORIZED);
      reply.errorCode!.should.not.equal(ErrorCode.UNKNOWN_COMMAND);
    });

    it('TS-29 · CA-6: un rechazo NO abre ninguna transacción', async () => {
      const transaction = sinon.spy(sequelize, 'transaction');

      await dispatch('clients.new', { name: 'X' }, SIN_FILA);

      // Un caller no autorizado no consume una conexión del pool de escritura.
      transaction.callCount.should.equal(0);
    });

    it('TS-30 · CA-9: los dos casos devuelven errorCode Y errorMessage idénticos', async () => {
      // El caller "con fila y sin permiso" es ahora `VACIO` (`roles: []`). Era `ADM` hasta S-030,
      // que enumeró los 18 comandos de `admin` y lo dejó del lado de los que SÍ escriben; y antes
      // era `EXT`, que con el rol de conector pasa a autorizar todo. Lo que el test afirma no
      // cambió: "sin fila" y "con fila pero ningún rol autoriza" son INDISTINGUIBLES desde afuera.
      const sinFila = await dispatch('clients.new', { name: 'X' }, SIN_FILA);
      const rolSinPermiso = await dispatch('clients.new', { name: 'X' }, VACIO);

      // Si el MENSAJE difiriera, el mensaje sería el oráculo de existencia que el código evita.
      sinFila.errorCode!.should.equal(rolSinPermiso.errorCode!);
      sinFila.errorMessage!.should.equal(rolSinPermiso.errorMessage!);
    });

    it('TS-31 · el rechazo loguea UN warn con el caller y el método, y SIN el payload', async () => {
      const warn = sinon.spy(logger, 'warn');

      await dispatch('clients.new', { name: 'SECRETO' }, SIN_FILA);

      warn.callCount.should.equal(1);
      const message = String(warn.firstCall.args[0]);
      message.should.startWith('[auth]');
      message.should.containEql(SIN_FILA);
      message.should.containEql('clients.new');
      message.should.not.containEql('SECRETO');
    });

    it('TS-32 · el camino AUTORIZADO no loguea nada', async () => {
      const warn = sinon.spy(logger, 'warn');
      const info = sinon.spy(logger, 'info');

      // `attachments.{id}.delete` está entre los 9 y no resuelve actor, así que un `warn` acá
      // solo puede venir de la compuerta. Es lo que mantiene verde TS-15 de attachments.test.ts.
      await dispatch('attachments.999999.delete', {}, EXT);

      warn.called.should.be.false();
      // Sin `LOG_COMMANDS` el camino autorizado tampoco emite la traza de diagnóstico.
      info.called.should.be.false();
    });

    it('TS-33 · CA-16: el camino EXENTO no loguea nada y no toca la base', async () => {
      const warn = sinon.spy(logger, 'warn');
      const findByPk = sinon.spy(User, 'findByPk');

      await dispatch('clients.new', { name: 'Acme Exenta' });

      // El 100% del tráfico de hoy pasa por acá: ni una consulta más ni un milisegundo más.
      warn.called.should.be.false();
      findByPk.callCount.should.equal(0);
    });

    it('TS-34 · D-1: si findByPk rechaza, se DENIEGA con internal_error', async () => {
      const error = sinon.spy(logger, 'error');
      sinon.stub(User, 'findByPk').rejects(new Error('pool agotado'));
      const before = await Client.count();

      // Resuelve, no rechaza: el stack no cruza el bus.
      const reply = await dispatch('clients.new', { name: 'X' }, EXT);

      reply.should.deepEqual({
        status: 'failure',
        errorCode: 'internal_error',
        errorMessage: 'Internal error',
      });
      error.callCount.should.equal(1);
      String(error.firstCall.args[0]).should.startWith('[auth]');
      // Una compuerta que no puede decidir DENIEGA: dejar pasar convertiría una base caída en un
      // bypass de autorización.
      (await Client.count()).should.equal(before);
    });

    it('TS-35 · D-11: un roles que NO es un array DENIEGA, no explota', async () => {
      // La columna es JSONB sin CHECK y la tabla es escribible por SQL: el caso es alcanzable.
      await sequelize.query(`UPDATE users SET roles = '{"a":1}'::jsonb WHERE id = :id`, {
        replacements: { id: MUTABLE },
      });

      const reply = await dispatch('clients.new', { name: 'X' }, MUTABLE);

      reply.errorCode!.should.equal(ErrorCode.CALLER_NOT_AUTHORIZED);
      reply.errorCode!.should.not.equal(ErrorCode.INTERNAL_ERROR);

      await User.update({ roles: [] }, { where: { id: MUTABLE } });
    });

    it('TS-36 · D-8: LOG_COMMANDS no imprime el payload de un caller rechazado', async () => {
      const previous = process.env.LOG_COMMANDS;
      process.env.LOG_COMMANDS = 'true';
      const info = sinon.spy(logger, 'info');
      try {
        await dispatch('clients.new', { name: 'SECRETO' }, SIN_FILA);

        // La traza sigue DESPUÉS de la compuerta: de un caller rechazado se registra quién y qué
        // método, nunca qué mandó.
        const lines = info.getCalls().map((call) => String(call.args[0]));
        lines.some((line) => line.includes('SECRETO')).should.be.false();
      } finally {
        if (previous === undefined) {
          delete process.env.LOG_COMMANDS;
        } else {
          process.env.LOG_COMMANDS = previous;
        }
      }
    });

    it('TS-37 · CA-17: dos despachos del mismo caller hacen DOS findByPk', async () => {
      const findByPk = sinon.spy(User, 'findByPk');

      await dispatch('clients.new', { name: 'X' }, EXT);
      await dispatch('clients.new', { name: 'X' }, EXT);

      // Sin cache: cachear reintroduciría los roles obsoletos con una ventana no medible.
      findByPk.callCount.should.equal(2);
    });

    it('TS-38 · un cambio de roles en la base aplica en el despacho SIGUIENTE', async () => {
      const antes = await dispatch('files.request-upload', uploadPayload, MUTABLE);
      antes.errorCode!.should.equal(ErrorCode.CALLER_NOT_AUTHORIZED);

      await User.update({ roles: ['internal-app'] }, { where: { id: MUTABLE } });

      const despues = await dispatch<{ id: number }>(
        'files.request-upload',
        uploadPayload,
        MUTABLE
      );
      // Es la propiedad que hace la revocación eventualmente consistente por el bus.
      despues.status.should.equal('success');

      await User.update({ roles: [] }, { where: { id: MUTABLE } });
    });
  });
});

describe('la compuerta de autorización · plano de consultas', () => {
  const QUERIES = queryRegistry.patterns();
  /**
   * Las consultas que YA TIENEN CONTRATO: `tasks` desde S-022, `clients`, `projects` y
   * `requirements` desde S-024, `comments`, `activity` y `subscriptions` desde S-025, los seis
   * de S-026 —`people`, `users`, los tres de tiempo y `project-permissions`—, los dos de S-027, y
   * los TRES CON FORMA PROPIA de S-028.
   *
   * SON LAS VEINTITRÉS, y por eso el array es el registro entero: desde S-028 ningún patrón
   * registrado cae en un stub sin contrato —el stub ya no existe—. Se conserva como lista explícita
   * —y no como `QUERIES`— porque lo que afirma es lo que el CONTRATO promete, no lo que el registro
   * contiene.
   */
  const WITH_CONTRACT = [
    'clients.list',
    'clients.get',
    'projects.list',
    'projects.get',
    'requirements.list',
    'requirements.get',
    'tasks.list',
    'tasks.get',
    'comments.list',
    'comments.get',
    'activity.list',
    'subscriptions.list',
    // Los dos de S-027: ídem, `queries: ALL` ya los autoriza y `ROLE_METHODS` no cambió.
    'attachments.list',
    'files.get',
    // Los seis de S-026: `queries: ALL` ya los autoriza, así que `ROLE_METHODS` no cambió.
    'people.list',
    'users.list',
    'worked-times.list',
    'unworked-times.list',
    'week-assigned-times.list',
    'project-permissions.list',
    // LOS TRES DE S-028, que cierran el contrato. QUEDAN AUTORIZADOS SIN TOCAR `ROLE_METHODS`, y es
    // intencional: `admin`, `user` y `external-user` tienen `queries: ALL`, y la consecuencia —una
    // consulta nueva queda autorizada para los tres sin tocar el mapa— ES la intención de "todas las
    // consultas" que declara `docs/apis/core.yaml`.
    'requirements.tags',
    'settings.list',
    'meta.describe',
  ];
  const USER_ROLE = 'sub-persona-user';
  const EXTERNAL_USER_ROLE = 'sub-persona-external-user';

  before(async () => {
    await User.bulkCreate([
      {
        id: EXT,
        name: 'Conector',
        username: 'conector-q',
        email: 'conector-q@test.local',
        roles: ['internal-app'],
      },
      {
        id: ADM,
        name: 'Persona Admin',
        username: 'admin-q2',
        email: 'admin-q2@test.local',
        roles: ['admin'],
      },
      {
        id: USER_ROLE,
        name: 'Persona User',
        username: 'user-q',
        email: 'user-q@test.local',
        roles: ['user'],
      },
      {
        id: EXTERNAL_USER_ROLE,
        name: 'Persona Externa',
        username: 'external-user-q',
        email: 'external-user-q@test.local',
        roles: ['external-user'],
      },
    ]);
  });

  after(async () => {
    await User.destroy({ where: {} });
  });

  afterEach(() => {
    sinon.restore();
  });

  /**
   * TS-39 CAMBIA EN S-023, Y ES UNO DE LOS TRES CAMBIOS DE ASERCIÓN DE TODA ESA STORY.
   *
   * Hasta S-022 este test afirmaba que el caller exento atravesaba las 6 consultas SIN TOCAR LA
   * BASE (`findByPk === 0`), porque la única compuerta del plano era la del MÉTODO y su exención
   * cortocircuitaba antes de leer. Desde S-023 hay una SEGUNDA compuerta —la de la CLASE del
   * caller— que responde otra pregunta ("¿qué le recorto?") y NO EXIME A NADIE, la api incluida
   * (CA-8): en consultas el exento también paga el `SELECT`.
   *
   * La consecuencia se parte en dos casos, y los dos se afirman acá:
   *
   *   SIN fila -> pasa la compuerta 1 por exención y FALLA la 2 con `unknown_caller`. Es el
   *               escenario real de producción cuando se pierde el evento de autenticación de la
   *               api (NATS sin JetStream), y es exactamente lo que CA-8 y CA-9 describen.
   *   CON fila -> las atraviesa las 6, igual que siempre.
   *
   * Su contraparte del plano de COMANDOS —TS-33, "el camino EXENTO no loguea nada y no toca la
   * base"— NO cambia y sigue verde: allá la exención corta antes del lookup porque no hay clase
   * que resolver. Esa asimetría ES el diseño de la story: dos preguntas, dos compuertas.
   */
  it('TS-39 · CA-8/CA-9: el caller exento SIN fila pasa la compuerta 1 y falla la 2', async () => {
    for (const query of QUERIES) {
      const reply = await dispatchQuery(query, {});

      // NUNCA `caller_not_authorized`: la compuerta 1 lo dejó pasar por exención. Y nunca
      // `items: []`, que se leería como "no hay datos".
      reply.status.should.equal('failure', query);
      reply.errorCode!.should.equal(ErrorCode.UNKNOWN_CALLER, query);
      reply.errorCode!.should.not.equal(ErrorCode.CALLER_NOT_AUTHORIZED, query);
    }
  });

  it('TS-39b · con fila, el caller exento atraviesa TODAS las consultas registradas', async () => {
    await User.create({
      id: getTrustedPublisherId(),
      name: 'Publicador Confiable',
      username: 'trusted-auth-q',
      email: 'trusted-auth-q@test.local',
      roles: ['internal-app'],
    });
    try {
      for (const query of QUERIES) {
        const reply = await dispatchQuery(query, {});

        if (WITH_CONTRACT.includes(query)) {
          // ESTAS TIENEN contrato (S-022 y S-024): la prueba de que las compuertas las dejaron
          // pasar es que la respuesta viene DEL OTRO LADO de ellas. Un `list` con `{}` devuelve la
          // colección; un `get` con `{}` devuelve `invalid_fields` porque le falta el `id`.
          reply.errorCode?.should.not.equal(ErrorCode.CALLER_NOT_AUTHORIZED, query);
          reply.errorCode?.should.not.equal(ErrorCode.UNKNOWN_CALLER, query);
          reply.errorCode?.should.not.equal(ErrorCode.UNKNOWN_COMMAND, query);
        } else {
          // RAMA INALCANZABLE DESDE S-028 y se deja a propósito: el registro tiene los 23 del
          // contrato y ninguno más. Un patrón registrado que NO estuviera en `WITH_CONTRACT` caería
          // acá, y como el stub ya no existe la aserción falla — que es exactamente lo que se
          // quiere: registrar un endpoint sin ficha tiene que ser ruidoso.
          throw new Error(`${query} está registrada y no figura en el contrato`);
        }
      }
    } finally {
      await User.destroy({ where: { id: getTrustedPublisherId() } });
    }
  });

  it('TS-40 · un conector SÍ consulta, en TODAS las registradas', async () => {
    for (const query of QUERIES) {
      const reply = await dispatchQuery(query, {}, EXT);

      // ESTE TEST AFIRMABA LO CONTRARIO: el rol `external-publisher` no leía NADA —"publica
      // comandos, no lee"— y la compuerta lo repetía después del transporte. `internal-app`
      // consulta los 16 recursos, y además cae en la clase `connector`, que NO RECORTA FILAS.
      //
      // Lo que se afirma acá es que la compuerta 1 lo deja pasar: el reply puede ser un
      // `invalid_fields` del contrato (un payload vacío no sirve para todas), pero NUNCA un
      // `caller_not_authorized`.
      (reply.errorCode === ErrorCode.CALLER_NOT_AUTHORIZED).should.be.false(query);
      (reply.errorCode === ErrorCode.UNKNOWN_CALLER).should.be.false(query);
    }
  });

  it('TS-41 · los roles de producto SÍ consultan', async () => {
    for (const caller of [ADM, USER_ROLE, EXTERNAL_USER_ROLE]) {
      const reply = await dispatchQuery('tasks.get', {}, caller);

      // DESDE S-022 `tasks.get` tiene contrato, así que un payload sin `id` ya no muere en el
      // stub sino en la validación del contrato. Lo que este test afirma no cambia: que la
      // compuerta los DEJÓ PASAR, y `invalid_fields` solo se emite del otro lado de ella.
      reply.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
      reply.errorCode!.should.not.equal(ErrorCode.CALLER_NOT_AUTHORIZED);
    }
  });

  it('TS-42 · CA-7 en consultas: sin fila → rechazo, con el MISMO mensaje', async () => {
    // El payload da igual: la compuerta corre ANTES de validar el contrato, y desde S-025
    // `comments.list` tiene uno.
    const reply = await dispatchQuery('comments.list', {}, SIN_FILA);

    reply.should.deepEqual({
      status: 'failure',
      errorCode: 'caller_not_authorized',
      errorMessage: 'El caller no está autorizado a ejecutar este método',
    });
  });

  it('TS-43 · CA-6: la compuerta corre ANTES de registry.resolve()', async () => {
    const reply = await dispatchQuery('widgets.list', {}, SIN_FILA);

    reply.errorCode!.should.equal(ErrorCode.CALLER_NOT_AUTHORIZED);
    reply.errorCode!.should.not.equal(ErrorCode.UNKNOWN_COMMAND);
  });

  it('TS-44 · CA-6: la compuerta no abre transacción en NINGUNA de las dos conexiones', async () => {
    const writeTx = sinon.spy(sequelize, 'transaction');
    const readTx = sinon.spy(readDb, 'transaction');

    await dispatchQuery('tasks.list', {}, SIN_FILA);
    await dispatchQuery('tasks.list', {}, ADM);

    // Espiar solo una dejaría pasar el error más probable: abrir la transacción en la conexión
    // equivocada. Es la misma razón que el test existente ya dejó escrita.
    writeTx.callCount.should.equal(0);
    readTx.callCount.should.equal(0);
  });

  it('TS-45 · D-5: la compuerta NO usa ctx.db — lee por la conexión del dueño', async () => {
    // Si la compuerta leyera por `ctx.db`, este objeto falso haría estallar la lectura.
    const fakeDb = { marker: 'fake' } as unknown as Sequelize;
    let executed = false;
    const dispatcher = new QueryDispatcher(
      new QueryRegistry().register({
        pattern: 'tasks.list',
        // `validate` permisivo: la interfaz lo exige desde S-022 y este doble no valida nada.
        validate: (payload: unknown) => ({ value: payload }),
        execute: () => {
          executed = true;
          return Promise.resolve(success());
        },
      }),
      fakeDb
    );

    const reply = await dispatcher.dispatch(querySubject('tasks.list', ADM), {});

    executed.should.be.true();
    reply.status.should.equal('success');
  });
});

/**
 * S-023 · Las dos mitades de la compuerta, por separado.
 *
 * El refactor de la Tarea 1 existe para que el plano de CONSULTAS pueda hacer UN SOLO `SELECT`
 * (CA-5) y alimentar con él las dos compuertas: la de método (S-017) y la de clase (S-023). Acá
 * se ejercitan las dos piezas nuevas en aislamiento; que `authorizeCaller` siga comportándose
 * exactamente igual lo prueban los tests de arriba, que NO se tocaron.
 */
describe('S-023 · readCallerRoles / authorizeWithRoles — la lectura y la decisión, separadas', () => {
  const ROLES_ROW = 'sub-s023-roles';
  const ROLES_RAROS = 'sub-s023-jsonb-raro';

  before(async () => {
    await User.bulkCreate([
      {
        id: ROLES_ROW,
        name: 'Con Roles',
        username: 'roles-s023',
        email: 'roles-s023@test.local',
        roles: ['admin', 'user'],
      },
      {
        id: ROLES_RAROS,
        name: 'Roles Raros',
        username: 'raros-s023',
        email: 'raros-s023@test.local',
      },
    ]);
  });

  after(async () => {
    await User.destroy({ where: { id: [ROLES_ROW, ROLES_RAROS] } });
  });

  afterEach(() => {
    sinon.restore();
  });

  it('`readCallerRoles` devuelve los roles de la fila, tal cual', async () => {
    (await readCallerRoles(ROLES_ROW)).should.deepEqual(['admin', 'user']);
  });

  it('`readCallerRoles` de un caller SIN fila devuelve `[]`, no null', async () => {
    (await readCallerRoles(SIN_FILA)).should.deepEqual([]);
  });

  it('`readCallerRoles` con un `roles` que NO es array devuelve `[]` (falla cerrada)', async () => {
    // La columna es JSONB sin CHECK y la tabla es escribible por SQL: el caso es alcanzable.
    await sequelize.query(`UPDATE users SET roles = '{"a":1}'::jsonb WHERE id = :id`, {
      replacements: { id: ROLES_RAROS },
    });

    (await readCallerRoles(ROLES_RAROS)).should.deepEqual([]);

    await User.update({ roles: [] }, { where: { id: ROLES_RAROS } });
  });

  it('`readCallerRoles` NO captura: un fallo del pool SUBE a quien la llama', async () => {
    // Quien la invoca decide qué hacer con el fallo, y en los dos planos ese "quien" ya tiene su
    // try/catch. Capturar acá devolvería `[]` y convertiría una base caída en un rechazo mudo.
    sinon.stub(User, 'findByPk').rejects(new Error('pool agotado'));
    let thrown: Error | null = null;

    try {
      await readCallerRoles(ROLES_ROW);
    } catch (error) {
      thrown = error as Error;
    }

    (thrown === null).should.be.false();
    thrown!.message.should.equal('pool agotado');
  });

  it('`authorizeWithRoles` NO toca la base: la lectura ya la hizo quien la llama', () => {
    const findByPk = sinon.spy(User, 'findByPk');

    authorizeWithRoles(ROLES_ROW, ['admin'], 'tasks.list', 'queries');

    findByPk.callCount.should.equal(0);
  });

  it('`authorizeWithRoles` conserva la exención del publicador confiable, con roles vacíos', () => {
    // La exención se vuelve a evaluar acá —una comparación de strings, no una lectura— para que
    // siga siendo una propiedad de la COMPUERTA y no del orden de las llamadas.
    (authorizeWithRoles(getTrustedPublisherId(), [], 'clients.new', 'commands') === null)
      .should.be.true();
    (authorizeWithRoles(getTrustedPublisherId(), [], 'tasks.list', 'queries') === null)
      .should.be.true();
  });

  it('`authorizeWithRoles` devuelve el MISMO rechazo de siempre cuando ningún rol autoriza', () => {
    const denied = authorizeWithRoles('otro', [], 'clients.new', 'commands');

    denied!.should.deepEqual({
      status: 'failure',
      errorCode: 'caller_not_authorized',
      errorMessage: 'El caller no está autorizado a ejecutar este método',
    });
  });

  it('`authorizeWithRoles` autoriza cuando un rol alcanza, y loguea SOLO en el rechazo', () => {
    const warn = sinon.spy(logger, 'warn');

    (authorizeWithRoles(ROLES_ROW, ['admin'], 'tasks.list', 'queries') === null).should.be.true();
    warn.called.should.be.false();
    // Desde S-030 `admin` TAMBIÉN autoriza `clients.new`, así que el caso autorizado tiene ahora
    // dos ejemplos y el rechazo hay que buscarlo en un rol que de verdad no escriba.
    (authorizeWithRoles(ROLES_ROW, ['admin'], 'clients.new', 'commands') === null).should.be.true();
    warn.called.should.be.false();

    authorizeWithRoles(ROLES_ROW, ['bus-observer'], 'clients.new', 'commands');

    warn.callCount.should.equal(1);
    const message = String(warn.firstCall.args[0]);
    message.should.startWith('[auth]');
    message.should.containEql(ROLES_ROW);
    message.should.containEql('clients.new');
  });
});
