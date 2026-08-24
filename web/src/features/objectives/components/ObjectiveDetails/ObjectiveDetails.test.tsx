import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as useRequirementModule from '@/features/requirements/hooks/useRequirement';
import { ObjectiveDetails } from './ObjectiveDetails';
import type { Objective } from '@/shared/types';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/features/requirements/hooks/useRequirement', () => ({
  useRequirement: vi.fn(),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

const baseObjective: Objective = {
  id: 12,
  area: 'desarrollo',
  title: 'Objetivo de prueba',
  description: 'Descripción',
  estimatedFinishDate: null,
  finishedAt: null,
  state: 'activo',
  priority: 1,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-02'),
  projectId: 5,
  project: { id: 5, name: 'Proyecto X' } as any,
  persons: [],
  creator: { id: 'u1', name: 'Ana Pérez', email: 'ana@grava.io' } as any,
  workedMinutes: 0,
  visibilityLevel: 'public',
  requirementId: null,
};

describe('ObjectiveDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TS-2: sin requirementId no muestra ninguna fila "Requisito"', () => {
    vi.mocked(useRequirementModule.useRequirement).mockReturnValue({
      data: undefined,
      isError: false,
      isLoading: false,
    } as any);

    render(<ObjectiveDetails objective={baseObjective} />, { wrapper: createWrapper() });

    expect(screen.queryByText('Requisito')).not.toBeInTheDocument();
  });

  it('TS-1: con requirementId muestra el título del requisito como link', async () => {
    vi.mocked(useRequirementModule.useRequirement).mockReturnValue({
      data: { id: 42, title: 'REQ-12 Bug login' },
      isError: false,
      isLoading: false,
    } as any);

    render(<ObjectiveDetails objective={{ ...baseObjective, requirementId: 42 }} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      const link = screen.getByRole('link', { name: 'REQ-12 Bug login' });
      expect(link).toHaveAttribute('href', '/requirements/42');
    });
  });

  it('TS-3: si useRequirement falla, muestra "Requisito no disponible"', async () => {
    vi.mocked(useRequirementModule.useRequirement).mockReturnValue({
      data: undefined,
      isError: true,
      isLoading: false,
    } as any);

    render(<ObjectiveDetails objective={{ ...baseObjective, requirementId: 99 }} />, {
      wrapper: createWrapper(),
    });

    expect(await screen.findByText(/Requisito no disponible/)).toBeInTheDocument();
  });

  it('no renderiza ninguna fila "Url Externa"', () => {
    vi.mocked(useRequirementModule.useRequirement).mockReturnValue({
      data: undefined,
      isError: false,
      isLoading: false,
    } as any);

    render(<ObjectiveDetails objective={baseObjective} />, { wrapper: createWrapper() });

    expect(screen.queryByText('Url Externa')).not.toBeInTheDocument();
    expect(
      screen.queryAllByRole('link').filter((link) => link.getAttribute('target') === '_blank')
    ).toEqual([]);
  });

  it('la columna izquierda conserva sus seis filas de metadato', () => {
    vi.mocked(useRequirementModule.useRequirement).mockReturnValue({
      data: { id: 42, title: 'REQ-12 Bug login' },
      isError: false,
      isLoading: false,
    } as any);

    render(<ObjectiveDetails objective={{ ...baseObjective, requirementId: 42 }} />, {
      wrapper: createWrapper(),
    });

    // Se asierta el ORDEN en el DOM, no solo la presencia: el REQ descartó rebalancear la
    // grilla, así que reordenar filas entre columnas también sería una regresión.
    const columnaIzquierda = screen.getByText('Estado').closest('p')?.parentElement;
    const etiquetas = Array.from(columnaIzquierda?.children ?? []).map(
      (fila) => fila.firstElementChild?.textContent
    );
    expect(etiquetas).toEqual([
      'Estado',
      'Proyecto',
      'Área',
      'Visibilidad',
      'Creado por',
      'Requisito',
    ]);

    const filaProyecto = screen.getByText('Proyecto').closest('p');
    const filaArea = screen.getByText('Área').closest('p');
    expect(filaProyecto?.nextElementSibling).toBe(filaArea);
  });

  it('no renderiza la fila "Url Externa" ni aunque el backend mande los campos', () => {
    vi.mocked(useRequirementModule.useRequirement).mockReturnValue({
      data: undefined,
      isError: false,
      isLoading: false,
    } as any);

    // El objeto simula un backend que todavía manda los campos de la integración dada de
    // baja (REQ-003). Los campos ya no existen en `Objective`, de ahí el cast: el test
    // prueba que la rama de render fue ELIMINADA, no solo no satisfecha.
    const objetivoConCamposExternos = {
      ...baseObjective,
      externalProjectId: 7,
      externalIssueId: '10042',
      externalIssueKey: 'ABC-1',
      externalUrl: 'https://jira.example/browse/ABC-1',
    } as unknown as Objective;

    render(<ObjectiveDetails objective={objetivoConCamposExternos} />, {
      wrapper: createWrapper(),
    });

    expect(screen.queryByText('Url Externa')).not.toBeInTheDocument();
    expect(screen.queryByText('https://jira.example/browse/ABC-1')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'https://jira.example/browse/ABC-1' })
    ).not.toBeInTheDocument();
  });

  describe('Marca de identidad automática (S-019)', () => {
    beforeEach(() => {
      vi.mocked(useRequirementModule.useRequirement).mockReturnValue({
        data: undefined,
        isError: false,
        isLoading: false,
      } as any);
    });

    it('TS-16: la fila "Creado por" muestra el nombre y la marca cuando el creador es una identidad de servicio', () => {
      render(
        <ObjectiveDetails
          objective={{
            ...baseObjective,
            creator: {
              id: 'u-svc',
              name: 'Conector Portal',
              email: 'conector@grava.io',
              identityType: 'service',
            },
          }}
        />,
        { wrapper: createWrapper() }
      );

      const row = screen.getByText('Creado por').closest('p');
      expect(row).toHaveTextContent('Conector Portal');
      expect(row).toHaveTextContent('Automático');
    });

    it('TS-17: la fila "Creado por" de una persona no muestra la marca', () => {
      render(
        <ObjectiveDetails
          objective={{
            ...baseObjective,
            creator: {
              id: 'u1',
              name: 'Ana Pérez',
              email: 'ana@grava.io',
              identityType: 'person',
            },
          }}
        />,
        { wrapper: createWrapper() }
      );

      const row = screen.getByText('Creado por').closest('p');
      expect(row).toHaveTextContent('Ana Pérez');
      expect(screen.queryByText('Automático')).not.toBeInTheDocument();
    });

    it('no muestra la marca cuando el creador llega sin identityType (api vieja)', () => {
      render(<ObjectiveDetails objective={baseObjective} />, { wrapper: createWrapper() });

      expect(screen.queryByText('Automático')).not.toBeInTheDocument();
    });

    it('no envuelve el nombre del creador en un span: la regla `p > span` de esta pantalla lo pondria en negrita', () => {
      render(
        <ObjectiveDetails
          objective={{
            ...baseObjective,
            creator: {
              id: 'u-svc',
              name: 'Conector Portal',
              email: 'conector@grava.io',
              identityType: 'service',
            },
          }}
        />,
        { wrapper: createWrapper() }
      );

      const row = screen.getByText('Creado por').closest('p');
      const textosDeSpans = Array.from(row?.querySelectorAll('span') ?? []).map(
        (span) => span.textContent
      );

      // El span de la etiqueta y el del badge, sí. El del valor, no: iria en negrita y
      // quedaria distinto de las filas hermanas (`Área`, `Visibilidad`), que son texto suelto.
      expect(textosDeSpans).toContain('Creado por');
      expect(textosDeSpans).toContain('Automático');
      expect(textosDeSpans).not.toContain('Conector Portal');
    });
  });
});
