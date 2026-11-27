'use strict';

module.exports = {
  up: async (queryInterface) => {
    return queryInterface.sequelize.transaction(async (transaction) => {
      const [enumValues] = await queryInterface.sequelize.query(`
        SELECT enumlabel
        FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'enum_stages_state'
        ORDER BY enumsortorder;
      `, { transaction });

      const currentValues = enumValues.map(row => row.enumlabel);
      const hasActive = currentValues.includes('active');
      const hasFinished = currentValues.includes('finished');

      if (hasActive && hasFinished) {
        return Promise.resolve();
      }

      if (!hasActive) {
        await queryInterface.sequelize.query(
          'ALTER TYPE "enum_stages_state" ADD VALUE \'active\';',
          { transaction }
        );
      }

      if (!hasFinished) {
        await queryInterface.sequelize.query(
          'ALTER TYPE "enum_stages_state" ADD VALUE \'finished\';',
          { transaction }
        );
      }
    });
  },

  down: async () => {
    return Promise.resolve();
  }
};
