import { describe, expect, it } from 'vitest';
import { getTypeLabel } from './requirementHelpers';

describe('getTypeLabel', () => {
  it('devuelve el label correspondiente para un tipo válido', () => {
    expect(getTypeLabel('funcionalidad')).toBe('Funcionalidad');
    expect(getTypeLabel('mejora')).toBe('Mejora');
    expect(getTypeLabel('incidencia')).toBe('Incidencia');
    expect(getTypeLabel('otro')).toBe('Otro');
  });

  it('devuelve "Sin tipo" cuando el tipo es null', () => {
    expect(getTypeLabel(null)).toBe('Sin tipo');
  });

  it('devuelve "Sin tipo" cuando el tipo es undefined', () => {
    expect(getTypeLabel(undefined)).toBe('Sin tipo');
  });

  it('devuelve "Sin tipo" cuando el tipo es un string vacío', () => {
    expect(getTypeLabel('' as never)).toBe('Sin tipo');
  });
});
