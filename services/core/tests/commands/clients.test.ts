import 'mocha';
import 'should';
import { Client } from '@jiku/models';
import { dispatch } from '../helpers/dispatch';

describe('clients', () => {
  afterEach(() => {
    return Client.destroy({ where: {} });
  });

  describe('clients.new', () => {
    it('crea un cliente y devuelve su id', () => {
      return dispatch<{ id: number }>('clients.new', {
        name: 'Adistal',
        description: 'Un cliente',
      }).then((reply) => {
        reply.status.should.equal('success');
        reply.data!.id.should.be.a.Number();

        return Client.findByPk(reply.data!.id).then((client) => {
          client!.name.should.equal('Adistal');
          client!.description!.should.equal('Un cliente');
        });
      });
    });

    it('crea un cliente sin description', () => {
      return dispatch<{ id: number }>('clients.new', { name: 'Verifarma' }).then((reply) => {
        reply.status.should.equal('success');
        return Client.findByPk(reply.data!.id).then((client) => {
          client!.name.should.equal('Verifarma');
          (client!.description === null).should.be.true();
        });
      });
    });

    it('acepta description vacía', () => {
      return dispatch<{ id: number }>('clients.new', { name: 'Exo', description: '' })
        .then((reply) => {
          reply.status.should.equal('success');
        });
    });

    it('falla sin name', () => {
      return dispatch('clients.new', { description: 'sin nombre' }).then((reply) => {
        reply.status.should.equal('failure');
        reply.errorCode!.should.equal('invalid_fields');
        return Client.count().then((count) => count.should.equal(0));
      });
    });

    it('falla con un campo desconocido', () => {
      return dispatch('clients.new', { name: 'Acme', unexpected: true }).then((reply) => {
        reply.status.should.equal('failure');
        reply.errorCode!.should.equal('invalid_fields');
      });
    });

    it('falla si name no es string', () => {
      return dispatch('clients.new', { name: 42 }).then((reply) => {
        reply.status.should.equal('failure');
        reply.errorCode!.should.equal('invalid_fields');
      });
    });
  });

  describe('clients.{id}.edit', () => {
    let clientId: number;

    beforeEach(() => {
      return Client.create({ name: 'Original', description: 'Descripción original' })
        .then((client) => {
          clientId = client.id;
        });
    });

    it('edita el name', () => {
      return dispatch(`clients.${clientId}.edit`, { name: 'Editado' }).then((reply) => {
        reply.status.should.equal('success');
        return Client.findByPk(clientId).then((client) => {
          client!.name.should.equal('Editado');
          // description no venía en el payload: queda como estaba
          client!.description!.should.equal('Descripción original');
        });
      });
    });

    it('vacía description con null', () => {
      return dispatch(`clients.${clientId}.edit`, { description: null }).then((reply) => {
        reply.status.should.equal('success');
        return Client.findByPk(clientId).then((client) => {
          (client!.description === null).should.be.true();
          client!.name.should.equal('Original');
        });
      });
    });

    it('falla al mandar null en name, que es obligatorio al crear', () => {
      return dispatch(`clients.${clientId}.edit`, { name: null }).then((reply) => {
        reply.status.should.equal('failure');
        reply.errorCode!.should.equal('invalid_fields');
        return Client.findByPk(clientId).then((client) => {
          client!.name.should.equal('Original');
        });
      });
    });

    it('acepta un payload vacío sin cambiar nada', () => {
      return dispatch(`clients.${clientId}.edit`, {}).then((reply) => {
        reply.status.should.equal('success');
        return Client.findByPk(clientId).then((client) => {
          client!.name.should.equal('Original');
          client!.description!.should.equal('Descripción original');
        });
      });
    });

    it('falla si el cliente no existe', () => {
      return dispatch('clients.999999.edit', { name: 'Fantasma' }).then((reply) => {
        reply.status.should.equal('failure');
        reply.errorCode!.should.equal('client_not_found');
      });
    });
  });

  describe('comando desconocido', () => {
    it('responde unknown_command', () => {
      return dispatch('clients.inexistente', {}).then((reply) => {
        reply.status.should.equal('failure');
        reply.errorCode!.should.equal('unknown_command');
      });
    });
  });
});
