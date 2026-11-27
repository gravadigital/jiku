'use strict';

/**
 * Agrega `users.roles` y `users.identity_type`: las dos columnas donde S-016 va a espejar la
 * identidad que el auth-callout autentica en el bus.
 *
 * PURAMENTE ADITIVA Y SIN CAMBIO DE COMPORTAMIENTO. Al terminar, las dos columnas existen,
 * TODAS las filas dicen `identity_type = 'person'` y `roles = '[]'`, y NADA las escribe: el
 * consumidor del evento es S-016 y la compuerta de autorizacion es S-017.
 *
 * UN SOLO ALTER CON DOS ADD COLUMN, no dos sentencias: es un solo pase sobre el catalogo, y con
 * defaults no volatiles PostgreSQL >= 11 no reescribe la tabla. Por eso no hace falta ventana de
 * mantenimiento. `queryInterface.addColumn` emite un ALTER por llamada, asi que no puede
 * expresarlo; el precedente de SQL crudo es 20260820_01.
 *
 * SIN BACKFILL EXPLICITO: los DEFAULT ya dejan toda fila preexistente en 'person' / '[]'.
 * 'person' es correcto para todas porque hoy `users` se puebla a mano con las personas del
 * equipo y ningun service user tiene fila. '[]' es la opcion conservadora: no inventa
 * autorizacion que nadie concedio. La fila se corrige en la proxima autenticacion de esa
 * identidad al bus, una vez que S-016 exista.
 *
 * LOS DEFAULT SE CONSERVAN (no hay ALTER COLUMN ... DROP DEFAULT). Son la garantia de que un
 * INSERT que no las mencione -los 127 puntos de siembra de los tests, el que produce sync()- no
 * falle.
 *
 * EL ENUM ES NATIVO (`identity_type`) pero el modelo declara DataType.STRING. La divergencia es
 * deliberada: declararlo ENUM en el modelo haria que sync() cree el tipo con la convencion de
 * nombre de Sequelize (`enum_users_identity_type`), distinto de este, y las dos fuentes del
 * esquema divergirian sin que ningun test lo vea. Es el precedente de byte_status /
 * retention_status.
 *
 * LOS VALORES VAN EN INGLES contra la convencion del esquema: no viajan al front y no los elige
 * el producto, son el `type` de deploy/nats/auth-callout/rules.yaml.
 *
 * SIN `IF NOT EXISTS` en el CREATE TYPE: una re-corrida indica un problema de estado de
 * migraciones que conviene ver, no absorber. La transaccion garantiza que no quede a medias.
 *
 * SIN INDICES: los dos accesos a estas columnas son por PK (findByPk en S-016 y S-017) y el
 * filtro de opus se aplica sobre un include ya acotado por user_project_permissions.
 *
 * REVERSIBLE: el `down` dropea las dos columnas y DESPUES el tipo, en ese orden. Invertirlo hace
 * fallar el DROP TYPE con `cannot drop type identity_type because other objects depend on it`,
 * un error que no nombra la columna que lo retiene.
 */
module.exports = {
  up: (queryInterface) => {
    return queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        "CREATE TYPE identity_type AS ENUM ('person', 'service');",
        { transaction }
      );

      // Las comillas dobles en "identity_type" dejan explicito que es el NOMBRE DEL TIPO y no
      // el de la columna, que en este caso son el mismo string. Es la forma de 20260819_01.
      await queryInterface.sequelize.query(
        `
        ALTER TABLE users
          ADD COLUMN roles         JSONB           NOT NULL DEFAULT '[]'::jsonb,
          ADD COLUMN identity_type "identity_type" NOT NULL DEFAULT 'person';
        `,
        { transaction }
      );
    });
  },

  down: (queryInterface) => {
    return queryInterface.sequelize.transaction(async (transaction) => {
      // El orden importa: el tipo no se puede borrar mientras una columna lo use.
      await queryInterface.sequelize.query(
        'ALTER TABLE users DROP COLUMN identity_type, DROP COLUMN roles;',
        { transaction }
      );

      // IF EXISTS solo en el `down`: el `up` quiere fallar ruidosamente ante un estado
      // inesperado, el `down` quiere ser idempotente para desenredar un rollback a medias.
      // Es el patron de 20260819_01.
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "identity_type";',
        { transaction }
      );
    });
  },
};
