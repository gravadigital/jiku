'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(
      `CREATE TYPE enum_unworked_reason AS ENUM (
        'tramite', 'corte_servicios', 'vacaciones', 'dia_no_laborable',
        'personal', 'medico', 'estudio', 'enfermedad', 'otro'
      )`
    );
    await queryInterface.createTable('unworked_times', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      minutes: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      reason: {
        type: Sequelize.ENUM('tramite', 'corte_servicios', 'vacaciones', 'dia_no_laborable', 'personal', 'medico', 'estudio', 'enfermedad', 'otro'),
        allowNull: false,
      },
      person_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'people', key: 'id' },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });
    await queryInterface.addIndex('unworked_times', ['person_id', 'date'], {
      name: 'idx_unworked_person_date',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('unworked_times');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_unworked_reason');
  },
};
