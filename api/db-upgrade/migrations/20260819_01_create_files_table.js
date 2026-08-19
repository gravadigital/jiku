'use strict';

/**
 * Crea la tabla `files`: la identidad del archivo, independiente de a qué se vincule.
 *
 * Es la primera de las cinco migraciones de S-001 y es puramente ADITIVA: no toca ninguna
 * tabla existente, así que ningún servicio cambia de comportamiento al aplicarla.
 *
 * Un `File` tiene 0..N `attachments`. El vínculo lo agrega la migración 20260819_02 y lo
 * puebla el backfill de 20260819_03.
 *
 * `byte_status` usa un ENUM nuevo (`file_byte_status`); `retention_status` REUTILIZA el ENUM
 * `retention_status` que ya existe desde 20260219_01 — crearlo de nuevo fallaría.
 *
 * NO se crea una CHECK equivalente a `check_attachments_active_status`: el ciclo de retención
 * de `files` es distinto (el archivo se retiene aunque el vínculo se borre).
 *
 * REVERSIBLE: el `down` dropea la tabla y el tipo nuevo, sin tocar `retention_status`.
 */
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        "CREATE TYPE file_byte_status AS ENUM ('pending', 'uploaded');",
        { transaction }
      );

      await queryInterface.createTable(
        'files',
        {
          id: {
            type: Sequelize.DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
          },
          file_name: {
            type: Sequelize.DataTypes.STRING(255),
            allowNull: false,
          },
          file_size: {
            type: Sequelize.DataTypes.INTEGER,
            allowNull: false,
          },
          mime_type: {
            type: Sequelize.DataTypes.STRING(100),
            allowNull: false,
          },
          // La construye core y no depende de la entidad (D-02). UNIQUE: es la llave del
          // join del backfill.
          storage_key: {
            type: Sequelize.DataTypes.STRING(500),
            allowNull: false,
            unique: true,
          },
          storage_bucket: {
            type: Sequelize.DataTypes.STRING(100),
            allowNull: false,
          },
          storage_region: {
            type: Sequelize.DataTypes.STRING(50),
            allowNull: false,
          },
          // sha256 declarado por el cliente; NADIE lo verifica (D-25).
          checksum: {
            type: Sequelize.DataTypes.STRING(64),
            allowNull: true,
          },
          byte_status: {
            type: '"file_byte_status"',
            allowNull: false,
            defaultValue: 'pending',
          },
          // Contra esto se valida la titularidad al vincular (RF-12).
          uploaded_by: {
            type: Sequelize.DataTypes.STRING(100),
            allowNull: false,
            references: { model: 'users', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT',
          },
          // El archivo se retiene; el vínculo se borra (D-04).
          retention_status: {
            type: '"retention_status"',
            allowNull: false,
            defaultValue: 'active',
          },
          deleted_at: {
            type: Sequelize.DataTypes.DATE,
            allowNull: true,
          },
          deleted_by: {
            type: Sequelize.DataTypes.STRING(100),
            allowNull: true,
            references: { model: 'users', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
          },
          created_at: {
            type: Sequelize.DataTypes.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
          },
          updated_at: {
            type: Sequelize.DataTypes.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
          },
        },
        { transaction }
      );

      // Titularidad al vincular + identificar abandonados por consulta, sin barrido.
      await queryInterface.addIndex('files', ['uploaded_by', 'byte_status'], {
        name: 'idx_files_uploader_byte_status',
        transaction,
      });
    });
  },

  down: (queryInterface) => {
    return queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable('files', { transaction });

      // Solo el tipo que esta migración creó. `retention_status` es de `attachments`.
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "file_byte_status";',
        { transaction }
      );
    });
  },
};
