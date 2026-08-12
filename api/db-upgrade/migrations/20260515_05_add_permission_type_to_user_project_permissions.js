'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.addColumn(
        'user_project_permissions',
        'permission_type',
        {
          type: Sequelize.DataTypes.STRING(50),
          allowNull: false,
          defaultValue: 'view',
        },
        { transaction }
      )
        .then(() => queryInterface.sequelize.query(
          `DROP INDEX IF EXISTS user_project_permissions_user_id_project_id;`,
          { transaction }
        ))
        .then(() => queryInterface.sequelize.query(
          `CREATE UNIQUE INDEX idx_user_project_permission ON user_project_permissions(user_id, project_id, permission_type);`,
          { transaction }
        ));
    });
  },

  down: (queryInterface) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.sequelize.query(
        `DROP INDEX IF EXISTS idx_user_project_permission;`,
        { transaction }
      )
        .then(() => queryInterface.removeColumn('user_project_permissions', 'permission_type', { transaction }));
    });
  },
};
