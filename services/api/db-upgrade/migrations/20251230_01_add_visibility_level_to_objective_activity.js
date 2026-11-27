'use strict';

/**
 * Migration: Add visibility_level column to objective_activity table
 *
 * This column allows differentiating between public and internal activities.
 * - Public activities are visible to external users (Opus)
 * - Internal activities are only visible to internal users (Gestor)
 *
 * Data migration rules:
 * - state, title, description activities -> 'public'
 * - comments with external_reference_url (Jira) -> 'public'
 * - Everything else -> 'internal' (default)
 */
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((transaction) => {
      // 1. Add the column with default 'internal'
      return queryInterface.addColumn(
        'objective_activity',
        'visibility_level',
        {
          type: Sequelize.DataTypes.ENUM('public', 'internal'),
          allowNull: false,
          defaultValue: 'internal',
        },
        { transaction }
      )
        .then(() => {
          // 2. Migrate existing data - activities that should be public by type
          return queryInterface.sequelize.query(
            `UPDATE objective_activity
             SET visibility_level = 'public'
             WHERE type_of_activity IN ('state', 'title', 'description');`,
            { transaction }
          );
        })
        .then(() => {
          // 3. Migrate Jira comments (with external_reference_url) to public
          return queryInterface.sequelize.query(
            `UPDATE objective_activity
             SET visibility_level = 'public'
             WHERE type_of_activity = 'comment'
               AND external_reference_url IS NOT NULL;`,
            { transaction }
          );
        });
    });
  },

  down: (queryInterface) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.removeColumn('objective_activity', 'visibility_level', { transaction })
        .then(() => {
          return queryInterface.sequelize.query(
            'DROP TYPE IF EXISTS "enum_objective_activity_visibility_level";',
            { transaction }
          );
        });
    });
  }
};
