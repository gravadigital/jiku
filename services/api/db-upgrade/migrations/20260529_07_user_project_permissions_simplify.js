'use strict';

module.exports = {
  up: (queryInterface) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.sequelize.query(
        `DELETE FROM user_project_permissions a
         USING user_project_permissions b
         WHERE a.id > b.id
           AND a.user_id = b.user_id
           AND a.project_id = b.project_id;`,
        { transaction }
      )
        .then(() => queryInterface.sequelize.query(
          `DROP INDEX IF EXISTS idx_user_project_permission;`,
          { transaction }
        ))
        .then(() => queryInterface.removeColumn('user_project_permissions', 'permission_type', { transaction }))
        .then(() => queryInterface.sequelize.query(
          `CREATE UNIQUE INDEX uk_user_project_permissions ON user_project_permissions(user_id, project_id);`,
          { transaction }
        ))
        .then(() => queryInterface.sequelize.query(
          `DROP TYPE IF EXISTS enum_permission_type;`,
          { transaction }
        ));
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.sequelize.query(
        `DROP INDEX IF EXISTS uk_user_project_permissions;`,
        { transaction }
      )
        .then(() => queryInterface.addColumn(
          'user_project_permissions',
          'permission_type',
          {
            type: Sequelize.DataTypes.STRING(50),
            allowNull: false,
            defaultValue: 'view',
          },
          { transaction }
        ))
        .then(() => queryInterface.sequelize.query(
          `CREATE UNIQUE INDEX idx_user_project_permission ON user_project_permissions(user_id, project_id, permission_type);`,
          { transaction }
        ));
    });
  },
};
