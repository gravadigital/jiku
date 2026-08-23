import 'should';

import { reload } from './helpers/reload';

describe('nats-protocol · infraestructura de tests', () => {
  it('reload() devuelve el default cuando la variable no está definida', () => {
    reload({}).INSTANCE.should.equal('dev');
  });

  it('reload() devuelve el override cuando la variable está definida', () => {
    reload({ NATS_INSTANCE: 'prod' }).INSTANCE.should.equal('prod');
  });

  it('reload() restaura el entorno al salir', () => {
    // Sin esto un `reload` filtra estado al test siguiente y los fallos aparecen según el
    // orden de ejecución, que es el peor modo de falla de una suite.
    const before = process.env.NATS_INSTANCE;
    reload({ NATS_INSTANCE: 'prod' });
    (process.env.NATS_INSTANCE === before).should.be.true();
  });
});

describe('nats-protocol · los dos nombres de servicio', () => {
  it('TS-1: COMMAND_SERVICE toma el default nuevo', () => {
    reload({}).COMMAND_SERVICE.should.equal('jiku-commands');
  });

  it('TS-2: COMMAND_SERVICE respeta NATS_COMMAND_SERVICE', () => {
    reload({ NATS_COMMAND_SERVICE: 'otro-commands' }).COMMAND_SERVICE.should.equal('otro-commands');
  });

  it('TS-3: QUERY_SERVICE toma el default nuevo', () => {
    reload({}).QUERY_SERVICE.should.equal('jiku-queries');
  });

  it('TS-4: QUERY_SERVICE respeta NATS_QUERY_SERVICE', () => {
    reload({ NATS_QUERY_SERVICE: 'otro-queries' }).QUERY_SERVICE.should.equal('otro-queries');
  });

  it('TS-5: los dos servicios son distintos por default', () => {
    const p = reload({});
    [p.COMMAND_SERVICE, p.QUERY_SERVICE].should.eql(['jiku-commands', 'jiku-queries']);
    (p.COMMAND_SERVICE !== p.QUERY_SERVICE).should.be.true();
  });

  it('TS-6: una variable vacía cae al default, no produce un token vacío', () => {
    // El operador tiene que ser `||`, no `??`: con `??` un `NATS_COMMAND_SERVICE=` en un .env
    // produciría `dev.u1..v1.clients.new`, un token vacío que NATS rechaza.
    reload({ NATS_COMMAND_SERVICE: '' }).COMMAND_SERVICE.should.equal('jiku-commands');
  });
});

describe('nats-protocol · subjects de comandos, consultas y grupo', () => {
  it('TS-10: commandSubject() — firma igual, valor nuevo', () => {
    reload({})
      .commandSubject('clients.new', '323332022539911171')
      .should.equal('dev.323332022539911171.jiku-commands.v1.clients.new');
  });

  it('TS-11: commandSubject() con un id concreto en el medio del método', () => {
    reload({})
      .commandSubject('tasks.88.edit', '323332022539911171')
      .should.equal('dev.323332022539911171.jiku-commands.v1.tasks.88.edit');
  });

  it('TS-12: commandSubject() respeta NATS_INSTANCE y NATS_PROTOCOL_VERSION', () => {
    reload({ NATS_INSTANCE: 'prod', NATS_PROTOCOL_VERSION: 'v2' })
      .commandSubject('clients.new', 'u1')
      .should.equal('prod.u1.jiku-commands.v2.clients.new');
  });

  it('TS-13: commandSubject() sigue el override del servicio de comandos', () => {
    reload({ NATS_COMMAND_SERVICE: 'otro-commands' })
      .commandSubject('clients.new', 'u1')
      .should.equal('dev.u1.otro-commands.v1.clients.new');
  });

  it('TS-14: querySubject() produce el token de consultas', () => {
    reload({})
      .querySubject('tasks.list', '323332022539911171')
      .should.equal('dev.323332022539911171.jiku-queries.v1.tasks.list');
  });

  it('TS-15: querySubject() con los seis métodos de lectura declarados', () => {
    const p = reload({});
    const methods = [
      'projects.list',
      'projects.get',
      'tasks.list',
      'tasks.get',
      'comments.list',
      'comments.get',
    ];
    methods
      .map((m) => p.querySubject(m, 'u1'))
      .should.eql([
        'dev.u1.jiku-queries.v1.projects.list',
        'dev.u1.jiku-queries.v1.projects.get',
        'dev.u1.jiku-queries.v1.tasks.list',
        'dev.u1.jiku-queries.v1.tasks.get',
        'dev.u1.jiku-queries.v1.comments.list',
        'dev.u1.jiku-queries.v1.comments.get',
      ]);
  });

  it('TS-16: el token {svc} de una consulta no es el de un comando', () => {
    // Los tokens de subject se comparan enteros: es lo que hace la separación efectiva.
    const p = reload({});
    const q = p.querySubject('tasks.list', 'u1').split('.')[2];
    const c = p.commandSubject('tasks.list', 'u1').split('.')[2];
    q.should.equal('jiku-queries');
    c.should.equal('jiku-commands');
    (q !== c).should.be.true();
  });

  it('TS-17: comando y consulta del mismo método difieren solo en el token {svc}', () => {
    const p = reload({});
    const command = p.commandSubject('tasks.list', 'u1').split('.');
    const query = p.querySubject('tasks.list', 'u1').split('.');
    command.length.should.equal(query.length);
    const differing = command.map((_, i) => i).filter((i) => command[i] !== query[i]);
    differing.should.eql([2]);
  });

  it('TS-18: groupSubject(COMMAND_SERVICE)', () => {
    const p = reload({});
    p.groupSubject(p.COMMAND_SERVICE).should.equal('dev.*.jiku-commands.v1');
  });

  it('TS-19: groupSubject(QUERY_SERVICE)', () => {
    const p = reload({});
    p.groupSubject(p.QUERY_SERVICE).should.equal('dev.*.jiku-queries.v1');
  });

  it('TS-20: groupSubject() respeta instancia y versión', () => {
    reload({ NATS_INSTANCE: 'prod', NATS_PROTOCOL_VERSION: 'v2' })
      .groupSubject('jiku-commands')
      .should.equal('prod.*.jiku-commands.v2');
  });

  it('TS-21: groupSubject() pone * en el user id, no el user id', () => {
    reload({}).groupSubject('jiku-commands').split('.')[1].should.equal('*');
  });
});
