'use strict';

/**
 * Migration: Add prefix column and indexes to external_project table
 *
 * - Adds optional prefix filter for Jira issue titles (NULL = sync all issues)
 * - Adds partial index for prefix filtering (performance optimization)
 * - Adds composite index for one-to-many lookups
 * - Adds unique constraint to prevent duplicate prefixes per Jira project
 */
module.exports = {
  up: (queryInterface) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.sequelize.query(
        `
        -- Step 1: Add prefix column
        -- NULL prefix means "sync all issues" (no filtering)
        -- VARCHAR(50) allows for bracketed prefixes like [PROJECT_NAME_LONG]
        ALTER TABLE external_project
        ADD COLUMN prefix VARCHAR(50) NULL;

        COMMENT ON COLUMN external_project.prefix IS
        'Optional prefix filter for Jira issue titles. NULL = sync all issues. Example: [VIS], [RIMS]';

        -- Step 2: Add partial index for prefix filtering (performance optimization)
        -- Only indexes non-NULL prefixes for faster lookups
        CREATE INDEX idx_external_project_prefix
        ON external_project(prefix)
        WHERE prefix IS NOT NULL;

        -- Step 3: Add composite index for one-to-many lookups
        -- Allows fast queries: "Find all ExternalProjects for this Jira project"
        CREATE INDEX idx_external_project_integration_project
        ON external_project(integration_id, external_project_id);

        -- Step 4: Add unique constraint to prevent duplicate prefixes
        -- Ensures one prefix maps to only one local project per Jira project
        -- NOTE: Multiple NULL prefixes are allowed (NULL is distinct in PostgreSQL)
        CREATE UNIQUE INDEX idx_external_project_unique_prefix
        ON external_project(integration_id, external_project_id, prefix);
        `,
        { transaction }
      );
    });
  },

  down: (queryInterface) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.sequelize.query(
        `
        DROP INDEX IF EXISTS idx_external_project_unique_prefix;
        DROP INDEX IF EXISTS idx_external_project_integration_project;
        DROP INDEX IF EXISTS idx_external_project_prefix;
        ALTER TABLE external_project DROP COLUMN IF EXISTS prefix;
        `,
        { transaction }
      );
    });
  }
};
