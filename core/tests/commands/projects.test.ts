import 'mocha';
import 'should';
import { Client, Project, User } from '@jiku/models';
import { dispatch } from '../helpers/dispatch';
import {
  keyValuePairsToProperties,
  propertiesToKeyValuePairs,
} from '../../src/commands/projects/properties';

const CREATOR = 'zitadel-sub-projects';

describe('projects', () => {
  before(() => {
    return User.create({
      id: CREATOR,
      name: 'Creador',
      username: 'creador',
      email: 'creador@mail.com',
    });
  });

  after(() => {
    return User.destroy({ where: { id: CREATOR } });
  });

  afterEach(() => {
    return Project.destroy({ where: {} }).then(() => Client.destroy({ where: {} }));
  });

  describe('projects.new', () => {
    it('crea un proyecto con los campos mínimos y aplica los defaults', () => {
      return dispatch<{ id: number }>('projects.new', {
        creator: CREATOR,
        name: 'Proyecto Uno',
        code: 'P-001',
      }).then((reply) => {
        reply.status.should.equal('success');
        reply.data!.id.should.be.a.Number();

        return Project.findByPk(reply.data!.id).then((project) => {
          project!.name.should.equal('Proyecto Uno');
          project!.code.should.equal('P-001');
          project!.status.should.equal('analisis');
          project!.type.should.equal('comercial');
          project!.createdBy.should.equal(CREATOR);
          project!.initDate.should.be.instanceof(Date);
        });
      });
    });

    it('guarda todos los campos cuando vienen', () => {
      return Client.create({ name: 'Cliente' }).then((client) => {
        return dispatch<{ id: number }>('projects.new', {
          creator: CREATOR,
          name: 'Proyecto Dos',
          code: 'P-002',
          status: 'activo',
          type: 'interno',
          description: 'Una descripción',
          initDate: '2026-01-15',
          endDate: '2026-12-31',
          clientId: client.id,
        }).then((reply) => {
          reply.status.should.equal('success');
          return Project.findByPk(reply.data!.id).then((project) => {
            project!.status.should.equal('activo');
            project!.type.should.equal('interno');
            project!.description.should.equal('Una descripción');
            project!.clientId.should.equal(client.id);
            project!.endDate.should.be.instanceof(Date);
          });
        });
      });
    });

    it('traduce properties a keyValuePairs', () => {
      return dispatch<{ id: number }>('projects.new', {
        creator: CREATOR,
        name: 'Proyecto Tres',
        code: 'P-003',
        properties: [
          { code: 'documentacion', value: 'https://docs.grava.io/p3' },
          { code: 'mattermost_group_name', value: 'equipo-p3' },
        ],
      }).then((reply) => {
        reply.status.should.equal('success');
        return Project.findByPk(reply.data!.id).then((project) => {
          const pairs = project!.keyValuePairs!;
          pairs.documentacion!.should.equal('https://docs.grava.io/p3');
          pairs.mattermost_group_name!.should.equal('equipo-p3');
        });
      });
    });

    it('falla si una property tiene un code desconocido', () => {
      return dispatch('projects.new', {
        creator: CREATOR,
        name: 'Proyecto',
        code: 'P-004',
        properties: [{ code: 'inventado', value: 'x' }],
      }).then((reply) => {
        reply.status.should.equal('failure');
        reply.errorCode!.should.equal('invalid_fields');
      });
    });

    it('falla si una property de URL no es una URI', () => {
      return dispatch('projects.new', {
        creator: CREATOR,
        name: 'Proyecto',
        code: 'P-005',
        properties: [{ code: 'documentacion', value: 'no-es-una-url' }],
      }).then((reply) => {
        reply.status.should.equal('failure');
        reply.errorCode!.should.equal('invalid_fields');
      });
    });

    it('falla sin creator', () => {
      return dispatch('projects.new', { name: 'Proyecto', code: 'P-006' }).then((reply) => {
        reply.status.should.equal('failure');
        reply.errorCode!.should.equal('invalid_fields');
      });
    });

    it('falla sin name ni code', () => {
      return dispatch('projects.new', { creator: CREATOR }).then((reply) => {
        reply.status.should.equal('failure');
        reply.errorCode!.should.equal('invalid_fields');
      });
    });

    it('falla con un status fuera del enum', () => {
      return dispatch('projects.new', {
        creator: CREATOR,
        name: 'Proyecto',
        code: 'P-007',
        status: 'inexistente',
      }).then((reply) => {
        reply.status.should.equal('failure');
        reply.errorCode!.should.equal('invalid_fields');
      });
    });

    it('falla si el cliente no existe', () => {
      return dispatch('projects.new', {
        creator: CREATOR,
        name: 'Proyecto',
        code: 'P-008',
        clientId: 999999,
      }).then((reply) => {
        reply.status.should.equal('failure');
        reply.errorCode!.should.equal('client_not_found');
        return Project.count().then((count) => count.should.equal(0));
      });
    });
  });

  describe('projects.{id}.edit', () => {
    let projectId: number;

    beforeEach(() => {
      return Project.create({
        name: 'Original',
        code: 'ORIG',
        status: 'analisis',
        type: 'comercial',
        description: 'Descripción original',
        initDate: new Date('2026-01-01'),
        createdBy: CREATOR,
        keyValuePairs: { documentacion: 'https://docs.grava.io/original' },
      }).then((project) => {
        projectId = project.id;
      });
    });

    it('edita solo los campos presentes', () => {
      return dispatch(`projects.${projectId}.edit`, { name: 'Editado' }).then((reply) => {
        reply.status.should.equal('success');
        return Project.findByPk(projectId).then((project) => {
          project!.name.should.equal('Editado');
          project!.code.should.equal('ORIG');
          project!.description.should.equal('Descripción original');
        });
      });
    });

    it('no vacía endDate cuando no viene en el payload', () => {
      return Project.update({ endDate: new Date('2026-06-30') }, { where: { id: projectId } })
        .then(() => dispatch(`projects.${projectId}.edit`, { name: 'Otro nombre' }))
        .then((reply) => {
          reply.status.should.equal('success');
          return Project.findByPk(projectId).then((project) => {
            // El protocolo dice que un campo ausente se deja como estaba.
            project!.endDate.should.be.instanceof(Date);
          });
        });
    });

    it('vacía endDate con null', () => {
      return Project.update({ endDate: new Date('2026-06-30') }, { where: { id: projectId } })
        .then(() => dispatch(`projects.${projectId}.edit`, { endDate: null }))
        .then((reply) => {
          reply.status.should.equal('success');
          return Project.findByPk(projectId).then((project) => {
            (project!.endDate === null).should.be.true();
          });
        });
    });

    it('reemplaza las properties', () => {
      return dispatch(`projects.${projectId}.edit`, {
        properties: [{ code: 'board_de_tareas', value: 'https://jira.grava.io/p1' }],
      }).then((reply) => {
        reply.status.should.equal('success');
        return Project.findByPk(projectId).then((project) => {
          const pairs = project!.keyValuePairs!;
          pairs.board_de_tareas!.should.equal('https://jira.grava.io/p1');
          (pairs.documentacion === undefined).should.be.true();
        });
      });
    });

    it('falla al mandar null en name, que es obligatorio al crear', () => {
      return dispatch(`projects.${projectId}.edit`, { name: null }).then((reply) => {
        reply.status.should.equal('failure');
        reply.errorCode!.should.equal('invalid_fields');
      });
    });

    it('acepta un payload vacío sin cambiar nada', () => {
      return dispatch(`projects.${projectId}.edit`, {}).then((reply) => {
        reply.status.should.equal('success');
        return Project.findByPk(projectId).then((project) => {
          project!.name.should.equal('Original');
        });
      });
    });

    it('falla si el proyecto no existe', () => {
      return dispatch('projects.999999.edit', { name: 'Fantasma' }).then((reply) => {
        reply.status.should.equal('failure');
        reply.errorCode!.should.equal('project_not_found');
      });
    });
  });
});

/**
 * LA TRADUCCIÓN `properties` <-> `key_value_pairs`, EN LAS DOS DIRECCIONES (S-024).
 *
 * La de escritura existía desde el principio; la de LECTURA la agrega S-024 y vive en el MISMO
 * helper del módulo, no en la ficha de consultas: la convención `contract-translation` dice que
 * una traducción vive en un solo lugar, y dos copias del mismo mapa en dos planos es exactamente
 * la divergencia que esa convención previene.
 */
describe('projects/properties — la traducción de lectura (S-024)', () => {
  it('convierte el objeto de la columna a la lista del protocolo', () => {
    keyValuePairsToProperties({
      documentacion: 'https://d.local',
      mattermost_group_name: 'jiku',
    }).should.deepEqual([
      { code: 'documentacion', value: 'https://d.local' },
      { code: 'mattermost_group_name', value: 'jiku' },
    ]);
  });

  it('una columna vacía devuelve `[]` y NUNCA `null` ni `undefined`', () => {
    // El contrato declara `properties` como lista: un consumidor que haga `.map()` sobre `null`
    // rompe. Es la asimetría deliberada con `propertiesToKeyValuePairs`, donde el `undefined` es
    // lo que hace funcionar la edición parcial.
    keyValuePairsToProperties(null).should.deepEqual([]);
    keyValuePairsToProperties(undefined).should.deepEqual([]);
    keyValuePairsToProperties({}).should.deepEqual([]);
  });

  it('preserva el `null` de una clave PRESENTE con valor nulo', () => {
    keyValuePairsToProperties({ board_de_tareas: null }).should.deepEqual([
      { code: 'board_de_tareas', value: null },
    ]);
  });

  it('NO filtra por la lista blanca de códigos: esa regla es de ESCRITURA', () => {
    // Aplicarla al leer escondería, sin decirlo, cualquier clave que haya quedado en la columna.
    keyValuePairsToProperties({ clave_vieja: 'valor' }).should.deepEqual([
      { code: 'clave_vieja', value: 'valor' },
    ]);
  });

  it('el ida y vuelta conserva los pares', () => {
    const properties = [
      { code: 'documentacion', value: 'https://d.local' },
      { code: 'board_de_tareas', value: null },
    ];

    keyValuePairsToProperties(propertiesToKeyValuePairs(properties)).should.deepEqual(properties);
  });
});
