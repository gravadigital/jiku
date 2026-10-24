import { NatsConnection, connect, credsAuthenticator, tokenAuthenticator, Empty, ErrorCode, NatsError } from 'nats';
import { readFileSync } from 'fs';
import { serviceUserFromEnv } from '@jiku/zitadel-auth';
import logger from '../../logger';
import {
  MODULES_BUCKET,
  Reply,
  USER_ID,
  commandSubject,
  inboxPrefix,
  moduleCommandSubject,
  modulePingSubject,
  moduleQuerySubject,
  querySubject,
} from './protocol';

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

/** A qué servicio de módulo se publica: ambos datos salen del registro `JIKU_MODULES` (CA-8). */
export interface ModuleTarget {
  serviceName: string;
  protocol: string;
}

/** Una entrada del KV de módulos, ya reducida a lo que el registro necesita. */
export interface ModuleKvEntry {
  operation: 'PUT' | 'DEL' | 'PURGE';
  value: string;
}

/** Handle de un watch abierto. `closed` resuelve cuando el iterador termina y NUNCA rechaza. */
export interface ModuleKvWatch {
  stop(): void;
  closed: Promise<void>;
}

/** Vista de solo lectura del bucket `JIKU_MODULES`. */
export interface ModuleKv {
  get(key: string): Promise<ModuleKvEntry | null>;
  watch(key: string, onEntry: (entry: ModuleKvEntry) => Promise<void> | void): Promise<ModuleKvWatch>;
}

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

  /**
   * Publica una CONSULTA a un servicio de módulo y espera la respuesta (timeout de consultas).
   *
   * Es la primera EXCEPCIÓN a ADR-001 ("un endpoint que lee no pasa por el bus"): la api lee
   * documentación por el bus porque no está en su base (se documenta como ADR-015 en S-085).
   * El subject sale del registro, no de una constante (CA-8) y H-2 aplica: el bus real solo
   * autoriza `jiku-docs` literal, y acá no se intenta compensar ese rechazo.
   */
  queryModule<T = any>(target: ModuleTarget, method: string, payload: unknown): Promise<Reply<T>>;

  /** Publica un COMANDO a un servicio de módulo (timeout de comandos). Ver `queryModule`. */
  commandModule<T = any>(target: ModuleTarget, method: string, payload: unknown): Promise<Reply<T>>;

  /**
   * Pregunta si el servicio micro `{serviceName}-queries` está vivo (`$SRV.PING`).
   * `true` con cualquier reply; `false` con `no responders` o timeout; el resto se relanza.
   */
  pingModule(serviceName: string, timeoutMs: number): Promise<boolean>;

  /**
   * Abre el bucket `JIKU_MODULES` en solo lectura.
   *
   * `bindOnly`: la api no tiene permiso ni responsabilidad de crear el bucket (lo crea
   * `create-modules-kv.sh`), y bindear no consulta el stream: un bucket inexistente se ve
   * recién en el primer `get()`.
   *
   * `allow_direct: true` NO es opcional: con `bindOnly` nats.js 2.29 no consulta el stream y
   * deja `direct = false`, así que `get()` iría a `$JS.API.STREAM.MSG.GET.*`, que la plantilla
   * del auth-callout no autoriza (autoriza `$JS.API.DIRECT.GET.*`). El síntoma sería un
   * registro siempre ilegible, con la violación solo en el log del servidor NATS.
   */
  openModuleKv(): Promise<ModuleKv>;
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

  async queryModule<T = any>(target: ModuleTarget, method: string, payload: unknown): Promise<Reply<T>> {
    if (!this.connection) {
      throw new Error('Bus no conectado');
    }

    // Misma conexión, inbox y service user que `query()` (una segunda conexión pediría otra
    // identidad al auth-callout).
    const subject = moduleQuerySubject(target.serviceName, target.protocol, method, this.userId);
    const message = await this.connection.request(
      subject,
      new TextEncoder().encode(JSON.stringify(payload)),
      { timeout: QUERY_TIMEOUT_MS }
    );

    return JSON.parse(new TextDecoder().decode(message.data)) as Reply<T>;
  }

  async commandModule<T = any>(target: ModuleTarget, method: string, payload: unknown): Promise<Reply<T>> {
    if (!this.connection) {
      throw new Error('Bus no conectado');
    }

    const subject = moduleCommandSubject(target.serviceName, target.protocol, method, this.userId);
    const message = await this.connection.request(
      subject,
      new TextEncoder().encode(JSON.stringify(payload)),
      { timeout: REQUEST_TIMEOUT_MS }
    );

    return JSON.parse(new TextDecoder().decode(message.data)) as Reply<T>;
  }

  async pingModule(serviceName: string, timeoutMs: number): Promise<boolean> {
    if (!this.connection) {
      throw new Error('Bus no conectado');
    }

    try {
      await this.connection.request(modulePingSubject(serviceName), Empty, { timeout: timeoutMs });
      return true;
    } catch (error: any) {
      // `ErrorCode.NoResponders` es el string '503' y colisiona con `JetStreamNotEnabled`; en un
      // `request()` plano (no JetStream) '503' ES no-responders.
      if (
        error instanceof NatsError &&
        (error.code === ErrorCode.NoResponders || error.code === ErrorCode.Timeout)
      ) {
        return false;
      }
      throw error;
    }
  }

  async openModuleKv(): Promise<ModuleKv> {
    if (!this.connection) {
      throw new Error('Bus no conectado');
    }

    const kv = await this.connection
      .jetstream()
      .views.kv(MODULES_BUCKET, { bindOnly: true, allow_direct: true });

    return {
      async get(key: string) {
        const entry = await kv.get(key);
        return entry ? { operation: entry.operation, value: entry.string() } : null;
      },
      async watch(key: string, onEntry) {
        const iter = await kv.watch({ key });
        const closed = (async () => {
          try {
            for await (const entry of iter) {
              await onEntry({ operation: entry.operation, value: entry.string() });
            }
          } catch (error: any) {
            // Nunca rechaza: el registro reabre el watch en el próximo tick.
            logger.error(`[modules] watch de ${MODULES_BUCKET} terminó con error: ${error.message}`);
          }
        })();
        return { stop: () => iter.stop(), closed };
      },
    };
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
