import { describe, expect, it } from 'vitest';
import { editorLabel } from './editorLabel';

describe('editorLabel', () => {
  it('"vos" si es la persona actual', () => {
    expect(editorLabel({ name: 'Yo', sub: 'sub-yo', currentUserId: 'sub-yo' })).toBe('vos');
  });
  it('el nombre del servicio si es otra persona', () => {
    expect(editorLabel({ name: 'Ana Pérez', sub: 'sub-ana', currentUserId: 'sub-yo' })).toBe(
      'Ana Pérez'
    );
  });
  it('"—" sin nombre', () => {
    expect(editorLabel({ name: null, sub: 'sub-bot', currentUserId: 'sub-yo' })).toBe('—');
    expect(editorLabel({ sub: 'sub-bot', currentUserId: null })).toBe('—');
  });
});
