import { NatsConnection, Subscription, credsAuthenticator, connect, tokenAuthenticator } from 'nats';
import { readFileSync } from 'fs';
import { serviceUserFromEnv } from '@jiku/zitadel-auth';
import logger from '../logger';
import { Dispatcher } from './dispatcher';
import {
  ErrorCode,
  SERVICE_NAME,
  failure,
  inboxPrefix,
  subscriptionSubject,
} from '@jiku/nats-protocol';

/**
 * Atiende los comandos del bus.
 *
 * Request/reply directo, sin JetStream: cada mensaje se responde en el momento. Si core
 * está caído, la request de la api expira por timeout — no hay reintento ni cola.
 *
 * La suscripción usa un queue group para que varias réplicas se repartan los mensajes en
 * lugar de procesar cada una lo mismo.
 */
export class Consumer {
  private connection: NatsConnection | null = null;
  private subscription: Subscription | null = null;
  private stopTokenRefresh: (() => void) | null = null;

  constructor(private dispatcher: Dispatcher) {}

  async start(): Promise<void> {
    const servers = process.env.NATS_URL || 'nats://localhost:4222';
    const credsPath = process.env.NATS_CREDS;
    // Fallback solo para arrancar sin service user (tests); en un deploy real lo pisa el
    // `sub` de la key, que es el que el callout usa para mintear el permiso de inbox.
    let userId = process.env.NATS_USER_ID || SERVICE_NAME;

    // Las creds del sentinel no conceden permisos por sí solas: es el token de Zitadel
    // el que dispara el auth-callout, que lee el rol y mintea los permisos.
    //
    // El token se pide con la key del service user y se renueva solo: caduca en ~1h, así
    // que pasarlo por variable de entorno obligaría a reiniciar el servicio.
    const serviceUser = serviceUserFromEnv();
    if (serviceUser) {
      // El inbox va bajo el hash del user id propio, no del nombre del servicio: es POR
      // RÉPLICA. Dos réplicas de core con distinto service user no se roban las
      // respuestas de los servicios que llamen.
      userId = serviceUser.userId;
      await serviceUser.token();
      this.stopTokenRefresh = serviceUser.startAutoRefresh((error) => {
        logger.error(`[bus] no se pudo renovar el token de Zitadel: ${error.message}`);
      });
    }

    const authenticators = [
      ...(credsPath ? [credsAuthenticator(readFileSync(credsPath))] : []),
      ...(serviceUser ? [tokenAuthenticator(() => serviceUser.currentToken())] : []),
    ];

    this.connection = await connect({
      servers,
      // El inbox tiene que ir bajo el prefijo propio: los permisos que mintea el
      // auth-callout solo autorizan `_INBOX.<hash(user-id)>.>`. Sin esto, las respuestas
      // de los servicios que core llame nunca llegarían.
      inboxPrefix: inboxPrefix(userId),
      ...(authenticators.length ? { authenticator: authenticators } : {}),
      name: 'jiku-core',
    });

    const subject = subscriptionSubject();
    this.subscription = this.connection.subscribe(subject, { queue: SERVICE_NAME });

    logger.info(`[bus] conectado a ${servers}, atendiendo ${subject}`);

    void this.consume();

    void (async () => {
      for await (const status of this.connection!.status()) {
        logger.info(`[bus] ${status.type}: ${JSON.stringify(status.data ?? '')}`);
      }
    })();
  }

  private async consume(): Promise<void> {
    for await (const message of this.subscription!) {
      let payload: unknown;

      try {
        payload = message.data.length ? JSON.parse(new TextDecoder().decode(message.data)) : {};
      } catch {
        // Un cuerpo que no es JSON no se puede procesar ni reintentar: se responde el
        // error y se sigue.
        logger.warn(`[bus] invalid payload on ${message.subject}`);
        message.respond(encode(failure(ErrorCode.INVALID_FIELDS, 'Malformed JSON payload')));
        continue;
      }

      // Cada mensaje se procesa sin bloquear la llegada de los siguientes.
      void this.dispatcher
        .dispatch(message.subject, payload)
        .then((reply) => message.respond(encode(reply)))
        .catch((error: Error) => {
          // El despachador ya captura sus errores; esto es la última red.
          logger.error(`[bus] ${message.subject}: ${error.message}`);
          message.respond(encode(failure(ErrorCode.INTERNAL_ERROR, 'Internal error')));
        });
    }
  }

  /** Drena la suscripción para que los mensajes en vuelo terminen antes de cerrar. */
  async stop(): Promise<void> {
    this.stopTokenRefresh?.();
    this.stopTokenRefresh = null;
    if (this.subscription) {
      await this.subscription.drain();
    }
    if (this.connection) {
      await this.connection.drain();
      await this.connection.close();
    }
    logger.info('[bus] desconectado');
  }
}

function encode(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}
