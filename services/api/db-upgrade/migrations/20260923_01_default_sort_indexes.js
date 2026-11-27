'use strict';

/**
 * Indices para el sort default de los `list` SIN FILTRO, que 20260824_02 no cubre.
 *
 * POR QUE EXISTE: los indices de 20260824_02 empiezan todos por una columna de filtro
 * (project_id, person_id, state, ...). Sirven cuando el list viene filtrado por esa columna,
 * pero un `worked-times.list` o un `tasks.list` sin filtro ordenan por el sort default
 * (`-date` / `-createdAt`) sin ningun indice que lo resuelva: el plan es Seq Scan de la tabla
 * entera + top-N sort para devolver 50 filas, y el costo crece linealmente con los datos.
 * Medido en local (dump de 2026-08, sentencia de core con parseo en Node, sesion caliente):
 *   worked-times.list sin filtro      6,78 ms -> 0,69 ms   (worked_times: 23.856 filas)
 *   tasks.list sin filtro             2,16 ms -> 0,69 ms   (objectives: 2.670 filas)
 *   tasks.list 200 + includes (ppal)  5,25 ms -> 2,02 ms
 *
 * people_objectives(objective_id): el include `responsiblePersons` de tasks filtra por
 * `objective_id IN (...)`, y el indice existente (person_id, objective_id) no sirve porque su
 * columna lider es person_id. Con los datos actuales la ganancia no se mide (la tabla es
 * chica); es preventivo, porque la tabla crece con cada asignacion. El lado de requirements NO
 * lo necesita: people_requirements(requirement_id) ya existe desde 20260703_01.
 *
 * MISMO CRITERIO QUE 20260824_02: sin transaccion, IF NOT EXISTS en el `up` (la migracion corre
 * al arrancar la api, y fallar ahi es la api que no levanta), CREATE INDEX comun y no
 * CONCURRENTLY por el tamano de las tablas. Ver el umbral para reconsiderarlo en ese archivo.
 *
 * PURAMENTE ADITIVA y REVERSIBLE: el `down` dropea exactamente los nombres que crea.
 */

const INDEX_NAMES = [
  'idx_worked_times_date_id',
  'idx_objectives_created_id',
  'idx_people_objectives_objective_id',
];

const CREATE_INDEXES = `
  -- worked-times.list sin filtro: sort default ["-date"].
  CREATE INDEX IF NOT EXISTS idx_worked_times_date_id
    ON worked_times ("date" DESC, id DESC);

  -- tasks.list sin filtro: sort default ["-createdAt"].
  CREATE INDEX IF NOT EXISTS idx_objectives_created_id
    ON objectives (created_at DESC, id DESC);

  -- include responsiblePersons, por lote de la pagina (WHERE objective_id IN (...)).
  CREATE INDEX IF NOT EXISTS idx_people_objectives_objective_id
    ON people_objectives (objective_id);
`;

const DROP_INDEXES = INDEX_NAMES.map((name) => `DROP INDEX IF EXISTS ${name};`).join('\n');

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(CREATE_INDEXES);
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(DROP_INDEXES);
  },

  INDEX_NAMES,
};
