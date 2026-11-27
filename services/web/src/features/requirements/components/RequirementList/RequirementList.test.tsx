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
  getRequirementsCount: vi.fn(),
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
    vi.mocked(requirementsApi.getRequirementsCount).mockResolvedValue(32);
  });

  // TS-1: 9 columnas con headers del prototipo, "Hs. Trab." antes de "Creación" (S-045)
  it('TS-1: tabla muestra 9 columnas con headers del prototipo, "Hs. Trab." antes de "Creación" (S-045)', async () => {
    render(<RequirementList filters={filters} />, { wrapper: createWrapper() });
    await waitFor(() => {
      const headers = document.querySelectorAll('thead th');
      const headerTexts = Array.from(headers).map((th) => th.textContent?.trim());
      expect(headerTexts).toEqual([
        'ID',
        'Proyecto',
        'Título',
        'Responsable',
        'Estado',
        'Tipo',
        'Prioridad',
        'Hs. Trab.',
        'Creación',
      ]);
      expect(headers.length).toBe(9);
    });
  });

  // TS-2 (S-057): el estado se muestra con el componente Badge, con familia de STATE_TO_FAMILY
  it('TS-2: estado se muestra con Badge, con la familia resuelta por STATE_TO_FAMILY', async () => {
    render(<RequirementList filters={filters} />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getAllByText('Análisis').length).toBeGreaterThan(0);
    });
    // mockRequirement.state === 'analisis', que no está en STATE_TO_FAMILY: cae al
    // default 'neutral' (comportamiento documentado, no un bug de esta migración).
    const stateBadge = screen.getByText('Análisis').closest('span')?.parentElement;
    expect(stateBadge?.className).toMatch(/familyNeutral/);
  });

  // TS-3 (S-057): la prioridad se muestra con Badge, con la familia del mapa de prioridad
  it('TS-3: prioridad se muestra con Badge, con family "urgent" para prioridad alta', async () => {
    render(<RequirementList filters={filters} />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getAllByText('Alta').length).toBeGreaterThan(0);
    });
    const priorityBadge = screen.getByText('Alta').closest('span')?.parentElement;
    expect(priorityBadge?.className).toMatch(/familyUrgent/);
  });

  // TS-5: Creación muestra createdAt formateado
  it('TS-5: Creación muestra createdAt formateado', async () => {
    render(<RequirementList filters={filters} />, { wrapper: createWrapper() });
    await waitFor(() => {
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

  // TS-11 (S-057): sin requisitos, EmptyState variant="filtered" (hay filtro de estado default)
  it('TS-11: sin requisitos muestra el EmptyState, sin invitar a crear', async () => {
    vi.mocked(requirementsApi.getRequirements).mockResolvedValue([]);
    render(<RequirementList filters={{ ...filters, state: 'desarrollo' }} />, {
      wrapper: createWrapper(),
    });
    await waitFor(() => {
      expect(screen.getByText('No se encontraron requisitos')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /nuevo/i })).not.toBeInTheDocument();
    // El <thead> se sigue viendo: Table renderiza el emptyState fuera del <table>, sin ocultar
    // el encabezado.
    expect(screen.getByText('ID')).toBeInTheDocument();
  });

  // TS-12: paginación — botón activo tiene data-active
  it('TS-12: botón de página activa tiene data-active', async () => {
    render(<RequirementList filters={filters} />, { wrapper: createWrapper() });
    await waitFor(() => {
      const activeBtn = document.querySelector('[data-active="true"]');
      expect(activeBtn).toBeTruthy();
    });
  });

  // Navegación al detalle: el título de la fila es el enlace accesible (S-057: Table no
  // ofrece click de fila, así que la navegación vive en la celda de título).
  it('el título de la fila enlaza a /requirements/{id}', async () => {
    render(<RequirementList filters={filters} />, { wrapper: createWrapper() });

    const link = await screen.findByRole('link', { name: 'Req test' });
    expect(link).toHaveAttribute('href', '/requirements/5');
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

    const projectSelect = await screen.findByLabelText('Proyecto');
    fireEvent.click(projectSelect);
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
      (content, element) => content === 'Estados' && element?.tagName.toLowerCase() === 'label'
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
      (content, element) => content === 'Estados' && element?.tagName.toLowerCase() === 'label'
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

describe('RequirementList — S-042 (paginador unificado con total real)', () => {
  const filters: RequirementFilters = { page: 1, limit: 10 };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    vi.mocked(requirementsApi.getRequirements).mockResolvedValue([mockRequirement]);
    vi.mocked(requirementsApi.getRequirementsCount).mockResolvedValue(32);
  });

  function getPaginationNav(): HTMLElement | null {
    return document.querySelector('nav[aria-label="Paginación"]');
  }

  function getPageNumberButtons(nav: HTMLElement): HTMLElement[] {
    return within(nav).getAllByLabelText(/^Página \d+$/);
  }

  // TS-1: cantidad exacta de páginas del conjunto filtrado (CA-1)
  it('TS-1: ofrece la cantidad exacta de páginas del conjunto filtrado (32/15 = 3)', async () => {
    vi.mocked(requirementsApi.getRequirements).mockResolvedValue(
      Array.from({ length: 15 }, (_, i) => ({ ...mockRequirement, id: i + 1 }))
    );
    vi.mocked(requirementsApi.getRequirementsCount).mockResolvedValue(32);
    render(
      <RequirementList
        filters={{
          state: 'planificacion,en_cola,desarrollo,revision',
          page: 1,
          limit: 15,
        }}
      />,
      { wrapper: createWrapper() }
    );

    // S-054: el nav siempre está presente (incluso antes de que resuelva el conteo real),
    // así que se espera por un botón que sólo existe una vez cargado el total real (32/15 = 3).
    const nav = getPaginationNav() as HTMLElement;
    await waitFor(() => {
      expect(within(nav).getByRole('button', { name: 'Página 3' })).toBeInTheDocument();
    });
    const pageButtons = getPageNumberButtons(nav);
    const labels = pageButtons.map((b) => b.getAttribute('aria-label'));
    expect(labels).toContain('Página 1');
    expect(labels).toContain('Página 2');
    expect(labels).toContain('Página 3');
    expect(labels).not.toContain('Página 4');
  });

  // TS-2: el conteo se pide con los mismos filtros que el listado (CA-1)
  it('TS-2: getRequirementsCount se llama con los mismos filtros que getRequirements', async () => {
    const listFilters: RequirementFilters = {
      state: 'desarrollo,revision',
      projectId: 3,
      search: 'login',
      page: 2,
      limit: 20,
    };
    render(<RequirementList filters={listFilters} />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(requirementsApi.getRequirementsCount).toHaveBeenCalled();
    });
    const callArg = vi.mocked(requirementsApi.getRequirementsCount).mock.calls[0][0];
    expect(callArg).toMatchObject({
      state: 'desarrollo,revision',
      projectId: 3,
      search: 'login',
      limit: 20,
    });
  });

  // TS-3: con conteo 0 el paginador no ofrece páginas navegables (CA-2)
  // S-054: ya no se oculta con 0 ítems — se renderiza deshabilitada, sin páginas navegables.
  it('TS-3: con conteo 0 el paginador se muestra deshabilitado, sin páginas navegables', async () => {
    vi.mocked(requirementsApi.getRequirements).mockResolvedValue([]);
    vi.mocked(requirementsApi.getRequirementsCount).mockResolvedValue(0);
    render(
      <RequirementList filters={{ state: 'planificacion,en_cola', page: 1, limit: 15 }} />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('No se encontraron requisitos')).toBeInTheDocument();
    });
    const nav = getPaginationNav() as HTMLElement;
    expect(nav).toBeTruthy();
    expect(within(nav).getByRole('button', { name: 'Página anterior' })).toBeDisabled();
    expect(within(nav).getByRole('button', { name: 'Página siguiente' })).toBeDisabled();
  });

  // TS-4 (S-057): el empty state convive con el selector de tamaño de página, que ahora lo
  // aporta Pagination (onPageSizeChange), no un <select> crudo
  it('TS-4: el selector de tamaño de página sigue visible con el empty state', async () => {
    vi.mocked(requirementsApi.getRequirements).mockResolvedValue([]);
    vi.mocked(requirementsApi.getRequirementsCount).mockResolvedValue(0);
    render(
      <RequirementList filters={{ state: 'planificacion,en_cola', page: 1, limit: 15 }} />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('No se encontraron requisitos')).toBeInTheDocument();
    });
    expect(document.querySelector('select')).toBeNull();
    const pageSizeControl = screen.getByLabelText('Cantidad por página');
    expect(pageSizeControl).toBeInTheDocument();
    expect(pageSizeControl).toHaveTextContent('15 por página');
  });

  // TS-5: la última página deshabilita la flecha "siguiente" (CA-1)
  it('TS-5: en la última página la flecha "siguiente" está deshabilitada', async () => {
    vi.mocked(requirementsApi.getRequirementsCount).mockResolvedValue(32);
    mockSearchParams = new URLSearchParams('page=3');
    render(<RequirementList filters={{ ...filters, page: 3, limit: 15 }} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(getPaginationNav()).toBeTruthy();
    });
    const nextBtn = screen.getByLabelText('Página siguiente');
    expect(nextBtn).toBeDisabled();
  });

  // TS-6: en la primera página la flecha "anterior" está deshabilitada (CA-1)
  it('TS-6: en la primera página la flecha "anterior" está deshabilitada', async () => {
    vi.mocked(requirementsApi.getRequirementsCount).mockResolvedValue(32);
    render(<RequirementList filters={{ ...filters, page: 1, limit: 15 }} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(getPaginationNav()).toBeTruthy();
    });
    const prevBtn = screen.getByLabelText('Página anterior');
    expect(prevBtn).toBeDisabled();
  });

  // TS-7: total múltiplo exacto del límite no ofrece una página vacía de más (CA-1)
  it('TS-7: total múltiplo exacto del límite no ofrece una página vacía de más', async () => {
    vi.mocked(requirementsApi.getRequirements).mockResolvedValue(
      Array.from({ length: 15 }, (_, i) => ({ ...mockRequirement, id: i + 1 }))
    );
    vi.mocked(requirementsApi.getRequirementsCount).mockResolvedValue(30);
    mockSearchParams = new URLSearchParams('page=2');
    render(<RequirementList filters={{ ...filters, page: 2, limit: 15 }} />, {
      wrapper: createWrapper(),
    });

    // S-054: el nav siempre está presente, incluso antes de cargar el total real — y con
    // count=0 por defecto y page=2 en la URL, "siguiente" arranca deshabilitado igual (1 sola
    // página). Se espera por "Página 2" en sí, que sólo existe una vez cargado el total (30/15).
    await screen.findByLabelText('Página 2');
    const nav = getPaginationNav() as HTMLElement;
    const labels = getPageNumberButtons(nav).map((b) => b.getAttribute('aria-label'));
    expect(labels).toContain('Página 1');
    expect(labels).toContain('Página 2');
    expect(labels).not.toContain('Página 3');
    expect(screen.getByLabelText('Página siguiente')).toBeDisabled();
  });

  // TS-8: navegar de página preserva el resto de los searchParams (CA-1)
  it('TS-8: navegar de página preserva el resto de los searchParams', async () => {
    vi.mocked(requirementsApi.getRequirementsCount).mockResolvedValue(32);
    mockSearchParams = new URLSearchParams('state=desarrollo&search=login&limit=15');
    render(
      <RequirementList
        filters={{ state: 'desarrollo', search: 'login', limit: 15, page: 1 }}
      />,
      { wrapper: createWrapper() }
    );

    // S-054: el nav siempre está presente; se espera por "Página 2" en sí (sólo existe
    // una vez cargado el total real) en vez del nav a secas.
    const page2Button = await screen.findByLabelText('Página 2');
    fireEvent.click(page2Button);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalled();
    });
    const pushedUrl = mockPush.mock.calls[mockPush.mock.calls.length - 1][0] as string;
    expect(pushedUrl).toMatch(/^\/requirements\?/);
    expect(pushedUrl).toContain('page=2');
    expect(pushedUrl).toContain('state=desarrollo');
    expect(pushedUrl).toContain('search=login');
    expect(pushedUrl).toContain('limit=15');
  });

  // TS-9: el botón de la página actual está marcado y deshabilitado (CA-1)
  it('TS-9: el botón de la página actual tiene data-active, aria-current y disabled', async () => {
    vi.mocked(requirementsApi.getRequirementsCount).mockResolvedValue(32);
    mockSearchParams = new URLSearchParams('page=2');
    render(<RequirementList filters={{ ...filters, page: 2, limit: 15 }} />, {
      wrapper: createWrapper(),
    });

    // S-054: se espera por el propio botón "Página 2" (sólo existe una vez cargado
    // el total real), no por la mera presencia del nav.
    const activeBtn = await screen.findByLabelText('Página 2');
    expect(activeBtn).toHaveAttribute('data-active');
    expect(activeBtn).toHaveAttribute('aria-current', 'page');
    expect(activeBtn).toBeDisabled();
  });

  // TS-10: el paginador es un landmark accesible, sin restos del paginador viejo (CA-1)
  it('TS-10: el paginador es un landmark accesible sin restos del paginador viejo', async () => {
    vi.mocked(requirementsApi.getRequirementsCount).mockResolvedValue(32);
    render(<RequirementList filters={{ ...filters, page: 1, limit: 15 }} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(getPaginationNav()).toBeTruthy();
    });
    const nav = getPaginationNav() as HTMLElement;
    expect(nav).toHaveAttribute('role', 'navigation');
    expect(document.querySelectorAll('[class*="pageBtn"]').length).toBe(0);
  });

  // TS-11 (S-057): cambiar el tamaño de página (vía Pagination.onPageSizeChange) resetea la
  // página a 1
  it('TS-11: cambiar el tamaño de página resetea "page" a 1', async () => {
    vi.mocked(requirementsApi.getRequirementsCount).mockResolvedValue(32);
    mockSearchParams = new URLSearchParams('page=3&state=desarrollo');
    render(
      <RequirementList filters={{ ...filters, state: 'desarrollo', page: 3, limit: 15 }} />,
      { wrapper: createWrapper() }
    );

    const pageSizeControl = await screen.findByLabelText('Cantidad por página');
    fireEvent.click(pageSizeControl);
    fireEvent.click(screen.getByRole('option', { name: '25 por página' }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalled();
    });
    const pushedUrl = mockPush.mock.calls[mockPush.mock.calls.length - 1][0] as string;
    expect(pushedUrl).toContain('limit=25');
    expect(pushedUrl).toContain('page=1');
    expect(pushedUrl).toContain('state=desarrollo');
  });

  // TS-12: un límite distinto recalcula las páginas (CA-1)
  it('TS-12: un límite distinto recalcula las páginas (32/25 = 2)', async () => {
    vi.mocked(requirementsApi.getRequirementsCount).mockResolvedValue(32);
    render(<RequirementList filters={{ ...filters, page: 1, limit: 25 }} />, {
      wrapper: createWrapper(),
    });

    // S-054: se espera por "Página 2" (sólo existe una vez cargado el total real: 32/25 = 2).
    await screen.findByLabelText('Página 2');
    const nav = getPaginationNav() as HTMLElement;
    const labels = getPageNumberButtons(nav).map((b) => b.getAttribute('aria-label'));
    expect(labels).toContain('Página 1');
    expect(labels).toContain('Página 2');
    expect(labels).not.toContain('Página 3');
  });

  // TS-13: ventana deslizante de máximo 10 números de página (CA-1)
  it('TS-13: la ventana deslizante muestra como máximo 10 números de página', async () => {
    vi.mocked(requirementsApi.getRequirementsCount).mockResolvedValue(500);
    render(<RequirementList filters={{ ...filters, page: 1, limit: 15 }} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(getPaginationNav()).toBeTruthy();
    });
    const nav = getPaginationNav() as HTMLElement;
    const pageButtons = getPageNumberButtons(nav);
    expect(pageButtons.length).toBeLessThanOrEqual(10);
  });

  // TS-14: el conteo pendiente no rompe el render de la tabla (CA-1, CA-2)
  // S-054: mientras el conteo está pendiente, `count` por defecto es 0 y el paginador ya no se
  // oculta — se renderiza igual, deshabilitado (una sola página).
  it('TS-14: el conteo pendiente no rompe el render de la tabla y el paginador queda deshabilitado', async () => {
    vi.mocked(requirementsApi.getRequirements).mockResolvedValue([mockRequirement]);
    vi.mocked(requirementsApi.getRequirementsCount).mockReturnValue(new Promise(() => {}));
    render(<RequirementList filters={{ ...filters, page: 1, limit: 15 }} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText('Req test')).toBeInTheDocument();
    });
    const nav = getPaginationNav() as HTMLElement;
    expect(nav).toBeTruthy();
    expect(within(nav).getByRole('button', { name: 'Página anterior' })).toBeDisabled();
    expect(within(nav).getByRole('button', { name: 'Página siguiente' })).toBeDisabled();
    expect(within(nav).queryByRole('button', { name: 'Página 2' })).not.toBeInTheDocument();
  });

  // TS-15: un conteo fallido no rompe la pantalla (CA-2)
  // S-054: un conteo fallido deja `count` en 0 (valor por defecto) — el paginador se muestra
  // igual, deshabilitado, en vez de ocultarse.
  it('TS-15: un conteo fallido no rompe la pantalla y el paginador queda deshabilitado', async () => {
    vi.mocked(requirementsApi.getRequirements).mockResolvedValue([mockRequirement]);
    vi.mocked(requirementsApi.getRequirementsCount).mockRejectedValue(new Error('boom'));
    render(<RequirementList filters={{ ...filters, page: 1, limit: 15 }} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText('Req test')).toBeInTheDocument();
    });
    // El rechazo del conteo resuelve en un microtask aparte del de "Req test": se espera
    // explícitamente a que las flechas del paginador queden deshabilitadas (estado final tras
    // el fallo) en vez de leer el nav apenas aparece el primer dato.
    await waitFor(() => {
      const nav = getPaginationNav();
      expect(nav).toBeTruthy();
      expect(within(nav as HTMLElement).getByRole('button', { name: 'Página anterior' })).toBeDisabled();
    });
    const nav = getPaginationNav() as HTMLElement;
    expect(within(nav).getByRole('button', { name: 'Página siguiente' })).toBeDisabled();
    expect(within(nav).queryByRole('button', { name: 'Página 2' })).not.toBeInTheDocument();
  });
});

describe('RequirementList — S-045 (columna "Hs. Trab.")', () => {
  const filters: RequirementFilters = { page: 1, limit: 10 };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    vi.mocked(requirementsApi.getRequirements).mockResolvedValue([mockRequirement]);
    vi.mocked(requirementsApi.getRequirementsCount).mockResolvedValue(32);
  });

  // TS-6: la celda formatea 150 minutos como "2h 30m" (CA-1)
  it('TS-6: la celda formatea 150 minutos como "2h 30m" (CA-1)', async () => {
    vi.mocked(requirementsApi.getRequirements).mockResolvedValue([
      { ...mockRequirement, id: 5, totalMinutes: 150 },
    ]);
    render(<RequirementList filters={filters} />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('2h 30m')).toBeInTheDocument();
    });
  });

  // TS-7: totalMinutes 0 muestra "—" y no "0h 0m" (CA-2)
  it('TS-7: totalMinutes 0 muestra "—" y no "0h 0m" (CA-2)', async () => {
    vi.mocked(requirementsApi.getRequirements).mockResolvedValue([
      { ...mockRequirement, id: 5, totalMinutes: 0 },
    ]);
    render(<RequirementList filters={filters} />, { wrapper: createWrapper() });

    await waitFor(() => {
      const row = screen.getByText('Req test').closest('tr') as HTMLElement;
      // Índice 7: "Hs. Trab." va entre "Prioridad" y "Creación", no al final de la fila.
      const hoursCell = row.querySelectorAll('td')[7];
      expect(hoursCell.textContent).toBe('—');
    });
    expect(screen.queryByText('0h 0m')).not.toBeInTheDocument();
  });

  // TS-8: totalMinutes ausente (api vieja) muestra "—" sin lanzar excepción (CA-2)
  it('TS-8: totalMinutes ausente muestra "—" sin lanzar excepción (CA-2)', async () => {
    // mockRequirement no declara `totalMinutes`: simula exactamente la respuesta de una api
    // vieja que todavía no conoce el campo (a diferencia de TS-7, que lo manda en 0).
    expect('totalMinutes' in mockRequirement).toBe(false);
    vi.mocked(requirementsApi.getRequirements).mockResolvedValue([mockRequirement]);
    render(<RequirementList filters={filters} />, { wrapper: createWrapper() });

    await waitFor(() => {
      const row = screen.getByText('Req test').closest('tr') as HTMLElement;
      // Índice 7: "Hs. Trab." va entre "Prioridad" y "Creación", no al final de la fila.
      const hoursCell = row.querySelectorAll('td')[7];
      expect(hoursCell.textContent).toBe('—');
    });
  });

  // TS-9: el <th> de "Hs. Trab." no es accionable (CA-6)
  it('TS-9: el <th> de "Hs. Trab." no es accionable (CA-6)', async () => {
    render(<RequirementList filters={filters} />, { wrapper: createWrapper() });

    const th = await screen.findByText('Hs. Trab.');
    fireEvent.click(th);

    expect(mockPush).not.toHaveBeenCalled();
    expect(th.closest('th')).not.toHaveAttribute('aria-sort');
  });

  // TS-10 (S-057): la fila de carga usa el estado `loading` de Table (role="status"), no un
  // <td colSpan> armado a mano
  it('TS-10: mientras carga, Table muestra el estado de carga accesible', async () => {
    vi.mocked(requirementsApi.getRequirements).mockReturnValue(new Promise(() => {}));
    render(<RequirementList filters={filters} />, { wrapper: createWrapper() });

    expect(await screen.findByText('Cargando…')).toHaveAttribute('role', 'status');
  });
});
