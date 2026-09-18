import { EventPublisher } from '../../src/bus/event-publisher';

/** Una entrada acumulada por el doble: lo que se hubiera publicado, sin publicarlo. */
export interface PublishedEvent {
  subject: string;
  payload: unknown;
}

/**
 * El doble del publicador de eventos (CA-10 de S-063), compartido por `core` y por la api.
 *
 * NO ES UN MOCK DE `sinon` (decisión 5 del diseño técnico de la story): un objeto propio con un
 * array es más útil para asertar `subject` y `payload` que una llamada espiada — un test hace
 * `pub.published[0].payload` y compara con `deepEqual` directo, sin desarmar los argumentos de
 * una llamada. Un test que necesite simular un FALLO de publicación (los escenarios de R-A/R-B)
 * puede además stubbear `publish` de una instancia con `sinon`, porque sigue siendo un método de
 * clase común.
 *
 * ACUMULA EL OBJETO TAL CUAL, no serializado: la serialización a JSON es responsabilidad de
 * `JetStreamEventPublisher` (la implementación real), no de este doble. Así un test hace
 * `deepEqual` sobre el `DomainEvent` sin tener que decodificar nada.
 *
 * VIVE EN `core/tests/helpers/` Y NO EN `core/src/`: es un doble de test, no código de producción,
 * y `api/tests/mocks/bus.ts` lo importa por RUTA RELATIVA a este archivo — el mismo doble, no una
 * copia (AC-6 de la Task 1). Que la api importe de `core/tests/` y no de `core/src/` es deliberado:
 * un doble de test no tiene por qué viajar en el build de producción de `core`.
 */
export class FakeEventPublisher implements EventPublisher {
  published: PublishedEvent[] = [];

  async publish(subject: string, payload: unknown): Promise<void> {
    this.published.push({ subject, payload });
  }

  /** Vacía lo acumulado. Usalo en un `afterEach`/`beforeEach` si el archivo comparte la instancia. */
  reset(): void {
    this.published = [];
  }
}
