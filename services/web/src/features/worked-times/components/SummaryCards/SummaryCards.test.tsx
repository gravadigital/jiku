import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SummaryCards } from './SummaryCards';
import type { ReportByPerson } from '../../types/worked-time.types';

const DATA_BY_PERSON: ReportByPerson[] = [
  {
    personId: 1,
    personName: 'A',
    totalMinutes: 8520,
    projects: [{ projectId: 1, projectName: 'P1', totalMinutes: 8520, objectives: [] }],
  } as unknown as ReportByPerson,
  {
    personId: 2,
    personName: 'B',
    totalMinutes: 8340,
    projects: [{ projectId: 2, projectName: 'P2', totalMinutes: 8340, objectives: [] }],
  } as unknown as ReportByPerson,
];

describe('SummaryCards', () => {
  it('TS-89: renderiza cuatro Card, cada una con text.metric para la cifra', () => {
    render(<SummaryCards dataByPerson={DATA_BY_PERSON} activeView="by-person" />);

    // 4 tarjetas: total horas, personas, proyectos, promedio
    expect(screen.getByText('Total horas')).toBeInTheDocument();
    expect(screen.getByText('Personas')).toBeInTheDocument();
    expect(screen.getByText('Proyectos')).toBeInTheDocument();
    expect(screen.getByText('Promedio / persona')).toBeInTheDocument();
  });

  it('TS-89: muestra el conteo de personas y proyectos', () => {
    render(<SummaryCards dataByPerson={DATA_BY_PERSON} activeView="by-person" />);

    // personCount = 2, projectCount = 2 (P1, P2): ambos "2" en el documento.
    expect(screen.getAllByText('2')).toHaveLength(2);
  });

  it('no renderiza nada cuando no hay datos', () => {
    const { container } = render(<SummaryCards dataByPerson={[]} activeView="by-person" />);
    expect(container).toBeEmptyDOMElement();
  });
});
