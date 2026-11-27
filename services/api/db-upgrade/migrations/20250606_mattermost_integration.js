'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        return queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.addColumn(
                'people',
                'mattermost_username',
                {
                    type: Sequelize.DataTypes.STRING,
                    allowNull: true,
                },
                { transaction }
            );
            await queryInterface.addColumn(
                'people',
                'must_charge_worked_time',
                {
                    type: Sequelize.DataTypes.BOOLEAN,
                    allowNull: false,
                    defaultValue: true,
                },
                { transaction }
            );
        });
    },

    down: async (queryInterface) => {
        return queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.removeColumn('people', 'mattermost_username', { transaction });
            await queryInterface.removeColumn('people', 'must_charge_worked_time', { transaction });
        });
    }
};