import { describe, it, expect } from 'vitest';
import { personName } from './persons';

const persons = [{ userId: 'sub-ana', firstName: 'Ana', lastName: 'Gómez' }];

describe('personName', () => {
  it('resuelve el nombre', () => expect(personName(persons, 'sub-ana')).toBe('Ana Gómez'));
  it('sin coincidencia o sin personas', () => {
    expect(personName(persons, 'x')).toBe('otra persona');
    expect(personName(undefined, 'sub-ana')).toBe('otra persona');
  });
});
