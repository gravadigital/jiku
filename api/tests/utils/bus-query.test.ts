import 'mocha';
import 'should';
import { QUERY_TIMEOUT_MS, REQUEST_TIMEOUT_MS, bus } from '../../lib/utils/bus';
import { commandSubject, querySubject } from '../../lib/utils/bus/protocol';
import { fakeBus } from '../mocks/bus';

/**
 * El cliente de consultas de la api (S-014, CA-6 a CA-9).
 *
 * Estos escenarios verifican las tres piezas de `query()` POR SEPARADO —el timeout, la
 * presencia del método y el subject— porque lo único que no se puede verificar acá es que
 * publique de verdad: eso necesita un NATS real y la suite de la api no levanta uno (el
 * `FakeBus` reemplaza al bus entero). Ver la nota de Test Scenarios del Story Plan.
 *
 * Van en `tests/utils/` porque no necesitan base de datos.
 */
describe('bus: el cliente de consultas (S-014)', () => {
  // TS-10: el timeout de consultas es PROPIO y más largo que el de comandos. El perfil es
  // opuesto: lecturas largas con joins contra escrituras cortas y transaccionales. Ninguna
  // de las dos variables está en `.env.test`, así que lo que se ejercita son los defaults.
  describe('el timeout de las consultas es propio y más largo (TS-10, CA-6)', () => {
    it('deja el timeout de comandos en 5000', () => {
      REQUEST_TIMEOUT_MS.should.equal(5000);
    });

    it('usa 10000 para las consultas', () => {
      QUERY_TIMEOUT_MS.should.equal(10000);
    });

    it('mantiene el de consultas estrictamente mayor que el de comandos', () => {
      QUERY_TIMEOUT_MS.should.be.above(REQUEST_TIMEOUT_MS);
    });
  });

  // TS-11: la interfaz `Bus` tiene DOS métodos, y el bus activo los expone. En la corrida de
  // tests el bus activo es el `FakeBus` (`tests/setup-env.ts`:31), así que esto verifica
  // también que el doble sigue implementando la interfaz completa.
  it('expone los dos métodos de la interfaz en el bus activo (TS-11, CA-6)', () => {
    (typeof bus().request).should.equal('function');
    (typeof bus().query).should.equal('function');
  });

  // TS-12: el subject de una consulta se arma con la función del paquete, nunca a mano
  // (RF-18). El token `{svc}` de las consultas es `jiku-queries`, distinto del de comandos.
  it('arma el subject de una consulta con querySubject (TS-12, CA-6)', () => {
    querySubject('tasks.list', '000000000000000001').should.equal(
      'dev.000000000000000001.jiku-queries.v1.tasks.list'
    );
  });

  // TS-15: `FakeBus.request()` sigue publicando en `jiku-commands` con el mismo helper que
  // usa en su línea de subject, que esta story NO toca (CA-9).
  it('deja el subject de los comandos en jiku-commands (TS-15, CA-9)', () => {
    commandSubject('clients.new', '000000000000000001').should.equal(
      'dev.000000000000000001.jiku-commands.v1.clients.new'
    );
  });

  describe('FakeBus.query() rechaza explícitamente (CA-8)', () => {
    // TS-13: sin contrato de consultas (RF-10) no hay nada que despachar, así que rechazar
    // nombrando la razón es lo honesto. Dejar el método sin implementar haría fallar los
    // tests con un `TypeError` en vez de por la razón real.
    it('rechaza nombrando que no hay contrato de consultas (TS-13)', async () => {
      let captured: Error | null = null;
      try {
        await fakeBus.query('tasks.list', {});
      } catch (error: any) {
        captured = error;
      }

      (captured === null).should.be.false();
      (captured as Error).should.be.an.instanceOf(Error);
      (captured as Error).name.should.not.equal('TypeError');
      (captured as Error).message.should.match(/contrato de consultas/i);
    });

    // TS-14: rechaza ANTES de registrar. Registrar sería mentir —nada se publicó— y
    // ensuciaría `fakeBus.sent`, que otros tests cuentan.
    it('no registra nada como publicado (TS-14)', async () => {
      fakeBus.reset();

      try {
        await fakeBus.query('tasks.list', {});
      } catch {
        // el rechazo es el comportamiento esperado; acá se mira `sent`
      }

      fakeBus.sent.length.should.equal(0);
    });
  });
});
