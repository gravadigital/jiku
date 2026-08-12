'use strict';

module.exports = {
  up: (queryInterface) => {
    return queryInterface.sequelize.query(
      `ALTER TABLE requirements ADD COLUMN resolution_type enum_requirement_resolution NULL;`
    )
      .then(() => queryInterface.sequelize.query(
        `UPDATE requirements SET resolution_type = resolution_conclusion;`
      ))
      .then(() => queryInterface.sequelize.query(
        `ALTER TABLE requirements ALTER COLUMN resolution_conclusion TYPE text USING resolution_conclusion::text;`
      ))
      .then(() => queryInterface.sequelize.query(
        `ALTER TABLE requirements ADD COLUMN resolution_comment text NULL;`
      ))
      .then(() => queryInterface.sequelize.query(`
        UPDATE requirements r
        SET resolution_comment = ra.new_value
        FROM (
          SELECT DISTINCT ON (requirement_id) requirement_id, new_value
          FROM requirement_activity
          WHERE type_of_activity = 'resolution'
          ORDER BY requirement_id, created_at DESC
        ) ra
        WHERE ra.requirement_id = r.id;
      `));
  },

  down: (queryInterface) => {
    return queryInterface.sequelize.query(
      `ALTER TABLE requirements DROP COLUMN resolution_type;`
    )
      .then(() => queryInterface.sequelize.query(
        `ALTER TABLE requirements ALTER COLUMN resolution_conclusion TYPE enum_requirement_resolution USING resolution_conclusion::enum_requirement_resolution;`
      ))
      .then(() => queryInterface.sequelize.query(
        `ALTER TABLE requirements DROP COLUMN resolution_comment;`
      ));
  },
};
