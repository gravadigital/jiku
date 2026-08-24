import {
  ConnectionOptions,
  NatsConnection,
  Service,
  Subscription,
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
 * Consumidor de un subject de eventos: fire-and-forget, sin reply.
 *
 * NO es un `ServiceSpec` y no puede serlo: micro es request/reply y exige que cada endpoint
 * responda. `respond()` sobre un mensaje SIN `reply` subject es un NO-OP SILENCIOSO —no falla, no
 * loguea— que además ensucia los contadores de `$SRV`. Un evento no tiene a quién contestarle.
 *
 * SIN `queue`: el queue group es infraestructura del consumidor y lo lee `start()`, donde ya se
 * leen `NATS_URL` y compañía. El `subject` sí viaja acá porque es CONTRATO: sale del helper del
 * paquete, igual que `COMMAND_SERVICE` en un `ServiceSpec`.
 */
export interface EventSpec {
  /** Subject LITERAL. No un wildcard: el permiso del callout es literal (ADR-008). */
  subject: string;
  /** Procesa el payload ya decodificado. Si rechaza, el try/catch del loop lo absorbe. */
  handle: (payload: unknown) => Promise<void>;
}

/** Queue group del consumidor de eventos. */
const DEFAULT_EVENTS_QUEUE = 'jiku-events';

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
  private subscription: Subscription | null = null;
  private events: EventSpec | null = null;

  constructor(...specs: ServiceSpec[]) {
    this.specs = specs;
  }

  /**
   * Declara el consumidor de eventos.
   *
   * Fluido y no un parámetro del constructor para no tocar la firma de varargs: un parámetro
   * nuevo tendría que ir ANTES del rest y obligaría a cambiar `src/index.ts` y las ocho
   * construcciones de `TestHost` de los tests.
   *
   * LANZA SI EL HOST YA ARRANCÓ: registrar un consumidor después de `start()` no abriría ninguna
   * suscripción y el síntoma sería "no llega ni un evento", que es exactamente el síntoma que
   * esta suscripción pelea por hacer diagnosticable.
   */
  withEventConsumer(spec: EventSpec): this {
    if (this.connection) {
      throw new Error('[bus] withEventConsumer() tiene que llamarse antes de start()');
    }
    this.events = spec;
    return this;
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

    // DESPUÉS de los servicios micro, a propósito: si el registro de un servicio falla, el
    // arranque tiene que morir sin haber abierto una suscripción a medias.
    if (this.events) {
      const queue = process.env.NATS_EVENTS_QUEUE || DEFAULT_EVENTS_QUEUE;
      // Suscripción PLANA, no un endpoint micro. El queue group lo exige la convención
      // `bus-consumer`: sin él, N réplicas escriben N veces. Acá es una optimización y no una
      // necesidad de corrección —el espejado es idempotente—, pero dos UPDATE concurrentes sobre
      // la misma fila son un lock innecesario.
      // Sin `max` ni `timeout`: `max` auto-desuscribiría después de N mensajes —el peor bug
      // posible acá, porque el síntoma sería "dejó de sincronizar después de un rato"—. Y sin
      // `callback`: con él los mensajes NO van por el async iterator y el `for await` no
      // recibiría nada, con el log diciendo que se suscribió.
      this.subscription = this.connection.subscribe(this.events.subject, { queue });

      // ESTE LOG NO ES DECORATIVO. `subscribe()` NO FALLA si el callout no autorizó el subject:
      // el cliente NATS no valida permisos de suscripción localmente, y la violación aparece en
      // el log del SERVIDOR, no acá. Esta línea es lo único que separa "no se suscribió" (no
      // aparece) de "se suscribió y no llega nada" (aparece y nada más pasa), que son dos
      // síntomas iguales con causas distintas.
      logger.info(`[events] suscripto a ${this.events.subject}`);

      void this.consumeEvents(this.subscription, this.events);
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

    // LOS SERVICIOS PRIMERO (arriba), DESPUÉS LA SUSCRIPCIÓN, DESPUÉS LA CONEXIÓN. El orden que
    // `stop()` ya tenía se conserva, y la suscripción se drena antes de cerrar para que un evento
    // EN VUELO TERMINE DE PROCESARSE: sin JetStream, un evento cortado a medias se pierde sin
    // rastro.
    if (this.subscription) {
      await this.subscription.drain();
      this.subscription = null;
    }

    if (this.connection) {
      await this.connection.drain();
      await this.connection.close();
      this.connection = null;
    }
    logger.info('[bus] desconectado');
  }

  /**
   * El único iterador del consumidor de eventos.
   *
   * CADA MENSAJE VA EN SU PROPIO try/catch, y es la última red: una excepción que escape de acá
   * TERMINA EL ITERADOR y core deja de recibir eventos PARA SIEMPRE, con un solo error en el log
   * al principio. Los 20 comandos siguen atendiendo, así que ningún healthcheck lo nota. Mismo
   * criterio que el try/catch de `service.ts`.
   *
   * SE ESPERA EL `handle`, a diferencia del `void handle(...)` de `service.ts`. Tres razones: (a)
   * un evento es uno por conexión al bus, no uno por acción de usuario, así que serializar no
   * cuesta nada; (b) con `void`, un rechazo NO lo atrapa este try/catch —sería un unhandled
   * rejection, y en producción el logger tiene `exitOnError: true`, o sea que mataría el
   * proceso—; y (c) es lo que hace que `drain()` espere a que el evento en vuelo TERMINE.
   */
  private async consumeEvents(subscription: Subscription, spec: EventSpec): Promise<void> {
    for await (const message of subscription) {
      try {
        // Un cuerpo vacío NO es `{}` acá, al revés que en `service.ts`: los comandos de borrado
        // no llevan payload, un evento sin cuerpo no existe. `msg.json()` lanza y cae al catch.
        const payload: unknown = message.json();
        await spec.handle(payload);
      } catch (error: any) {
        // Un cuerpo que no es JSON se loguea y SE DESCARTA, sin intentar responder: no hay
        // `reply` subject al que contestar. Es la excepción explícita a la regla de
        // `bus-consumer` ("todo mensaje recibido se responde... nunca se descarta en silencio"):
        // un evento se descarta, Y SE LOGUEA.
        // `warn` y no `error`: los dos casos que caen acá —cuerpo no-JSON y un `handle` que
        // rechazó— ya fueron logueados por quien correspondía, y un `error` duplicaría la línea
        // sugiriendo dos fallas.
        logger.warn(`[events] ${message.subject}: mensaje descartado: ${error.message}`);
      }
    }
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
