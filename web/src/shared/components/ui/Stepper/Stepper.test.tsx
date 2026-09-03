import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Stepper } from './Stepper';

const CINCO_PASOS = [
  { key: 'analisis', label: 'Análisis' },
  { key: 'planificacion', label: 'Planificación' },
  { key: 'en_cola', label: 'En cola' },
  { key: 'desarrollo', label: 'Desarrollo' },
  { key: 'revision', label: 'Revisión' },
];

describe('Stepper — estructura y estado', () => {
  it('TS-14: es una lista ordenada con un ítem por paso', () => {
    render(<Stepper steps={CINCO_PASOS} currentKey="en_cola" />);

    const list = screen.getByRole('list');
    expect(list.tagName).toBe('OL');
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
  });

  it('TS-15: marca la etapa actual con aria-current="step"', () => {
    render(<Stepper steps={CINCO_PASOS} currentKey="en_cola" />);

    const current = screen.getAllByRole('listitem').filter(
      (li) => li.getAttribute('aria-current') === 'step'
    );
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent('En cola');
  });

  it('TS-16: anuncia el estado de cada nodo en texto, no sólo con el ✓', () => {
    render(<Stepper steps={CINCO_PASOS} currentKey="en_cola" />);

    expect(screen.getByText('Análisis, completada')).toBeInTheDocument();
    expect(screen.getByText('En cola, etapa actual')).toBeInTheDocument();
    expect(screen.getByText('Revisión, pendiente')).toBeInTheDocument();
  });

  it('TS-17: informativo no es focusable', async () => {
    const user = userEvent.setup();
    render(<Stepper steps={CINCO_PASOS} currentKey="desarrollo" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    const list = screen.getByRole('list');
    await user.tab();
    expect(list.contains(document.activeElement)).toBe(false);
  });

  it('TS-18: interactivo expone botones y avisa el paso elegido', async () => {
    const onStepChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Stepper
        steps={CINCO_PASOS}
        currentKey="analisis"
        interactive
        onStepChange={onStepChange}
      />
    );

    await user.click(screen.getByRole('button', { name: /Desarrollo/ }));

    expect(onStepChange).toHaveBeenCalledWith('desarrollo');
  });

  it('TS-19: muestra los cinco pasos, incluido En cola, sin recortar por tipo', () => {
    render(<Stepper steps={CINCO_PASOS} currentKey="planificacion" />);

    CINCO_PASOS.forEach((step) => {
      expect(screen.getByText(step.label)).toBeInTheDocument();
    });
  });

  it('TS-20: no dibuja Resuelto ni Cancelado como nodos', () => {
    render(<Stepper steps={CINCO_PASOS} currentKey="planificacion" />);

    expect(screen.queryByText('Resuelto')).not.toBeInTheDocument();
    expect(screen.queryByText('Cancelado')).not.toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
  });

  it('TS-21: distingue recorrido / actual / pendiente por forma, no sólo por color', () => {
    render(<Stepper steps={CINCO_PASOS} currentKey="en_cola" />);

    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('✓');
    expect(items[1]).toHaveTextContent('✓');
    // El actual (en_cola) no muestra número ni ✓ visible como contenido de dígito.
    expect(items[2]).not.toHaveTextContent('✓');
    expect(items[3]).toHaveTextContent('4');
    expect(items[4]).toHaveTextContent('5');
  });

  it('TS-22: acepta marcar un paso superado sin actividad real (preservación de S-050)', () => {
    render(
      <Stepper
        steps={CINCO_PASOS}
        currentKey="cancelado"
        doneKeys={['analisis', 'planificacion', 'en_cola', 'desarrollo', 'revision']}
        skippedKeys={['en_cola']}
      />
    );

    const items = screen.getAllByRole('listitem');
    const enColaItem = items[2];
    expect(enColaItem).toHaveTextContent('×');
    expect(enColaItem).not.toHaveTextContent('completada');
  });

  it('TS-23: no ofrece control de cambio de estado por defecto', () => {
    render(<Stepper steps={CINCO_PASOS} currentKey="revision" />);

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
  });
});
