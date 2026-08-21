import 'mocha';
import 'should';
import { QueryTypes } from 'sequelize';
import { initDb } from '../mocks/app';
import { sequelize } from '../../lib/models';
import * as models from '@jiku/models';
import { allModels, Client, Objective, ObjectiveActivity, Project, User } from '@jiku/models';

/**
 * S-010: baja del esquema y el código de la integración con sistemas externos (Jira).
 *
 * Es un test de AUSENCIA, y conviene ser explícito sobre qué prueba y qué no.
 *
 * LO QUE PRUEBA: que los modelos ya no DECLARAN nada de la integración (CA-3) y que, en
 * consecuencia, `sequelize.sync()` no recrea las tablas, las columnas ni el índice único
 * parcial (CA-9). Eso último es lo que evita el modo de falla del Riesgo 4: si el `indexes`
 * del `@Table` de `ObjectiveActivity` hubiera quedado, el fixture global habría fallado con
 * `column "external_reference_url" does not exist` y ningún test de la suite correría.
 *
 * LO QUE NO PRUEBA: que la migración haya borrado nada. El esquema de esta suite lo construye
 * `sequelize.sync()`, no las migraciones (ADR-013, su límite declarado). Contra ese esquema,
 * afirmar "la tabla no existe" pasa POR CONSTRUCCIÓN en cuanto se borra el modelo. Por eso los
 * escenarios de catálogo de acá están redactados como CA-9 ("no se recrea") y NO como CA-1 /
 * CA-2, que se verifican a mano contra una base migrada (ver
 * `docs/changelog/2026-08-20-baja-integracion-sistemas-externos.md`).
 *
 * El valor real del archivo es fijar la ausencia como contrato: si alguien vuelve a agregar un
 * atributo `external*` a `Objective`, esto falla y explica por qué no debería estar.
 */

const INTEGRATION_MODEL_NAMES = [
  'ExternalIntegrationConfig',
  'ExternalProject',
  'ExternalSyncEvent',
];

const OBJECTIVE_INTEGRATION_ATTRS = [
  'externalProjectId',
  'externalIssueId',
  'externalIssueKey',
  'externalUrl',
  'externalRawData',
  'lastSyncedAt',
];

const ACTIVITY_INTEGRATION_ATTRS = [
  'externalReferenceUrl',
  'externalUserName',
  'externalUserId',
];

const OBJECTIVE_REMAINING_ATTRS = [
  'id',
  'title',
  'description',
  'estimatedFinishDate',
  'finishedAt',
  'state',
  'area',
  'priority',
  'visibilityLevel',
  'projectId',
  'createdBy',
  'requirementId',
  'createdAt',
  'updatedAt',
];

const ACTIVITY_REMAINING_ATTRS = [
  'id',
  'typeOfActivity',
  'previousValue',
  'newValue',
  'visibilityLevel',
  'objectiveId',
  'changedBy',
  'createdAt',
  'updatedAt',
];

describe('S-010 - baja de la integración con sistemas externos', () => {
  before(function () {
    this.timeout(30000);
    return initDb();
  });

  describe('barrel de @jiku/models', () => {
    // TS-1
    it('TS-1: el barrel exporta 26 clases, no 29', () => {
      allModels.length.should.be.equal(26);
    });

    // TS-2
    it('TS-2: ninguna de las tres clases de la integración se exporta', () => {
      INTEGRATION_MODEL_NAMES.map((name) => name in models)
        .should.be.eql([false, false, false]);
    });

    it('TS-2: ninguna de las tres clases está registrada en allModels', () => {
      const registered = allModels.map((model) => model.name);
      INTEGRATION_MODEL_NAMES.forEach((name) => {
        registered.should.not.containEql(name);
      });
    });
  });

  describe('declaraciones de los modelos (CA-3)', () => {
    // TS-3
    it('TS-3: Objective no declara las 6 columnas de la integración', () => {
      const attributes = Object.keys(Objective.getAttributes());
      OBJECTIVE_INTEGRATION_ATTRS.forEach((attr) => {
        attributes.should.not.containEql(attr);
      });
    });

    it('TS-3: Objective conserva sus 14 atributos restantes', () => {
      const attributes = Object.keys(Objective.getAttributes());
      OBJECTIVE_REMAINING_ATTRS.forEach((attr) => {
        attributes.should.containEql(attr);
      });
      attributes.should.have.length(OBJECTIVE_REMAINING_ATTRS.length);
    });

    // TS-4
    it('TS-4: Objective no declara la asociación externalProject', () => {
      (Objective.associations.externalProject === undefined).should.be.true();
    });

    it('TS-4: las demás asociaciones de Objective siguen definidas', () => {
      [
        'project',
        'creator',
        'requirement',
        'persons',
        'ObjectiveActivity',
        'workedTime',
        'objectiveSubscriptors',
      ].forEach((association) => {
        (Objective.associations[association] !== undefined).should.be.true();
      });
    });

    // TS-5
    it('TS-5: ObjectiveActivity no declara los 3 atributos de la integración', () => {
      const attributes = Object.keys(ObjectiveActivity.getAttributes());
      ACTIVITY_INTEGRATION_ATTRS.forEach((attr) => {
        attributes.should.not.containEql(attr);
      });
    });

    it('TS-5: ObjectiveActivity conserva sus 9 atributos restantes', () => {
      const attributes = Object.keys(ObjectiveActivity.getAttributes());
      ACTIVITY_REMAINING_ATTRS.forEach((attr) => {
        attributes.should.containEql(attr);
      });
      attributes.should.have.length(ACTIVITY_REMAINING_ATTRS.length);
    });

    /**
     * TS-6. Es el que cubre el Riesgo 4 desde el lado de la declaración: el índice único vivía
     * en la base Y en el decorador `@Table`. Si quedara acá, `sync()` intentaría recrearlo
     * sobre una columna inexistente.
     */
    it('TS-6: ObjectiveActivity no declara el índice único en su @Table', () => {
      const indexes = (ObjectiveActivity.options as { indexes?: unknown[] }).indexes;
      const names = (indexes || []).map((index) => (index as { name?: string }).name);
      names.should.not.containEql('uk_objective_activity_external_comment');
    });

    // TS-7
    it('TS-7: Client no declara la asociación externalIntegrations', () => {
      (Client.associations.externalIntegrations === undefined).should.be.true();
    });

    it('TS-7: Client conserva la asociación projects', () => {
      (Client.associations.projects !== undefined).should.be.true();
    });
  });

  describe('el esquema que deja sync() no recrea la integración (CA-9)', () => {
    // TS-11
    it('TS-11: sync() no crea las tres tablas', () => {
      return sequelize
        .query<{ regclass: string | null }>(
          `SELECT to_regclass('external_integration_config')::text AS config,
                  to_regclass('external_project')::text AS project,
                  to_regclass('external_sync_event')::text AS sync_event`,
          { type: QueryTypes.SELECT }
        )
        .then((rows) => {
          const row = rows[0] as unknown as Record<string, string | null>;
          (row.config === null).should.be.true();
          (row.project === null).should.be.true();
          (row.sync_event === null).should.be.true();
        });
    });

    /**
     * TS-12. Que este test corra ya es parte de la aserción: si el `indexes` del `@Table`
     * hubiera quedado, el `sequelize.sync()` del fixture global habría lanzado y la suite
     * completa no arrancaría.
     */
    it('TS-12: sync() no crea el índice único parcial', () => {
      return sequelize
        .query(
          `SELECT indexname FROM pg_indexes
            WHERE indexname = 'uk_objective_activity_external_comment'`,
          { type: QueryTypes.SELECT }
        )
        .then((rows) => {
          rows.should.have.length(0);
        });
    });

    // TS-13
    it('TS-13: sync() no crea ninguna de las 9 columnas', () => {
      return sequelize
        .query(
          `SELECT column_name FROM information_schema.columns
            WHERE table_name IN ('objectives', 'objective_activity')
              AND (column_name LIKE 'external%' OR column_name = 'last_synced_at')`,
          { type: QueryTypes.SELECT }
        )
        .then((rows) => {
          rows.should.have.length(0);
        });
    });
  });

  describe('comportamiento observable con los modelos limpios', () => {
    let projectId: number;
    let objectiveId: number;

    before(() => {
      return User.create({
        id: 'zitadel-sub-s010',
        name: 'Usuario S-010',
        username: 'users010',
        email: 'users010@mail.com',
      })
        .then(() => {
          return Project.create({
            code: 'S010',
            name: 'Proyecto S-010',
            type: 'comercial',
            description: 'Proyecto de prueba de la baja de la integración',
            status: 'activo',
            priority: 1,
            originId: 1,
            initDate: new Date(),
            createdBy: 'zitadel-sub-s010',
          });
        })
        .then((project) => {
          projectId = project.id;
          return Objective.create({
            title: 'Tarea de prueba',
            area: 'desarrollo',
            priority: 3,
            projectId,
            createdBy: 'zitadel-sub-s010',
          });
        })
        .then((objective) => {
          objectiveId = objective.id;
        });
    });

    after(() => {
      return ObjectiveActivity.destroy({ where: {} })
        .then(() => Objective.destroy({ where: {} }))
        .then(() => Project.destroy({ where: {} }))
        .then(() => User.destroy({ where: { id: 'zitadel-sub-s010' } }));
    });

    // TS-8
    it('TS-8: una lectura de Tarea con include sigue funcionando y devuelve 14 claves', () => {
      return Objective.findByPk(objectiveId, { include: ['project', 'creator'] }).then(
        (objective) => {
          (objective !== null).should.be.true();
          const keys = Object.keys((objective as Objective).toJSON());
          // `project` y `creator` entran por el include, no son columnas de la tabla.
          const columnKeys = keys.filter((key) => !['project', 'creator'].includes(key));
          columnKeys.should.have.length(14);
          columnKeys.forEach((key) => {
            key.startsWith('external').should.be.false();
            key.should.not.be.equal('lastSyncedAt');
          });
        }
      );
    });

    /**
     * TS-14. El índice único NUNCA bloqueó nada en la práctica: `external_reference_url` era
     * `NULL` en toda fila, y en PostgreSQL cada `NULL` es distinto de los demás en un índice
     * único. Así que este escenario confirma que el comportamiento observable NO CAMBIÓ con la
     * baja — no que se haya ganado una capacidad nueva.
     */
    it('TS-14: dos comentarios con el mismo texto no colisionan', () => {
      const comment = {
        typeOfActivity: 'comment',
        previousValue: '',
        newValue: 'mismo comentario',
        objectiveId,
        changedBy: 'zitadel-sub-s010',
      };
      return ObjectiveActivity.create(comment)
        .then((first) => {
          return ObjectiveActivity.create(comment).then((second) => {
            first.id.should.not.be.equal(second.id);
          });
        });
    });
  });
});
