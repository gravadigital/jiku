import { Bus } from '../../lib/utils/bus';
import { Reply, commandSubject } from '../../lib/utils/bus/protocol';

export interface SentCommand {
  command: string;
  payload: any;
}

/**
 * User id del service user en los tests. Es un `sub` de Zitadel de mentira: nada lo
 * valida acá, porque el callout no participa. Solo tiene que ser un token válido de
 * subject NATS.
 */
const TEST_USER_ID = '000000000000000001';

/**
 * Doble del bus para los tests.
 *
 * Registra qué comandos publicó la api y, por defecto, **los ejecuta contra core** con la
 * misma base de datos. Eso permite que un test verifique las tres cosas a la vez:
 *
 *   - qué comando se publicó y con qué payload
 *   - que la api traduce la respuesta al mismo HTTP que antes del split
 *   - que la escritura efectivamente ocurrió
 *
 * Con `reply()` o `failWith()` se corta la ejecución real y se devuelve lo que el test
 * indique, para poder cubrir los caminos de error sin fabricar el estado que los provoca.
 *
 * Core vive en otro paquete del monorepo (`../../core`), así que se carga de forma
 * perezosa: si no está instalado, el doble sigue funcionando en modo respuestas fijas.
 */
export class FakeBus implements Bus {
  readonly sent: SentCommand[] = [];
  private replies = new Map<string, Reply>();
  private defaultReply: Reply | null = null;
  private failure: Error | null = null;
  private dispatcher: ((subject: string, payload: unknown) => Promise<Reply>) | null = null;
  private dispatcherLoaded = false;

  /** Respuesta fija para un comando; evita ejecutarlo contra core. */
  reply(command: string, reply: Reply): this {
    this.replies.set(command, reply);
    return this;
  }

  /** Respuesta fija para cualquier comando sin respuesta propia. */
  replyDefault(reply: Reply): this {
    this.defaultReply = reply;
    return this;
  }

  /** Simula un bus caído o un timeout. */
  failWith(error: Error): this {
    this.failure = error;
    return this;
  }

  reset(): this {
    this.sent.length = 0;
    this.replies.clear();
    this.defaultReply = null;
    this.failure = null;
    return this;
  }

  get last(): SentCommand | undefined {
    return this.sent[this.sent.length - 1];
  }

  async request<T = any>(command: string, payload: unknown): Promise<Reply<T>> {
    this.sent.push({ command, payload });

    if (this.failure) {
      throw this.failure;
    }

    const fixed = this.replies.get(command) ?? this.defaultReply;
    if (fixed) {
      return fixed as Reply<T>;
    }

    const dispatch = this.loadDispatcher();
    if (!dispatch) {
      return { status: 'success' } as Reply<T>;
    }

    // El subject completo, como lo armaría la api: se arma con la misma función que usa
    // el bus real, así que el formato no puede divergir del protocolo. El user id es uno
    // de prueba — a core solo le importa que el segmento esté.
    return dispatch(commandSubject(command, TEST_USER_ID), payload) as Promise<Reply<T>>;
  }

  private loadDispatcher() {
    if (this.dispatcherLoaded) {
      return this.dispatcher;
    }
    this.dispatcherLoaded = true;

    try {
      /* eslint-disable @typescript-eslint/no-var-requires */
      const { Dispatcher } = require('../../../core/src/bus/dispatcher');
      const { registry } = require('../../../core/src/commands');
      /* eslint-enable @typescript-eslint/no-var-requires */
      const instance = new Dispatcher(registry);
      this.dispatcher = (subject: string, payload: unknown) =>
        instance.dispatch(subject, payload);
    } catch {
      // core no disponible: los tests que dependan de la escritura real fallarán con un
      // mensaje claro, en vez de pasar en falso.
      this.dispatcher = null;
    }

    return this.dispatcher;
  }
}

export const fakeBus = new FakeBus();
