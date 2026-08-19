'use strict';

/**
 * Resuelve las cuatro poblaciones de `attachments` que bloquean el NOT NULL de `entity_id`:
 * los drafts sin confirmar, las filas `stage` huérfanas, el `comment` legado, y los drafts
 * ya confirmados con el tipo sin actualizar.
 *
 * TODA RAMA ES CONTABLE Y LOGUEADA. Sin eso el backfill es una caja negra sobre datos de
 * producción, y el paso de verificación del operador (entre esta migración y 20260819_05) no
 * tendría nada que verificar. Los conteos son el producto principal de esta migración, tanto
 * como el cambio de datos.
 *
 * LOS `files` NO SE TOCAN. El borrado es solo de `attachments`: es lo que hace que el archivo
 * quede "sin vínculo" en lugar de perderse.
 *
 * NO ES REVERSIBLE en cuanto a datos. El `down` es un no-op: las filas borradas no se pueden
 * recuperar y los `entity_type` normalizados no se pueden distinguir de los que ya estaban en
 * su tipo concreto. Lo que sí revierte el esquema son las migraciones 20260819_01 y _02.
 * Mismo precedente que 20260729_01.
 */

// El mapeo de normalización de drafts YA CONFIRMADOS (los que tienen `entity_id` no nulo).
//
// `comment_draft` -> `objective_comment` no es obvio y queda asentado: `comment_draft` es de
// 20260423_01, anterior al split de 20260729_01, cuando "comment" significaba actividad de
// objetivo. Si el conteo de esta rama sale distinto de cero, VERIFICAR contra
// `objective_activity` antes de avanzar al paso 5.
const MAPEO_DRAFTS_CONFIRMADOS = [
  ['comment_draft', 'objective_comment'],
  ['objective_comment_draft', 'objective_comment'],
  ['requirement_comment_draft', 'requirement_comment'],
  ['objective_draft', 'objective'],
  ['requirement_draft', 'requirement'],
];

const TIPOS_DRAFT = [
  'comment_draft',
  'requirement_draft',
  'objective_draft',
  'objective_comment_draft',
  'requirement_comment_draft',
];

module.exports = {
  up: (queryInterface) => {
    return queryInterface.sequelize.transaction(async (transaction) => {
      const contar = async (sql) => {
        const [[{ n }]] = await queryInterface.sequelize.query(sql, { transaction });
        return n;
      };

      const listaDraft = TIPOS_DRAFT.map((t) => `'${t}'`).join(', ');

      // Se cuenta ANTES de resolver, porque los UPDATE lo destruyen. Se loguea aunque sea 0:
      // una línea que dice "comment ambiguos: 0" es evidencia; su ausencia no.
      const ambiguos = await contar(
        `SELECT count(*)::int AS n FROM attachments
         WHERE entity_type = 'comment'
           AND entity_id IN (SELECT id FROM objective_activity)
           AND entity_id IN (SELECT id FROM requirement_activity)`
      );

      // ---------------------------------------------------------------------------------
      // RAMA 4 (va PRIMERO): drafts YA CONFIRMADOS -> se normalizan al tipo concreto.
      //
      // Si fuera después del borrado de drafts (rama 1) ya no habría nada que normalizar, y
      // si fuera después de la rama `comment` el conteo de esa rama quedaría inflado.
      // ---------------------------------------------------------------------------------
      const normalizados = await contar(
        `SELECT count(*)::int AS n FROM attachments
         WHERE entity_type IN (${listaDraft}) AND entity_id IS NOT NULL`
      );

      for (const [origen, destino] of MAPEO_DRAFTS_CONFIRMADOS) {
        await queryInterface.sequelize.query(
          `UPDATE attachments SET entity_type = '${destino}'
           WHERE entity_type = '${origen}' AND entity_id IS NOT NULL;`,
          { transaction }
        );
      }

      // ---------------------------------------------------------------------------------
      // RAMA 3: el `comment` legado de 20260423_01.
      //
      // Misma lógica que `api/lib/utils/attachments-access.ts` usa hoy para el fallback:
      // buscar el `entity_id` primero en `objective_activity`, después en
      // `requirement_activity`. EL ORDEN IMPORTA: el segundo UPDATE es seguro porque el
      // primero ya sacó de `entity_type = 'comment'` a las filas que resolvieron a objetivo.
      // Si un `entity_id` existiera en las dos tablas gana objetivo — por eso `ambiguos` se
      // cuenta y se loguea aparte, en lugar de resolverse en silencio.
      // ---------------------------------------------------------------------------------
      const aObjectiveComment = await contar(
        `SELECT count(*)::int AS n FROM attachments
         WHERE entity_type = 'comment'
           AND entity_id IN (SELECT id FROM objective_activity)`
      );
      await queryInterface.sequelize.query(
        `UPDATE attachments SET entity_type = 'objective_comment'
         WHERE entity_type = 'comment'
           AND entity_id IN (SELECT id FROM objective_activity);`,
        { transaction }
      );

      const aRequirementComment = await contar(
        `SELECT count(*)::int AS n FROM attachments
         WHERE entity_type = 'comment'
           AND entity_id IN (SELECT id FROM requirement_activity)`
      );
      await queryInterface.sequelize.query(
        `UPDATE attachments SET entity_type = 'requirement_comment'
         WHERE entity_type = 'comment'
           AND entity_id IN (SELECT id FROM requirement_activity);`,
        { transaction }
      );

      // Lo que no resolvió a ninguna tabla de actividad: se borra el vínculo y el File queda
      // sin vínculo.
      const irresolubles = await contar(
        `SELECT count(*)::int AS n FROM attachments WHERE entity_type = 'comment'`
      );
      await queryInterface.sequelize.query(
        "DELETE FROM attachments WHERE entity_type = 'comment';",
        { transaction }
      );

      // ---------------------------------------------------------------------------------
      // RAMA 1: drafts NUNCA confirmados (sin `entity_id`) -> se borra el vínculo.
      // Es el estado que RF-1 declara válido: el archivo se conserva con su `uploaded_by`
      // intacto; el vínculo nunca existió.
      // ---------------------------------------------------------------------------------
      const draftsBorrados = await contar(
        `SELECT count(*)::int AS n FROM attachments
         WHERE entity_type IN (${listaDraft}) AND entity_id IS NULL`
      );
      await queryInterface.sequelize.query(
        `DELETE FROM attachments
         WHERE entity_type IN (${listaDraft}) AND entity_id IS NULL;`,
        { transaction }
      );

      // ---------------------------------------------------------------------------------
      // RAMA 2: las filas `stage`. Hoy son pérdida de datos silenciosa (la tabla `stages` se
      // borró en 20260808_01 y nadie puede acceder). Recuperarlos como archivos sin vínculo
      // los vuelve alcanzables por su `uploaded_by`. NO se marcan para baja: borrar datos
      // recuperables es irreversible.
      // ---------------------------------------------------------------------------------
      const stageRecuperados = await contar(
        `SELECT count(*)::int AS n FROM attachments WHERE entity_type = 'stage'`
      );
      await queryInterface.sequelize.query(
        "DELETE FROM attachments WHERE entity_type = 'stage';",
        { transaction }
      );

      // Un conteo por rama, con prefijo estable para que el operador pueda filtrarlo.
      console.log(`[20260819_04] drafts sin entity_id borrados: ${draftsBorrados}`);
      console.log(`[20260819_04] stage recuperados: ${stageRecuperados}`);
      console.log(`[20260819_04] comment -> requirement_comment: ${aRequirementComment}`);
      console.log(`[20260819_04] comment -> objective_comment: ${aObjectiveComment}`);
      console.log(`[20260819_04] comment irresolubles borrados: ${irresolubles}`);
      console.log(`[20260819_04] drafts normalizados: ${normalizados}`);
      console.log(`[20260819_04] comment ambiguos: ${ambiguos}`);
    });
  },

  // NO-OP DELIBERADO. Ver el encabezado: los datos de esta migración no son reversibles.
  down: () => Promise.resolve(),
};
