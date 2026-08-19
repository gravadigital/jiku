'use strict';

/**
 * EL PASO DESTRUCTIVO Y EL ÚNICO PUNTO DE NO RETORNO de S-001.
 *
 * Pone `entity_id` y `file_id` en NOT NULL, crea la FK `fk_attachments_file`, elimina las 10
 * columnas que migraron a `files` o murieron, amplía `system_settings.value` a TEXT y siembra
 * las cinco claves de configuración de archivos.
 *
 * VA APARTE DE LAS MIGRACIONES 01-04 A PROPÓSITO: las cuatro primeras son aditivas y
 * reversibles, y se despliegan solas para que el operador verifique los siete conteos de
 * 20260819_04 contra producción ANTES de aplicar esta. Ver
 * `docs/changelog/2026-08-19-separacion-file-attachment.md`.
 *
 * SI EL PASO 4 QUEDÓ INCOMPLETO, ESTA MIGRACIÓN FALLA — y que la api no arranque es el
 * comportamiento correcto, preferible a endurecer sobre datos sin resolver.
 *
 * NO se retira ningún valor del ENUM `attachment_entity_type`: PostgreSQL no lo soporta sin
 * recrear el tipo, y ningún CA lo pide. Lo que esta story garantiza es que ninguna FILA use
 * los cinco valores draft.
 *
 * NO ES REVERSIBLE. El `down` es un no-op: recrear las 10 columnas dejaría las filas borradas
 * en 20260819_04 sin restaurar, y los datos que vivían en ellas ya migraron a `files`.
 */

// Las 10 columnas que se van. Las 9 primeras migraron a `files`; `description` muere (columna
// muerta confirmada). OJO: `deleted_by` NO está en esta lista — sigue en `attachments`.
const COLUMNAS_A_ELIMINAR = [
  'file_name',
  'file_size',
  'mime_type',
  'storage_key',
  'storage_bucket',
  'storage_region',
  'uploaded_by',
  'checksum',
  'retention_status',
  'description',
];

// Los defaults se toman de la política de subida vigente hoy en la api
// (`api/lib/routes/attachments-post.ts`). También viven en el código de core (S-002): RF-16
// exige que el sistema funcione sin valor cargado. El seed es conveniencia, no la garantía.
const EXTENSIONES_PERMITIDAS = [
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv',
].join(',');

const MIME_PERMITIDOS = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
].join(',');

const CLAVES_A_SEMBRAR = [
  ['upload-url-ttl-seconds', '300'],
  ['download-url-ttl-seconds', '300'],
  ['file-max-size-bytes', '10485760'],
  ['file-allowed-extensions', EXTENSIONES_PERMITIDAS],
  ['file-allowed-mime-types', MIME_PERMITIDOS],
];

module.exports = {
  up: (queryInterface) => {
    return queryInterface.sequelize.transaction(async (transaction) => {
      // 1. LA GUARDA, ANTES DE CUALQUIER CAMBIO.
      //
      // El SET NOT NULL fallaría igual sin ella, pero con un mensaje de PostgreSQL que no
      // dice qué hacer. La guarda existe para que el operador sepa a qué migración volver.
      // Lanzar dentro de la transacción la revierte: la base queda intacta.
      const [[{ pendientes }]] = await queryInterface.sequelize.query(
        'SELECT count(*)::int AS pendientes FROM attachments WHERE entity_id IS NULL',
        { transaction }
      );
      const [[{ sinFile }]] = await queryInterface.sequelize.query(
        'SELECT count(*)::int AS "sinFile" FROM attachments WHERE file_id IS NULL',
        { transaction }
      );
      if (pendientes > 0 || sinFile > 0) {
        throw new Error(
          `No se puede endurecer el esquema: ${pendientes} filas con entity_id NULL y ` +
          `${sinFile} con file_id NULL. Corré la migración 20260819_04 y verificá sus conteos.`
        );
      }

      // 2. La CHECK constraint referencia `retention_status`. Borrarla explícitamente ANTES
      // del DROP COLUMN es la única forma determinista de que el drop no quede bloqueado.
      await queryInterface.sequelize.query(
        'ALTER TABLE attachments DROP CONSTRAINT IF EXISTS check_attachments_active_status;',
        { transaction }
      );

      // 3. NOT NULL en las dos columnas.
      await queryInterface.sequelize.query(
        'ALTER TABLE attachments ALTER COLUMN entity_id SET NOT NULL;',
        { transaction }
      );
      await queryInterface.sequelize.query(
        'ALTER TABLE attachments ALTER COLUMN file_id SET NOT NULL;',
        { transaction }
      );

      // 4. La FK: la primera que esta tabla tiene hacia el contenido. La polimórfica
      // (entity_type, entity_id) sigue siendo imposible (D-05).
      await queryInterface.sequelize.query(
        `ALTER TABLE attachments ADD CONSTRAINT fk_attachments_file
         FOREIGN KEY (file_id) REFERENCES files(id);`,
        { transaction }
      );

      // 5. Los 10 DROP COLUMN. `idx_attachments_uploader` referencia `uploaded_by`, así que
      // PostgreSQL lo borra en cascada junto con la columna. `idx_attachments_entity` sobrevive.
      for (const columna of COLUMNAS_A_ELIMINAR) {
        await queryInterface.removeColumn('attachments', columna, { transaction });
      }

      // 6. `value` a TEXT. VA ANTES DEL SEED: la lista de MIME supera los 255 caracteres y el
      // seed fallaría en el orden inverso. `key` no se toca.
      await queryInterface.sequelize.query(
        'ALTER TABLE system_settings ALTER COLUMN value TYPE TEXT;',
        { transaction }
      );

      // 7. El seed, idempotente. `ON CONFLICT (key) DO NOTHING` importa porque no debe pisar
      // un valor que un operador ya ajustó a mano.
      const valores = CLAVES_A_SEMBRAR
        .map(([clave, valor]) => `('${clave}', '${valor}', now(), now())`)
        .join(',\n          ');
      await queryInterface.sequelize.query(
        `INSERT INTO system_settings (key, value, created_at, updated_at) VALUES
          ${valores}
         ON CONFLICT (key) DO NOTHING;`,
        { transaction }
      );
    });
  },

  // NO-OP DELIBERADO. Ver el encabezado: este es el punto de no retorno.
  down: () => Promise.resolve(),
};
