import { Mailer, MailMessage, setTransport } from '../../src/notifications/dispatch/transport';

/**
 * Doble del transporte SMTP para los tests de notificaciones (REQ-015/S-073).
 *
 * MISMO MOLDE QUE `S3Double` (`s3-double.ts`): SMTP es una frontera externa de la misma clase
 * que S3 —"la misma clase de doble que `S3Double`, ya aceptado para la otra frontera externa del
 * servicio" (Story Plan, Testing)—. La base NO se dobla: solo la red saliente.
 *
 * `delayMs` permite simular latencia (TS-6: envíos secuenciales, no en paralelo) y una espera
 * larga (TS-43: el comando no espera al SMTP; TS-24: la parada espera la corrida en curso).
 */
export interface SentMail extends MailMessage {
  startedAt: number;
  finishedAt: number;
}

export class SMTPDouble implements Mailer {
  /** Todos los envíos aceptados, en orden, con sus marcas de tiempo (TS-6). */
  readonly sent: SentMail[] = [];

  /** Cuántas veces se llamó `createTransport()` — expuesto para TS-44 vía el propio módulo, no acá. */
  createTransportCalls = 0;

  /** Si se fija, `sendMail` rechaza con este error. */
  rejectWith: Error | null = null;

  /** Si se fija, `sendMail` LANZA sincrónicamente (no rechaza) — TS-45. */
  throwSyncWith: Error | null = null;

  /** Retardo artificial antes de resolver/rechazar, en ms — simula latencia real del proveedor. */
  delayMs = 0;

  /** Cuántos envíos están en curso ahora mismo — para TS-6 (nunca > 1: secuencial). */
  concurrentSends = 0;
  maxConcurrentSends = 0;

  async sendMail(message: MailMessage): Promise<{ messageId: string }> {
    if (this.throwSyncWith) {
      throw this.throwSyncWith;
    }

    const startedAt = Date.now();
    this.concurrentSends += 1;
    this.maxConcurrentSends = Math.max(this.maxConcurrentSends, this.concurrentSends);

    if (this.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    }

    this.concurrentSends -= 1;
    const finishedAt = Date.now();

    if (this.rejectWith) {
      throw this.rejectWith;
    }

    this.sent.push({ ...message, startedAt, finishedAt });
    return { messageId: `smtp-double-${this.sent.length}` };
  }

  reset(): void {
    this.sent.length = 0;
    this.createTransportCalls = 0;
    this.rejectWith = null;
    this.throwSyncWith = null;
    this.delayMs = 0;
    this.concurrentSends = 0;
    this.maxConcurrentSends = 0;
  }
}

/** Instala el doble y devuelve la instancia. Llamalo en un `beforeEach`. */
export function installSMTPDouble(): SMTPDouble {
  const double = new SMTPDouble();
  setTransport(double);
  return double;
}

/** Desinstala el doble, dejando que el transporte real vuelva a construirse al primer uso. */
export function uninstallSMTPDouble(): void {
  setTransport(null);
}
