/**
 * LA TRADUCCIÓN DE `entityType`, en un solo lugar.
 *
 * `entityType` no es un filtro: es lo que hace que un id TENGA SIGNIFICADO. Los ids de
 * `objective_activity` y `requirement_activity` SE PISAN —el 1234 existe en las dos y son cosas
 * distintas—, así que sin él un `comments.get {id: 1234}` devolvería "algún" comentario y el bug
 * sería silencioso e intermitente: funciona hasta que las dos tablas crecen lo suficiente.
 *
 * VA EN LAS DOS DIRECCIONES (RF-25): se consulta `objective_activity` y se devuelve
 * `entityType: "task"`. En esta story la vuelta se ve en los adjuntos —se filtra
 * `attachments.entity_type = 'objective_comment'` y el comentario vuelve con `"task"`—, y S-027
 * (`attachments.list`) la vuelve a ejercer entera. POR ESO ESTÁ ACÁ Y NO ADENTRO DE UNA FICHA:
 * dos copias de esta tabla pueden divergir sin que nada lo diga.
 *
 * ES UN DATO, NO FUNCIONES: las fichas leen estos nombres al construirse, así `meta.describe`
 * (S-028) puede proyectar el contrato sin ejecutar una traducción.
 *
 * NO IMPORTA NADA DEL MOTOR: es un dato del plano de consultas, no una pieza de `engine/`.
 */

/** Los valores válidos, EN EL ORDEN que viaja en `errorDetails.allowed`. */
export const ENTITY_TYPES = ['task', 'requirement'] as const;

/** El tipo se DERIVA del array: escribirlo a mano dejaría que los dos divergieran. */
export type EntityType = (typeof ENTITY_TYPES)[number];

export interface EntityTables {
  /** Tabla de actividad: comentarios Y cambios de campo (ver la ficha de `activity`). */
  readonly activityTable: string;
  /**
   * OJO CON EL NÚMERO: la de tareas es PLURAL (`objectives_subscriptors`) y la de requisitos
   * SINGULAR (`requirement_subscriptors`). La asimetría es de la base, no del contrato, y copiar
   * una para la otra rompe el SQL sin que nada lo diga hasta que la consulta corre.
   */
  readonly subscriptionTable: string;
  /** Columna que apunta a la entidad dueña: `objective_id` / `requirement_id`. */
  readonly entityColumn: string;
  /** La tabla que SÍ lleva el proyecto: la que el recorte externo alcanza con un EXISTS. */
  readonly ownerTable: string;
  /** `attachments.entity_type` de un COMENTARIO de esta entidad. */
  readonly commentAttachmentType: string;
}

export const ENTITY_TABLES: Readonly<Record<EntityType, EntityTables>> = {
  task: {
    activityTable: 'objective_activity',
    subscriptionTable: 'objectives_subscriptors',
    entityColumn: 'objective_id',
    ownerTable: 'objectives',
    commentAttachmentType: 'objective_comment',
  },
  requirement: {
    activityTable: 'requirement_activity',
    subscriptionTable: 'requirement_subscriptors',
    entityColumn: 'requirement_id',
    ownerTable: 'requirements',
    commentAttachmentType: 'requirement_comment',
  },
};

export default ENTITY_TABLES;
