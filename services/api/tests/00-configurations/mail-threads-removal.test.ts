import 'mocha';
import 'should';
import { QueryTypes } from 'sequelize';
import { initDb } from '../mocks/app';
import { sequelize } from '../../lib/models';
import * as models from '@jiku/models';
import { allModels, Objective, Requirement } from '@jiku/models';

/**
 * S-069: baja de los tres modelos de la funcionalidad de mail eliminada
 * (`ObjectiveMailThread`, `RequirementMailThread`, `InboundMailThread`).
 *
 * Es un test de AUSENCIA, y conviene ser explícito sobre qué prueba y qué no.
 *
 * LO QUE PRUEBA: que los tres modelos ya no se DECLARAN en `@jiku/models` (CA-7) y que, en
 * consecuencia, `sequelize.sync()` no recrea las tres tablas ni los dos índices de
 * `inbound_mail_threads` (precondición de CA-7: si el modelo siguiera registrado, `sync()` en
 * `development`/`testing` recrearía la tabla que la migración del plan de `api` acaba de
 * borrar). También fija que `Objective` y `Requirement` conservan sus atributos: ninguno de los
 * tres modelos borrados era referenciado desde el lado de ellos (`@BelongsTo` solo del lado del
 * hilo), así que su baja tiene que ser puramente local.
 *
 * LO QUE NO PRUEBA: que la migración haya borrado las tablas en una base migrada — eso es CA-6,
 * y se verifica del lado del plan de `api`. Contra el esquema de esta suite, "la tabla no
 * existe" pasa POR CONSTRUCCIÓN apenas se borra el modelo: por eso los escenarios de acá están
 * redactados como "sync() no la recrea" y no como una aserción de migración. Mismo encuadre que
 * `external-integration-removal.test.ts` (S-010).
 *
 * El valor real del archivo es fijar la ausencia como contrato: si alguien vuelve a agregar uno
 * de los tres modelos, esto falla y explica por qué no debería estar.
 */

const DEAD_MODEL_NAMES = ['ObjectiveMailThread', 'RequirementMailThread', 'InboundMailThread'];

const DEAD_TABLES = ['objective_mail_threads', 'requirement_mail_threads', 'inbound_mail_threads'];

const DEAD_INDEXES = ['uk_inbound_mail_threads_message_id', 'idx_inbound_mail_threads_requirement_id'];

const OBJECTIVE_ATTRS = [
  'id', 'title', 'description', 'estimatedFinishDate', 'finishedAt', 'state', 'area',
  'priority', 'visibilityLevel', 'projectId', 'createdBy', 'requirementId', 'createdAt',
  'updatedAt',
];

const REQUIREMENT_ATTRS = [
  'id', 'title', 'description', 'type', 'priority', 'state', 'estimatedFinishDate', 'tags',
  'projectId', 'createdBy', 'scheduledAt', 'inProgressAt', 'inReviewAt', 'finishedAt',
  'visibilityLevel', 'resolutionType', 'resolutionConclusion', 'resolutionComment', 'scope',
  'technicalSolution', 'acceptanceCriteria', 'createdAt', 'updatedAt',
];

describe('S-069: baja de los tres modelos de mail eliminados', () => {
  before(function () {
    this.timeout(30000);
    return initDb();
  });

  describe('barrel de @jiku/models', () => {
    // TS-17
    it('TS-17: el barrel ya no exporta los tres modelos', () => {
      DEAD_MODEL_NAMES.forEach((name) => {
        (name in models).should.be.false();
      });
    });

    // TS-18
    it('TS-18: allModels no contiene ninguno de los tres, y tiene exactamente 24 elementos', () => {
      const registered = allModels.map((model) => model.name);
      DEAD_MODEL_NAMES.forEach((name) => {
        registered.should.not.containEql(name);
      });
      allModels.length.should.be.equal(24);
    });
  });

  describe('el esquema que deja sync() no recrea los modelos muertos (TS-19, TS-20)', () => {
    // TS-19
    it('TS-19: sync() no recrea las tres tablas', () => {
      return sequelize.getQueryInterface().showAllTables().then((tables: string[]) => {
        DEAD_TABLES.forEach((table) => {
          tables.should.not.containEql(table);
        });
      });
    });

    // TS-20
    it('TS-20: sync() no recrea los dos índices de inbound_mail_threads', () => {
      return sequelize.query(
        "SELECT indexname FROM pg_indexes WHERE schemaname = 'public'",
        { type: QueryTypes.SELECT }
      ).then((rows: any[]) => {
        const names = rows.map((r) => r.indexname as string);
        DEAD_INDEXES.forEach((name) => {
          names.should.not.containEql(name);
        });
      });
    });
  });

  describe('Objective y Requirement conservan sus atributos (TS-21)', () => {
    // TS-21. Red contra borrar de más: ninguno de los tres modelos muertos era referenciado
    // desde `Objective` ni `Requirement` (la relación estaba declarada solo del lado del
    // hilo), así que su baja no debería haber tocado ningún atributo de estos dos.
    it('TS-21: Objective conserva exactamente sus atributos', () => {
      const attributes = Object.keys(Objective.getAttributes());
      OBJECTIVE_ATTRS.forEach((attr) => attributes.should.containEql(attr));
      attributes.should.have.length(OBJECTIVE_ATTRS.length);
    });

    it('TS-21: Requirement conserva exactamente sus atributos', () => {
      const attributes = Object.keys(Requirement.getAttributes());
      REQUIREMENT_ATTRS.forEach((attr) => attributes.should.containEql(attr));
      attributes.should.have.length(REQUIREMENT_ATTRS.length);
    });
  });
});
