'use strict';

/**
 * Backfill: una fila de `files` por cada fila de `attachments`, 1:1, y vincula cada
 * `attachment` a su `File` por `storage_key`.
 *
 * DOS DECISIONES QUE NO SE PUEDEN RELAJAR:
 *
 * 1. 1:1 DELIBERADO, SIN DEDUPLICAR POR CHECKSUM. Deduplicar cambiaría la cardinalidad y
 *    está FUERA DE ALCANCE. 1:1 es idempotente y reversible; deduplicar no lo sería.
 *
 * 2. NINGÚN OBJETO DEL BUCKET SE TOCA. Las `storage_key` existentes se copian tal cual, con
 *    su patrón viejo. El namespace `/f/` es solo para lo nuevo. Esta migración NO instancia
 *    ningún cliente S3.
 *
 * `storage_key` es UNIQUE en las dos tablas: el join es seguro y no hace falta tabla de mapeo.
 * Los `attachments.id` no se tocan (D-06).
 *
 * REVERSIBLE: el `down` pone `file_id` en NULL y vacía `files`.
 */
module.exports = {
  up: (queryInterface) => {
    return queryInterface.sequelize.transaction(async (transaction) => {
      // `ORDER BY id` no es decorativo: hace que los `files.id` se asignen en el mismo orden
      // que los `attachments.id`, lo que vuelve el resultado determinista y comparable entre
      // entornos al verificar los conteos.
      //
      // El 'uploaded' va LITERAL en el SELECT, no como default de la columna (que es
      // 'pending'): son adjuntos que existieron y se sirvieron; marcarlos pendientes los
      // haría parecer abandonados.
      //
      // Los dos casts explícitos NO son decorativos. `files` declara `byte_status` y
      // `retention_status` como ENUM nativos, mientras que `attachments.retention_status` es
      // el ENUM en producción pero un VARCHAR en el esquema que construye `sync()`. El
      // `::text::retention_status` funciona en los dos casos; sin él, el INSERT falla con
      // "column is of type retention_status but expression is of type character varying".
      await queryInterface.sequelize.query(
        `INSERT INTO files (file_name, file_size, mime_type, storage_key, storage_bucket,
                            storage_region, checksum, byte_status, uploaded_by,
                            retention_status, created_at, updated_at)
         SELECT file_name, file_size, mime_type, storage_key, storage_bucket,
                storage_region, checksum,
                'uploaded'::file_byte_status,
                uploaded_by, retention_status::text::retention_status, created_at, updated_at
         FROM attachments
         ORDER BY id;`,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `UPDATE attachments a
         SET file_id = f.id
         FROM files f
         WHERE f.storage_key = a.storage_key;`,
        { transaction }
      );

      const [[{ insertados }]] = await queryInterface.sequelize.query(
        'SELECT count(*)::int AS insertados FROM files',
        { transaction }
      );
      const [[{ vinculados }]] = await queryInterface.sequelize.query(
        'SELECT count(*)::int AS vinculados FROM attachments WHERE file_id IS NOT NULL',
        { transaction }
      );
      const [[{ sinVincular }]] = await queryInterface.sequelize.query(
        'SELECT count(*)::int AS "sinVincular" FROM attachments WHERE file_id IS NULL',
        { transaction }
      );

      console.log(`[20260819_03] filas insertadas en files: ${insertados}`);
      console.log(`[20260819_03] attachments vinculados: ${vinculados}`);
      console.log(`[20260819_03] attachments SIN vincular: ${sinVincular}`);
    });
  },

  down: (queryInterface) => {
    return queryInterface.sequelize.transaction(async (transaction) => {
      // Es seguro vaciar `files` entera: en el punto del `down`, TODAS sus filas provienen de
      // este backfill — `files` se creó vacía en 20260819_01 y ningún servicio escribe en ella
      // hasta S-002.
      await queryInterface.sequelize.query(
        'UPDATE attachments SET file_id = NULL;',
        { transaction }
      );
      await queryInterface.sequelize.query('DELETE FROM files;', { transaction });
    });
  },
};
