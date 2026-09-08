import 'should';
import { diffResponsibles } from '../../src/events/domain/responsibles-diff';

/**
 * `diffResponsibles()` — TS-1 a TS-9 del Story Plan de S-066. Tests puros, sin base de datos: el
 * helper es aritmética de listas de enteros.
 */
describe('events/domain/responsibles-diff', () => {
  it('TS-1 · se agrega un responsable', () => {
    diffResponsibles([7, 3], [7, 3, 9]).should.deepEqual({
      from: [7, 3],
      to: [7, 3, 9],
      added: [9],
      removed: [],
      leaderId: 7,
      changed: true,
    });
  });

  it('TS-2 · se quitan responsables', () => {
    diffResponsibles([7, 3, 9], [7]).should.deepEqual({
      from: [7, 3, 9],
      to: [7],
      added: [],
      removed: [3, 9],
      leaderId: 7,
      changed: true,
    });
  });

  it('TS-3 · reemplazo total del conjunto', () => {
    diffResponsibles([7, 3], [5]).should.deepEqual({
      from: [7, 3],
      to: [5],
      added: [5],
      removed: [3, 7],
      leaderId: 5,
      changed: true,
    });
  });

  it('TS-4 · se vacía la lista', () => {
    diffResponsibles([7, 3], []).should.deepEqual({
      from: [7, 3],
      to: [],
      added: [],
      removed: [3, 7],
      leaderId: null,
      changed: true,
    });
  });

  it('TS-5 · se asigna desde una lista vacía', () => {
    diffResponsibles([], [4]).should.deepEqual({
      from: [],
      to: [4],
      added: [4],
      removed: [],
      leaderId: 4,
      changed: true,
    });
  });

  it('TS-6 · cambia el líder sin cambiar el conjunto (CA-5)', () => {
    diffResponsibles([7, 3], [3, 7]).should.deepEqual({
      from: [7, 3],
      to: [3, 7],
      added: [],
      removed: [],
      leaderId: 3,
      changed: true,
    });
  });

  it('TS-7 · nada cambió: misma lista, mismo orden', () => {
    diffResponsibles([7, 3], [7, 3]).should.deepEqual({
      from: [7, 3],
      to: [7, 3],
      added: [],
      removed: [],
      leaderId: 7,
      changed: false,
    });
  });

  it('TS-8 · la trampa de D-5: mismo conjunto, mismo líder, distinto orden de los NO líderes', () => {
    // El orden de los no líderes que devuelve el lector es `personId` asc y NO es información del
    // usuario (D-5) — un `changed` que comparara las listas completas reportaría un falso
    // positivo acá.
    diffResponsibles([7, 3, 9], [7, 9, 3]).should.deepEqual({
      from: [7, 3, 9],
      to: [7, 9, 3],
      added: [],
      removed: [],
      leaderId: 7,
      changed: false,
    });
  });

  it('TS-9 · ids duplicados en el payload', () => {
    diffResponsibles([3], [7, 7, 3]).should.deepEqual({
      from: [3],
      to: [7, 7, 3],
      added: [7],
      removed: [],
      leaderId: 7,
      changed: true,
    });
  });
});
