import { describe, expect, it } from 'vitest';
import { chooseClient, chooseProject, projectClientId, setPrincipal } from './relationFields';

const clientOf = (id: number) => (id === 12 ? 4 : null);

describe('relationFields (TS-10)', () => {
  it('setPrincipal', () => {
    expect(setPrincipal([12, 31], 40)).toEqual([40, 31]);
    expect(setPrincipal([12, 31], 31)).toEqual([31]);
    expect(setPrincipal([12, 31], null)).toEqual([31]);
    expect(setPrincipal([], 12)).toEqual([12]);
  });

  it('chooseProject completa el cliente', () => {
    expect(chooseProject({ clients: [2], projects: [] }, { id: 12, clientId: 4 })).toEqual({
      clients: [4],
      projects: [12],
    });
  });

  it('chooseClient', () => {
    const value = { clients: [4], projects: [12] };
    expect(chooseClient(value, 2, clientOf)).toEqual({ clients: [2], projects: [] });
    expect(chooseClient(value, 4, clientOf)).toEqual({ clients: [4], projects: [12] });
    expect(chooseClient({ clients: [4], projects: [12, 31] }, null, clientOf)).toEqual({
      clients: [],
      projects: [31],
    });
  });
});

describe('projectClientId (TS-1 a TS-4)', () => {
  it('TS-1: client presente', () => {
    expect(projectClientId({ clientId: 1, client: { id: 1 } })).toBe(1);
  });
  it('TS-2: respaldo en clientId', () => {
    expect(projectClientId({ clientId: 1 })).toBe(1);
  });
  it('TS-3: sin cliente', () => {
    expect(projectClientId({ clientId: null, client: null })).toBeNull();
    expect(projectClientId({})).toBeNull();
  });
  it('TS-4: client gana sobre clientId', () => {
    expect(projectClientId({ clientId: 2, client: { id: 1 } })).toBe(1);
  });
});
