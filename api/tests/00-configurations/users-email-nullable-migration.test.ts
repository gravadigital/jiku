import 'mocha';
import 'should';
import { QueryTypes, Sequelize as SequelizeLib } from 'sequelize';
import { readFileSync } from 'fs';
import { join } from 'path';
import { initDb } from '../mocks/app';
import { sequelize } from '../../lib/models';

/**
 * `20260825_01_users_email_nullable`: `users.email` deja de ser `NOT NULL`.
 *
 * POR QUE ESTE ARCHIVO EXISTE, siendo que la suite ya cubre el comportamiento. Los tests de
 * `core` verifican que el evento de una identidad de servicio se espeje con `email` en NULL,
 * pero corren contra el esquema que construye `sequelize.sync()`, y ese esquema sale DEL
 * MODELO: apenas `@jiku/models` declara `allowNull: true`, la columna ya es nullable ahi sin
 * que la migracion haya hecho nada. O sea que la suite entera pasaria **aunque la migracion
 * estuviera vacia o mal escrita**, y en produccion el INSERT fallaria contra el NOT NULL.
 *
 * Es exactamente el riesgo que `docs/db-schemas/jiku.md` declara como el mas serio del esquema
 * (NFR-R07) —dos fuentes de verdad para la misma estructura— y el unico lugar donde se puede
 * cerrar es aca: aplicando la migracion A MANO y mirando el catalogo, con el precedente de
 * `query-indexes-migration.test.ts`.
 *
 * SE PUEDE HACER PORQUE LA MIGRACION NO DEPENDE DEL ESTADO DE LOS DATOS. Es un ALTER de
 * catalogo sobre una tabla y una columna que `sync()` produce igual que produccion, asi que el
 * DDL que se ejecuta es identico. No corre `upgrade-db` y no toca `sequelize_meta`.
 *
 * EL `down` SE PRUEBA EN SUS DOS RAMAS, y la segunda es la que importa: restaurar el NOT NULL
 * FALLA si ya existe una fila con `email` en NULL, y esta escrito para fallar. Un `down` que
 * completara direcciones inventadas para poder correr dejaria datos falsos en una tabla que es
 * un ESPEJO del proveedor de identidad, que es justo lo que el `up` decidio no hacer.
 */

const MIGRATION_NAME = '20260825_01_users_email_nullable.js';
const MIGRATION_PATH = join(__dirname, '../../db-upgrade/migrations', MIGRATION_NAME);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const migration = require(MIGRATION_PATH);

/** Ids propios del archivo: el truncado es al arrancar la corrida, no entre tests. */
const SERVICE_ID = 'mig-email-service';
const PERSON_ID = 'mig-email-person';

interface NullableRow {
  is_nullable: string;
}

/**
 * Le pregunta AL CATALOGO si la columna admite NULL, en vez de deducirlo de que un INSERT haya
 * andado: es la unica forma de distinguir "la restriccion no esta" de "la fila que probe no la
 * violaba".
 */
function isNullable(): Promise<string> {
  return sequelize
    .query<NullableRow>(
      `SELECT is_nullable
         FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'email'`,
      { type: QueryTypes.SELECT }
    )
    .then((rows) => rows[0].is_nullable);
}

function up(): Promise<unknown> {
  return migration.up(sequelize.getQueryInterface(), SequelizeLib);
}

function down(): Promise<unknown> {
  return migration.down(sequelize.getQueryInterface(), SequelizeLib);
}

function insertUser(id: string, email: string | null): Promise<unknown> {
  return sequelize.query(
    `INSERT INTO users (id, name, username, email, roles, identity_type, created_at, updated_at)
     VALUES (:id, 'X', :id, :email, '[]'::jsonb, :itype, now(), now())`,
    {
      type: QueryTypes.INSERT,
      replacements: {
        id,
        email,
        itype: email === null ? 'service' : 'person',
      },
    }
  );
}

function cleanUp(): Promise<unknown> {
  return sequelize.query('DELETE FROM users WHERE id IN (:ids)', {
    type: QueryTypes.DELETE,
    replacements: { ids: [SERVICE_ID, PERSON_ID] },
  });
}

describe('migración 20260825_01 — users.email nullable', () => {
  before(function () {
    this.timeout(60000);
    return initDb();
  });

  afterEach(() => {
    return cleanUp();
  });

  after(() => {
    // La migración queda APLICADA al terminar: es el estado que el resto de la suite espera,
    // y coincide con el que el modelo declara.
    return up();
  });

  it('TS-1: es un único archivo JavaScript con `use strict` y sin backfill', () => {
    const source = readFileSync(MIGRATION_PATH, 'utf8');
    source.should.startWith("'use strict';");

    // Ni UPDATE ni INSERT: soltar un NOT NULL no toca una sola fila, y completar direcciones
    // inventadas es exactamente lo que se decidió NO hacer.
    source.should.not.match(/update\s+users\s+set|insert\s+into/i);

    // Tampoco crea ni borra nada más: el alcance es una columna.
    source.should.not.match(/create\s+(table|type|index)|drop\s+(table|type|column)/i);
  });

  it('TS-2: `up()` deja la columna nullable en el CATÁLOGO', async () => {
    await up();

    (await isNullable()).should.equal('YES');
  });

  it('TS-3: con la migración aplicada, un service user SIN email se inserta', async () => {
    await up();

    // Es la operación exacta que el consumidor del evento hace y que antes fallaba contra el
    // NOT NULL: `syncUser` -> `User.create({ ..., email: null })`.
    await insertUser(SERVICE_ID, null);

    const rows = await sequelize.query<{ email: string | null }>(
      'SELECT email FROM users WHERE id = :id',
      { type: QueryTypes.SELECT, replacements: { id: SERVICE_ID } }
    );
    (rows[0].email === null).should.be.true();
  });

  it('TS-4: `up()` dos veces seguidas no rompe', async () => {
    await up();
    await up();

    // Soltar un NOT NULL que ya no está es un no-op para PostgreSQL. Importa porque la
    // migración corre AL ARRANCAR LA API: fallar ahí no es un error que alguien lee, es la api
    // que no levanta.
    (await isNullable()).should.equal('YES');
  });

  it('TS-5: `down()` restaura el NOT NULL cuando no hay filas en NULL', async () => {
    await up();
    await insertUser(PERSON_ID, 'persona@grava.digital');

    await down();

    (await isNullable()).should.equal('NO');

    // Y la restricción está VIVA, no solo declarada.
    let rejected = false;
    await insertUser(SERVICE_ID, null).catch(() => {
      rejected = true;
    });
    rejected.should.be.true();
  });

  it('TS-6: `down()` FALLA si ya existe una fila de servicio, y es el comportamiento buscado', async () => {
    await up();
    await insertUser(SERVICE_ID, null);

    let message = '';
    await down().catch((error: Error) => {
      message = error.message;
    });

    // PostgreSQL nombra la columna y la tabla, así que el fallo es diagnosticable. Revertir de
    // verdad exige decidir ANTES qué pasa con esas filas —borrarlas, o completarlas a mano con
    // un criterio explícito—, y borrarlas no pierde nada: la identidad se vuelve a espejar sola
    // en su próxima autenticación contra el bus.
    message.should.match(/contains null values/i);
    // Y el `down` fallido NO dejó la columna a medias.
    (await isNullable()).should.equal('YES');
  });
});
