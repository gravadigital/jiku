import { describe, it, expect } from 'vitest';
import { isLockActive, lockedMessage, lockRowLabel } from './lockState';

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

describe('identidad por sub (S-101)', () => {
  const JIKU_ID = '7f3c2a10-0000-4000-8000-000000000001';
  const MINE = {
    holder: 'sub-yo',
    holderName: 'Yo',
    via: 'human' as const,
    expiresAt: '2026-10-26T15:45:00.000Z',
  };
  const other = 'Yo lo está editando hasta las 15:45. Podés leerlo mientras tanto.';

  it('TS-4: lockedMessage reconoce el lock propio por sub', () => {
    expect(lockedMessage(MINE, 'sub-yo')).toBe('Lo estás editando en otra pestaña o ventana.');
  });
  it('TS-5/TS-6: con el id de Jiku o sin sub no reconoce', () => {
    expect(lockedMessage(MINE, JIKU_ID)).toBe(other);
    expect(lockedMessage(MINE, null)).toBe(other);
    expect(lockedMessage(MINE, undefined)).toBe(other);
  });
  it('TS-7: un agente con holder igual al sub no es propio', () => {
    expect(lockedMessage({ ...MINE, holderName: null, via: 'agent' }, 'sub-yo')).toBe(
      'Un agente lo está editando hasta las 15:45. Podés leerlo mientras tanto.'
    );
  });
  it('TS-8: lockRowLabel propio', () => {
    expect(lockRowLabel(MINE, 'sub-yo')).toBe('Lo estás editando');
  });
  it('TS-9: lockRowLabel de otro, sin nombre, sin sub o con id de Jiku', () => {
    const luis = { holder: 'sub-luis', holderName: 'Luis Gómez', via: 'human' as const };
    expect(lockRowLabel(luis, 'sub-yo')).toBe('Luis Gómez lo está editando');
    expect(lockRowLabel({ ...luis, holderName: null }, 'sub-yo')).toBe(
      'Otra persona lo está editando'
    );
    expect(lockRowLabel(MINE, null)).toBe('Yo lo está editando');
    expect(lockRowLabel(MINE, JIKU_ID)).toBe('Yo lo está editando');
  });
});
