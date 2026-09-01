import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as requirementsApi from '../../services/requirementsApi';
import { RequirementList } from './RequirementList';
import type { RequirementFilters } from '../../types/requirement.types';

const mockPush = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock('../../services/requirementsApi', () => ({
  getRequirements: vi.fn(),
}));

vi.mock('@/features/projects/services/projectsApi', () => ({
  getProjects: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/features/auth/services/personsApi', () => ({
  getPersons: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/auth', () => ({
  auth: () => Promise.resolve(null),
}));

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({ data: null })),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
}));

const mockRequirement = {
  id: 5,
  title: 'Req test',
  description: '## Descripción',
  type: 'funcionalidad' as const,
  priority: 'alta' as const,
  state: 'analisis' as const,
  visibilityLevel: 'public' as const,
  estimatedFinishDate: '2026-06-30',
  projectId: 1,
  project: { id: 1, name: 'PRJ-1' },
  responsiblePeople: [{ id: 2, firstName: 'Ana', lastName: 'Pérez', isLeader: true }],
  createdBy: 'ivan@grava.io',
  creator: { id: 'u1', name: 'Iván López', email: 'ivan@grava.io' },
  tags: [{ key: 'cliente', value: 'Grava' }],
  createdAt: '2026-06-21T00:00:00Z',
  updatedAt: '2026-06-21T00:00:00Z',
  scope: null,
  technicalSolution: null,
  acceptanceCriteria: null,
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

describe('RequirementList — S-051', () => {
  const filters: RequirementFilters = { page: 1, limit: 10 };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    vi.mocked(requirementsApi.getRequirements).mockResolvedValue([mockRequirement]);
  });

  // TS-1: 8 columnas con headers del prototipo
  it('TS-1: tabla muestra 8 columnas con headers del prototipo', async () => {
    render(<RequirementList filters={filters} />, { wrapper: createWrapper() });
    await waitFor(() => {
      const headers = document.querySelectorAll('thead th');
      const headerTexts = Array.from(headers).map((th) => th.textContent?.trim());
      expect(headerTexts).toContain('ID');
      expect(headerTexts).toContain('Proyecto');
      expect(headerTexts).toContain('Título');
      expect(headerTexts).toContain('Estado');
      expect(headerTexts).toContain('Responsable');
      expect(headerTexts).toContain('Tipo');
      expect(headerTexts).toContain('Prioridad');
      expect(headerTexts).toContain('Creación');
      expect(headers.length).toBe(8);
    });
  });

  // TS-2: Estado como texto plano sin dot
  it('TS-2: estado se muestra como texto plano sin dot ni fondo', async () => {
    render(<RequirementList filters={filters} />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getAllByText('Análisis').length).toBeGreaterThan(0);
    });
    const dots = document.querySelectorAll('[class*="stateDot"]');
    expect(dots.length).toBe(0);
  });

  // TS-3: Prioridad como texto plano sin fondo
  it('TS-3: prioridad se muestra como texto plano sin priorityPill', async () => {
    render(<RequirementList filters={filters} />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getAllByText('Alta').length).toBeGreaterThan(0);
    });
    const pills = document.querySelectorAll('[class*="priorityPill"]');
    expect(pills.length).toBe(0);
  });

  // TS-5: Creación muestra createdAt formateado
  it('TS-5: Creación muestra createdAt formateado', async () => {
    render(<RequirementList filters={filters} />, { wrapper: createWrapper() });
    await waitFor(() => {
      // createdAt: '2026-06-21T00:00:00Z' → algún formato de fecha con 2026
      const cells = document.querySelectorAll('td');
      const dateCell = Array.from(cells).find((td) => td.textContent?.includes('2026'));
      expect(dateCell).toBeTruthy();
    });
  });

  // TS-6: Responsable muestra nombre completo
  it('TS-6: Responsable muestra nombre completo', async () => {
    render(<RequirementList filters={filters} />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
    });
  });

  // Múltiples responsables: muestra "Nombre +N" con tooltip de la lista completa
  it('con más de un responsable muestra "Nombre +N" con title de la lista completa', async () => {
    vi.mocked(requirementsApi.getRequirements).mockResolvedValue([
      {
        ...mockRequirement,
        responsiblePeople: [
          { id: 2, firstName: 'Ana', lastName: 'Pérez', isLeader: true },
          { id: 3, firstName: 'Juan', lastName: 'Gómez', isLeader: false },
        ],
      },
    ]);
    render(<RequirementList filters={filters} />, { wrapper: createWrapper() });
    await waitFor(() => {
      const label = screen.getByText('Ana Pérez +1');
      expect(label).toBeInTheDocument();
      expect(label).toHaveAttribute('title', 'Ana Pérez, Juan Gómez');
    });
  });

  // TS-7: Proyecto muestra project.name en primera columna
  it('TS-7: primera columna muestra project.name', async () => {
    render(<RequirementList filters={filters} />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('PRJ-1')).toBeInTheDocument();
    });
  });

  // TS-8: responsiblePeople vacío → "Sin asignar"
  it('TS-8: responsiblePeople vacío muestra "Sin asignar"', async () => {
    vi.mocked(requirementsApi.getRequirements).mockResolvedValue([
      { ...mockRequirement, responsiblePeople: [] },
    ]);
    render(<RequirementList filters={filters} />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Sin asignar')).toBeInTheDocument();
    });
  });

  // TS-9: project null → "—"
  it('TS-9: project null muestra "—"', async () => {
    vi.mocked(requirementsApi.getRequirements).mockResolvedValue([
      { ...mockRequirement, project: null },
    ]);
    render(<RequirementList filters={filters} />, { wrapper: createWrapper() });
    await waitFor(() => {
      const dashes = screen.getAllByText('—');
      expect(dashes.length).toBeGreaterThan(0);
    });
  });

  // TS-11: sin requisitos → mensaje vacío con colSpan 8
  it('TS-11: sin requisitos muestra mensaje vacío', async () => {
    vi.mocked(requirementsApi.getRequirements).mockResolvedValue([]);
    render(<RequirementList filters={filters} />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('No se encontraron requisitos')).toBeInTheDocument();
    });
    const td = screen.getByText('No se encontraron requisitos').closest('td');
    expect(td?.getAttribute('colSpan') ?? td?.getAttribute('colspan')).toBe('8');
  });

  // TS-12: paginación — botón activo tiene data-active
  it('TS-12: botón de página activa tiene data-active', async () => {
    render(<RequirementList filters={filters} />, { wrapper: createWrapper() });
    await waitFor(() => {
      const activeBtn = document.querySelector('[data-active="true"]');
      expect(activeBtn).toBeTruthy();
    });
  });

  // Click en la fila abre el detalle del requisito en una pestaña nueva
  it('click en la fila abre /requirements/{id} en una pestaña nueva', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<RequirementList filters={filters} />, { wrapper: createWrapper() });

    const title = await screen.findByText('Req test');
    fireEvent.click(title.closest('tr') as HTMLElement);

    expect(openSpy).toHaveBeenCalledWith('/requirements/5', '_blank');
    openSpy.mockRestore();
  });

  // Sin tabs de estado (el prototipo no los tiene)
  it('no muestra nav de tabs de estado', () => {
    render(<RequirementList filters={filters} />, { wrapper: createWrapper() });
    const nav = document.querySelector('nav[aria-label="Filtro por estado"]');
    expect(nav).toBeNull();
  });

  // TS-4 (S-066/CA-3): búsqueda combinable con un filtro ya aplicado, sin pisarlo
  it('TS-4: buscar por título combina "search" con un filtro ya aplicado, sin pisarlo (S-066)', async () => {
    mockSearchParams = new URLSearchParams('projectId=3');
    render(<RequirementList filters={{ ...filters, projectId: 3 }} />, {
      wrapper: createWrapper(),
    });

    const input = await screen.findByPlaceholderText('Buscar requisito');
    fireEvent.change(input, { target: { value: 'texto' } });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalled();
    });
    const pushedUrl = mockPush.mock.calls[mockPush.mock.calls.length - 1][0] as string;
    expect(pushedUrl).toContain('projectId=3');
    expect(pushedUrl).toContain('search=texto');
    expect(pushedUrl).not.toContain('page=');
  });

  // TS-5 (S-066/CA-2): búsqueda por título sin coincidencias no rompe el render
  it('TS-5: búsqueda sin coincidencias muestra el estado vacío sin error (S-066)', async () => {
    vi.mocked(requirementsApi.getRequirements).mockResolvedValue([]);
    render(<RequirementList filters={{ ...filters, search: 'zzz-no-existe' }} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText('No se encontraron requisitos')).toBeInTheDocument();
    });
  });

  // TS-12 (S-041/CA-4): updateFilter conserva state=all en la URL (excepción al borrado del sentinel)
  it('TS-12: updateFilter conserva "state=all" en la URL y borra "page" (S-041)', async () => {
    mockSearchParams = new URLSearchParams('state=desarrollo&page=3');
    render(<RequirementList filters={{ ...filters, state: 'desarrollo', page: 3 }} />, {
      wrapper: createWrapper(),
    });

    const removeButton = await screen.findByLabelText('Remove Desarrollo');
    fireEvent.click(removeButton);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalled();
    });
    const pushedUrl = mockPush.mock.calls[mockPush.mock.calls.length - 1][0] as string;
    expect(pushedUrl).toContain('state=all');
    expect(pushedUrl).not.toContain('page');
  });

  // TS-13 (S-041/CA-6): updateFilter sigue borrando el parámetro para los demás filtros con 'all'
  it('TS-13: updateFilter sigue borrando "projectId" con el valor "all", sin tocar "state" (S-041)', async () => {
    mockSearchParams = new URLSearchParams('projectId=7&state=desarrollo');
    render(
      <RequirementList filters={{ ...filters, projectId: 7, state: 'desarrollo' }} />,
      { wrapper: createWrapper() }
    );

    const label = await screen.findByText(
      (content, element) => content === 'Proyecto' && element?.tagName.toLowerCase() === 'label'
    );
    const container = label.closest('div') as HTMLElement;
    const input = within(container).getByRole('combobox');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    const option = screen.getAllByRole('option').find((o) => o.textContent === 'Todos los proyectos');
    fireEvent.click(option as HTMLElement);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalled();
    });
    const pushedUrl = mockPush.mock.calls[mockPush.mock.calls.length - 1][0] as string;
    expect(pushedUrl).not.toContain('projectId');
    expect(pushedUrl).toContain('state=desarrollo');
  });

  // TS-14 (S-041/CA-2, CA-3): cambiar la selección de estados resetea la página a 1
  it('TS-14: cambiar la selección de estados resetea "page" (S-041)', async () => {
    mockSearchParams = new URLSearchParams('state=desarrollo&page=4');
    render(<RequirementList filters={{ ...filters, state: 'desarrollo', page: 4 }} />, {
      wrapper: createWrapper(),
    });

    const stateLabel = await screen.findByText(
      (content, element) => content === 'ESTADO' && element?.tagName.toLowerCase() === 'label'
    );
    const container = stateLabel.closest('div') as HTMLElement;
    const input = within(container).getByRole('combobox');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.click(screen.getByText('Revisión'));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalled();
    });
    const pushedUrl = mockPush.mock.calls[mockPush.mock.calls.length - 1][0] as string;
    expect(pushedUrl).toMatch(/state=desarrollo(%2C|,)revision/);
    expect(pushedUrl).not.toContain('page');
  });

  // TS-15 (S-041/CA-6): el filtro de estado no borra los demás filtros de la URL
  it('TS-15: cambiar el filtro de estado conserva los demás parámetros de la URL (S-041)', async () => {
    mockSearchParams = new URLSearchParams('search=login&projectId=3&sort=priority&state=desarrollo');
    render(
      <RequirementList
        filters={{ ...filters, search: 'login', projectId: 3, sort: 'priority', state: 'desarrollo' }}
      />,
      { wrapper: createWrapper() }
    );

    const stateLabel = await screen.findByText(
      (content, element) => content === 'ESTADO' && element?.tagName.toLowerCase() === 'label'
    );
    const container = stateLabel.closest('div') as HTMLElement;
    const input = within(container).getByRole('combobox');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.click(screen.getByText('Revisión'));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalled();
    });
    const pushedUrl = mockPush.mock.calls[mockPush.mock.calls.length - 1][0] as string;
    expect(pushedUrl).toContain('search=login');
    expect(pushedUrl).toContain('projectId=3');
    expect(pushedUrl).toContain('sort=priority');
  });

  // TS-18 (S-041/CA-4): con state='all' la tabla lista requisitos de estados fuera del default
  it('TS-18: con state="all" la tabla lista requisitos de estados fuera del default (S-041)', async () => {
    vi.mocked(requirementsApi.getRequirements).mockResolvedValue([
      { ...mockRequirement, id: 5, state: 'resuelto' },
      { ...mockRequirement, id: 6, state: 'cancelado' },
    ]);
    render(<RequirementList filters={{ ...filters, state: 'all' }} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText('Resuelto')).toBeInTheDocument();
      expect(screen.getByText('Cancelado')).toBeInTheDocument();
    });
    expect(screen.queryByText('No se encontraron requisitos')).not.toBeInTheDocument();
  });

  // TS-19 (S-041/CA-7): una combinación de estados sin resultados muestra el empty state
  it('TS-19: una combinación de estados sin resultados muestra el empty state (S-041)', async () => {
    vi.mocked(requirementsApi.getRequirements).mockResolvedValue([]);
    render(
      <RequirementList filters={{ ...filters, state: 'planificacion,en_cola' }} />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('No se encontraron requisitos')).toBeInTheDocument();
    });
    expect(screen.getByText('ID')).toBeInTheDocument();
  });
});
