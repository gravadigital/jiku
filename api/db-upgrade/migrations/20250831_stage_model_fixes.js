'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction(async (transaction) => {
      const tableDescription = await queryInterface.describeTable('stages');

      if (!tableDescription.is_current_active) {
        await queryInterface.addColumn(
          'stages',
          'is_current_active',
          {
            type: Sequelize.DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
          },
          { transaction }
        );
      }

      try {
        await queryInterface.sequelize.query(
          'ALTER TYPE "enum_stages_type" RENAME TO "enum_stages_type_old";',
          { transaction }
        );

        await queryInterface.sequelize.query(
          'CREATE TYPE "enum_stages_type" AS ENUM(\'support\', \'scope\');',
          { transaction }
        );

        await queryInterface.sequelize.query(
          'ALTER TABLE stages ALTER COLUMN type TYPE "enum_stages_type" USING ' +
           'CASE ' +
             'WHEN type::text = \'soporte\' THEN \'support\'::"enum_stages_type" ' +
             'WHEN type::text = \'alcance\' THEN \'scope\'::"enum_stages_type" ' +
             'ELSE type::text::"enum_stages_type" ' +
           'END;',
          { transaction }
        );

        await queryInterface.sequelize.query(
          'DROP TYPE "enum_stages_type_old";',
          { transaction }
        );
      } catch (error) {
        console.log('Enum update skipped:', error.message);
      }

      return Promise.resolve();
    });
  },

  down: async (queryInterface) => {
    return queryInterface.sequelize.transaction(async (transaction) => {
      const tableDescription = await queryInterface.describeTable('stages');

      if (tableDescription.is_current_active) {
        await queryInterface.removeColumn('stages', 'is_current_active', { transaction });
      }

      try {
        await queryInterface.sequelize.query(
          'ALTER TYPE "enum_stages_type" RENAME TO "enum_stages_type_old";',
          { transaction }
        );

        await queryInterface.sequelize.query(
          'CREATE TYPE "enum_stages_type" AS ENUM(\'soporte\', \'alcance\');',
          { transaction }
        );

        await queryInterface.sequelize.query(
          'ALTER TABLE stages ALTER COLUMN type TYPE "enum_stages_type" USING ' +
           'CASE ' +
             'WHEN type::text = \'support\' THEN \'soporte\'::"enum_stages_type" ' +
             'WHEN type::text = \'scope\' THEN \'alcance\'::"enum_stages_type" ' +
             'ELSE type::text::"enum_stages_type" ' +
           'END;',
          { transaction }
        );

        await queryInterface.sequelize.query(
          'DROP TYPE "enum_stages_type_old";',
          { transaction }
        );
      } catch (error) {
        console.log('Enum revert skipped:', error.message);
      }

      return Promise.resolve();
    });
  }
};
