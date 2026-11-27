'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.addColumn(
        'objectives',
        'visibility_level',

        {
          type: Sequelize.ENUM([
            'public',
            'internal',
          ]),
          allowNull: false,
          defaultValue: 'public'
        },


        { transaction }

      );

    });

  },
  down: (queryInterface) => {
    return queryInterface.sequelize.transaction((transaction) =>{
      return queryInterface.removeColumn(
        'objectives',
        'visibility_level',
        {transaction}
      );

    });
  }
};
