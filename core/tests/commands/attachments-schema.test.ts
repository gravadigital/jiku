import 'mocha';
import 'should';
import { Attachment } from '@jiku/models';

/**
 * LA GUARDA QUE FALTABA.
 *
 * El producto tiene DOS FUENTES para el mismo esquema (convención `orm`, ADR-013): en
 * `testing`/`development` la construye `sequelize.sync()` desde el modelo, y en producción las
 * migraciones de `api/db-upgrade/migrations/`. Cuando divergen, los tests pasan y producción
 * falla — que es exactamente lo que pasó al vincular un archivo después de la 20260819_05:
 * `column "file_name" of relation "attachments" does not exist`.
 *
 * Ninguno de los tests de vinculación podía detectarlo: todos corren contra el esquema que
 * `sync()` construye desde el modelo, así que las columnas que la migración dropeó SEGUÍAN
 * EXISTIENDO para ellos.
 *
 * Este test compara el modelo contra la lista de columnas que la migración deja, que es la
 * única forma de que la divergencia rompa en CI y no en el navegador del usuario. Es
 * intencionalmente una lista literal y no una lectura de la migración: si alguien cambia el
 * esquema, tiene que cambiar las dos puntas a mano y verlas juntas en el diff.
 */

/**
 * Las 8 columnas de `attachments` DESPUÉS de la 20260819_05, en nombre de base.
 * La migración dropea `file_name`, `file_size`, `mime_type`, `storage_key`, `storage_bucket`,
 * `storage_region`, `uploaded_by`, `checksum`, `retention_status` y `description`.
 */
const COLUMNAS_VIGENTES = [
  'id',
  'entity_type',
  'entity_id',
  'file_id',
  'deleted_at',
  'deleted_by',
  'created_at',
  'updated_at',
];

/** Las 10 que la 20260819_05 dropeó. Ninguna puede volver al modelo. */
const COLUMNAS_DROPEADAS = [
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

describe('attachments — esquema del modelo vs. migraciones', () => {
  /** Los nombres de columna DE BASE que el modelo declara (no los atributos camelCase). */
  function columnasDelModelo(): string[] {
    const attributes = Attachment.getAttributes();
    return Object.values(attributes)
      .map((attribute: any) => attribute.field as string)
      .sort();
  }

  it('no declara ninguna de las 10 columnas que dropeó la 20260819_05', () => {
    const columnas = columnasDelModelo();
    const sobrantes = COLUMNAS_DROPEADAS.filter((columna) => columnas.includes(columna));

    // El mensaje nombra las columnas: el síntoma en producción es un error de PostgreSQL que
    // menciona UNA sola, y saber la lista completa ahorra la segunda vuelta.
    sobrantes.should.deepEqual(
      [],
      `El modelo declara columnas que ya no existen en la base: ${sobrantes.join(', ')}`
    );
  });

  it('declara exactamente las 8 columnas vigentes', () => {
    columnasDelModelo().should.deepEqual([...COLUMNAS_VIGENTES].sort());
  });
});
