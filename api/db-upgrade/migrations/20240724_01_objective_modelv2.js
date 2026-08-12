'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.sequelize.query(
        'SELECT id FROM users WHERE id = \'system-sub\';',
        { transaction }
      ).then(([results]) => {
        if (results.length === 0) {
          return queryInterface.sequelize.query(
            'INSERT INTO users (id, name, username, email) VALUES (\'system-sub\', \'Sistema\', \'system\', \'system@mail.com\');',
            { transaction }
          );
        }
      })
        .then(() => {
          return queryInterface.addColumn(
            'objectives',
            'created_by',
            {
              type: Sequelize.DataTypes.STRING,
              allowNull: true,
              references: {
                model: 'users',
                key: 'id'
              },
              onUpdate: 'CASCADE',
              onDelete: 'SET NULL'
            },
            { transaction }
          );
        })
        .then(() => {
          return queryInterface.sequelize.query('UPDATE objectives SET created_by = \'system-sub\' WHERE created_by IS NULL;',
            { transaction });
        })
        .then(() => {
          return queryInterface.changeColumn(
            'objectives',
            'created_by',
            {
              type: Sequelize.DataTypes.STRING,
              allowNull: false,
              references: {
                model: 'users',
                key: 'id'
              },
              onUpdate: 'CASCADE',
              onDelete: 'SET NULL'
            },
            { transaction }
          );
        });
    });
  },
  down: (queryInterface) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.removeColumn(
        'objectives',
        'created_by',
        { transaction });

    });
  }
};
