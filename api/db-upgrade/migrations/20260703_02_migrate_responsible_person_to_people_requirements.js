'use strict';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      INSERT INTO people_requirements (person_id, requirement_id, is_leader, created_at, updated_at)
      SELECT responsible_person_id, id, true, now(), now()
      FROM requirements
      WHERE responsible_person_id IS NOT NULL;
    `);
    await queryInterface.removeIndex('requirements', 'idx_requirements_responsible_person_id');
    await queryInterface.removeColumn('requirements', 'responsible_person_id');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('requirements', 'responsible_person_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'people', key: 'id' },
    });
    await queryInterface.addIndex('requirements', ['responsible_person_id'], {
      name: 'idx_requirements_responsible_person_id',
    });
    await queryInterface.sequelize.query(`
      UPDATE requirements r
      SET responsible_person_id = pr.person_id
      FROM people_requirements pr
      WHERE pr.requirement_id = r.id AND pr.is_leader = true;
    `);
    await queryInterface.dropTable('people_requirements');
  },
};
