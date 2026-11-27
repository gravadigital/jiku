'use strict';

/**
 * Migration: Add unique index on objective_activity for external comments
 *
 * Ensures each Jira comment (external_reference_url) is synced only once.
 * Partial index for comment activities with non-null URLs.
 */
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.sequelize.query(
        `
        CREATE UNIQUE INDEX uk_objective_activity_external_comment
            ON objective_activity(external_reference_url)
            WHERE type_of_activity = 'comment'
              AND external_reference_url IS NOT NULL;

        COMMENT ON INDEX uk_objective_activity_external_comment IS
            'Ensures each Jira comment (external_reference_url) is synced only once. Partial index for comment activities with non-null URLs.';
        `,
        { transaction }
      );
    });
  },

  down: (queryInterface) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.sequelize.query(
        'DROP INDEX IF EXISTS uk_objective_activity_external_comment;',
        { transaction }
      );
    });
  }
};
