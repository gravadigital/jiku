'use strict';

/**
 * Agrega `attachments.file_id` como NULLABLE y SIN FK.
 *
 * Es el puente que el backfill (20260819_03) va a poblar y que el endurecimiento
 * (20260819_05) va a convertir en NOT NULL + FK.
 *
 * Nullable y sin FK A PROPÓSITO: en el momento en que esta migración corre, `files` está
 * vacía y todas las filas de `attachments` existen. Un NOT NULL o una FK acá harían fallar
 * la migración o bloquearían las escrituras vigentes. La story es aditiva hasta el paso 5.
 *
 * El índice sobre `file_id` se crea ACÁ y no en el paso 5: la FK del paso 5 se apoya en él,
 * y crearlo sobre una tabla ya poblada en el paso destructivo alargaría la ventana de bloqueo.
 *
 * REVERSIBLE: el `down` borra el índice y la columna, dejando `attachments` con sus 16
 * columnas originales.
 */
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.addColumn(
        'attachments',
        'file_id',
        {
          type: Sequelize.DataTypes.INTEGER,
          allowNull: true,
        },
        { transaction }
      );

      await queryInterface.addIndex('attachments', ['file_id'], {
        name: 'idx_attachments_file_id',
        transaction,
      });
    });
  },

  down: (queryInterface) => {
    return queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeIndex('attachments', 'idx_attachments_file_id', { transaction });
      await queryInterface.removeColumn('attachments', 'file_id', { transaction });
    });
  },
};
