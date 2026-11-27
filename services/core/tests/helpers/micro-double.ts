import {
  EndpointOptions,
  Payload,
  PublishOptions,
  ServiceConfig,
  ServiceHandler,
  Status,
  SubscriptionOptions,
} from 'nats';

/**
 * Dobles del framework micro de `nats`.
 *
 * El entorno de test no tiene un NATS al que conectarse, así que la única forma de ejercitar el
 * registro de endpoints y el contrato de respuesta es sustituir la librería. NO sustituye a la
 * base —esa es real, y tiene que seguir siéndolo, como manda la convención `testing`—: sustituye
 * una red que no está. Un doble que reemplaza una verificación posible es un problema; éste
 * habilita la única verificación que hay.
 *
 * Mismo criterio y mismo estilo que `tests/helpers/s3-double.ts`: registran las llamadas, no
 * tocan la red, y no transforman nada de lo que reciben para que el test pueda assertarlo tal
 * cual llegó.
 */

/** Texto de un cuerpo del bus, para que el diff de un fallo sea legible. */
export function decode(data?: Payload): string {
  if (data === undefined) {
    return '';
  }
  return typeof data === 'string' ? data : new TextDecoder().decode(data);
}

/** Cuerpo del bus a partir de un string, como lo arma el productor real. */
export function encode(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

export interface RecordedResponse {
  data?: Payload;
  opts?: PublishOptions;
}

export interface RecordedErrorResponse {
  code: number;
  description: string;
  data?: Uint8Array;
  opts?: PublishOptions;
}

/**
 * Doble de `ServiceMsg`.
 *
 * `json()` delega en `JSON.parse` y LANZA con un cuerpo inválido, igual que la implementación
 * real: si el doble devolviera `null` en vez de lanzar, el camino de `invalid_fields` nunca se
 * ejercitaría y el test pasaría sin probar nada.
 */
export class FakeMsg {
  readonly responses: RecordedResponse[] = [];
  readonly errorResponses: RecordedErrorResponse[] = [];

  constructor(
    readonly subject: string,
    readonly data: Uint8Array
  ) {}

  json<T = unknown>(): T {
    return JSON.parse(new TextDecoder().decode(this.data)) as T;
  }

  respond(data?: Payload, opts?: PublishOptions): boolean {
    this.responses.push({ data, opts });
    return true;
  }

  /** Los tres argumentos se guardan SIN transformar: el test decodifica el cuerpo y comprueba
   * que no es `Empty`, que es la mitad importante de CA-5. */
  respondError(
    code: number,
    description: string,
    data?: Uint8Array,
    opts?: PublishOptions
  ): boolean {
    this.errorResponses.push({ code, description, data, opts });
    return true;
  }

  /** Respuestas totales. Tiene que ser exactamente 1 en cualquier camino. */
  get replyCount(): number {
    return this.responses.length + this.errorResponses.length;
  }
}

export function fakeMsg(options: { subject?: string; data?: Uint8Array } = {}): FakeMsg {
  return new FakeMsg(
    options.subject ?? 'dev.api.jiku-commands.v1.clients.new',
    options.data ?? new Uint8Array(0)
  );
}

export interface RecordedEndpoint {
  name: string;
  subject?: string;
  handler?: ServiceHandler;
  queue?: string;
}

/** Doble de `ServiceGroup`. */
export class FakeGroup {
  readonly endpoints: RecordedEndpoint[] = [];

  constructor(
    readonly subject?: string,
    readonly queue?: string
  ) {}

  addEndpoint(name: string, opts?: ServiceHandler | EndpointOptions): FakeGroup {
    if (typeof opts === 'function') {
      this.endpoints.push({ name, handler: opts });
    } else {
      this.endpoints.push({
        name,
        subject: opts?.subject,
        handler: opts?.handler,
        queue: opts?.queue,
      });
    }
    return this;
  }

  addGroup(subject?: string, queue?: string): FakeGroup {
    return new FakeGroup(subject, queue);
  }
}

/** Doble de `Service`. */
export class FakeService {
  readonly groups: FakeGroup[] = [];
  stopCount = 0;

  constructor(
    readonly config: ServiceConfig,
    private trace: string[]
  ) {}

  addGroup(subject?: string, queue?: string): FakeGroup {
    const group = new FakeGroup(subject, queue);
    this.groups.push(group);
    return group;
  }

  addEndpoint(name: string, opts?: ServiceHandler | EndpointOptions): FakeGroup {
    return this.addGroup().addEndpoint(name, opts);
  }

  stop(): Promise<null> {
    this.stopCount += 1;
    this.trace.push('service.stop');
    return Promise.resolve(null);
  }

  /** El único grupo creado. Falla ruidosamente si hubo más de uno: un `addGroup` por endpoint
   * es un bug que CA-2 no perdona, y devolver el primero en silencio lo escondería. */
  get group(): FakeGroup {
    if (this.groups.length !== 1) {
      throw new Error(`[micro-double] se esperaba 1 grupo, hubo ${this.groups.length}`);
    }
    return this.groups[0];
  }
}

/**
 * Doble de `Sub<Msg>`: la suscripción PLANA del consumidor de eventos.
 *
 * Es lo mínimo del tipo real de `nats@2.29.3` que `BusHost` usa y que los tests assertan, y nada
 * más: `getReceived`, `getMax` y `getPending` no están porque ningún test los mira.
 *
 * AL REVÉS QUE `FakeConnection.status()`, ESTE ITERADOR NO TERMINA SOLO: una suscripción tiene
 * que quedarse abierta para recibir. La salida la da `drain()` o `unsubscribe()`, así que TODO
 * test que empuje mensajes tiene que drenar antes de terminar, o el proceso queda colgado — el
 * `for await` del consumidor corre con `void` y sin `await` desde `start()`.
 *
 * La cola interna más una promesa "hay algo nuevo" alcanzan: sin `setInterval` ni polling con
 * timers, que hacen los tests lentos y flakey.
 */
export class FakeSubscription {
  /** Los mensajes que el iterador YA entregó, en orden. */
  readonly delivered: FakeMsg[] = [];
  private queue: FakeMsg[] = [];
  /** Resolver del iterador que está esperando un mensaje, si hay uno esperando. */
  private waiting: (() => void) | null = null;
  /** Resolvers de los `push()` que esperan a que el consumidor termine con su mensaje. */
  private processed: (() => void)[] = [];
  private ended = false;
  private draining = false;
  private iterating = false;
  private finish: (() => void) | null = null;
  /** Resuelve cuando el iterador terminó: es lo que hace que `drain()` espere al mensaje en vuelo. */
  private finished: Promise<void>;
  readonly closed: Promise<void>;

  constructor(
    readonly subject: string,
    readonly opts: SubscriptionOptions | undefined,
    private trace: string[]
  ) {
    this.finished = new Promise<void>((resolve) => {
      this.finish = resolve;
    });
    this.closed = this.finished;
  }

  /**
   * Entrega un mensaje al consumidor.
   *
   * La promesa que devuelve se resuelve cuando el consumidor PIDIÓ EL SIGUIENTE, o sea cuando
   * terminó de procesar este. Es lo que permite escribir los tests sin `setTimeout` arbitrarios.
   */
  push(data: Uint8Array, subject: string = this.subject): Promise<void> {
    this.queue.push(new FakeMsg(subject, data));
    this.wake();
    return new Promise<void>((resolve) => {
      this.processed.push(resolve);
    });
  }

  /** Termina el iterador y deja que el mensaje EN VUELO termine de procesarse. */
  drain(): Promise<void> {
    this.trace.push('subscription.drain');
    this.draining = true;
    return this.end();
  }

  unsubscribe(): void {
    void this.end();
  }

  getSubject(): string {
    return this.subject;
  }

  isDraining(): boolean {
    return this.draining;
  }

  isClosed(): boolean {
    return this.ended && this.queue.length === 0;
  }

  [Symbol.asyncIterator](): AsyncIterator<FakeMsg> {
    this.iterating = true;
    return {
      next: async (): Promise<IteratorResult<FakeMsg>> => {
        // Pedir el siguiente ES la señal de que el anterior terminó de procesarse.
        this.release();
        while (this.queue.length === 0) {
          if (this.ended) {
            this.finish?.();
            return { done: true, value: undefined as unknown as FakeMsg };
          }
          await new Promise<void>((resolve) => {
            this.waiting = resolve;
          });
        }
        const message = this.queue.shift() as FakeMsg;
        this.delivered.push(message);
        return { done: false, value: message };
      },
    };
  }

  private end(): Promise<void> {
    this.ended = true;
    this.wake();
    // Si nadie empezó a iterar, no hay nada que esperar: sin esto un `stop()` sobre una
    // suscripción que nunca se consumió colgaría el test.
    return this.iterating ? this.finished : Promise.resolve();
  }

  private wake(): void {
    const waiting = this.waiting;
    this.waiting = null;
    waiting?.();
  }

  private release(): void {
    const pending = this.processed;
    this.processed = [];
    for (const resolve of pending) {
      resolve();
    }
  }
}

/** Doble de `NatsConnection`, con solo lo que `BusHost` y `registerService` usan. */
export class FakeConnection {
  /** Las configs con las que se pidió un servicio, en orden. */
  readonly configs: ServiceConfig[] = [];
  readonly created: FakeService[] = [];
  /** Las suscripciones planas que se abrieron, en orden. */
  readonly subscriptions: FakeSubscription[] = [];
  /**
   * Traza compartida entre el servicio y la conexión. Que el orden del apagado se lea de UN
   * array es lo que hace posible assertar CA-13 sin acrobacias.
   */
  readonly trace: string[] = [];
  readonly services: { add: (config: ServiceConfig) => Promise<FakeService> };

  constructor(private add?: (config: ServiceConfig) => Promise<FakeService>) {
    this.services = { add: (config) => this.addService(config) };
  }

  private addService(config: ServiceConfig): Promise<FakeService> {
    this.configs.push(config);
    if (this.add) {
      return this.add(config);
    }
    const service = new FakeService(config, this.trace);
    this.created.push(service);
    return Promise.resolve(service);
  }

  /** Un servicio propio de la conexión, para que un `add` inyectado pueda devolver uno real. */
  makeService(config: ServiceConfig): FakeService {
    const service = new FakeService(config, this.trace);
    this.created.push(service);
    return service;
  }

  /**
   * La suscripción plana del consumidor de eventos.
   *
   * Registra `{ subject, opts }` SIN transformar nada: el test asserta el subject literal y el
   * queue group tal cual llegaron. `'subscribe'` va a la traza compartida, y de ahí sale la
   * aserción de que la suscripción se abre DESPUÉS de registrar los servicios micro.
   */
  subscribe(subject: string, opts?: SubscriptionOptions): FakeSubscription {
    const subscription = new FakeSubscription(subject, opts, this.trace);
    this.subscriptions.push(subscription);
    this.trace.push('subscribe');
    return subscription;
  }

  status(): AsyncIterable<Status> {
    // Se cierra de inmediato: el loop de estado de `BusHost` corre con `void` y sin `await`, así
    // que un iterador que no termina nunca dejaría el proceso de test colgado.
    return {
      [Symbol.asyncIterator]: (): AsyncIterator<Status> => ({
        next: (): Promise<IteratorResult<Status>> =>
          Promise.resolve({ done: true, value: undefined as unknown as Status }),
      }),
    };
  }

  drain(): Promise<void> {
    this.trace.push('connection.drain');
    return Promise.resolve();
  }

  close(): Promise<void> {
    this.trace.push('connection.close');
    return Promise.resolve();
  }
}

export function fakeConnection(
  options: { add?: (config: ServiceConfig) => Promise<FakeService> } = {}
): FakeConnection {
  return new FakeConnection(options.add);
}
