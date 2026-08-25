import 'mocha';
import 'should';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { User } from '@jiku/models';
import { endpointName, endpointSubject } from '@jiku/nats-protocol';
import { readDb } from '../../src/models/read';
import { QueryDispatcher } from '../../src/queries/dispatcher';
import { queryRegistry } from '../../src/queries';

/**
 * Los 6 patrones, COPIADOS de la tabla del contrato (API Context del plan de S-013), no
 * recalculados con `endpointName`/`endpointSubject`. Recalcularlos verificaría que el paquete es
 * consistente consigo mismo; copiarlos verifica que el servicio expone lo que el contrato promete.
 */
const CONTRACT_PATTERNS = [
  'projects.list',
  'projects.get',
  'tasks.list',
  'tasks.get',
  'comments.list',
  'comments.get',
];

/**
 * Los que SIGUEN SIN CONTRATO después de S-022.
 *
 * S-022 le dio contrato a `tasks.list` y `tasks.get`; `projects` llega con S-024 y `comments` con
 * S-025. `src/queries/pending.ts` se elimina recién en S-028, cuando este array quede vacío.
 */
const PENDING_PATTERNS = ['projects.list', 'projects.get', 'comments.list', 'comments.get'];

const REPO_ROOT = join(__dirname, '..', '..', '..');

describe('queries/index — el registry poblado', () => {
  before(async () => {
    // Desde S-017 el despachador de consultas autoriza al caller del subject ANTES de resolver el
    // método, y TS-19 entra por el despachador real con `dev.api.jiku-queries.v1.…`. El subject NO
    // CAMBIA —la aserción es sobre el stub sin contrato, no sobre el caller—: lo que se agrega es
    // la fila que la compuerta va a encontrar. `admin` autoriza TODAS las consultas y NINGÚN
    // comando, que es exactamente lo que este archivo necesita.
    await User.destroy({ where: { id: 'api' } });
    await User.create({
      id: 'api',
      name: 'Api',
      username: 'api-qr',
      email: 'api-qr@test.local',
      roles: ['admin'],
    });
  });

  after(async () => {
    await User.destroy({ where: { id: 'api' } });
  });

  it('TS-13 · los 6 patrones del registry, exactos y en el orden del contrato', () => {
    queryRegistry.patterns().should.deepEqual(CONTRACT_PATTERNS);
  });

  it('TS-14 · ningún patrón de consulta lleva {param}, y por eso NO hay * en los subjects', () => {
    for (const pattern of queryRegistry.patterns()) {
      pattern.should.not.containEql('{');
      pattern.should.not.containEql('}');
      // Sin params, `endpointSubject` es la identidad: ningún `*` después del prefijo del grupo.
      // Es una decisión de PERFORMANCE (el cache de subjects de 1024 entradas del server), no un
      // olvido: el id del recurso viaja en el payload.
      endpointSubject(pattern).should.equal(pattern);
      endpointName(pattern).should.equal(pattern.replace('.', '-'));
    }
  });

  it('TS-19 · los endpoints sin contrato contestan un failure BIEN FORMADO, con cualquier payload', async () => {
    const dispatcher = new QueryDispatcher(queryRegistry, readDb);

    for (const pattern of PENDING_PATTERNS) {
      for (const payload of [{}, { id: 7, limit: 50 }]) {
        const reply = await dispatcher.dispatch(
          `dev.api.jiku-queries.v1.${pattern}`,
          payload
        );

        const label = `${pattern} <- ${JSON.stringify(payload)}`;
        reply.status.should.equal('failure', label);
        reply.errorCode!.should.equal('unknown_command', label);
        reply.errorMessage!.should.equal(
          `La consulta ${pattern} todavía no tiene contrato definido`,
          label
        );
        // Nunca datos inventados: sin contrato, `data` no existe.
        (reply.data === undefined).should.be.true(label);
      }
    }
  });

  it('TS-20 · ningún archivo de queries/ importa el ORM ni la conexión', () => {
    // Es lo que hace que la inyección de la conexión sea real y que CA-7 valga para el módulo
    // entero, no solo para `read.ts`. ESTE CANDADO NO SE AFLOJA NUNCA: es ADR-001 y ADR-005, y
    // el motor de S-022 lee con SQL explícito sobre la conexión que le llega por el contexto.
    for (const forbidden of [/@jiku\/models/, /models\/read/, /from '\.\.\/models/]) {
      matchesInCode(forbidden).should.deepEqual([]);
    }
  });

  it('queries/ no lee process.env: todo lo variable llega inyectado', () => {
    // LO QUE QUEDA DEL CANDADO DE ALCANCE DE S-013. Aquel test también prohibía `joi` y
    // `QueryTypes`, y era correcto MIENTRAS no hubiera contrato: su comentario decía que su
    // aparición significaría que la story se corrió a escribir el contrato que RF-10 dejaba para
    // el REQ siguiente. S-022 ES ese REQ, así que las dos prohibiciones se retiran acá —Joi valida
    // la forma exterior y `QueryTypes.SELECT` es cómo se ejecuta el SQL explícito—.
    //
    // `process.env` SIGUE PROHIBIDO, y esa mitad no tiene fecha de vencimiento: el presupuesto de
    // bytes y la conexión llegan por el contexto, y leerlos del entorno acá volvería a atar el
    // módulo a un arranque en vez de a una request.
    matchesInCode(/process\.env/).should.deepEqual([]);
  });
});

/** Todos los `.ts` de `core/src/queries/`. */
function queryFiles(dir = join(REPO_ROOT, 'core', 'src', 'queries')): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      return queryFiles(full);
    }
    return entry.name.endsWith('.ts') ? [full] : [];
  });
}

/**
 * Los archivos de `queries/` cuyo CÓDIGO —sin comentarios— matchea el patrón.
 *
 * El candado va sobre código y no sobre el texto crudo porque los comentarios de los seis stubs
 * están OBLIGADOS por el criterio 5 de la Tarea 4 a nombrar `ctx.db.query(...)`, `QueryTypes` y
 * la traducción de vocabulario: es la ubicación que la story le deja al REQ del contrato. Un grep
 * sobre el texto crudo fallaría por esos comentarios, o sea por la razón equivocada.
 */
function matchesInCode(pattern: RegExp): string[] {
  return queryFiles().filter((file) => {
    const code = readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    return pattern.test(code);
  });
}
