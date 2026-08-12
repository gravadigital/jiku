'use strict';

/**
 * Elimina el concepto de "etapa" del producto.
 *
 * Se borran las columnas `stage_id` de `objectives` y `worked_times`, y después la tabla
 * `stages`. Los objetivos y las horas NO se tocan: siguen existiendo con su proyecto y su
 * requisito; lo que se pierde es a qué etapa estaban atribuidos.
 *
 * NO ES REVERSIBLE en cuanto a datos. El `down` recrea la estructura para poder volver
 * atrás el esquema, pero las etapas y sus asociaciones no se pueden recuperar.
 */
module.exports = {
  up: (queryInterface) => {
    return queryInterface.sequelize.transaction(async (transaction) => {
      // Primero las columnas que la referencian, si no la tabla no se puede borrar.
      await queryInterface.removeColumn('objectives', 'stage_id', { transaction });
      await queryInterface.removeColumn('worked_times', 'stage_id', { transaction });

      await queryInterface.dropTable('stages', { transaction });

      // Los enums quedan huérfanos al borrar la tabla.
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_stages_state;', { transaction });
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_stages_type;', { transaction });
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        "CREATE TYPE enum_stages_state AS ENUM ('active', 'finished');",
        { transaction }
      );
      await queryInterface.sequelize.query(
        "CREATE TYPE enum_stages_type AS ENUM ('support', 'scope');",
        { transaction }
      );

      await queryInterface.createTable('stages', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        title: {
          type: Sequelize.STRING(255),
          allowNull: false,
        },
        init_date: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        state: {
          type: 'enum_stages_state',
          allowNull: false,
        },
        type: {
          type: 'enum_stages_type',
          allowNull: true,
        },
        estimated_completion_date: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        scope: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        estimated_hours: {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        project_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'projects', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        is_current_active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        created_at: Sequelize.DATE,
        updated_at: Sequelize.DATE,
      }, { transaction });

      await queryInterface.addColumn('objectives', 'stage_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'stages', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      }, { transaction });

      await queryInterface.addColumn('worked_times', 'stage_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'stages', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      }, { transaction });
    });
  },
};
