'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.addColumn(
        'requirements',
        'project_id',
        {
          type: Sequelize.DataTypes.INTEGER,
          allowNull: true,
          references: { model: 'projects', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        { transaction }
      )
        .then(() => queryInterface.sequelize.query(
          `UPDATE requirements r
           SET project_id = (
             SELECT project_id FROM requirements_projects
             WHERE requirement_id = r.id
             LIMIT 1
           );`,
          { transaction }
        ))
        .then(() => queryInterface.sequelize.query(
          `ALTER TABLE requirements ALTER COLUMN project_id SET NOT NULL;`,
          { transaction }
        ))
        .then(() => queryInterface.dropTable('requirements_projects', { transaction }))
        .then(() => queryInterface.renameColumn('requirements', 'close_date', 'estimated_finish_date', { transaction }))
        .then(() => queryInterface.addIndex('requirements', ['project_id'], {
          name: 'idx_requirements_project_id',
          transaction,
        }));
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.removeIndex('requirements', 'idx_requirements_project_id', { transaction })
        .then(() => queryInterface.renameColumn('requirements', 'estimated_finish_date', 'close_date', { transaction }))
        .then(() => queryInterface.createTable(
          'requirements_projects',
          {
            requirement_id: {
              type: Sequelize.DataTypes.INTEGER,
              allowNull: false,
              references: { model: 'requirements', key: 'id' },
              onUpdate: 'CASCADE',
              onDelete: 'CASCADE',
            },
            project_id: {
              type: Sequelize.DataTypes.INTEGER,
              allowNull: false,
              references: { model: 'projects', key: 'id' },
              onUpdate: 'CASCADE',
              onDelete: 'RESTRICT',
            },
            created_at: {
              type: Sequelize.DataTypes.DATE,
              allowNull: false,
              defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
          },
          { transaction }
        ))
        .then(() => queryInterface.sequelize.query(
          `ALTER TABLE requirements_projects ADD PRIMARY KEY (requirement_id, project_id);`,
          { transaction }
        ))
        .then(() => queryInterface.sequelize.query(
          `INSERT INTO requirements_projects (requirement_id, project_id)
           SELECT id, project_id FROM requirements WHERE project_id IS NOT NULL;`,
          { transaction }
        ))
        .then(() => queryInterface.removeColumn('requirements', 'project_id', { transaction }));
    });
  },
};
