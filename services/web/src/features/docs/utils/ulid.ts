const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * ULID (26 caracteres Crockford base32): 48 bits de tiempo en 10 caracteres + 80 bits de
 * `crypto.getRandomValues` en 16. Se usa como `sessionId` del lock y como `id` de alta (P-3, DD-8);
 * no se agrega una librería por 15 líneas.
 */
export function newUlid(): string {
  let time = Date.now();
  let timePart = '';
  for (let i = 0; i < 10; i += 1) {
    timePart = CROCKFORD[time % 32] + timePart;
    time = Math.floor(time / 32);
  }

  const bytes = crypto.getRandomValues(new Uint8Array(10));
  let bits = 0;
  let acc = 0;
  let randomPart = '';
  for (const byte of bytes) {
    acc = (acc << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      randomPart += CROCKFORD[(acc >> bits) & 31];
    }
    acc &= (1 << bits) - 1;
  }

  return timePart + randomPart;
}
