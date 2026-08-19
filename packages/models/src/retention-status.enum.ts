/**
 * Estado de retención, compartido por `Attachment` y `File`.
 *
 * Vive en su propio módulo, y no dentro de `attachment.model.ts`, porque los dos modelos se
 * importan mutuamente (`Attachment.belongsTo(File)` / `File.hasMany(Attachment)`). Ese ciclo
 * lo toleran los decoradores, que usan thunks (`() => File`) y se resuelven de forma diferida
 * — pero NO lo tolera leer un valor del otro módulo en tiempo de decoración: el que se cargue
 * segundo vería el enum a medio inicializar y fallaría con "Cannot read properties of
 * undefined". Sacarlo del ciclo es lo que lo evita.
 *
 * En la base es el ENUM nativo `retention_status`, creado en 20260219_01 y reutilizado por
 * `files` desde 20260819_01.
 */
export enum RetentionStatus {
  Active = 'active',
  ScheduledForDeletion = 'scheduled_for_deletion',
  Deleted = 'deleted',
}
