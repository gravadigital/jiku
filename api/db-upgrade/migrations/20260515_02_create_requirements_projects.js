'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.createTable(
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
      )
        .then(() => queryInterface.sequelize.query(
          `ALTER TABLE requirements_projects ADD PRIMARY KEY (requirement_id, project_id);`,
          { transaction }
        ))
        .then(() => queryInterface.addIndex('requirements_projects', ['project_id'], {
          name: 'idx_req_projects_project',
          transaction,
        }));
    });
  },

  down: (queryInterface) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.dropTable('requirements_projects', { transaction });
    });
  },
};
