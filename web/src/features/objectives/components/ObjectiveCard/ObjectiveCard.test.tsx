import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ObjectiveCard } from './ObjectiveCard';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('next/image', () => ({
  default: ({ alt, title }: { alt: string; title?: string }) => <img alt={alt} title={title} />,
}));

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

const baseProps = {
  area: 'desarrollo',
  createdAt: new Date('2026-01-01'),
  description: null,
  estimatedFinishDate: null,
  finishedAt: null,
  id: 1,
  persons: [{ id: 1, userId: 'user-1', firstName: 'Ana', lastName: 'Pérez' }],
  portalContainer: null,
  priority: 0,
  project: { id: 1, name: 'Proyecto Alpha' },
  projectId: 1,
  showProject: false,
  state: 'activo',
  title: 'Tarea de prueba',
  updatedAt: new Date('2026-01-01'),
  workedMinutes: 0,
  workedTime: [],
  visibilityLevel: 'internal',
} as any;

describe('ObjectiveCard', () => {
  it('TS-14 (S-067): tooltip "Soy parte de esta tarea" cuando el usuario actual está entre persons', () => {
    render(<ObjectiveCard {...baseProps} user={{ id: 'user-1', name: 'Ana Pérez' }} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByTitle('Soy parte de esta tarea')).toBeInTheDocument();
  });

  it('S-056 TS-18: usa Card con un único destino accesible a /objectives/{id}', () => {
    render(<ObjectiveCard {...baseProps} />, { wrapper: createWrapper() });

    const link = screen.getByRole('link', { name: /Tarea de prueba/ });
    expect(link).toHaveAttribute('href', '/objectives/1');
  });

  it('S-056 TS-18: la tarea vencida usa Card variant task-overdue (pie en tono urgente)', () => {
    const { container } = render(
      <ObjectiveCard
        {...baseProps}
        estimatedFinishDate={new Date('2020-01-01')}
        state="backlog"
      />,
      { wrapper: createWrapper() }
    );

    expect(container.querySelector('[class*="taskOverdue"]')).not.toBeNull();
  });

  it('S-056 TS-18: una tarea no vencida no aplica el tinte de vencido', () => {
    const { container } = render(
      <ObjectiveCard {...baseProps} estimatedFinishDate={new Date('2099-01-01')} />,
      { wrapper: createWrapper() }
    );

    expect(container.querySelector('[class*="taskOverdue"]')).toBeNull();
  });
});
