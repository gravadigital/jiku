import {
  EndpointOptions,
  Payload,
  PublishOptions,
  ServiceConfig,
  ServiceHandler,
  Status,
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

/** Doble de `NatsConnection`, con solo lo que `BusHost` y `registerService` usan. */
export class FakeConnection {
  /** Las configs con las que se pidió un servicio, en orden. */
  readonly configs: ServiceConfig[] = [];
  readonly created: FakeService[] = [];
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
