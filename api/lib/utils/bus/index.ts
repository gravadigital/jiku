import { NatsConnection, connect, credsAuthenticator, tokenAuthenticator } from 'nats';
import { readFileSync } from 'fs';
import { serviceUserFromEnv } from '@jiku/zitadel-auth';
import logger from '../../logger';
import { Reply, USER_ID, commandSubject, inboxPrefix, querySubject } from './protocol';

export const REQUEST_TIMEOUT_MS = Number(process.env.NATS_REQUEST_TIMEOUT_MS) || 5000;

/**
 * Timeout de las CONSULTAS, separado del de los comandos y más holgado a propósito.
 *
 * El perfil es el opuesto: una lectura son joins largos y una escritura es una transacción
 * corta, así que compartir un solo timeout obligaría a elegir entre cortar lecturas
 * legítimas o regalarle 5 segundos de más a cada escritura.
 *
 * Y detrás hay una invariante de operación: `POSTGRESQL_STATEMENT_TIMEOUT_MS` de core (8000)
 * tiene que quedar ESTRICTAMENTE POR DEBAJO de este valor, para que la base corte primero y
 * el error sea explicable, en vez de un timeout mudo del bus.
 */
export const QUERY_TIMEOUT_MS = Number(process.env.NATS_QUERY_TIMEOUT_MS) || 10000;

/**
 * Cliente del bus: publica comandos y consultas, y espera la respuesta.
 *
 * Request/reply directo, sin JetStream. Si no contestan dentro del timeout, la request
 * falla: no hay reintento ni cola. Un comando perdido es un comando perdido.
 */
export interface Bus {
  request<T = any>(command: string, payload: unknown): Promise<Reply<T>>;

  /**
   * Publica una CONSULTA y espera la respuesta.
   *
   * Mismo transporte que `request()`, con dos diferencias y solo dos: el token `{svc}` del
   * subject (`jiku-queries` en lugar de `jiku-commands`) y el timeout, propio y más largo.
   *
   * Hoy no tiene ningún caller, y es deliberado: los endpoints de lectura de la api siguen
   * leyendo PostgreSQL directo (ADR-001) y no migran al bus. El cliente se entrega por
   * adelantado para el requerimiento que defina el contrato de consultas. Hasta que haya
   * alguien escuchando, una consulta devuelve el `no responders` del server, que es
   * exactamente lo que corresponde.
   */
  query<T = any>(query: string, payload: unknown): Promise<Reply<T>>;
}

class NatsBus implements Bus {
  private connection: NatsConnection | null = null;
  private stopTokenRefresh: (() => void) | null = null;
  /**
   * User id con el que se publica: el `sub` del service user de Zitadel.
   *
   * Sale de la key y no de una variable de entorno porque tiene que ser exactamente el
   * mismo que el callout lee del token; si no, el permiso no cubre el subject.
   */
  private userId = USER_ID;

  async connect(): Promise<void> {
    const servers = process.env.NATS_URL || 'nats://localhost:4222';
    const credsPath = process.env.NATS_CREDS;

    // Las creds del sentinel no conceden permisos por sí solas: es el token de Zitadel
    // el que dispara el auth-callout, que lee el rol y mintea los permisos.
    //
    // El token se pide con la key del service user y se renueva solo: caduca en ~1h, así
    // que pasarlo por variable de entorno obligaría a reiniciar el servicio.
    const serviceUser = serviceUserFromEnv();
    if (serviceUser) {
      // El user id del subject es el del service user: el mismo `sub` que el callout va a
      // leer del token al autenticar la conexión.
      this.userId = serviceUser.userId;
      // El primero se pide ahora; después se renueva solo, antes de cada vencimiento.
      await serviceUser.token();
      this.stopTokenRefresh = serviceUser.startAutoRefresh((error) => {
        logger.error(`[bus] no se pudo renovar el token de Zitadel: ${error.message}`);
      });
    }

    const authenticators = [
      ...(credsPath ? [credsAuthenticator(readFileSync(credsPath))] : []),
      ...(serviceUser
        ? [tokenAuthenticator(() => serviceUser.currentToken())]
        : []),
    ];

    this.connection = await connect({
      servers,
      // Los permisos que mintea el callout solo autorizan `_INBOX.<hash(user-id)>.>`. Sin
      // este prefijo la librería genera un inbox aleatorio y las respuestas nunca llegan.
      inboxPrefix: inboxPrefix(this.userId),
      ...(authenticators.length ? { authenticator: authenticators } : {}),
      name: 'jiku-api',
    });

    logger.info(`[bus] conectado a ${servers}`);
  }

  async request<T = any>(command: string, payload: unknown): Promise<Reply<T>> {
    if (!this.connection) {
      throw new Error('Bus no conectado');
    }

    const subject = commandSubject(command, this.userId);
    const message = await this.connection.request(
      subject,
      new TextEncoder().encode(JSON.stringify(payload)),
      { timeout: REQUEST_TIMEOUT_MS }
    );

    return JSON.parse(new TextDecoder().decode(message.data)) as Reply<T>;
  }

  async query<T = any>(query: string, payload: unknown): Promise<Reply<T>> {
    if (!this.connection) {
      throw new Error('Bus no conectado');
    }

    // LA MISMA conexión, el MISMO inbox y el MISMO service user que los comandos: lo que se
    // separa es el timeout y el subject, no el transporte. Una segunda conexión pediría una
    // identidad nueva al auth-callout y ampliaría la superficie de autenticación sin que
    // haga falta.
    const subject = querySubject(query, this.userId);
    const message = await this.connection.request(
      subject,
      new TextEncoder().encode(JSON.stringify(payload)),
      { timeout: QUERY_TIMEOUT_MS }
    );

    return JSON.parse(new TextDecoder().decode(message.data)) as Reply<T>;
  }

  async close(): Promise<void> {
    this.stopTokenRefresh?.();
    this.stopTokenRefresh = null;
    if (this.connection) {
      await this.connection.drain();
      await this.connection.close();
      this.connection = null;
    }
  }
}

const natsBus = new NatsBus();

/**
 * Instancia activa. Es intercambiable para que los tests puedan poner un doble en su
 * lugar y verificar qué comando se publicó, sin levantar un NATS.
 */
let current: Bus = natsBus;

export function bus(): Bus {
  return current;
}

export function setBus(replacement: Bus): void {
  current = replacement;
}

export function resetBus(): void {
  current = natsBus;
}

export function connectBus(): Promise<void> {
  return natsBus.connect();
}

export function closeBus(): Promise<void> {
  return natsBus.close();
}
