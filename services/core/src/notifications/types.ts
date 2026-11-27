import { Transaction } from 'sequelize';
import { NotificationDeclaration, NotificationPayload } from '@jiku/nats-protocol';

/**
 * El vocabulario del módulo de notificaciones (REQ-015, S-071): las formas que el registro de
 * tipos (`registry.ts`), las reglas de filtrado (`recipients.ts`) y el escritor
 * (`write-notifications.ts`) comparten.
 *
 * `NotificationDeclaration` y `NotificationPayload` NO SE REDECLARAN ACÁ: viven en
 * `@jiku/nats-protocol` porque `Reply.notifications` (el campo del paquete) tiene que verlas, y
 * dos copias de una misma forma —una en el paquete y otra acá— divergen con el tiempo, que es
 * exactamente lo que `@jiku/models` y `@jiku/nats-protocol` existen para impedir. Este archivo
 * las REEXPORTA para que el resto del módulo las importe desde un solo lugar relativo.
 */
export type { NotificationDeclaration, NotificationPayload };

/**
 * El contexto que necesita resolver destinatarios y armar el payload: la entidad de la
 * declaración, quién actuó y la transacción viva del comando.
 *
 * NO ES `CommandContext` completo: el escritor y las reglas de filtrado no necesitan `caller`,
 * `params` ni `roles` — reducir la superficie acá es lo que permite testear `recipients.ts` y
 * `registry.ts` sin construir un contexto de comando entero.
 */
export interface NotificationContext {
  /** El `actorId` ya resuelto por `resolveActor()` — `undefined` en el canal exento. */
  actorId: string | undefined;
  transaction: Transaction;
}

/** Un destinatario candidato, antes de las reglas 3 y 4. La misma forma que ya devuelve `resolveRecipients()`. */
export interface NotificationCandidate {
  userId: string;
  email: string | null;
}

/**
 * La firma de la resolución de destinatarios de UN TIPO (D-8, D-9, CA-2): recibe la declaración
 * completa —así puede leer `recipientOverride`— y el contexto, y devuelve los candidatos ANTES
 * de las reglas 3 y 4 (exclusión/dedup/sin-email y permiso de proyecto), que se aplican después y
 * son las mismas para todos los tipos.
 *
 * CADA TIPO DECLARA LA SUYA. No hay una firma "genérica" que un `switch` central invoque por
 * tipo: eso es precisamente lo que CA-2 prohíbe.
 */
export type ResolveRecipients = (
  declaration: NotificationDeclaration,
  ctx: NotificationContext
) => Promise<NotificationCandidate[]>;

/**
 * Una entrada del registro de tipos (CA-1): declara las cuatro cosas que un tipo necesita, aunque
 * esta story solo consuma la última.
 *
 * `subject` Y `template` SE DECLARAN AUNQUE NADIE LOS LEA TODAVÍA (S-073 los consume). Dejarlos
 * para más adelante partiría la propiedad del catálogo en dos: agregar un tipo volvería a abrir
 * este registro una segunda vez, que es justo lo que CA-1 quiere evitar.
 */
export interface NotificationTypeEntry {
  /** El asunto del mail. Sin usar en esta story — lo consume el proceso de envío de S-073. */
  subject: string;
  /** El nombre/identificador de la plantilla del cuerpo. Sin usar en esta story — S-073. */
  template: string;
  /** Cómo este tipo resuelve sus propios destinatarios (D-8, D-9). */
  resolveRecipients: ResolveRecipients;
}
