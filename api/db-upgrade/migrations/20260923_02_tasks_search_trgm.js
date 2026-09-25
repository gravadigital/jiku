'use strict';

/**
 * Indices trigram para la busqueda libre (`q`) de tasks.list.
 *
 * POR QUE EXISTE: `q` se traduce a `title ILIKE '%...%' OR description ILIKE '%...%'`, que ningun
 * btree puede resolver. Sobre `objectives` eso es un Seq Scan que evalua el ILIKE contra cada
 * `description` (texto largo): 5,9 ms de ejecucion con 2.670 filas, lineal en los datos. Con un
 * GIN trigram por columna el plan pasa a BitmapOr + Bitmap Heap Scan: 0,65 ms.
 *
 * EL INDICE SOLO NO ALCANZA: con random_page_cost = 4 (el default, pensado para disco rotacional)
 * el planner estima el Seq Scan apenas mas barato y lo sigue eligiendo. core fija
 * random_page_cost = 1.1 en las sesiones de SU conexion de lectura (`core/src/models/read.ts`), que
 * es con lo que el planner elige el indice. Este archivo no toca ninguna configuracion del servidor.
 *
 * SOLO objectives. `requirements` declara la misma busqueda, pero con 124 filas el planner no usa
 * el indice ni con random_page_cost = 1.1 (medido): seria costo de escritura sin ganancia. Las demas
 * tablas con `q` (people, users, clients, projects) son de decenas de filas. comments filtra
 * siempre por entidad antes de buscar, y ese filtro ya tiene indice.
 *
 * pg_trgm es una extension "trusted" desde PostgreSQL 13: la crea el dueno de la base sin
 * superusuario. El `down` dropea los indices y NO la extension: otra cosa puede estar usandola, y
 * dropearla no es reversible sin saber quien.
 *
 * MISMO CRITERIO QUE 20260824_02 y 20260923_01: sin transaccion, IF NOT EXISTS, CREATE INDEX
 * comun por el tamano de la tabla.
 */

const INDEX_NAMES = ['idx_objectives_title_trgm', 'idx_objectives_description_trgm'];

const CREATE = `
  CREATE EXTENSION IF NOT EXISTS pg_trgm;

  CREATE INDEX IF NOT EXISTS idx_objectives_title_trgm
    ON objectives USING gin (title gin_trgm_ops);

  CREATE INDEX IF NOT EXISTS idx_objectives_description_trgm
    ON objectives USING gin (description gin_trgm_ops);
`;

const DROP = INDEX_NAMES.map((name) => `DROP INDEX IF EXISTS ${name};`).join('\n');

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(CREATE);
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(DROP);
  },

  INDEX_NAMES,
};
