import 'mocha';
import 'should';
import * as fs from 'fs';
import * as path from 'path';
import { ROLE_METHODS } from '../../src/authorize-caller';
import { registry } from '../../src/commands';

/**
 * LA PARIDAD DEL MAPA ROL → COMANDO CONTRA `docs/apis/api.yaml`.
 *
 * ES LA MITIGACIÓN (c) DEL RIESGO CRÍTICO DE S-030, escrita como test: *"un test de paridad por
 * rol que recorra el mapa contra el `x-roles` del spec"*.
 *
 * SIN ESTE ARCHIVO, la enumeración de `ROLE_METHODS` es una lista escrita a mano que nadie vuelve
 * a verificar. El día que alguien agregue un endpoint —o le cambie el `x-roles`— la divergencia
 * NO SE NOTA hasta que S-034 elimine la regla de la api y ese rol deje de poder escribir. El
 * síntoma sería *"nadie puede hacer nada"* con una causa de hace semanas.
 *
 * NO ENTRA POR `dispatch()`, y la convención `testing` no lo pide: es un test ESTRUCTURAL sobre un
 * documento, del mismo género que `queries/contract-spec.test.ts`. Vive bajo `tests/auth/` con los
 * otros gates del mapa porque esa carpeta corre primero y ese orden es parte del contrato.
 *
 * NO USA UN PARSER DE YAML, Y ES DELIBERADO: el repo no tiene uno en `core` y agregar una
 * dependencia por un test es desproporcionado. El spec tiene indentación regular y
 * `contract-spec.test.ts` ya sienta el precedente de leerlo con regex sobre el texto. Si algún día
 * la indentación del spec cambia, el gate de "el spec declara N comandos" de más abajo se pone
 * rojo antes de que la comparación empiece a mentir.
 */

/** El spec vive en la raíz del repo, no en `core/`. Ruta RELATIVA a `__dirname`, nunca absoluta. */
const API_SPEC = path.join(__dirname, '../../../docs/apis/api.yaml');

/** Los tres roles de producto: los únicos cuya enumeración se deriva del spec. */
const PRODUCT_ROLES = ['admin', 'user', 'external-user'] as const;
type ProductRole = (typeof PRODUCT_ROLES)[number];

/**
 * EL COMANDO 21 SE EXCLUYE EXPLÍCITAMENTE, y sin esta línea el test estaría rojo HOY.
 *
 * `week-assigned-times.replace` ya está declarado en `docs/apis/api.yaml` (con `x-roles: [admin]`)
 * pero TODAVÍA NO ESTÁ EN EL REGISTRY de `core`: el comando 21 nace en S-032, y su entrada en el
 * mapa —`admin` solamente, C-38— se agrega ahí. Comparar contra el spec sin excluirlo haría
 * fallar este test por algo que otra story tiene que hacer.
 */
const NOT_YET_IMPLEMENTED = 'week-assigned-times.replace';

/**
 * Un endpoint que publica un comando: sus roles declarados, o `null` si NO declara ninguno.
 *
 * `null` NO ES lo mismo que `[]`: es "el endpoint no lleva `hasAnyRole`", que es la deuda que la
 * regla (b) traduce. Un `[]` sería "declara explícitamente que ningún rol lo alcanza", que no
 * ocurre en el spec.
 */
interface Publisher {
  readonly command: string;
  readonly roles: readonly string[] | null;
}

/**
 * LOS CUATRO COMANDOS CUYO PUBLICADOR NO ESTÁ EN EL SPEC, declarados acá COMO DATO DEL TEST.
 *
 * El spec no les pone `x-bus-command` porque son endpoints de ADJUNTOS: publican un comando de
 * `files`/`attachments` como paso interno de una operación cuyo contrato HTTP es otro (subir un
 * archivo, previsualizarlo, borrar un vínculo). El `x-bus-command` del spec documenta la
 * correspondencia 1:1 endpoint → comando, y acá no la hay.
 *
 * LOS ROLES SALEN DEL CÓDIGO DE LA RUTA, no del spec: son el `hasAnyRole` que cada archivo declara
 * (o su ausencia). Verificados con `grep` sobre `api/lib/routes/` — si alguna de esas rutas cambia
 * su `hasAnyRole`, ESTA TABLA HAY QUE ACTUALIZARLA A MANO, que es el precio de que el spec no las
 * declare.
 *
 * `requirements.{id}.resolve` NO FIGURA ACÁ Y NO ES UN OLVIDO: no lo publica NINGUNA ruta HTTP
 * (`docs/apis/core.yaml`: "NO HTTP ROUTE PUBLISHES IT — but the rule IS enforced"). Su ausencia
 * total es lo que dispara la regla (c).
 *
 * ============================================================================================
 * Y ACÁ VIVEN TAMBIÉN LOS COMANDOS SECUNDARIOS, QUE SON EL AGUJERO QUE ESTA TABLA TAPA
 * ============================================================================================
 *
 * Una ruta puede publicar MÁS DE UN COMANDO. El `x-bus-command` del spec documenta la
 * correspondencia 1:1 endpoint → comando, así que el SEGUNDO no aparece en ningún lado del spec
 * y una derivación que mire solo `x-bus-command` LO PIERDE.
 *
 * NO ES HIPOTÉTICO: pasó al escribir S-030. `POST /api/opus/requirements` publica
 * `requirements.new` y después `requirements.{id}.subscriptors.new` —el creador queda suscripto
 * siempre—, y omitirlo dejaba a todo `user` sin poder crear un requisito por el portal. Lo
 * detectó la suite de la api, no este test, porque este test tenía el mismo punto ciego.
 *
 * SI AGREGÁS UNA RUTA QUE PUBLIQUE UN COMANDO SECUNDARIO, VA ACÁ.
 */
const PUBLISHERS_FROM_CODE: readonly Publisher[] = [
  // api/lib/routes/attachments-delete.ts:90 — sin `hasAnyRole`; autoriza por entidad en el handler
  { command: 'attachments.{id}.delete', roles: null },
  // api/lib/routes/attachments-post.ts:56 — sin `hasAnyRole`
  { command: 'files.request-upload', roles: null },
  // api/lib/routes/opus-attachments-post.ts:52 — hasAnyRole(['user','external-user'])
  { command: 'files.request-upload', roles: ['user', 'external-user'] },
  // api/lib/routes/attachments-download.ts:67 — sin `hasAnyRole`
  { command: 'files.{fileId}.request-download', roles: null },
  // api/lib/routes/attachments-preview.ts:67 — sin `hasAnyRole`
  { command: 'files.{fileId}.request-download', roles: null },
  // api/lib/routes/files-preview.ts:38 — sin `hasAnyRole`
  { command: 'files.{fileId}.request-download', roles: null },
  // api/lib/routes/opus-attachments-preview.ts:47 — hasAnyRole(['user','external-user'])
  { command: 'files.{fileId}.request-download', roles: ['user', 'external-user'] },
  // SECUNDARIO — api/lib/routes/opus-requirements-post.ts: la misma ruta que publica
  // `requirements.new` (y que el spec SÍ declara) publica después la suscripción del creador.
  // hasAnyRole(['user','external-user']).
  { command: 'requirements.{id}.subscriptors.new', roles: ['user', 'external-user'] },
];

/**
 * Lee el spec y devuelve un publicador por cada operación HTTP que declara `x-bus-command`.
 *
 * Una operación arranca en `    {verbo}:` con exactamente 4 espacios y sus claves llevan 6; una
 * línea de path (`  /ruta:`) cierra la operación anterior. Es la misma forma que el resto del
 * archivo, y el gate de conteo de más abajo la protege.
 */
function readPublishersFromSpec(): Publisher[] {
  const OPERATION = /^ {4}(get|post|put|patch|delete):\s*$/;
  const PATH_KEY = /^ {2}\/\S*:\s*$/;
  const X_ROLES = /^ {6}x-roles:\s*\[([^\]]*)\]/;
  const X_COMMAND = /^ {6}x-bus-command:\s*(\S+)/;

  const publishers: Publisher[] = [];
  let roles: readonly string[] | null = null;
  let command: string | null = null;
  let inside = false;

  const flush = () => {
    if (inside && command) {
      publishers.push({ command, roles });
    }
    roles = null;
    command = null;
  };

  for (const line of fs.readFileSync(API_SPEC, 'utf8').split('\n')) {
    if (OPERATION.test(line)) {
      flush();
      inside = true;
      continue;
    }
    if (PATH_KEY.test(line)) {
      flush();
      inside = false;
      continue;
    }
    if (!inside) {
      continue;
    }

    const rolesMatch = X_ROLES.exec(line);
    if (rolesMatch) {
      roles = rolesMatch[1]
        .split(',')
        .map((role) => role.trim())
        .filter(Boolean);
    }
    const commandMatch = X_COMMAND.exec(line);
    if (commandMatch) {
      command = commandMatch[1];
    }
  }
  flush();

  return publishers;
}

/**
 * LA REGLA D-2, EJECUTABLE. Un rol `R` autoriza el comando `C` si y solo si:
 *
 *   (a) algún endpoint que publica `C` declara `x-roles` que contiene `R`; o
 *   (b) algún endpoint que publica `C` NO declara `x-roles` y `R` es `admin` o `user`; o
 *   (c) `C` no tiene NINGÚN endpoint que lo publique y `R` es `admin` o `user`.
 *
 * POR QUÉ (b) Y (c) RECORTAN A `external-user`, que es la decisión menos obvia del mapa y la que
 * alguien va a querer "corregir" leyendo solo el spec:
 *
 *   Un endpoint sin `hasAnyRole` es alcanzable por CUALQUIER usuario autenticado, incluido un
 *   `external-user` — y `docs/architectures/api/conventions/authorization.md` lo llama DEUDA con
 *   todas las letras: *"La ausencia no es una convención, es deuda."* Traducir esa deuda a un
 *   permiso DECLARADO del bus le daría a `external-user` escritura sobre clientes, proyectos,
 *   objetivos, horas y ausencias: trece comandos que NINGUNA pantalla del portal usa.
 *
 *   SE TRADUCE LA INTENCIÓN, NO LA DEUDA. Si algún día esas rutas declaran su rol, este test
 *   empieza a derivarlo por (a) y la regla (b) deja de tener a quién aplicarse sola.
 */
function derive(role: ProductRole, command: string, publishers: readonly Publisher[]): boolean {
  const mine = publishers.filter((p) => p.command === command);
  const isInternal = role === 'admin' || role === 'user';

  // (a)
  if (mine.some((p) => p.roles?.includes(role))) {
    return true;
  }
  // (b)
  if (isInternal && mine.some((p) => p.roles === null)) {
    return true;
  }
  // (c)
  return isInternal && mine.length === 0;
}

/** Los patrones que el mapa autoriza a un rol, por el canal que ese rol usa para escribir. */
function mapped(role: ProductRole): readonly string[] {
  const permissions = ROLE_METHODS[role];
  const allowed = permissions.envelopeCommands ?? permissions.commands;
  // Ninguno de los tres roles de producto tiene el sentinela `'*'`; si alguno lo ganara, este
  // test tiene que romperse ruidosamente y no comparar un string contra una lista.
  Array.isArray(allowed).should.be.true(
    `ROLE_METHODS['${role}'] no puede autorizar TODOS los comandos: la enumeración es el criterio`
  );
  return allowed as readonly string[];
}

describe('authorize-caller — la paridad del mapa con `docs/apis/api.yaml` (S-030, CA-1/CA-3)', () => {
  const publishers = [...readPublishersFromSpec(), ...PUBLISHERS_FROM_CODE];
  const commands = registry.patterns();

  it('TS-16 · el spec declara un comando que el registry todavía no tiene, y es EXACTAMENTE el 21', () => {
    const inSpec = new Set(readPublishersFromSpec().map((p) => p.command));
    const missing = [...inSpec].filter((command) => !commands.includes(command)).sort();

    // Si esta lista crece, alguien agregó un `x-bus-command` al spec sin registrar el comando —o
    // S-032 ya entregó y hay que sacar `week-assigned-times.replace` de la exclusión de arriba.
    missing.should.deepEqual([NOT_YET_IMPLEMENTED]);
  });

  it('TS-16b · el parser encontró publicadores en el spec (la indentación no cambió)', () => {
    // Un gate barato contra el modo de falla silencioso del regex: si el spec cambiara de forma,
    // `readPublishersFromSpec()` devolvería una lista vacía y la paridad "pasaría" comparando
    // nada contra nada. Este número solo puede bajar si un endpoint deja de publicar.
    readPublishersFromSpec().length.should.be.aboveOrEqual(20);
  });

  it('TS-15 · todo patrón del mapa existe en el registry — ni muerto ni con un typo', () => {
    for (const role of PRODUCT_ROLES) {
      for (const pattern of mapped(role)) {
        commands.includes(pattern).should.be.true(
          `ROLE_METHODS['${role}'] autoriza \`${pattern}\`, que NO está en registry.patterns(). ` +
            'O el patrón tiene un typo, o el comando no existe.'
        );
      }
    }
  });

  for (const role of PRODUCT_ROLES) {
    it(`TS-14 · \`${role}\`: el mapa coincide EXACTAMENTE con la derivación D-2 sobre el spec`, () => {
      const expected = commands
        .filter((command) => command !== NOT_YET_IMPLEMENTED)
        .filter((command) => derive(role, command, publishers))
        .sort();
      const actual = [...mapped(role)].sort();

      // EL MENSAJE DICE QUÉ ROL Y QUÉ COMANDO, no solo "deepEqual failed": el día que este test se
      // ponga rojo, quien lo lea tiene que poder decidir en un minuto si el error está en el mapa
      // o en el spec.
      const extra = actual.filter((command) => !expected.includes(command));
      const missing = expected.filter((command) => !actual.includes(command));
      extra.should.deepEqual(
        [],
        `ROLE_METHODS['${role}'] autoriza comandos que el spec NO le da: ${extra.join(', ')}`
      );
      missing.should.deepEqual(
        [],
        `ROLE_METHODS['${role}'] NO autoriza comandos que el spec SÍ le da: ${missing.join(', ')}. ` +
          'Si S-034 elimina la regla de la api, ese rol deja de poder escribirlos.'
      );
      actual.should.deepEqual(expected);
    });
  }

  it('TS-14b · los conteos derivados: 18 · 19 · 6 por el canal que cada rol usa', () => {
    // `user` tiene UNO MÁS que `admin`, y es `requirements.{id}.subscriptors.new`: se lo da el
    // comando SECUNDARIO de `POST /api/opus/requirements`, un endpoint que `admin` no alcanza.
    mapped('admin').length.should.equal(18);
    mapped('user').length.should.equal(19);
    mapped('external-user').length.should.equal(6);

    const soloDeUser = mapped('user').filter((c) => !mapped('admin').includes(c));
    soloDeUser.should.deepEqual(['requirements.{id}.subscriptors.new']);
  });

  it('TS-14c · el canal DIRECTO de `user` no incluye lo que solo alcanza por el sobre', () => {
    // LA PARIDAD DE ARRIBA SE MIDE SOBRE `envelopeCommands ?? commands`, que es el canal por el
    // que cada rol escribe HOY. Este test cubre la otra mitad: lo que un rol puede publicar
    // POR SU CUENTA, que es siempre un subconjunto y nunca más.
    //
    // `requirements.{id}.subscriptors.new` lo alcanza `user` SOLO porque la api lo publica en su
    // nombre. Su endpoint directo (`POST /opus/requirements/{reqid}/subscriptors`) es
    // `external-user` only, así que dárselo para publicar solo sería AMPLIAR.
    const directo = ROLE_METHODS['user'].commands as readonly string[];
    directo.length.should.equal(18);
    directo.includes('requirements.{id}.subscriptors.new').should.be.false();

    for (const role of PRODUCT_ROLES) {
      const own = ROLE_METHODS[role].commands as readonly string[];
      for (const pattern of own) {
        mapped(role).includes(pattern).should.be.true(
          `${role}: \`${pattern}\` está en el canal directo pero no en el del sobre`
        );
      }
    }
  });
});
