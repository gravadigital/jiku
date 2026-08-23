import { Sequelize } from 'sequelize-typescript';

/**
 * Conexión de SOLO LECTURA del servicio de consultas.
 *
 * SIN los modelos A PROPÓSITO, y es la decisión más importante del módulo: el paquete de modelos
 * exporta clases que se registran en UN Sequelize (ADR-005), y hasta hoy eso funcionaba porque
 * api y core son procesos distintos. Dos instancias en el MISMO proceso se pelean las clases: la
 * segunda que registre el índice de modelos del paquete las REASIGNA, y `Objective.findAll()`
 * empieza a salir por la conexión equivocada. En el sentido malo —consultas por el usuario
 * dueño— rompe ADR-001 SIN UN SOLO SÍNTOMA. Por eso acá no se registra ninguna clase y las
 * consultas usan SQL explícito (`db.query(...)`), no el ORM.
 *
 * Se construye AL IMPORTARSE, igual que `models/index.ts`: las variables tienen que estar
 * puestas antes (dotenv en `src/index.ts`, `tests/setup-env.ts` en los tests).
 *
 * NO conecta acá: Sequelize abre el socket en el primer query. Una credencial mal configurada
 * falla ahí, RUIDOSAMENTE, que es el modo de falla que se quiere — por eso tampoco hay
 * `authenticate()` de arranque ni reintentos.
 */
export const readDb = new Sequelize({
  database: process.env.POSTGRESQL_DB,
  username: process.env.POSTGRESQL_READ_USER,
  password: process.env.POSTGRESQL_READ_PASSWORD,
  port: Number(process.env.POSTGRESQL_PORT) || 5432,
  host: process.env.POSTGRESQL_HOST,
  dialect: 'postgres',
  logging: false,
  // Pool PROPIO: el de lectura no le come conexiones al de escritura. La asimetría con el
  // default implícito de la conexión de escritura (5) está documentada en `core/README.md`.
  pool: { max: Number(process.env.POSTGRESQL_READ_POOL_MAX) || 10 },
  dialectOptions: {
    // ESTRICTAMENTE MENOR que NATS_QUERY_TIMEOUT_MS del caller: la base tiene que cortar antes
    // que el bus, o el caller espera un timeout que no explica nada.
    statement_timeout: Number(process.env.POSTGRESQL_STATEMENT_TIMEOUT_MS) || 8000,
  },
});

export default readDb;
