import { describe, it, expect } from 'vitest';
import { isLockActive, lockedMessage } from './lockState';

const LOCK = {
  sessionId: '01J9Z3K8M2Q4R6T8V0W2Y4A6E3',
  holder: 'sub-ana',
  via: 'human' as const,
  expiresAt: '2026-10-24T14:02:00.000Z',
};

describe('isLockActive (TS-22)', () => {
  it('vigente, vencido, propio y sin lock', () => {
    expect(isLockActive(LOCK, new Date('2026-10-24T14:00:00Z'), null)).toBe(true);
    expect(isLockActive(LOCK, new Date('2026-10-24T14:03:00Z'), null)).toBe(false);
    expect(isLockActive(LOCK, new Date('2026-10-24T14:00:00Z'), LOCK.sessionId)).toBe(false);
    expect(isLockActive(null, new Date('2026-10-24T14:00:00Z'), null)).toBe(false);
  });
});

describe('lockedMessage (TS-9)', () => {
  const LUIS = {
    holder: 'sub-luis',
    holderName: 'Luis Gómez',
    via: 'human' as const,
    expiresAt: '2026-10-26T15:45:00.000Z',
  };
  const tail = 'lo está editando hasta las 15:45. Podés leerlo mientras tanto.';
  it('nombre del servicio, sin nombre, agente y propio', () => {
    expect(lockedMessage(LUIS, 'sub-yo')).toBe(`Luis Gómez ${tail}`);
    expect(lockedMessage({ ...LUIS, holderName: null }, 'sub-yo')).toBe(`Otra persona ${tail}`);
    expect(lockedMessage({ ...LUIS, via: 'agent' }, 'sub-yo')).toBe(`Un agente ${tail}`);
    expect(lockedMessage({ ...LUIS, holder: 'sub-yo' }, 'sub-yo')).toBe(
      'Lo estás editando en otra pestaña o ventana.'
    );
  });
});
