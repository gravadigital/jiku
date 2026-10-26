import { describe, expect, it } from 'vitest';
import { editorLabel } from './editorLabel';

describe('editorLabel', () => {
  it('"vos" si es la persona actual', () => {
    expect(editorLabel({ name: 'Yo', sub: 'sub-yo', currentUserSub: 'sub-yo' })).toBe('vos');
  });
  it('el nombre del servicio si es otra persona', () => {
    expect(editorLabel({ name: 'Ana Pérez', sub: 'sub-ana', currentUserSub: 'sub-yo' })).toBe(
      'Ana Pérez'
    );
  });
  it('"—" sin nombre', () => {
    expect(editorLabel({ name: null, sub: 'sub-bot', currentUserSub: 'sub-yo' })).toBe('—');
    expect(editorLabel({ sub: 'sub-bot', currentUserSub: null })).toBe('—');
  });
});

describe('editorLabel por sub (S-101)', () => {
  const JIKU_ID = '7f3c2a10-0000-4000-8000-000000000001';
  it('TS-10: "vos" por sub', () => {
    expect(editorLabel({ name: 'Yo', sub: 'sub-yo', currentUserSub: 'sub-yo' })).toBe('vos');
  });
  it('TS-11: con id de Jiku o sin sub no reconoce', () => {
    expect(editorLabel({ name: 'Yo', sub: 'sub-yo', currentUserSub: JIKU_ID })).toBe('Yo');
    expect(editorLabel({ name: 'Yo', sub: 'sub-yo', currentUserSub: null })).toBe('Yo');
    expect(editorLabel({ name: null, sub: 'sub-yo', currentUserSub: null })).toBe('—');
  });
});
