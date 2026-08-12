'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => queryInterface.changeColumn(
    'requirements',
    'estimated_finish_date',
    {
      type: Sequelize.DataTypes.DATEONLY,
      allowNull: true,
    }
  ),

  down: (queryInterface, Sequelize) => queryInterface.changeColumn(
    'requirements',
    'estimated_finish_date',
    {
      type: Sequelize.DataTypes.DATEONLY,
      allowNull: false,
    }
  ),
};
