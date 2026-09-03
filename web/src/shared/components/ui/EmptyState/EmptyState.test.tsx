import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EmptyState } from './EmptyState';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

describe('EmptyState', () => {
  it('renderiza el mensaje como texto real, sin imágenes (TS-1)', () => {
    const { container } = render(<EmptyState message="No hay etapas activas" />);

    expect(screen.getByText('No hay etapas activas')).toBeInTheDocument();
    expect(container.querySelectorAll('img')).toHaveLength(0);
  });

  it('la variant por defecto es list (TS-2)', () => {
    const { container } = render(<EmptyState message="No hay etapas activas" />);
    const root = container.firstElementChild as HTMLElement;

    expect(root.className).toMatch(/_list_/);
    expect(root.className).not.toMatch(/_filtered_/);
    expect(root.className).not.toMatch(/_scoped_/);
  });

  it('en variant list con action renderiza el botón y lo dispara al hacer click (TS-3)', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <EmptyState
        variant="list"
        message="No hay etapas activas"
        action={{ children: 'Nueva etapa', onClick }}
      />
    );

    const button = screen.getByRole('button', { name: 'Nueva etapa' });
    await user.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('en variant filtered no renderiza la acción aunque se la pasen (TS-4)', () => {
    render(
      <EmptyState
        variant="filtered"
        message="No se encontraron requisitos"
        action={{ children: 'Nuevo requisito', onClick: vi.fn() }}
      />
    );

    expect(screen.queryByRole('button', { name: 'Nuevo requisito' })).toBeNull();
  });

  it('en variant scoped no renderiza la acción (TS-5)', () => {
    render(
      <EmptyState
        variant="scoped"
        message="No hay cargas para este día"
        action={{ children: 'Cargar', onClick: vi.fn() }}
      />
    );

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('en variant filtered se anuncia en una live region educada (TS-6)', () => {
    const { container } = render(
      <EmptyState variant="filtered" message="No se encontraron requisitos" />
    );

    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull();
  });

  it('nunca usa role="alert" en ninguna variant (TS-7)', () => {
    const { rerender } = render(
      <EmptyState variant="list" message="No hay etapas activas" />
    );
    expect(screen.queryByRole('alert')).toBeNull();

    rerender(<EmptyState variant="filtered" message="No se encontraron requisitos" />);
    expect(screen.queryByRole('alert')).toBeNull();

    rerender(<EmptyState variant="scoped" message="No hay cargas para este día" />);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
