import { ModuleRecord } from '@jiku/nats-protocol';
import logger from '../logger';
import { ModuleKv, ModuleKvEntry, ModuleKvWatch, ModuleTarget, bus } from '../utils/bus';
import { docsFeatures } from './docs/features';

export type ModuleName = 'docs';
/** `incompatible` es interno: hacia afuera se informa como `not_installed` (RF-4). */
export type ModuleStatus = 'not_installed' | 'incompatible' | 'unavailable' | 'available';
export type PublicModuleStatus = 'not_installed' | 'unavailable' | 'available';

export interface ModuleStatusEntry {
  module: ModuleName;
  status: PublicModuleStatus;
  features?: Record<string, unknown>;
}

export const SUPPORTED_PROTOCOL = 'v1';
export const MODULE_CHECK_INTERVAL_MS = 30000;
export const MODULE_PING_TIMEOUT_MS = 2000;

const SERVICE_NAME_PATTERN = /^[a-z][a-z0-9-]{1,40}$/;
const PROTOCOL_PATTERN = /^v[0-9]+$/;

/**
 * Valida el valor de la clave contra `ModuleRecord`. Campos extra se toleran
 * (`jiku-modules.yaml`: los lectores deben tolerar campos nuevos dentro de v1).
 *
 * Validar `serviceName` ACÁ es la primera línea de defensa: un valor inválido nunca llega a
 * `modulePingSubject`, que lanzaría.
 */
function parseRecord(module: ModuleName, value: string): { record?: ModuleRecord; reason?: string } {
  let parsed: any;
  try {
    parsed = JSON.parse(value);
  } catch {
    return { reason: 'JSON inválido' };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { reason: 'JSON inválido' };
  }
  if (typeof parsed.serviceName !== 'string') {
    return { reason: 'falta serviceName' };
  }
  if (!SERVICE_NAME_PATTERN.test(parsed.serviceName)) {
    return { reason: 'serviceName inválido' };
  }
  if (typeof parsed.protocol !== 'string' || !PROTOCOL_PATTERN.test(parsed.protocol)) {
    return { reason: 'protocol inválido' };
  }
  if (parsed.module !== module) {
    return { reason: 'module no coincide con la clave' };
  }
  if (typeof parsed.registeredAt !== 'string') {
    return { reason: 'registeredAt inválido' };
  }
  return { record: parsed as ModuleRecord };
}

/**
 * Estado de un módulo opcional, EN MEMORIA POR RÉPLICA (DD-5): dos réplicas pueden discrepar
 * hasta 30 s. Lee el registro `JIKU_MODULES`, observa la clave y hace ping cada 30 s.
 *
 * DD-6: un registro ilegible NO tumba la api; `start()` nunca rechaza y se reintenta en cada tick.
 */
export class ModuleRegistry {
  private state: ModuleStatus = 'not_installed';
  private current: ModuleRecord | null = null;
  private kv: ModuleKv | null = null;
  private watcher: ModuleKvWatch | null = null;
  private timer: NodeJS.Timeout | null = null;
  private starting: Promise<void> | null = null;
  private pinging: Promise<void> | null = null;
  private pingGeneration = -1;
  /** Solo `stop()` lo incrementa: `open()` lo usa para abandonar si lo detuvieron a mitad. */
  private epoch = 0;
  /** Última entrada aplicada: el watch re-entrega el valor vigente y re-aplicarlo duplicaría pings y logs. */
  private lastApplied: string | null = null;
  /**
   * Se incrementa con cada entrada aplicada y con `stop()`: el resultado de un ping solo se
   * aplica si no cambió. Sin esto, un ping en vuelo cuya clave se borró dejaría `available`
   * un módulo desinstalado.
   */
  private generation = 0;

  constructor(private readonly module: ModuleName, private readonly features: () => Record<string, unknown>) {}

  status(): ModuleStatus {
    return this.state;
  }

  /** Solo con `unavailable` | `available`. */
  record(): ModuleTarget | null {
    if ((this.state === 'unavailable' || this.state === 'available') && this.current) {
      return { serviceName: this.current.serviceName, protocol: this.current.protocol };
    }
    return null;
  }

  publicEntry(): ModuleStatusEntry {
    if (this.state === 'unavailable' || this.state === 'available') {
      return { module: this.module, status: this.state, features: this.features() };
    }
    return { module: this.module, status: 'not_installed' };
  }

  start(): Promise<void> {
    if (!this.starting) {
      this.starting = this.open().then(() => {
        if (!this.timer) {
          this.timer = setInterval(() => {
            void this.tick();
          }, MODULE_CHECK_INTERVAL_MS);
          this.timer.unref();
        }
      });
    }
    return this.starting;
  }

  stop(): void {
    this.generation += 1;
    this.epoch += 1;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.watcher?.stop();
    this.watcher = null;
    this.kv = null;
    this.current = null;
    this.state = 'not_installed';
    this.starting = null;
    this.pinging = null;
    this.lastApplied = null;
  }

  /** `unavailable` YA (sincrónico) y re-ping inmediato: paso 6 del flujo. */
  async markUnavailable(): Promise<void> {
    if (this.current && this.state === 'available') {
      this.transition('unavailable');
    }
    await this.ping();
  }

  private transition(next: ModuleStatus): void {
    if (next !== this.state) {
      logger.info(`[modules] ${this.module}: ${this.state} -> ${next}`);
      this.state = next;
    }
  }

  /** Abre el KV (get + watch). NUNCA rechaza. */
  private async open(): Promise<void> {
    const epoch = this.epoch;
    try {
      const kv = await bus().openModuleKv();
      const entry = await kv.get(this.module);
      if (epoch !== this.epoch) {
        return;
      }
      this.kv = kv;
      // No se espera el ping acá: el watch tiene que quedar armado ANTES, para no perder un
      // cambio de la clave mientras el ping está en vuelo (la generación descarta el resultado).
      const initial = entry ? this.apply(entry) : null;
      // `include` por default: re-entrega el valor vigente, así una escritura entre el get y el
      // watch no se pierde (la re-evaluación es idempotente).
      const watcher = await kv.watch(this.module, (e) => this.apply(e));
      if (epoch !== this.epoch) {
        watcher.stop();
        return;
      }
      this.watcher = watcher;
      await initial;
      void watcher.closed.then(() => {
        // Un watch que termina suelta el handle; el próximo tick lo reabre.
        if (this.watcher === watcher) {
          this.watcher = null;
          this.kv = null;
        }
      });
    } catch (error: any) {
      this.kv = null;
      this.watcher = null;
      logger.error(
        `[modules] ${this.module}: no se pudo leer el registro (${error.message}); reintento en 30 s`
      );
    }
  }

  private async tick(): Promise<void> {
    if (!this.kv || !this.watcher) {
      this.watcher?.stop();
      await this.open();
      return;
    }
    if (this.current && this.state !== 'incompatible') {
      await this.ping();
    }
  }

  /** Aplica una entrada del KV (get inicial o watch). */
  private async apply(entry: ModuleKvEntry): Promise<void> {
    const key = `${entry.operation}:${entry.value}`;
    if (key === this.lastApplied) {
      return;
    }
    this.lastApplied = key;
    this.generation += 1;

    if (entry.operation !== 'PUT') {
      this.current = null;
      this.transition('not_installed');
      return;
    }

    const { record, reason } = parseRecord(this.module, entry.value);
    if (!record) {
      this.current = null;
      logger.error(`[modules] ${this.module}: registro inválido (${reason})`);
      this.transition('incompatible');
      return;
    }
    if (record.protocol !== SUPPORTED_PROTOCOL) {
      this.current = null;
      logger.error(
        `[modules] ${this.module}: protocolo ${record.protocol} no soportado (soportado: ${SUPPORTED_PROTOCOL})`
      );
      this.transition('incompatible');
      return;
    }

    this.current = record;
    await this.ping();
  }

  /** Un solo ping en vuelo a la vez; el resultado se descarta si cambió la generación. */
  private ping(): Promise<void> {
    if (this.pinging && this.pingGeneration === this.generation) {
      return this.pinging;
    }
    const record = this.current;
    if (!record) {
      return Promise.resolve();
    }
    const gen = this.generation;
    this.pingGeneration = gen;
    const run = (async () => {
      let alive = false;
      try {
        alive = await bus().pingModule(record.serviceName, MODULE_PING_TIMEOUT_MS);
      } catch {
        alive = false;
      }
      if (gen === this.generation) {
        this.transition(alive ? 'available' : 'unavailable');
      }
    })().finally(() => {
      if (this.pinging === run) {
        this.pinging = null;
      }
    });
    this.pinging = run;
    return run;
  }
}

export const docsModule = new ModuleRegistry('docs', docsFeatures);

const REGISTRIES: Record<ModuleName, ModuleRegistry> = { docs: docsModule };

export function registryFor(module: ModuleName): ModuleRegistry {
  return REGISTRIES[module];
}

export function listModules(): ModuleStatusEntry[] {
  return [docsModule.publicEntry()];
}
