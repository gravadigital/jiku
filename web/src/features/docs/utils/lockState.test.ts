import { describe, it, expect } from 'vitest';
import { isLockActive, lockedMessage } from './lockState';

const LOCK = {
  sessionId: '01J9Z3K8M2Q4R6T8V0W2Y4A6E3',
  holder: 'sub-ana',
  via: 'human' as const,
  expiresAt: '2026-10-24T14:02:00.000Z',
};
const persons = [{ userId: 'sub-ana', firstName: 'Ana', lastName: 'Gómez' }];

describe('isLockActive (TS-22)', () => {
  it('vigente, vencido, propio y sin lock', () => {
    expect(isLockActive(LOCK, new Date('2026-10-24T14:00:00Z'), null)).toBe(true);
    expect(isLockActive(LOCK, new Date('2026-10-24T14:03:00Z'), null)).toBe(false);
    expect(isLockActive(LOCK, new Date('2026-10-24T14:00:00Z'), LOCK.sessionId)).toBe(false);
    expect(isLockActive(null, new Date('2026-10-24T14:00:00Z'), null)).toBe(false);
  });
});

describe('lockedMessage (TS-23)', () => {
  const expiresAt = '2026-10-24T14:32:00.000Z';
  it('humano, agente y desconocido', () => {
    expect(lockedMessage({ holder: 'sub-ana', via: 'human', expiresAt }, persons)).toBe(
      'Ana Gómez lo está editando hasta las 14:32. Podés leerlo mientras tanto.'
    );
    expect(lockedMessage({ holder: 'sub-ana', via: 'agent', expiresAt }, persons)).toBe(
      'Un agente lo está editando hasta las 14:32. Podés leerlo mientras tanto.'
    );
    expect(lockedMessage({ holder: 'sub-x', via: 'human', expiresAt }, persons)).toBe(
      'otra persona lo está editando hasta las 14:32. Podés leerlo mientras tanto.'
    );
  });
});
