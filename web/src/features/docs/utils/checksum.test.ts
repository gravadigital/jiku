import { describe, it, expect } from 'vitest';
import { sha256Checksum } from './checksum';

describe('sha256Checksum (TS-18)', () => {
  it('calcula el SHA-256 del contenido', async () => {
    await expect(sha256Checksum(new Blob(['hola']))).resolves.toBe(
      'sha256:b221d9dbb083a7f33428d7c2a3c3198ae925614d70210e28716ccaa7cd4ddb79'
    );
  });
});
