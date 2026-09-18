import { randomBytes } from 'crypto';

/**
 * Generador de ULID (REQ-014 / S-063), implementación propia de este servicio.
 *
 * DOS COSAS LO USAN — el `eventId` de cada `DomainEvent` y el `correlationId` de `dispatch()` — y
 * por eso vive en su propio archivo, el mismo criterio con el que `times/window.ts` existe.
 *
 * IMPLEMENTACIÓN PROPIA Y NO LA DEPENDENCIA `ulid` (D-2, decisión ya tomada en la planificación),
 * por tres razones concretas de este árbol:
 *
 *   (a) `packages/nats-protocol` ya tiene un codificador base32 escrito a mano para
 *       `hashUserId()` — el alfabeto y el encoder son un problema ya resuelto una vez en el
 *       monorepo, aunque el ALFABETO no se reusa (ver abajo);
 *   (b) una dependencia nueva en `core` —el único servicio que escribe— es superficie que hay
 *       que justificar, y 26 caracteres de base32 no la justifican;
 *   (c) `crypto.randomBytes` de Node cubre la parte aleatoria sin nada más.
 *
 * EL ALFABETO ES CROCKFORD, NO EL DE `hashUserId()`. El de `hashUserId()` es RFC 4648 (`A-Z2-7`):
 * copiar esa tabla daría valores que no matchean `/^[0-9A-HJKMNP-TV-Z]{26}$/` (Crockford EXCLUYE
 * `I`, `L`, `O` y `U`, para que un humano no confunda un caracter con un dígito al leerlo en un
 * log). Se reusa la FORMA del encoder de bits, no la tabla.
 *
 * FORMA: 26 caracteres — 10 derivados del timestamp en milisegundos (48 bits, suficientes hasta
 * el año 10889) + 16 aleatorios (80 bits). Dos ULIDs generados en el mismo milisegundo difieren
 * por su parte aleatoria, y el orden lexicográfico de los primeros 10 caracteres es monótono no
 * decreciente en el tiempo — la propiedad que le da su nombre ("Universally Unique
 * Lexicographically Sortable Identifier").
 */
const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

const TIME_CHARS = 10;
const RANDOM_CHARS = 16;
/** 16 caracteres base32 de 5 bits = 80 bits, la parte aleatoria del ULID. */
const RANDOM_BYTES = 10;

/** Codifica `value` (hasta 48 bits) en `length` caracteres Crockford base32, con ceros a la izquierda. */
function encodeTime(value: number, length: number): string {
  let output = '';
  let remaining = value;
  for (let i = 0; i < length; i++) {
    output = CROCKFORD_ALPHABET[remaining % 32] + output;
    remaining = Math.floor(remaining / 32);
  }
  return output;
}

/** Codifica los bytes aleatorios en Crockford base32, a `length` caracteres. */
function encodeRandom(bytes: Buffer, length: number): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5 && output.length < length) {
      output += CROCKFORD_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  // Si sobran bits sin alcanzar `length` (no debería pasar con 10 bytes -> 16 chars, pero la
  // guarda es barata): completa con el resto desplazado, igual que el encoder de `hashUserId()`.
  if (output.length < length && bits > 0) {
    output += CROCKFORD_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output.slice(0, length);
}

/**
 * Genera un ULID: 26 caracteres, alfabeto Crockford, ordenable por tiempo.
 *
 * Usado para `DomainEvent.eventId` (uno por evento) y para `correlationId` (uno por `dispatch()`,
 * compartido por todos los eventos de ese comando — CA-9). Es la MISMA función para los dos: no
 * hay una variante "de evento" y otra "de correlación", porque un ULID no lleva semántica propia
 * más allá de ser único y ordenable.
 */
export function generateUlid(now: number = Date.now()): string {
  return encodeTime(now, TIME_CHARS) + encodeRandom(randomBytes(RANDOM_BYTES), RANDOM_CHARS);
}

export default generateUlid;
