'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((transaction) =>{
      return Promise.all([
        queryInterface.createTable(
          'stages',
          {
            id: {
              type: Sequelize.DataTypes.INTEGER,
              primaryKey: true,
              autoIncrement: true,
            },
            title: {
              type: Sequelize.DataTypes.STRING,
              allowNull: false,
            },
            init_date: {
              type: Sequelize.DataTypes.DATE,
              allowNull: false,
            },
            state: {
              type: Sequelize.DataTypes.ENUM('active', 'finished'),
              allowNull: false,
            },
            type: {
              type: Sequelize.DataTypes.ENUM('soporte', 'alcance'),
            },
            estimated_completion_date: {
              type: Sequelize.DataTypes.DATE,
            },
            scope: {
              type: Sequelize.DataTypes.TEXT,
            },
            hours_per_month: {
              type: Sequelize.DataTypes.INTEGER,
            },
            project_id: {
              type: Sequelize.DataTypes.INTEGER,
              references: { model: 'projects', key: 'id' },
              allowNull: false,
              onUpdate: 'CASCADE',
              onDelete: 'SET NULL',
            },
            created_at: Sequelize.DataTypes.DATE,
            updated_at: Sequelize.DataTypes.DATE,
          },
          { transaction }
        ),
      ]);
    });
  },


  down:  (queryInterface) => {
    return queryInterface.sequelize.transaction((transaction) => {

      return queryInterface.dropTable('stages', { transaction});
    });
  }
};
