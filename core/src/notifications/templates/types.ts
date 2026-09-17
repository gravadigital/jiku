/** El resultado de renderizar el cuerpo de una plantilla: las dos versiones, multipart (CA-8). */
export interface RenderedMail {
  text: string;
  html: string;
}

/** El resultado completo del render de una notificación: asunto + las dos versiones del cuerpo. */
export interface RenderedNotification extends RenderedMail {
  subject: string;
}
