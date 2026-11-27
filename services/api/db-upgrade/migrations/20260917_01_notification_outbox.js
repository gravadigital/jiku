'use strict';

/**
 * S-069: crea la cola de salida de notificaciones (`notification_outbox`) y dropea las tres
 * tablas muertas de la funcionalidad de mail eliminada (`objective_mail_threads`,
 * `requirement_mail_threads`, `inbound_mail_threads`). Siembra también las tres claves nuevas
 * de `system_settings` que S-073 va a leer.
 *
 * LAS DOS MITADES VAN EN EL MISMO ARCHIVO A PROPÓSITO: la story lo pide explícitamente —
 * separarlo produciría dos migraciones consecutivas sobre el mismo tema.
 *
 * EL ORDEN DEL `up` NO ES COSMÉTICO:
 *   1. Primero `notification_outbox` (aditivo, sin riesgo).
 *   2. Después la siembra de `system_settings` (independiente, pero agrupada con lo aditivo).
 *   3. AL FINAL los tres `DROP TABLE`. Si un `DROP` fallara por una dependencia que nadie
 *      relevó, la transacción revierte TODO, incluida la tabla nueva, y la base queda intacta.
 *
 * `DROP TABLE IF EXISTS`, SIN `CASCADE`: el `IF EXISTS` hace la migración idempotente contra una
 * instalación donde alguien ya las hubiera borrado a mano (o, en la base de test, donde `sync()`
 * ya no las crea porque sus tres modelos salieron del barrel en el commit anterior de esta
 * misma story). La ausencia de `CASCADE` es deliberada, mismo criterio que
 * `20260820_01_drop_external_integration.js`: si quedara una dependencia que nadie relevó, la
 * migración falla y no borra nada, en lugar de arrastrarla en silencio. Las FK que desaparecen
 * son las SALIENTES de las tres tablas borradas; nada apunta hacia ellas. Los dos índices de
 * `inbound_mail_threads` caen en cascada con su tabla — no hace falta un `DROP INDEX` aparte.
 *
 * NO ES REVERSIBLE EN CUANTO A DATOS. El `down` recrea las tres tablas VACÍAS para poder volver
 * atrás el esquema, pero las filas que hubiera no se recuperan. Es una decisión tomada (S-069,
 * CA-8), no un olvido: la funcionalidad de mail que las escribía ya no existe.
 *
 * LA VERIFICACIÓN DE QUE LAS TRES TABLAS ESTÁN VACÍAS ES OPERATIVA Y PREVIA AL DEPLOY, y va
 * FUERA de esta migración a propósito: no es una condición dentro del código — una migración
 * que se saltea a sí misma según los datos deja dos esquemas distintos en dos instalaciones.
 * Ver `CHANGELOG.md`, "Notes for existing installations" de esta versión.
 */

/** Las tres claves nuevas de `system_settings`. Valores como texto: la columna es TEXT. */
const CLAVES_A_SEMBRAR = [
  ['notification-dispatch-interval-seconds', '60'],
  ['notification-batch-size', '50'],
  ['notification-max-attempts', '5'],
];

const TABLAS_MUERTAS = [
  'objective_mail_threads',
  'requirement_mail_threads',
  'inbound_mail_threads',
];

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction(async (transaction) => {
      // 1. `notification_outbox`. BIGSERIAL: Sequelize no tiene un DataType.BIGSERIAL propio,
      // así que se declara BIGINT + primaryKey + autoIncrement y el dialecto de PostgreSQL
      // emite BIGSERIAL (verificado por TS-2: `nextval` en el default, BIGINT en el tipo).
      //
      // TIMESTAMPTZ y no TIMESTAMP a secas en las tres columnas de fecha: es lo que
      // `Sequelize.DataTypes.DATE` produce en el dialecto de PostgreSQL, y es lo que usa el
      // resto del esquema. La story habla de "TIMESTAMP" refiriéndose al concepto, no al tipo
      // SQL literal — usar TIMESTAMP sin zona haría divergir la base migrada de la de sync().
      await queryInterface.createTable(
        'notification_outbox',
        {
          id: {
            type: Sequelize.DataTypes.BIGINT,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
          },
          type: {
            // VARCHAR y no ENUM a propósito (CA-3): agregar un tipo de notificación futuro es
            // sumar una fila al registro de código (S-071), no un ALTER TYPE.
            type: Sequelize.DataTypes.STRING(100),
            allowNull: false,
          },
          channel: {
            type: Sequelize.DataTypes.STRING(20),
            allowNull: false,
            defaultValue: 'email',
          },
          recipient_user_id: {
            type: Sequelize.DataTypes.STRING(100),
            allowNull: false,
            references: { model: 'users', key: 'id' },
            onUpdate: 'CASCADE',
          },
          recipient_email: {
            type: Sequelize.DataTypes.STRING(255),
            allowNull: false,
          },
          payload: {
            type: Sequelize.DataTypes.JSONB,
            allowNull: false,
          },
          status: {
            // VARCHAR y no ENUM, mismo motivo que `type` (CA-3).
            type: Sequelize.DataTypes.STRING(20),
            allowNull: false,
            defaultValue: 'pending',
          },
          attempts: {
            type: Sequelize.DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
          },
          next_attempt_at: {
            // DEFAULT NOW() puesto en la BASE, no solo en el modelo: CA-1 lo pide explícito, y
            // es una red real para cualquier INSERT que no pase por el modelo (un reencolado
            // manual por SQL). `Sequelize.literal('NOW()')` y nunca `new Date()`, que
            // evaluaría una vez al cargar el módulo y congelaría el valor.
            type: Sequelize.DataTypes.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('NOW()'),
          },
          last_error: {
            type: Sequelize.DataTypes.TEXT,
            allowNull: true,
          },
          created_at: {
            type: Sequelize.DataTypes.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('NOW()'),
          },
          sent_at: {
            type: Sequelize.DataTypes.DATE,
            allowNull: true,
          },
          // Sin `updated_at`: el modelo declara `updatedAt: false` y esta migración lo
          // respeta. Con `timestamps: true` a secas, sync() agregaría una columna que la
          // migración no tiene, y las dos fuentes del esquema divergirían.
        },
        { transaction }
      );

      // El índice, uno solo, y PARCIAL: es la decisión central de la story (CA-2). Sin el
      // `where`, el índice crece con el histórico en vez de con la cola pendiente.
      await queryInterface.addIndex('notification_outbox', ['next_attempt_at', 'id'], {
        name: 'idx_notification_outbox_pending',
        where: { status: 'pending' },
        transaction,
      });

      // 2. La siembra de las tres claves de configuración de S-073. Acotada por completo a
      // este bulkInsert: `system_settings` no cambia de esquema (su `value` ya es TEXT desde
      // REQ-001 / 20260819_05). `created_at`/`updated_at` van explícitos porque la tabla no
      // tiene default de fila para ellos.
      const ahora = new Date();
      await queryInterface.bulkInsert(
        'system_settings',
        CLAVES_A_SEMBRAR.map(([key, value]) => ({
          key,
          value,
          created_at: ahora,
          updated_at: ahora,
        })),
        { transaction }
      );

      // 3. Los tres DROP, AL FINAL. IF EXISTS, sin CASCADE — ver el bloque de cabecera.
      for (const tabla of TABLAS_MUERTAS) {
        await queryInterface.dropTable(tabla, { transaction, cascade: false });
      }
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction(async (transaction) => {
      // Orden inverso al del up: primero se recrean las tablas que el up dropeó, después se
      // retira la siembra, y por último se dropea `notification_outbox`.

      // 1. Recrear las tres tablas muertas con su forma EXACTA original — copiada del DDL
      // verbatim de las cuatro migraciones que las crearon (20260417_01, 20260515_01,
      // 20260703_03, 20260717_02), no reinventada. Las tres asimetrías de
      // `inbound_mail_threads` (sin `updated_at`, sin `mattermost_post_id`, FK sin
      // `ON UPDATE CASCADE`) se respetan tal cual.
      await queryInterface.createTable(
        'objective_mail_threads',
        {
          id: {
            type: Sequelize.DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
          },
          objective_id: {
            type: Sequelize.DataTypes.INTEGER,
            allowNull: false,
            unique: true,
            references: { model: 'objectives', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
          message_id: {
            type: Sequelize.DataTypes.STRING(500),
            allowNull: false,
          },
          // La agregó 20260515_01 con un ALTER TABLE posterior; se recrea inline porque la
          // tabla se recrea entera y la posición ordinal de la columna no la lee nadie.
          mattermost_post_id: {
            type: Sequelize.DataTypes.STRING(100),
            allowNull: true,
          },
          created_at: {
            type: Sequelize.DataTypes.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('now()'),
          },
          updated_at: {
            type: Sequelize.DataTypes.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('now()'),
          },
        },
        { transaction }
      );

      await queryInterface.createTable(
        'requirement_mail_threads',
        {
          id: {
            type: Sequelize.DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
          },
          requirement_id: {
            type: Sequelize.DataTypes.INTEGER,
            allowNull: false,
            unique: true,
            references: { model: 'requirements', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
          message_id: {
            type: Sequelize.DataTypes.STRING(500),
            allowNull: false,
          },
          mattermost_post_id: {
            type: Sequelize.DataTypes.STRING(100),
            allowNull: true,
          },
          created_at: {
            type: Sequelize.DataTypes.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('now()'),
          },
          updated_at: {
            type: Sequelize.DataTypes.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('now()'),
          },
        },
        { transaction }
      );

      // La única de las tres SIN updated_at y SIN mattermost_post_id, y cuya FK solo declara
      // ON DELETE CASCADE (sin ON UPDATE CASCADE). Las tres asimetrías son reales y del
      // original — no uniformarlas con sus dos hermanas.
      await queryInterface.createTable(
        'inbound_mail_threads',
        {
          id: {
            type: Sequelize.DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
          },
          requirement_id: {
            type: Sequelize.DataTypes.INTEGER,
            allowNull: false,
            references: { model: 'requirements', key: 'id' },
            onDelete: 'CASCADE',
          },
          message_id: {
            type: Sequelize.DataTypes.STRING(500),
            allowNull: false,
          },
          created_at: {
            type: Sequelize.DataTypes.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('now()'),
          },
        },
        { transaction }
      );

      await queryInterface.addIndex('inbound_mail_threads', ['message_id'], {
        name: 'uk_inbound_mail_threads_message_id',
        unique: true,
        transaction,
      });
      await queryInterface.addIndex('inbound_mail_threads', ['requirement_id'], {
        name: 'idx_inbound_mail_threads_requirement_id',
        transaction,
      });

      // 2. Retirar exactamente las tres filas sembradas, acotado por `key`. NUNCA un
      // bulkDelete sin where: borraría `hours_per_day` y las cinco claves de archivos.
      await queryInterface.bulkDelete(
        'system_settings',
        { key: CLAVES_A_SEMBRAR.map(([key]) => key) },
        { transaction }
      );

      // 3. Dropear notification_outbox. Su índice parcial cae en cascada con la tabla.
      await queryInterface.dropTable('notification_outbox', { transaction });
    });
  },
};
