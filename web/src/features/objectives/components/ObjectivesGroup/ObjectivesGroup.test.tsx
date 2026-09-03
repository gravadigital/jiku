import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ObjectivesGroup } from './ObjectivesGroup';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/features/auth', () => ({ usePersons: () => ({ data: [] }) }));

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('ObjectivesGroup', () => {
  it('S-056 TS-6: muestra el título del grupo y el botón de nueva tarea con nombre accesible', () => {
    render(<ObjectivesGroup title="Proyecto Alpha" objectives={[]} projectId={7} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByRole('heading', { name: /Proyecto Alpha/, level: 2 })).toBeInTheDocument();
    const addButton = screen.getByRole('button', { name: 'Nueva tarea' });
    expect(addButton).toBeInTheDocument();
  });

  it('S-056 TS-6: muestra tag-horas-mes sólo cuando currentMonthHours está definido', () => {
    const { rerender } = render(
      <ObjectivesGroup title="Proyecto Alpha" objectives={[]} projectId={7} />,
      { wrapper: createWrapper() }
    );

    expect(screen.queryByText(/Trabajadas en el mes/)).not.toBeInTheDocument();

    rerender(
      <ObjectivesGroup
        title="Proyecto Alpha"
        objectives={[]}
        projectId={7}
        currentMonthHours={2}
        currentMonthMinutes={30}
      />
    );

    expect(screen.getByText('Trabajadas en el mes')).toBeInTheDocument();
    expect(screen.getByText('2 hs 30 min')).toBeInTheDocument();
  });
});
