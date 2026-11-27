/* eslint-disable @typescript-eslint/no-var-requires */
'use strict';

/*
 * Baseline of the schema, run before `sequelize-cli db:migrate` (see `upgrade-db` in package.json).
 *
 * The migrations in ./migrations/ never built the schema from an empty database: the first one
 * alters `objectives`, which no migration creates. Installations started from a dump of an
 * existing database. This step makes an empty database reach the state those migrations expect:
 *
 *   - Empty database (no `objectives` table): applies ./baseline/schema.sql — the schema after the
 *     migrations listed in ./baseline/applied-migrations.txt — and records those migrations as
 *     executed in `sequelize_meta`. `db:migrate` then runs only the ones that came after.
 *   - Database that already has the schema: does nothing.
 *
 * It uses the same connection settings as the migrations (./config.js).
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const env = process.env.NODE_ENV || 'production';
const config = require('./config.js')[env];

async function main() {
  const client = new Client({
    user: config.username,
    password: config.password,
    database: config.database,
    host: config.host,
    port: config.port ? Number(config.port) : undefined,
  });
  await client.connect();
  try {
    const { rows } = await client.query("SELECT to_regclass('public.objectives') IS NOT NULL AS present");
    if (rows[0].present) {
      console.log('baseline: the schema already exists, nothing to do');
      return;
    }
    const schema = fs.readFileSync(path.join(__dirname, 'baseline', 'schema.sql'), 'utf8');
    const applied = fs
      .readFileSync(path.join(__dirname, 'baseline', 'applied-migrations.txt'), 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    await client.query('BEGIN');
    await client.query(schema);
    await client.query('SET search_path TO public');
    for (const name of applied) {
      await client.query('INSERT INTO sequelize_meta (name) VALUES ($1)', [name]);
    }
    await client.query('COMMIT');
    console.log(`baseline: schema created, ${applied.length} migrations recorded as applied`);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`baseline: ${error.message}`);
  process.exit(1);
});
