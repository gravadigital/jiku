import 'mocha';
import 'should';
import { QueryTypes, Sequelize as SequelizeLib } from 'sequelize';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { initDb } from '../mocks/app';
import { sequelize } from '../../lib/models';

/**
 * S-021: los 18 índices compuestos que la paginación keyset de REQ-006 necesita.
 *
 * **Es el primer test de una migración del producto**, y conviene decir por qué se puede acá y
 * no se pudo antes: una migración de SOLO ÍNDICES no depende del estado de los datos. El
 * esquema que deja `sequelize.sync()` tiene las mismas tablas y columnas que producción, así
 * que el DDL de `CREATE INDEX` que se ejecuta es idéntico. El archivo aplica la migración **a
 * mano** (`migration.up(...)`), no corre `upgrade-db` y no toca `sequelize_meta`.
 *
 * LO QUE PRUEBA: que la migración crea los 18 índices con el nombre, las columnas, el orden y
 * la dirección exactos que declara `docs/db-schemas/jiku.md`; que el GIN de `tags` es GIN; que
 * todo índice que sostiene un orden termina en `id` en la dirección de la columna anterior
 * (CA-11); que el bloque `DO $$` de `user_project_permissions` resuelve por CATÁLOGO y no por
 * nombre, o sea que NO crea el duplicado cuando ya hay un índice cuya primera columna es
 * `user_id` (CA-8); que `up()` dos veces seguidas no rompe (CA-14); que el `down()` **no borra
 * nada que existiera antes** (CA-13); y que los tres `EXPLAIN` de la story se resuelven por el
 * índice esperado.
 *
 * LO QUE NO PRUEBA: que los índices PREEXISTENTES de CA-10 sigan ahí. En esta base **no existe
 * ninguno** —`attachments(entity_type, entity_id)`, `projects(client_id)`,
 * `files(uploaded_by, byte_status)` y el cuarto que el relevamiento encontró,
 * `idx_worked_times_requirement_id`— porque los creó una migración y `sync()` no los reproduce.
 * Es el límite declarado de ADR-013: el esquema de la suite lo construye `sync()`, no las
 * migraciones, y son dos fuentes de verdad. Lo único que se puede afirmar acá es la mitad
 * verificable: que esta migración **no los nombra en ninguna sentencia y no crea nada nuevo**
 * sobre `attachments` ni sobre `files`. La otra mitad —que existen, con idéntico `indexdef`,
 * antes y después de aplicar contra una base migrada— es una REVISIÓN a mano, y su evidencia
 * está en `docs/changelog/2026-08-24-indices-compuestos-para-el-keyset.md`.
 *
 * TAMPOCO PRUEBA TIEMPOS. `EXPLAIN`, no `EXPLAIN ANALYZE`: el plan, no el reloj. Un test de
 * duración es ruidoso y depende del tamaño del entorno.
 *
 * EL ARCHIVO DEJA LA BASE COMO LA ENCONTRÓ. Todo `describe` que aplica la migración la revierte
 * en su `after`: un índice olvidado acá contamina a los 61 archivos de rutas que corren después
 * (ADR-013: no depender del orden de ejecución entre archivos).
 */

// La migración es `.js` (requisito de sequelize-cli). `require` y no `import`: el tsconfig no
// tiene `allowJs`, y no hace falta activarlo para cargar un módulo CommonJS.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const migration = require('../../db-upgrade/migrations/20260824_02_query_indexes.js');

const MIGRATIONS_DIR = join(__dirname, '../../db-upgrade/migrations');
const MIGRATION_PATH = join(MIGRATIONS_DIR, '20260824_02_query_indexes.js');

/** Las 11 tablas que la migración toca, más `attachments` y `files`, que NO tiene que tocar. */
const AFFECTED_TABLES = [
  'objectives',
  'requirements',
  'objective_activity',
  'requirement_activity',
  'people_objectives',
  'people_requirements',
  'projects',
  'worked_times',
  'unworked_times',
  'week_assigned_times',
  'user_project_permissions',
  'attachments',
  'files',
];

/** Los 18 nombres salen de la propia migración: si las dos listas se separan, se separan juntas. */
const EXPECTED_INDEXES: string[] = migration.INDEX_NAMES;

/**
 * Los índices que sostienen un ORDEN, que son los que CA-11 obliga a terminar en `id` con la
 * dirección de la columna anterior. Es la lista que enumera TS-15 en el Story Plan.
 *
 * No incluye a los dos de actividad ni al de `projects`, que también terminan en `id`: TS-15 los
 * deja afuera porque su última columna no sostiene un criterio de orden con dirección propia —
 * `(objective_id, type_of_activity, created_at, id)` y `(client_id, name, id)` son todos
 * ascendentes. Su forma exacta la fijan las aserciones `eql` de TS-7 y TS-13, que comparan la
 * lista de columnas completa; el loop genérico de más abajo **no** pasa sobre ellos.
 */
const ORDERING_INDEXES = [
  'idx_objectives_project_created_id',
  'idx_objectives_priority_created_id',
  'idx_objectives_state_created_id',
  'idx_requirements_project_created_id',
  'idx_requirements_state_created_id',
  'idx_worked_times_person_date_id',
  'idx_worked_times_project_date_id',
  'idx_unworked_times_person_date_id',
  'idx_week_assigned_times_person_datefrom_id',
];

/**
 * Los tres que CA-10 enumera: existen por otra migración y esta no los puede nombrar ni tocar.
 *
 * El cuarto preexistente, `idx_worked_times_requirement_id`, NO va en esta lista: la migración sí
 * lo nombra —lo crea con `IF NOT EXISTS` para la base de `sync()`, donde no está— y lo que no hace
 * es dropearlo. Ese caso se verifica en el `describe` de TS-17.
 */
const PREEXISTING_INDEX_NAMES = [
  'idx_projects_client_id',
  'idx_files_uploader_byte_status',
  'idx_attachments_entity',
];

interface IndexRow {
  tablename: string;
  indexname: string;
  indexdef: string;
}

function catalog(): Promise<IndexRow[]> {
  return sequelize.query<IndexRow>(
    `SELECT tablename, indexname, indexdef
       FROM pg_indexes
      WHERE schemaname = 'public' AND tablename IN (:tables)
      ORDER BY tablename, indexname`,
    { type: QueryTypes.SELECT, replacements: { tables: AFFECTED_TABLES } }
  );
}

function up(): Promise<unknown> {
  return migration.up(sequelize.getQueryInterface(), SequelizeLib);
}

function down(): Promise<unknown> {
  return migration.down(sequelize.getQueryInterface(), SequelizeLib);
}

/**
 * `down()` más la limpieza del índice que la migración puede crear pero NO dropea.
 *
 * `idx_worked_times_requirement_id` lo posee `20260626_01`, que lo creó junto con la columna
 * `requirement_id`; el `down` de S-021 no lo toca a propósito (ver el `describe` de TS-17). En
 * una base construida por `sync()` ese índice no existe, así que el `up` sí lo crea y hay que
 * sacarlo a mano para que el archivo deje la base como la encontró (ADR-013).
 */
function revert(): Promise<unknown> {
  return down().then(() =>
    sequelize.query('DROP INDEX IF EXISTS idx_worked_times_requirement_id')
  );
}

function indexByName(rows: IndexRow[], name: string): IndexRow | undefined {
  return rows.find((row) => row.indexname === name);
}

/**
 * Saca la lista de columnas de un `indexdef`. Ejemplo de entrada:
 *   CREATE INDEX idx_x ON public.objectives USING btree (project_id, created_at DESC, id DESC)
 */
function indexColumns(indexdef: string): string[] {
  const match = /USING\s+\w+\s+\(([^)]*)\)/.exec(indexdef);
  if (!match) {
    throw new Error(`indexdef sin lista de columnas: ${indexdef}`);
  }
  return match[1].split(',').map((column) => column.trim());
}

/** `created_at DESC` -> 'DESC'; `id` -> 'ASC' (el default de PostgreSQL). */
function direction(column: string): string {
  return /\bDESC\b/.test(column) ? 'DESC' : 'ASC';
}

/** Quita comentarios SQL para poder afirmar sobre SENTENCIAS y no sobre prosa. */
function stripSqlComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ');
}

interface PlanNode {
  'Node Type'?: string;
  'Index Name'?: string;
  Plans?: PlanNode[];
}

function planNodes(root: PlanNode): PlanNode[] {
  const collected: PlanNode[] = [root];
  (root.Plans || []).forEach((child) => {
    planNodes(child).forEach((node) => collected.push(node));
  });
  return collected;
}

/**
 * Corre un `EXPLAIN (FORMAT JSON)` DENTRO de una transacción con `SET LOCAL enable_seqscan = off`
 * y devuelve los nodos del plan ya parseados.
 *
 * `SET LOCAL` y no `SET` pelado: el pool reutiliza conexiones y un `SET` se filtraría a los
 * tests que corren después. Y hace falta desactivar el seqscan porque las tablas de la suite
 * están VACÍAS: el planner elegiría `Seq Scan` legítimamente por tamaño, y el test estaría
 * midiendo el tamaño del entorno en vez de si el índice es utilizable por la consulta.
 *
 * Se parsea el plan en vez de buscar substrings sobre el JSON serializado: el formato del
 * driver mete o saca espacios (`"Node Type": "Sort"` vs `"Node Type":"Sort"`) y un test que
 * dependa de eso falla por una razón que no es la suya.
 */
function explain(sql: string): Promise<PlanNode[]> {
  return sequelize.transaction(async (transaction) => {
    await sequelize.query('SET LOCAL enable_seqscan = off;', { transaction });
    const rows = await sequelize.query<Record<string, unknown>>(
      `EXPLAIN (FORMAT JSON) ${sql}`,
      { type: QueryTypes.SELECT, transaction }
    );
    const raw = rows[0]['QUERY PLAN'];
    const parsed = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Array<{ Plan: PlanNode }>;
    return planNodes(parsed[0].Plan);
  });
}

describe('S-021: migración de índices del keyset (20260824_02_query_indexes)', () => {
  /** El catálogo tal como estaba ANTES de que este archivo aplicara nada. */
  let baseline: IndexRow[] = [];

  before(function () {
    this.timeout(30000);
    return initDb()
      .then(() => catalog())
      .then((rows) => {
        baseline = rows;
      });
  });

  describe('el archivo de la migración', () => {
    let source = '';
    let statements = '';

    before(() => {
      source = readFileSync(MIGRATION_PATH, 'utf8');
      statements = stripSqlComments(
        [
          migration.CREATE_INDEXES,
          migration.CREATE_USER_PROJECT_PERMISSIONS_INDEX,
          migration.DROP_INDEXES,
        ].join('\n')
      );
    });

    it('TS-1: es un único archivo JavaScript con `use strict`', () => {
      source.should.startWith("'use strict';");
      EXPECTED_INDEXES.should.have.length(18);

      // "Exactamente una" migración de índices de consulta, y el conteo total. Es la aserción
      // que rompe si alguien agrega un segundo `*_query_indexes.js` en vez de editar este, o si
      // el archivo se renombra sin actualizar la documentación (TS-24).
      //
      // EL CONTEO SUBE CUANDO SE AGREGA UNA MIGRACIÓN LEGÍTIMA, y actualizarlo es parte del
      // cambio: 103 -> 104 con `20260825_01_users_email_nullable.js`, y 104 -> 105 con
      // `20260901_01_activity_edited_at_edited_by.js` (S-046). Que rompa es el punto — obliga a
      // mirar si la migración nueva era la que se quería. Al tocarlo, actualizá también el
      // "Cantidad" de `docs/db-schemas/jiku.md`.
      const migrations = readdirSync(MIGRATIONS_DIR);
      migrations.filter((name) => name.includes('query_indexes')).should.be.eql([
        '20260824_02_query_indexes.js',
      ]);
      migrations.should.have.length(105);
    });

    it('TS-2: solo crea índices — ni ALTER, ni columnas, ni tipos, ni datos', () => {
      const forbidden =
        /alter\s+table|add\s+column|drop\s+column|create\s+type|create\s+table|insert\s+into|update\s+\w+\s+set/i;
      source.should.not.match(forbidden);
    });

    it('TS-2: la única sentencia que no es CREATE/DROP INDEX es el bloque DO $$ de CA-8', () => {
      // Los dos bloques de sentencias sueltas se parten por `;` y cada una tiene que ser un
      // CREATE INDEX o un DROP INDEX. El DO $$ va aparte a propósito: es un solo statement con
      // `;` adentro (`END IF;`), así que partirlo por `;` no tendría sentido.
      const listed = [migration.CREATE_INDEXES, migration.DROP_INDEXES]
        .map((sql: string) => stripSqlComments(sql))
        .join('\n');

      listed
        .split(';')
        .map((statement) => statement.trim())
        .filter((statement) => statement.length > 0)
        .forEach((statement) => {
          statement.should.match(/^(CREATE INDEX|DROP INDEX)/i);
        });

      // El condicional de CA-8: un DO $$ cuya única sentencia de DDL es un CREATE INDEX.
      const conditional = stripSqlComments(migration.CREATE_USER_PROJECT_PERMISSIONS_INDEX).trim();
      conditional.should.startWith('DO $$');
      conditional.should.endWith('END $$;');
      (conditional.match(/\b(CREATE|DROP|ALTER|INSERT|UPDATE|DELETE)\b/gi) || []).should.be.eql([
        'CREATE',
      ]);

      // Y entre los tres cubren todo el SQL del archivo: no hay una cuarta sentencia suelta.
      statements.length.should.be.above(0);
    });

    it('TS-14: ninguna sentencia nombra a los tres índices preexistentes de CA-10', () => {
      // Se afirma sobre las SENTENCIAS y no sobre el archivo entero a propósito: el bloque de
      // cabecera SÍ nombra `idx_projects_client_id`, y tiene que hacerlo — dejar escrito que NO
      // se borra es justamente la garantía de CA-9.
      PREEXISTING_INDEX_NAMES.forEach((name) => {
        statements.should.not.containEql(name);
      });
    });

    it('TS-16: la decisión de CONCURRENTLY está escrita, con los tamaños medidos', () => {
      source.should.match(/CONCURRENTLY: DESCARTADO/);
      source.should.match(/objectives\s+[\d.]+\s+filas/);
      source.should.match(/requirements\s+[\d.]+\s+filas/);
      source.should.match(/objective_activity\s+[\d.]+\s+filas/);
      source.should.match(/UMBRAL PARA RECONSIDERARLO/);
    });
  });

  describe('el catálogo después de aplicar la migración', () => {
    let rows: IndexRow[] = [];

    before(function () {
      this.timeout(30000);
      return up()
        .then(() => catalog())
        .then((result) => {
          rows = result;
        });
    });

    after(() => revert());

    it('TS-3: se crean los tres índices de objectives', () => {
      const names = rows.filter((row) => row.tablename === 'objectives').map((row) => row.indexname);
      names.should.containEql('idx_objectives_project_created_id');
      names.should.containEql('idx_objectives_priority_created_id');
      names.should.containEql('idx_objectives_state_created_id');
    });

    it('TS-4: el índice de priority es DESC en las tres columnas', () => {
      const row = indexByName(rows, 'idx_objectives_priority_created_id');
      (row === undefined).should.be.false();
      indexColumns((row as IndexRow).indexdef).should.be.eql([
        'priority DESC',
        'created_at DESC',
        'id DESC',
      ]);
    });

    it('TS-5: los dos compuestos de requirements se crean y terminan en id DESC', () => {
      ['idx_requirements_project_created_id', 'idx_requirements_state_created_id'].forEach(
        (name) => {
          const row = indexByName(rows, name);
          (row === undefined).should.be.false();
          (row as IndexRow).tablename.should.be.equal('requirements');
          indexColumns((row as IndexRow).indexdef).pop()!.should.be.equal('id DESC');
        }
      );
    });

    it('TS-6: el índice de tags es GIN', () => {
      const row = indexByName(rows, 'idx_requirements_tags_gin');
      (row === undefined).should.be.false();
      (row as IndexRow).indexdef.should.containEql('USING gin (tags)');
    });

    it('TS-7: los dos índices de actividad, con las cuatro columnas en orden', () => {
      const objective = indexByName(rows, 'idx_objective_activity_entity_type_created_id');
      (objective === undefined).should.be.false();
      indexColumns((objective as IndexRow).indexdef).should.be.eql([
        'objective_id',
        'type_of_activity',
        'created_at',
        'id',
      ]);

      const requirement = indexByName(rows, 'idx_requirement_activity_entity_type_created_id');
      (requirement === undefined).should.be.false();
      indexColumns((requirement as IndexRow).indexdef).should.be.eql([
        'requirement_id',
        'type_of_activity',
        'created_at',
        'id',
      ]);
    });

    it('TS-8: los índices de las dos tablas intermedias', () => {
      const objectives = indexByName(rows, 'idx_people_objectives_person_objective');
      (objectives === undefined).should.be.false();
      indexColumns((objectives as IndexRow).indexdef).should.be.eql(['person_id', 'objective_id']);

      const requirements = indexByName(rows, 'idx_people_requirements_person_requirement');
      (requirements === undefined).should.be.false();
      indexColumns((requirements as IndexRow).indexdef).should.be.eql([
        'person_id',
        'requirement_id',
      ]);
    });

    it('TS-9: los cuatro índices de los tres recursos de tiempo, con su dirección', () => {
      const worked = indexByName(rows, 'idx_worked_times_person_date_id');
      (worked === undefined).should.be.false();
      indexColumns((worked as IndexRow).indexdef).should.be.eql([
        'person_id',
        'date DESC',
        'id DESC',
      ]);

      const workedProject = indexByName(rows, 'idx_worked_times_project_date_id');
      (workedProject === undefined).should.be.false();
      indexColumns((workedProject as IndexRow).indexdef).should.be.eql([
        'project_id',
        'date DESC',
        'id DESC',
      ]);

      // Estos dos van ASCENDENTES porque su sort default lo es (["date"] y ["dateFrom"]). No
      // son intercambiables con los de arriba.
      const unworked = indexByName(rows, 'idx_unworked_times_person_date_id');
      (unworked === undefined).should.be.false();
      indexColumns((unworked as IndexRow).indexdef).should.be.eql(['person_id', 'date', 'id']);

      const week = indexByName(rows, 'idx_week_assigned_times_person_datefrom_id');
      (week === undefined).should.be.false();
      indexColumns((week as IndexRow).indexdef).should.be.eql(['person_id', 'date_from', 'id']);
    });

    it('TS-10: los dos índices simples que sostienen totalMinutes', () => {
      const requirement = indexByName(rows, 'idx_worked_times_requirement_id');
      (requirement === undefined).should.be.false();
      indexColumns((requirement as IndexRow).indexdef).should.be.eql(['requirement_id']);

      const objective = indexByName(rows, 'idx_worked_times_objective_id');
      (objective === undefined).should.be.false();
      indexColumns((objective as IndexRow).indexdef).should.be.eql(['objective_id']);
    });

    it('TS-11: sin índice previo sobre user_id, la migración lo crea', () => {
      // En esta base el modelo no declara la constraint única, así que `sync()` deja la tabla
      // sin ningún índice sobre `user_id` y el DO $$ tiene que crearlo.
      const row = indexByName(rows, 'idx_user_project_permissions_user_id');
      (row === undefined).should.be.false();
      indexColumns((row as IndexRow).indexdef).should.be.eql(['user_id']);
    });

    it('TS-13: el compuesto de projects se crea y ningún índice previo desapareció', () => {
      const row = indexByName(rows, 'idx_projects_client_name_id');
      (row === undefined).should.be.false();
      indexColumns((row as IndexRow).indexdef).should.be.eql(['client_id', 'name', 'id']);

      baseline.forEach((previous) => {
        (indexByName(rows, previous.indexname) === undefined).should.be.false();
      });
    });

    it('TS-14: no aparece ningún índice nuevo sobre attachments ni sobre files', () => {
      ['attachments', 'files'].forEach((table) => {
        const before = baseline.filter((row) => row.tablename === table).map((r) => r.indexname);
        const after = rows.filter((row) => row.tablename === table).map((r) => r.indexname);
        after.should.be.eql(before);
      });
    });

    it('los 18 índices declarados están todos presentes', () => {
      EXPECTED_INDEXES.forEach((name) => {
        (indexByName(rows, name) === undefined).should.be.false();
      });
    });

    it('TS-15: todo índice que sostiene un orden termina en `id`, en la dirección de la anterior', () => {
      // Genérico y no nueve asserts copiados: es el que atrapa un índice futuro mal escrito.
      ORDERING_INDEXES.forEach((name) => {
        const row = indexByName(rows, name);
        (row === undefined).should.be.false();

        const columns = indexColumns((row as IndexRow).indexdef);
        columns.length.should.be.aboveOrEqual(2);

        const last = columns[columns.length - 1];
        const previous = columns[columns.length - 2];

        last.should.match(/^id\b/);
        direction(last).should.be.equal(direction(previous));
      });
    });
  });

  describe('TS-12: con un índice previo cuya primera columna es user_id', () => {
    let rows: IndexRow[] = [];

    before(function () {
      this.timeout(30000);
      // Se fabrica el escenario que CA-8 nombra: el índice implícito de una constraint única
      // (user_id, project_id), cuyo prefijo ya sirve al recorte del modo externo. Es
      // EXACTAMENTE lo que hay en una base migrada (`uk_user_project_permissions`, de
      // 20260529_07), y lo que `IF NOT EXISTS` no vería, porque compara por NOMBRE.
      return sequelize
        .query(
          `CREATE UNIQUE INDEX uk_upp_user_project
             ON user_project_permissions (user_id, project_id)`
        )
        .then(() => up())
        .then(() => catalog())
        .then((result) => {
          rows = result;
        });
    });

    after(() => {
      return revert().then(() =>
        sequelize.query('DROP INDEX IF EXISTS uk_upp_user_project')
      );
    });

    it('no crea el duplicado idx_user_project_permissions_user_id', () => {
      (indexByName(rows, 'idx_user_project_permissions_user_id') === undefined).should.be.true();
    });

    it('el índice previo sigue existiendo, y un solo índice cubre (user_id)', () => {
      (indexByName(rows, 'uk_upp_user_project') === undefined).should.be.false();

      const covering = rows
        .filter((row) => row.tablename === 'user_project_permissions')
        .filter((row) => indexColumns(row.indexdef)[0].startsWith('user_id'));
      covering.should.have.length(1);
    });

    it('la tabla queda con el índice previo y la PK, sin ningún agregado', () => {
      // La otra mitad del output esperado de TS-12: no alcanza con que el duplicado no exista
      // por nombre, el conteo de índices de la tabla no puede haber subido.
      rows
        .filter((row) => row.tablename === 'user_project_permissions')
        .map((row) => row.indexname)
        .sort()
        .should.be.eql(['uk_upp_user_project', 'user_project_permissions_pkey']);
    });
  });

  describe('TS-17: rollback simétrico', () => {
    let before_: IndexRow[] = [];
    let after_: IndexRow[] = [];

    before(function () {
      this.timeout(30000);
      return catalog()
        .then((rows) => {
          before_ = rows;
          return up();
        })
        .then(() => down())
        .then(() => catalog())
        .then((rows) => {
          after_ = rows;
        });
    });

    after(() => {
      // Ver más abajo: en esta base el `up` crea `idx_worked_times_requirement_id` y el `down`
      // no lo dropea a propósito. Se limpia acá para dejar la base como se la encontró (ADR-013).
      return sequelize.query('DROP INDEX IF EXISTS idx_worked_times_requirement_id');
    });

    it('el down no borra NADA que existiera antes — que es lo que CA-13 garantiza', () => {
      const names = after_.map((row) => row.indexname);
      before_.forEach((previous) => {
        names.should.containEql(previous.indexname);
        indexByName(after_, previous.indexname)!.indexdef.should.be.equal(previous.indexdef);
      });
    });

    it('lo único que el down puede dejar atrás es el índice que posee otra migración', () => {
      // DESVIACIÓN DELIBERADA de la letra de TS-17 ("los dos snapshots son exactamente iguales").
      // La igualdad estricta no puede ser cierta en los dos entornos a la vez:
      //   - `idx_worked_times_requirement_id` lo creó `20260626_01` JUNTO CON la columna
      //     `requirement_id`, así que en toda base MIGRADA ya existe. Si el `down` lo dropeara,
      //     borraría un índice preexistente y ahí sí violaría CA-13 ("de los mismos nombres que
      //     creó, y ninguno más").
      //   - En ESTA base, construida por `sync()`, el modelo no declara `indexes`, así que el
      //     índice no está y el `up` sí lo crea. Como el `down` no lo dropea, queda uno de más.
      // La garantía real de CA-13 es la del test anterior (no se pierde nada). Acá se fija que
      // el excedente es EXACTAMENTE ese índice y ninguno otro: si mañana el `down` se olvidara
      // de otro nombre, este assert lo ve.
      const added = after_
        .map((row) => row.indexname)
        .filter((name) => !before_.some((previous) => previous.indexname === name));

      added.should.be.eql(migration.INDEX_NAMES_OWNED_BY_OTHER_MIGRATION);
    });

    it('el down no borra ninguno de los índices preexistentes de CA-10', () => {
      // En esta base ninguno de los tres de CA-10 existe (ADR-013), así que lo verificable acá
      // es que el catálogo de `attachments` y `files` no perdió NI GANÓ nada.
      ['attachments', 'files'].forEach((table) => {
        const previous = before_.filter((row) => row.tablename === table);
        const current = after_.filter((row) => row.tablename === table);
        current.should.be.eql(previous);
      });
    });
  });

  describe('TS-18: idempotencia', () => {
    let firstRun: IndexRow[] = [];
    let secondRun: IndexRow[] = [];

    before(function () {
      this.timeout(30000);
      return up()
        .then(() => catalog())
        .then((rows) => {
          firstRun = rows;
          return up();
        })
        .then(() => catalog())
        .then((rows) => {
          secondRun = rows;
        });
    });

    after(() => revert());

    it('up() dos veces seguidas no lanza y no agrega nada', () => {
      secondRun.should.be.eql(firstRun);
    });
  });

  describe('los planes de ejecución (EXPLAIN, no EXPLAIN ANALYZE)', () => {
    before(function () {
      this.timeout(30000);
      return up();
    });

    after(() => revert());

    it('TS-19: el keyset de tasks.list usa el índice y no tiene nodo Sort', () => {
      // IGUALDAD en la columna líder (`project_id = 12`), NO un `IN`. Un `state IN (...)`
      // produce un `ScalarArrayOpExpr` que no preserva el orden de las columnas trailing entre
      // elementos del array, así que el plan puede conservar un `Sort` legítimamente. Afirmar
      // lo contrario sería un test que miente.
      return explain(
        `SELECT id, created_at FROM objectives
          WHERE project_id = 12 AND (created_at, id) < ('2026-08-01T00:00:00.000Z', 9999)
          ORDER BY created_at DESC, id DESC LIMIT 201`
      ).then((nodes) => {
        nodes
          .map((node) => node['Index Name'])
          .should.containEql('idx_objectives_project_created_id');
        nodes.map((node) => node['Node Type']).should.not.containEql('Sort');
      });
    });

    it('TS-20: la subconsulta de totalMinutes se resuelve por índice', () => {
      return explain(
        'SELECT SUM(minutes) FROM worked_times WHERE requirement_id = 42'
      ).then((nodes) => {
        nodes.map((node) => node['Index Name']).should.containEql('idx_worked_times_requirement_id');
      });
    });

    it('TS-21: el recorte del modo externo se resuelve por índice', () => {
      return explain(
        `SELECT project_id FROM user_project_permissions WHERE user_id = 'zitadel-sub-test'`
      ).then((nodes) => {
        nodes
          .map((node) => node['Index Name'])
          .should.containEql('idx_user_project_permissions_user_id');
      });
    });
  });
});
