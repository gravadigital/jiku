import nodemailer, { SentMessageInfo } from 'nodemailer';

/**
 * El transporte SMTP (REQ-015/S-073), construido PEREZOSAMENTE: al primer envío, nunca al
 * importar el módulo ni al arrancar el proceso.
 *
 * MISMO CRITERIO QUE `STORAGE_S3_*` (`commands/files/storage.ts`): las `SMTP_*` no llevan assert
 * de arranque (ver `env-config`) porque su modo de fallo es ruidoso y recuperable, no silencioso.
 * Construir el transporte al importar el módulo además rompería la suite de tests, que no tiene
 * un SMTP real disponible.
 *
 * LA INTERFAZ `Mailer` Y `setTransport()` SON EL MISMO PATRÓN QUE `StorageSigner`/
 * `setStorageSigner()` en `commands/files/storage.ts`: la superficie mínima que el resto del
 * módulo necesita (`sendMail`), inyectable desde los tests con el doble
 * (`tests/helpers/smtp-double.ts`, molde de `s3-double.ts`) sin depender del tipo concreto
 * `Transporter` de `nodemailer`.
 */

export interface MailMessage {
  from: string | undefined;
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface Mailer {
  sendMail(message: MailMessage): Promise<SentMessageInfo>;
}

let transport: Mailer | null = null;

/** Construye el transporte la primera vez que se necesita, y lo reusa después. */
export function getTransport(): Mailer {
  if (transport === null) {
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      // El default vive ACÁ, donde se lee la variable — no se duplica en `.env.dist` (regla de
      // `env-config`: "no dupliques un default en dos archivos").
      port: Number(process.env.SMTP_PORT) || 587,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }
  return transport;
}

/** Solo para tests: instala un doble del transporte (`SMTPDouble`), igual que `setStorageSigner()`. */
export function setTransport(replacement: Mailer | null): void {
  transport = replacement;
}

/** Solo para tests: descarta el transporte construido, igual que `resetConfig()` en `config.ts`. */
export function resetTransport(): void {
  transport = null;
}
