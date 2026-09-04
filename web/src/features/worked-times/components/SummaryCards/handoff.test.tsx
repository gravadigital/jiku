import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { SummaryCards } from './SummaryCards';

// El handoff (pantalla 7) pide que de las cuatro cards de métrica la PRIMERA vaya sobre azul
// oscuro con la cifra en verde agua, y las otras tres en superficie normal. En el código las
// cuatro eran idénticas.
const CARD_MODULE = fs.readFileSync(
  path.resolve(__dirname, '../../../../shared/components/ui/Card/Card.module.scss'),
  'utf8'
);

const DATA_BY_PERSON = [
  {
    personId: 1,
    personName: 'Agustín Nava',
    totalMinutes: 4050,
    projects: [{ projectId: 1, projectName: 'EXO', projectCode: 'EXO', totalMinutes: 4050 }],
  },
  {
    personId: 2,
    personName: 'Lucía Ríos',
    totalMinutes: 1800,
    projects: [{ projectId: 2, projectName: 'Bill', projectCode: 'BIL', totalMinutes: 1800 }],
  },
];

describe('SummaryCards — la primera métrica va destacada', () => {
  it('las cuatro métricas se siguen mostrando (el contenido no cambia)', () => {
    render(<SummaryCards dataByPerson={DATA_BY_PERSON as never} activeView="by-person" />);
    for (const label of [/total horas/i, /personas/i, /proyectos/i, /promedio/i]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('sólo la primera card recibe el destaque', () => {
    const source = fs.readFileSync(path.resolve(__dirname, './SummaryCards.tsx'), 'utf8');
    // Una sola aparición de la prop, en la primera card.
    expect(source.match(/emphasis/g)?.length).toBe(1);
  });
});

describe('Card — variante destacada de métrica', () => {
  it('la card destacada se apoya en el fondo inverso y pierde el borde', () => {
    expect(CARD_MODULE).toMatch(
      /\.metricEmphasis\s*\{[^}]*background-color:\s*var\(--card-metric-emphasis-bg\)/s
    );
  });

  it('la cifra destacada va en verde agua', () => {
    expect(CARD_MODULE).toMatch(
      /\.metricEmphasis\s+\.metricValue\s*\{[^}]*color:\s*var\(--card-metric-emphasis-value\)/s
    );
  });

  it('el label de la card destacada usa el gris de modo oscuro, no el secundario claro', () => {
    expect(CARD_MODULE).toMatch(
      /\.metricEmphasis\s+\.metricLabel\s*\{[^}]*color:\s*var\(--card-metric-emphasis-label\)/s
    );
  });
});
