import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ViewHeader } from './ViewHeader';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe('ViewHeader', () => {
  it('TS-40: renderiza el título como <h1>', () => {
    render(<ViewHeader title="Proyectos" />);

    expect(screen.getByRole('heading', { level: 1, name: 'Proyectos' })).toBeInTheDocument();
  });

  it('TS-41: variant breadcrumb es un nav aria-label="Ruta" con lista', () => {
    render(
      <ViewHeader variant="breadcrumb" title="crear" parent={{ label: 'Tareas', href: '/objectives' }} />
    );

    const nav = screen.getByRole('navigation', { name: 'Ruta' });
    expect(nav).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Tareas' });
    expect(link).toHaveAttribute('href', '/objectives');
  });

  it('TS-42: el nivel actual del breadcrumb lleva aria-current="page"', () => {
    render(
      <ViewHeader variant="breadcrumb" title="crear" parent={{ label: 'Tareas', href: '/objectives' }} />
    );

    const nav = screen.getByRole('navigation', { name: 'Ruta' });
    const current = within(nav).getByText('crear');
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Tareas' })).not.toHaveAttribute('aria-current');
  });

  it('TS-43: renderiza una sola acción principal', () => {
    const onClick = vi.fn();
    render(<ViewHeader title="Proyectos" action={{ children: 'Nuevo proyecto', onClick }} />);

    expect(screen.getByRole('button', { name: 'Nuevo proyecto' })).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('TS-44: la acción principal dispara su callback', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<ViewHeader title="Proyectos" action={{ children: 'Nuevo proyecto', onClick }} />);

    await user.click(screen.getByRole('button', { name: 'Nuevo proyecto' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('TS-45: variant detail renderiza los badges que recibe', () => {
    render(
      <ViewHeader
        variant="detail"
        title="#151"
        badges={[{ variant: 'state', family: 'in-progress', label: 'Desarrollo' }]}
      />
    );

    expect(screen.getByText('#151')).toBeInTheDocument();
    expect(screen.getByText('Desarrollo')).toBeInTheDocument();
  });

  it('TS-46: sin parent no dibuja breadcrumb', () => {
    render(<ViewHeader title="Proyectos" />);

    expect(screen.queryByRole('navigation', { name: 'Ruta' })).not.toBeInTheDocument();
  });
});
