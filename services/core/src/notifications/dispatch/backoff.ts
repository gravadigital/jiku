/**
 * El cálculo del backoff exponencial (REQ-015/S-073, CA-3): cuánto esperar antes del próximo
 * intento de una fila que falló al enviarse.
 *
 * BASE Y TOPE COMO CONSTANTES DE MÓDULO: `BASE_SECONDS = 60` reproduce la progresión que la
 * story ejemplifica (60s, 120s, 240s, ...) para `base * 2^attempts`. `MAX_SECONDS` evita que
 * `next_attempt_at` se vaya a años con muchos intentos acumulados — sin tope, un `attempts` alto
 * (por ejemplo si `notification-max-attempts` se sube por SQL después de que una fila ya
 * acumuló muchos) haría que `2^attempts` desborde a un número absurdamente grande.
 */
const BASE_SECONDS = 60;
const MAX_SECONDS = 24 * 60 * 60; // 1 día: tope superior explícito, ninguna fila espera más que esto.

/**
 * Devuelve el próximo `next_attempt_at`, a partir de cuántos intentos YA tiene la fila (antes de
 * sumarle este fallo). Con `attempts = 0` (primer fallo) da `BASE_SECONDS` de espera; con
 * `attempts = 1`, el doble; y así sucesivamente, acotado por `MAX_SECONDS`.
 */
export function nextAttemptAt(attempts: number, now: Date = new Date()): Date {
  const delaySeconds = Math.min(BASE_SECONDS * 2 ** attempts, MAX_SECONDS);
  return new Date(now.getTime() + delaySeconds * 1000);
}
