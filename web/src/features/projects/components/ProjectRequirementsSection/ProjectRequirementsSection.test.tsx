import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useRequirements } from '@/features/requirements/hooks/useRequirements';
import { ProjectRequirementsSection } from './ProjectRequirementsSection';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/features/requirements/hooks/useRequirements', () => ({
  useRequirements: vi.fn(),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return Wrapper;
};

const makeReq = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  title: 'Requisito de prueba',
  type: 'funcionalidad',
  priority: 'media',
  state: 'analisis',
  createdAt: '2026-01-15T00:00:00.000Z',
  responsiblePeople: [],
  ...overrides,
});

describe('ProjectRequirementsSection — tabs y tabla', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza 6 tabs (sin "Todos")', () => {
    vi.mocked(useRequirements).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useRequirements>);

    render(<ProjectRequirementsSection projectId={1} />, { wrapper: createWrapper() });

    const tabs = screen.getAllByRole('button', {
      name: /análisis|planificación|desarrollo|revisión|resuelto|cancelado/i,
    });
    expect(tabs).toHaveLength(6);
    expect(screen.queryByRole('button', { name: /^todos$/i })).toBeNull();
  });

  it('renderiza los labels correctos de cada tab', () => {
    vi.mocked(useRequirements).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useRequirements>);

    render(<ProjectRequirementsSection projectId={1} />, { wrapper: createWrapper() });

    expect(screen.getByRole('button', { name: /análisis/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /planificación/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /desarrollo/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /revisión/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /resuelto/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancelado/i })).toBeInTheDocument();
  });

  it('renderiza 6 columnas en la tabla', () => {
    vi.mocked(useRequirements).mockReturnValue({
      data: [makeReq()],
      isLoading: false,
    } as unknown as ReturnType<typeof useRequirements>);

    render(<ProjectRequirementsSection projectId={1} />, { wrapper: createWrapper() });

    const headers = screen.getAllByRole('columnheader');
    expect(headers).toHaveLength(6);
    expect(headers[0]).toHaveTextContent('ID');
    expect(headers[1]).toHaveTextContent('Título');
    expect(headers[2]).toHaveTextContent('Responsable');
    expect(headers[3]).toHaveTextContent('Tipo');
    expect(headers[4]).toHaveTextContent('Prioridad');
    expect(headers[5]).toHaveTextContent('Creación');
  });

  it('muestra el nombre del responsable cuando existe', () => {
    vi.mocked(useRequirements).mockReturnValue({
      data: [
        makeReq({
          state: 'desarrollo',
          responsiblePeople: [{ id: 1, firstName: 'Ana', lastName: 'Pérez', isLeader: true }],
        }),
      ],
      isLoading: false,
    } as unknown as ReturnType<typeof useRequirements>);

    render(<ProjectRequirementsSection projectId={1} />, { wrapper: createWrapper() });

    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
  });

  it('muestra "Sin asignar" cuando no hay responsable asignado', () => {
    vi.mocked(useRequirements).mockReturnValue({
      data: [makeReq({ state: 'desarrollo', responsiblePeople: [] })],
      isLoading: false,
    } as unknown as ReturnType<typeof useRequirements>);

    render(<ProjectRequirementsSection projectId={1} />, { wrapper: createWrapper() });

    const cells = screen.getAllByRole('cell');
    expect(cells[2]).toHaveTextContent('Sin asignar');
  });

  it('paginación siempre visible independientemente de la cantidad de requisitos', () => {
    const reqs = Array.from({ length: 5 }, (_, i) =>
      makeReq({ id: i + 1, title: `Req ${i + 1}`, state: 'analisis' })
    );
    vi.mocked(useRequirements).mockReturnValue({
      data: reqs,
      isLoading: false,
    } as unknown as ReturnType<typeof useRequirements>);

    render(<ProjectRequirementsSection projectId={1} />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByRole('button', { name: /análisis/i }));
    expect(screen.getByRole('navigation', { name: /paginación/i })).toBeInTheDocument();
  });

  it('paginación visible con 6 o más requisitos', () => {
    const reqs = Array.from({ length: 6 }, (_, i) =>
      makeReq({ id: i + 1, title: `Req ${i + 1}`, state: 'analisis' })
    );
    vi.mocked(useRequirements).mockReturnValue({
      data: reqs,
      isLoading: false,
    } as unknown as ReturnType<typeof useRequirements>);

    render(<ProjectRequirementsSection projectId={1} />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByRole('button', { name: /análisis/i }));
    expect(screen.getByRole('navigation', { name: /paginación/i })).toBeInTheDocument();
  });

  it('click en tab filtra los requisitos mostrados', () => {
    const reqs = [
      makeReq({ id: 1, title: 'En análisis', state: 'analisis' }),
      makeReq({ id: 2, title: 'Programado', state: 'programado' }),
    ];
    vi.mocked(useRequirements).mockReturnValue({
      data: reqs,
      isLoading: false,
    } as unknown as ReturnType<typeof useRequirements>);

    render(<ProjectRequirementsSection projectId={1} />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByRole('button', { name: /análisis/i }));
    expect(screen.getByText('En análisis')).toBeInTheDocument();
    expect(screen.queryByText('Programado')).toBeNull();
  });

  it('click en página 2 muestra la segunda página', () => {
    const reqs = Array.from({ length: 8 }, (_, i) =>
      makeReq({ id: i + 1, title: `Req ${i + 1}`, state: 'analisis' })
    );
    vi.mocked(useRequirements).mockReturnValue({
      data: reqs,
      isLoading: false,
    } as unknown as ReturnType<typeof useRequirements>);

    render(<ProjectRequirementsSection projectId={1} />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByRole('button', { name: /análisis/i }));
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    expect(screen.getByText('Req 6')).toBeInTheDocument();
    expect(screen.queryByText('Req 1')).toBeNull();
  });
});
