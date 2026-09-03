import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Card } from './Card';

describe('Card', () => {
  it('panel (default) renderiza título y children (TS-49)', () => {
    render(
      <Card title="Información general">
        <p>Cliente: EXO</p>
      </Card>,
    );

    expect(screen.getByRole('heading', { name: 'Información general' })).toBeInTheDocument();
    expect(screen.getByText('Cliente: EXO')).toBeInTheDocument();
  });

  it('navegable expone un solo destino accesible (TS-50)', () => {
    render(<Card variant="project" title="EXO · WashMach" href="/projects/1" />);

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', '/projects/1');
    expect(screen.getByRole('link', { name: 'EXO · WashMach' })).toBeInTheDocument();
  });

  it('task-overdue comunica el vencimiento con texto, no sólo con color (TS-51)', () => {
    const { container } = render(
      <Card
        variant="task-overdue"
        title="Migrar el formulario"
        metrics={[{ label: 'Cierre', value: 'vencido hace 1 día', overdue: true }]}
      />,
    );

    expect(screen.getByText('vencido hace 1 día')).toBeInTheDocument();
    const metric = container.querySelector('[class*="metricOverdue"]');
    expect(metric).not.toBeNull();
  });

  it('task (no vencida) no tiñe el pie (TS-52)', () => {
    const { container } = render(
      <Card variant="task" title="Ajustar el endpoint" metrics={[{ label: 'Cierre', value: '3 d' }]} />,
    );

    const metric = container.querySelector('[class*="metricOverdue"]');
    expect(metric).toBeNull();
  });

  it('metric renderiza cifra y unidad (TS-53)', () => {
    render(<Card variant="metric" metrics={[{ label: 'total horas', value: '2h' }]} />);

    expect(screen.getByText('2h')).toBeInTheDocument();
    expect(screen.getByText('total horas')).toBeInTheDocument();
  });

  it('renderiza el estado como badge en la cabecera (TS-54)', () => {
    render(<Card variant="project" title="EXO" status={{ family: 'in-progress', label: 'Activo' }} />);

    expect(screen.getByText('Activo')).toBeInTheDocument();
  });
});
