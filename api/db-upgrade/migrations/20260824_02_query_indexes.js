'use strict';

/**
 * Crea los 18 indices que la paginacion keyset del contrato de consultas (REQ-006) necesita.
 *
 * POR QUE EXISTE: RF-10 declara un campo ordenable SOLO si tiene indice compuesto terminado en
 * `id`, porque es lo que hace resoluble la pagina siguiente con WHERE (sort..., id) > (k...).
 * Sin el indice, cada pagina degrada a Seq Scan + Sort y el statement_timeout de 8000 ms de la
 * conexion de solo lectura empieza a devolver query_timeout bajo carga normal. No es una
 * optimizacion: es la precondicion de que el contrato pueda declarar esos campos. Sin este
 * archivo, el campo no se declara ordenable y el contrato pierde una capacidad.
 *
 * PURAMENTE ADITIVA. Solo CREATE INDEX. Ninguna tabla, ninguna columna, ningun tipo, ningun
 * dato. NO borra `idx_projects_client_id`: el compuesto (client_id, name, id) lo sustituye
 * funcionalmente, pero borrar un indice preexistente es un cambio de otro alcance y de otro
 * riesgo. Tampoco toca los indices de `attachments` ni de `files`, que existian antes.
 *
 * NADA USA ESTOS INDICES TODAVIA. El consumidor es el motor de consulta de S-022 en adelante.
 * Hasta entonces el unico efecto observable es el costo de escritura que cada indice agrega a
 * `objectives`, `requirements`, `objective_activity` y `worked_times`, que son las cuatro
 * tablas de mayor transito de escritura del producto. Es el precio explicito de que el keyset
 * se sostenga.
 *
 * SIN TRANSACCION EXPLICITA, a diferencia de 20260819_01 / 20260820_01 / 20260824_01. Dos
 * razones: cada sentencia es idempotente por su IF NOT EXISTS, asi que una corrida parcial se
 * completa sola en el reintento; y deja la estructura lista por si hubiera que pasar a
 * CONCURRENTLY sin reescribir el archivo.
 * (Nota verificada, porque la premisa contraria circula: sequelize-cli 6.6.3 usa umzug 2.3.0,
 * que NO abre transaccion por migracion -- core/migrator.js pasa el queryInterface pelado. La
 * transaccion de las otras migraciones es propia de cada una, no algo que la herramienta
 * imponga. CONCURRENTLY, entonces, esta disponible sin desactivar nada.)
 *
 * IF NOT EXISTS TAMBIEN EN EL `up`, contra la convencion de 20260824_01 ("IF EXISTS solo en el
 * down: el up quiere fallar ruidosamente ante un estado inesperado"). Aca manda la idempotencia:
 * un entorno puede tener ya alguno de estos indices, y la migracion corre AL ARRANCAR LA API
 * (`npm start` -> `upgrade-db && ts-node ./bin`). Fallar ahi no es un error ruidoso que alguien
 * lee: es la api que no levanta.
 *
 * user_project_permissions(user_id) ES CONDICIONAL y NO usa IF NOT EXISTS: eso compara por
 * NOMBRE, y el riesgo real es un indice equivalente con OTRO nombre. Es exactamente el caso de
 * este producto: 20260529_07 ya creo `uk_user_project_permissions (user_id, project_id)`, cuyo
 * prefijo `user_id` ya sirve al recorte del modo externo. Un indice redundante cuesta
 * escrituras para siempre. Por eso el DO $$ de abajo mira el CATALOGO (pg_index) y no el
 * nombre: crea solo si no hay ya un indice cuya PRIMERA columna sea user_id.
 * Contra una base migrada NO crea nada; contra el esquema que produce sequelize.sync() -- donde
 * el modelo no declara esa constraint -- si lo crea. Los dos desenlaces son correctos: en los
 * dos, un solo indice cubre (user_id).
 *
 * CONCURRENTLY: DESCARTADO, se usa CREATE INDEX comun. Medicion del entorno al 2026-08-24:
 *   objectives             2.670 filas /  888 kB
 *   requirements             124 filas /  240 kB
 *   objective_activity     6.930 filas / 1304 kB
 *   (la mas grande del conjunto es worked_times: 23.856 filas / 2800 kB)
 * Con esos tamanos el CREATE INDEX comun toma un SHARE lock que bloquea escrituras por
 * milisegundos, no por una ventana: son tablas de kilobytes. Y la ventana coincide igual con el
 * despliegue, porque las escrituras entran por `core`, que se despliega DESPUES de esta
 * migracion. CONCURRENTLY se descarta porque el costo es mayor que el beneficio a esta escala:
 * es mas lento, hace dos pasadas, y si falla a mitad deja el indice INVALID que hay que dropear
 * A MANO antes de que la api pueda volver a arrancar -- y esta migracion corre justamente en el
 * arranque. UMBRAL PARA RECONSIDERARLO: que alguna de objectives, requirements u
 * objective_activity supere ~5.000.000 de filas, o que el CREATE INDEX se estime en mas de ~30 s.
 * Si se escala: no abrir transaccion (ya no la abre) y mandar cada CREATE INDEX CONCURRENTLY en
 * su PROPIO query(), nunca en una cadena multi-sentencia, que es una transaccion implicita.
 *
 * LAS DIRECCIONES SE ESCRIBEN AUNQUE EN CASI TODOS LOS CASOS DEN IGUAL. En 17 de los 18, la
 * columna lider es un predicado de igualdad (project_id = $1, person_id = $1), y con la lider
 * fijada la direccion no afecta al orden: PostgreSQL recorre las trailing en la direccion que
 * haga falta. El unico donde la direccion es sustantiva es idx_objectives_priority_created_id,
 * donde `priority` no filtra sino que ordena. Aun asi van escritas en los 18: coinciden con el
 * sort default de cada recurso, hacen legible la intencion, y cuestan cero.
 *
 * SIN CAMBIOS EN packages/models: un indice no es una columna. De los 26 modelos, solo
 * inbound-mail-thread declara `indexes` en su @Table, y ninguno de los indices ya existentes de
 * attachments, files o projects esta declarado en su modelo -- viven solo en las migraciones.
 * Se sigue ese precedente a proposito: declararlos cambiaria lo que sync() produce en testing y
 * development y abriria una divergencia nueva con produccion (ADR-005).
 *
 * idx_worked_times_requirement_id ES UN CUARTO INDICE PREEXISTENTE, que el diseno de la story no
 * habia relevado (enumeraba tres: attachments, projects(client_id) y files). Lo creo
 * 20260626_01_worked_times_requirement_id JUNTO CON la columna `requirement_id`, asi que toda base
 * que tenga la columna tiene el indice; la unica donde falta es la que construye sequelize.sync()
 * en tests, porque el modelo no declara `indexes`. Consecuencias, las dos deliberadas:
 *   - El `up` lo deja igual, con su IF NOT EXISTS: contra una base migrada es un no-op, y contra
 *     la de tests es lo que hace que el indice de CA-7 exista tambien ahi.
 *   - El `down` NO lo dropea. Lo posee 20260626_01 y su propio `down` lo saca. Dos migraciones no
 *     pueden ser duenas del mismo objeto, y CA-13 es explicita: el down dropea "los mismos nombres
 *     que creo, y ninguno mas". Contra una base migrada este `up` NO lo crea, asi que dropearlo
 *     seria borrar un indice preexistente -- exactamente lo que CA-13 prohibe para
 *     idx_projects_client_id, idx_files_uploader_byte_status y los de attachments.
 *
 * REVERSIBLE: el `down` dropea por nombre los 17 que este archivo puede crear en exclusiva, y
 * ninguno mas. La unica huella que puede dejar es idx_worked_times_requirement_id en una base
 * construida por sync(), y es a proposito (ver el parrafo anterior).
 */

// Los 18 nombres, en el mismo orden en que el `up` los crea. Se exporta para que el test afirme
// la simetria del `down` contra ESTA lista y no contra una copia literal que se despegue con el
// tiempo.
const INDEX_NAMES = [
  'idx_objectives_project_created_id',
  'idx_objectives_priority_created_id',
  'idx_objectives_state_created_id',
  'idx_requirements_project_created_id',
  'idx_requirements_state_created_id',
  'idx_requirements_tags_gin',
  'idx_objective_activity_entity_type_created_id',
  'idx_requirement_activity_entity_type_created_id',
  'idx_people_objectives_person_objective',
  'idx_people_requirements_person_requirement',
  'idx_projects_client_name_id',
  'idx_worked_times_person_date_id',
  'idx_worked_times_project_date_id',
  'idx_worked_times_requirement_id',
  'idx_worked_times_objective_id',
  'idx_unworked_times_person_date_id',
  'idx_week_assigned_times_person_datefrom_id',
  'idx_user_project_permissions_user_id',
];

// Los 17 incondicionales. `"date"` va entrecomillado en los tres indices que la usan: `date` es
// un col_name_keyword de PostgreSQL y, aunque como referencia de columna parsea igual, las
// comillas dejan explicito que es la columna y no el tipo. Mismo criterio que 20260819_01 con
// '"file_byte_status"' y 20260824_01 con "identity_type".
const CREATE_INDEXES = `
  -- objectives: tasks.list. El sort default del recurso es ["-createdAt"].
  CREATE INDEX IF NOT EXISTS idx_objectives_project_created_id
    ON objectives (project_id, created_at DESC, id DESC);

  -- El unico donde la direccion es sustantiva: priority ORDENA, no filtra. DESC uniforme, asi
  -- que sirve a ["-priority", "-createdAt"] y a su inverso exacto.
  CREATE INDEX IF NOT EXISTS idx_objectives_priority_created_id
    ON objectives (priority DESC, created_at DESC, id DESC);

  -- filter.state + sort default. Con state = 'x' (igualdad) resuelve filtro y orden sin Sort;
  -- con state IN (...) el ScalarArrayOpExpr no preserva el orden de las trailing entre
  -- elementos del array y el plan puede conservar un Sort legitimamente. No es un defecto de
  -- este indice: es el indice que el REQ declara.
  CREATE INDEX IF NOT EXISTS idx_objectives_state_created_id
    ON objectives (state, created_at DESC, id DESC);

  -- requirements: requirements.list por proyecto y por estado.
  CREATE INDEX IF NOT EXISTS idx_requirements_project_created_id
    ON requirements (project_id, created_at DESC, id DESC);

  CREATE INDEX IF NOT EXISTS idx_requirements_state_created_id
    ON requirements (state, created_at DESC, id DESC);

  -- GIN sobre jsonb: lo usa el filtro "tag" por par exacto, que se escribe con el contains
  -- (tags @> '[{"key": "...", "value": "..."}]'::jsonb) y no desarmando el array. Escrito de
  -- otra forma, el indice no se usa. Tambien lo consume requirements.tags de S-028.
  CREATE INDEX IF NOT EXISTS idx_requirements_tags_gin
    ON requirements USING gin (tags);

  -- Las dos tablas de actividad llevan el MISMO indice de los dos lados: comments.list filtra
  -- por type_of_activity = 'comment' y activity.list no, y las cuatro columnas en este orden
  -- sirven a los dos casos.
  CREATE INDEX IF NOT EXISTS idx_objective_activity_entity_type_created_id
    ON objective_activity (objective_id, type_of_activity, created_at, id);

  CREATE INDEX IF NOT EXISTS idx_requirement_activity_entity_type_created_id
    ON requirement_activity (requirement_id, type_of_activity, created_at, id);

  -- filter.responsiblePersonId resuelve por tabla intermedia, de los dos lados.
  CREATE INDEX IF NOT EXISTS idx_people_objectives_person_objective
    ON people_objectives (person_id, objective_id);

  CREATE INDEX IF NOT EXISTS idx_people_requirements_person_requirement
    ON people_requirements (person_id, requirement_id);

  -- projects.list + filter.clientId con sort por name. Convive con idx_projects_client_id
  -- (20260724_01), al que sustituye funcionalmente y NO se borra.
  CREATE INDEX IF NOT EXISTS idx_projects_client_name_id
    ON projects (client_id, name, id);

  -- worked-times.list, sort default ["-date"], por persona y por proyecto.
  CREATE INDEX IF NOT EXISTS idx_worked_times_person_date_id
    ON worked_times (person_id, "date" DESC, id DESC);

  CREATE INDEX IF NOT EXISTS idx_worked_times_project_date_id
    ON worked_times (project_id, "date" DESC, id DESC);

  -- Los dos que sostienen requirements.totalMinutes, que son DOS subconsultas correlacionadas
  -- POR FILA (horas del requisito mas las de sus tareas): con limit 200 son 400 subconsultas en
  -- una sola request. Son la razon por la que totalMinutes puede ser incluible en vez de
  -- imposible.
  CREATE INDEX IF NOT EXISTS idx_worked_times_requirement_id
    ON worked_times (requirement_id);

  CREATE INDEX IF NOT EXISTS idx_worked_times_objective_id
    ON worked_times (objective_id);

  -- unworked-times.list: sort default ["date"], ascendente. La direccion NO es intercambiable
  -- con la de worked_times, y por eso este va sin DESC.
  CREATE INDEX IF NOT EXISTS idx_unworked_times_person_date_id
    ON unworked_times (person_id, "date", id);

  -- week-assigned-times.list: sort default ["dateFrom"], ascendente.
  CREATE INDEX IF NOT EXISTS idx_week_assigned_times_person_datefrom_id
    ON week_assigned_times (person_id, date_from, id);
`;

// El #18. Participa de TODA consulta en modo externo, porque el recorte inyecta
// `project_id IN (SELECT project_id FROM user_project_permissions WHERE user_id = $caller)` en
// el SQL de casi todos los recursos. Es el indice mas chico y el de mayor frecuencia de uso del
// conjunto: que el recorte sea barato es lo que sostiene que nadie proponga desactivarlo "solo
// para este caso" (RF-22 exige que no se pueda desactivar por payload).
const CREATE_USER_PROJECT_PERMISSIONS_INDEX = `
  DO $$
  BEGIN
    -- Cualquier indice cuya PRIMERA columna sea user_id ya sirve como prefijo para el recorte
    -- del modo externo: el implicito de una constraint unica (user_id, project_id) incluido.
    -- Por eso se mira el catalogo y no el nombre, que es lo unico que veria IF NOT EXISTS.
    IF NOT EXISTS (
      SELECT 1
        FROM pg_index i
        JOIN pg_class t ON t.oid = i.indrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = i.indkey[0]
       WHERE n.nspname = 'public'
         AND t.relname = 'user_project_permissions'
         AND a.attname = 'user_id'
    ) THEN
      CREATE INDEX idx_user_project_permissions_user_id
        ON user_project_permissions (user_id);
    END IF;
  END $$;
`;

// Indices que otra migracion posee: este archivo puede crearlos si faltan, pero NO los dropea.
// Ver el bloque de cabecera.
const INDEX_NAMES_OWNED_BY_OTHER_MIGRATION = ['idx_worked_times_requirement_id'];

// Los 17 nombres que el `down` dropea, y NINGUNO mas. No aparecen aca idx_projects_client_id,
// idx_files_uploader_byte_status ni ningun indice de attachments -- los tres existian antes de
// esta migracion y borrarlos seria un cambio de otro alcance-- ni idx_worked_times_requirement_id,
// que es el cuarto preexistente y lo posee 20260626_01.
// IF EXISTS en los 17 porque el de user_project_permissions pudo no haberse creado (ver el DO $$
// de arriba), y porque un `down` tiene que poder correr sobre una base donde el `up` quedo a medias.
const DROP_INDEXES = `
  DROP INDEX IF EXISTS idx_objectives_project_created_id;
  DROP INDEX IF EXISTS idx_objectives_priority_created_id;
  DROP INDEX IF EXISTS idx_objectives_state_created_id;
  DROP INDEX IF EXISTS idx_requirements_project_created_id;
  DROP INDEX IF EXISTS idx_requirements_state_created_id;
  DROP INDEX IF EXISTS idx_requirements_tags_gin;
  DROP INDEX IF EXISTS idx_objective_activity_entity_type_created_id;
  DROP INDEX IF EXISTS idx_requirement_activity_entity_type_created_id;
  DROP INDEX IF EXISTS idx_people_objectives_person_objective;
  DROP INDEX IF EXISTS idx_people_requirements_person_requirement;
  DROP INDEX IF EXISTS idx_projects_client_name_id;
  DROP INDEX IF EXISTS idx_worked_times_person_date_id;
  DROP INDEX IF EXISTS idx_worked_times_project_date_id;
  DROP INDEX IF EXISTS idx_worked_times_objective_id;
  DROP INDEX IF EXISTS idx_unworked_times_person_date_id;
  DROP INDEX IF EXISTS idx_week_assigned_times_person_datefrom_id;
  DROP INDEX IF EXISTS idx_user_project_permissions_user_id;
`;

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(CREATE_INDEXES);
    await queryInterface.sequelize.query(CREATE_USER_PROJECT_PERMISSIONS_INDEX);
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(DROP_INDEXES);
  },

  INDEX_NAMES,
  INDEX_NAMES_OWNED_BY_OTHER_MIGRATION,
  CREATE_INDEXES,
  CREATE_USER_PROJECT_PERMISSIONS_INDEX,
  DROP_INDEXES,
};
