/* eslint-disable @typescript-eslint/no-var-requires */
'use strict';
require('dotenv').config();

const env = process.env.NODE_ENV || 'production';

// Las migraciones necesitan permisos de escritura, y la api conecta a la base con un
// usuario de SOLO LECTURA. Por eso usan credenciales propias
// (POSTGRESQL_MIGRATION_USER / _PASSWORD) y caen a las de la api solo si no están
// definidas, que es el caso en desarrollo y en los tests.
module.exports = {
  [env]: {
    username: process.env.POSTGRESQL_MIGRATION_USER || process.env.POSTGRESQL_USER,
    password: process.env.POSTGRESQL_MIGRATION_PASSWORD || process.env.POSTGRESQL_PASSWORD,
    database: process.env.POSTGRESQL_DB,
    host: process.env.POSTGRESQL_HOST,
    port: process.env.POSTGRESQL_PORT,
    dialect: 'postgres',
    dialectOptions: {
      multipleStatements: true
    },
    migrationStorageTableName: 'sequelize_meta',
  }
};
