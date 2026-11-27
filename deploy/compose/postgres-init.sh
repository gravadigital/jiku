#!/bin/sh
# Runs once, when the database volume is created (docker-entrypoint-initdb.d). The api connects
# with a role that holds SELECT and nothing else (ADR-001); core reads through the same role.
# The schema is created later by the migrations, as the owner: the default privileges below give
# the read-only role SELECT on every table they create.
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<SQL
CREATE ROLE "$DATABASE_READONLY_USER" LOGIN PASSWORD '$DATABASE_READONLY_PASSWORD';
GRANT CONNECT ON DATABASE "$POSTGRES_DB" TO "$DATABASE_READONLY_USER";
GRANT USAGE ON SCHEMA public TO "$DATABASE_READONLY_USER";
GRANT SELECT ON ALL TABLES IN SCHEMA public TO "$DATABASE_READONLY_USER";
ALTER DEFAULT PRIVILEGES FOR ROLE "$POSTGRES_USER" IN SCHEMA public GRANT SELECT ON TABLES TO "$DATABASE_READONLY_USER";
SQL
