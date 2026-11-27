'use strict';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`ALTER TYPE enum_requirement_state ADD VALUE IF NOT EXISTS 'planificacion';`);
    await queryInterface.sequelize.query(`ALTER TYPE enum_requirement_state ADD VALUE IF NOT EXISTS 'resuelto';`);
    await queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.sequelize.query(
        `UPDATE requirements SET state = 'planificacion' WHERE state = 'programado';`,
        { transaction }
      )
        .then(() => queryInterface.sequelize.query(
          `UPDATE requirements SET state = 'resuelto' WHERE state = 'finalizado';`,
          { transaction }
        ))
        .then(() => queryInterface.sequelize.query(
          `ALTER TABLE requirements ALTER COLUMN state TYPE varchar(50);`,
          { transaction }
        ))
        .then(() => queryInterface.sequelize.query(
          `DROP TYPE enum_requirement_state;`,
          { transaction }
        ))
        .then(() => queryInterface.sequelize.query(
          `CREATE TYPE enum_requirement_state AS ENUM (
            'analisis', 'planificacion', 'desarrollo', 'revision', 'resuelto', 'cancelado'
          );`,
          { transaction }
        ))
        .then(() => queryInterface.sequelize.query(
          `ALTER TABLE requirements ALTER COLUMN state TYPE enum_requirement_state
            USING state::enum_requirement_state;`,
          { transaction }
        ));
    });
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(`ALTER TYPE enum_requirement_state ADD VALUE IF NOT EXISTS 'programado';`);
    await queryInterface.sequelize.query(`ALTER TYPE enum_requirement_state ADD VALUE IF NOT EXISTS 'finalizado';`);
    await queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.sequelize.query(
        `UPDATE requirements SET state = 'programado' WHERE state = 'planificacion';`,
        { transaction }
      )
        .then(() => queryInterface.sequelize.query(
          `UPDATE requirements SET state = 'finalizado' WHERE state = 'resuelto';`,
          { transaction }
        ))
        .then(() => queryInterface.sequelize.query(
          `ALTER TABLE requirements ALTER COLUMN state TYPE varchar(50);`,
          { transaction }
        ))
        .then(() => queryInterface.sequelize.query(
          `DROP TYPE enum_requirement_state;`,
          { transaction }
        ))
        .then(() => queryInterface.sequelize.query(
          `CREATE TYPE enum_requirement_state AS ENUM (
            'analisis', 'programado', 'desarrollo', 'revision', 'finalizado', 'cancelado'
          );`,
          { transaction }
        ))
        .then(() => queryInterface.sequelize.query(
          `ALTER TABLE requirements ALTER COLUMN state TYPE enum_requirement_state
            USING state::enum_requirement_state;`,
          { transaction }
        ));
    });
  },
};
