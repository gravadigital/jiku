import {
  ConnectionOptions,
  NatsConnection,
  Service,
  connect,
  credsAuthenticator,
  tokenAuthenticator,
} from 'nats';
import { readFileSync } from 'fs';
import { COMMAND_SERVICE, inboxPrefix } from '@jiku/nats-protocol';
import { serviceUserFromEnv } from '@jiku/zitadel-auth';
import logger from '../logger';
import { ServiceSpec, registerService } from './service';

/**
 * Una conexión NATS, N servicios micro.
 *
 * Recibe los specs por varargs desde el día uno aunque hoy le pasen uno: `nc.services.add()` no
 * tiene singleton, así que montar el segundo servicio es sumar un elemento acá y nada más.
 */
export class BusHost {
  private connection: NatsConnection | null = null;
  private services: Service[] = [];
  private stopTokenRefresh: (() => void) | null = null;
  private specs: ServiceSpec[];

  constructor(...specs: ServiceSpec[]) {
    this.specs = specs;
  }

  async start(): Promise<void> {
    const servers = process.env.NATS_URL || 'nats://localhost:4222';
    const credsPath = process.env.NATS_CREDS;
    // Fallback solo para arrancar sin service user (tests); en un deploy real lo pisa el `sub`
    // de la key, que es el que el callout usa para mintear el permiso de inbox.
    let userId = process.env.NATS_USER_ID || COMMAND_SERVICE;

    // Las creds del sentinel no conceden permisos por sí solas: es el token de Zitadel el que
    // dispara el auth-callout, que lee el rol y mintea los permisos de subject.
    const serviceUser = serviceUserFromEnv();
    if (serviceUser) {
      // El inbox va bajo el hash del user id PROPIO, no del nombre del servicio: es POR
      // RÉPLICA. Dos réplicas con distinto service user no se roban las respuestas.
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

    this.connection = await this.openConnection({
      servers,
      // Sin este prefijo la librería genera un `_INBOX.<aleatorio>` que ningún permiso acotado
      // autoriza, y el síntoma es un TIMEOUT, no un error de permisos: el diagnóstico más caro
      // que este servicio puede tener.
      inboxPrefix: inboxPrefix(userId),
      ...(authenticators.length ? { authenticator: authenticators } : {}),
      name: 'jiku-core',
    });

    logger.info(`[bus] conectado a ${servers}`);

    // EN SERIE, y el error se propaga: un `Promise.all` acá podría dejar el proceso arriba con
    // un servicio registrado y el otro caído, que es justo lo que no puede pasar. Tampoco hay
    // try/catch: el arranque tiene que fallar entero.
    for (const spec of this.specs) {
      this.services.push(await registerService(this.connection, spec));
    }

    void (async () => {
      for await (const status of this.connection!.status()) {
        logger.info(`[bus] ${status.type}: ${JSON.stringify(status.data ?? '')}`);
      }
    })();
  }

  /** Para los servicios y drena para que los mensajes en vuelo terminen antes de cerrar. */
  async stop(): Promise<void> {
    this.stopTokenRefresh?.();
    this.stopTokenRefresh = null;

    // LOS SERVICIOS PRIMERO: dejan de aceptar requests nuevas. Al revés, una request nueva
    // podría entrar durante el drain y quedarse sin respuesta. Acá `Promise.all` sí es correcto:
    // parar servicios es idempotente y no tiene orden entre sí, a diferencia del registro.
    await Promise.all(this.services.map((service) => service.stop()));
    this.services = [];

    if (this.connection) {
      await this.connection.drain();
      await this.connection.close();
      this.connection = null;
    }
    logger.info('[bus] desconectado');
  }

  /**
   * El único punto que toca la red, aislado a propósito: `connect` se exporta de `nats` con un
   * getter no configurable, así que no se puede sustituir con sinon. Sin este método, `host.ts`
   * solo se podría testear con un bus real.
   */
  protected openConnection(options: ConnectionOptions): Promise<NatsConnection> {
    return connect(options);
  }
}
