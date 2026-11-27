'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.createTable(
        'system_settings',
        {
          id: {
            type: Sequelize.DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
          },
          key: {
            type: Sequelize.DataTypes.STRING(255),
            allowNull: false,
            unique: true,
          },
          value: {
            type: Sequelize.DataTypes.STRING(255),
            allowNull: false,
          },
          created_at: {
            type: Sequelize.DataTypes.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
          },
          updated_at: {
            type: Sequelize.DataTypes.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
          },
        },
        { transaction }
      )
        .then(() => {
          return queryInterface.bulkInsert(
            'system_settings',
            [{ key: 'hours_per_day', value: '6', created_at: new Date(), updated_at: new Date() }],
            { transaction }
          );
        });
    });
  },

  down: (queryInterface) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.dropTable('system_settings', { transaction });
    });
  }
};
