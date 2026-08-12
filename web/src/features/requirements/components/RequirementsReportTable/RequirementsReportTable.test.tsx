import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { RequirementsReportTable } from './RequirementsReportTable';
import type { RequirementReportItem } from '../../types/requirement.types';

const baseItem: RequirementReportItem = {
  id: 12,
  title: 'Error al iniciar sesión',
  type: 'incidencia',
  state: 'resuelto',
  createdBy: 'ivan@grava.io',
  createdAt: '2026-06-01T00:00:00Z',
  inProgressAt: '2026-06-02T00:00:00Z',
  finishedAt: '2026-06-05T00:00:00Z',
  totalMinutes: 90,
  resolutionType: 'error_interno',
  resolutionConclusion: 'El equipo confirmó el bug en el endpoint',
  resolutionComment: 'El cliente confirmó el error',
  project: { id: 1, name: 'Proyecto Alpha' },
};

describe('RequirementsReportTable', () => {
  it('TS-1: renderiza una fila con todas las columnas esperadas', () => {
    render(<RequirementsReportTable items={[baseItem]} />);

    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Error al iniciar sesión')).toBeInTheDocument();
    expect(screen.getByText('Proyecto Alpha')).toBeInTheDocument();
    expect(screen.getByText('ivan@grava.io')).toBeInTheDocument();
    expect(screen.getByText('El cliente confirmó el error')).toBeInTheDocument();
  });

  it('TS-5: muestra mensaje de estado vacío cuando no hay items', () => {
    render(<RequirementsReportTable items={[]} />);

    expect(
      screen.getByText('No se encontraron requisitos con los filtros aplicados')
    ).toBeInTheDocument();
  });

  it('TS-7: formatea totalMinutes=90 como "1h 30m"', () => {
    render(<RequirementsReportTable items={[baseItem]} />);

    expect(screen.getByText('1h 30m')).toBeInTheDocument();
  });

  it('TS-8: formatea totalMinutes=0 como "0h 0m"', () => {
    render(<RequirementsReportTable items={[{ ...baseItem, totalMinutes: 0 }]} />);

    expect(screen.getByText('0h 0m')).toBeInTheDocument();
  });

  it('TS-9: muestra label humanizado para resolutionType', () => {
    render(<RequirementsReportTable items={[baseItem]} />);

    expect(screen.getByText('Error interno')).toBeInTheDocument();
    expect(screen.queryByText('error_interno')).not.toBeInTheDocument();
  });

  it('TS-17: muestra resolutionConclusion como texto libre, sin mapeo', () => {
    render(<RequirementsReportTable items={[baseItem]} />);

    expect(screen.getByText('El equipo confirmó el bug en el endpoint')).toBeInTheDocument();
  });

  it('TS-10: muestra placeholder cuando resolutionType es null', () => {
    render(<RequirementsReportTable items={[{ ...baseItem, resolutionType: null }]} />);

    const row = screen.getByText('Error al iniciar sesión').closest('tr');
    expect(row).toHaveTextContent('-');
  });

  it('muestra placeholder cuando resolutionConclusion es null', () => {
    render(<RequirementsReportTable items={[{ ...baseItem, resolutionConclusion: null }]} />);

    const row = screen.getByText('Error al iniciar sesión').closest('tr');
    expect(row).toHaveTextContent('-');
  });

  it('TS-11: muestra placeholder cuando resolutionComment es null', () => {
    render(<RequirementsReportTable items={[{ ...baseItem, resolutionComment: null }]} />);

    const row = screen.getByText('Error al iniciar sesión').closest('tr');
    expect(row).toHaveTextContent('-');
  });

  it('TS-12: fechas nullable no rompen el render y muestran placeholder', () => {
    render(
      <RequirementsReportTable items={[{ ...baseItem, inProgressAt: null, finishedAt: null }]} />
    );

    const row = screen.getByText('Error al iniciar sesión').closest('tr') as HTMLElement;
    expect(row).toBeInTheDocument();
    expect(row).toHaveTextContent('-');
  });

  it('muestra placeholder cuando project es null', () => {
    render(<RequirementsReportTable items={[{ ...baseItem, project: null }]} />);

    const row = screen.getByText('Error al iniciar sesión').closest('tr') as HTMLElement;
    expect(row).toHaveTextContent('-');
  });
});
