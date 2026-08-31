import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getRequirements,
  getRequirementsCount,
} from '@/features/requirements/services/requirementsApi';
import { ProjectRequirementsSection } from './ProjectRequirementsSection';
import type { RequirementState } from '@/features/requirements/types/requirement.types';

const pushSpy = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushSpy }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));
vi.mock('@/features/requirements/services/requirementsApi', () => ({
  getRequirements: vi.fn(),
  getRequirementsCount: vi.fn(),
}));

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

/** Variante de createWrapper que expone el QueryClient, para forzar invalidaciones desde el test. */
function createWrapperWithClient() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { Wrapper, queryClient };
}

const makeReq = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  title: 'Requisito de prueba',
  type: 'funcionalidad',
  priority: 'media',
  state: 'desarrollo',
  createdAt: '2026-01-15T00:00:00.000Z',
  responsiblePeople: [],
  ...overrides,
});

const DEFAULT_COUNTS: Record<RequirementState, number> = {
  analisis: 8,
  planificacion: 5,
  en_cola: 3,
  desarrollo: 12,
  revision: 4,
  resuelto: 9,
  cancelado: 4,
};

/** Mockea getRequirementsCount para que resuelva el número correspondiente al `state` pedido. */
function mockCounts(counts: Partial<Record<RequirementState, number | 'error'>> = {}) {
  const merged: Record<RequirementState, number | 'error'> = { ...DEFAULT_COUNTS, ...counts };
  vi.mocked(getRequirementsCount).mockImplementation(({ state } = {}) => {
    const value = merged[state as RequirementState];
    if (value === 'error') return Promise.reject(new Error('boom'));
    return Promise.resolve(value ?? 0);
  });
}

describe('ProjectRequirementsSection — tabs con totales reales', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCounts();
    vi.mocked(getRequirements).mockResolvedValue([]);
  });

  // TS-6 (CA-1): los 7 tabs muestran el total real de la api y suman 45, no 20
  it('TS-6: cada tab muestra su total real y la suma de los 7 es 45', async () => {
    render(<ProjectRequirementsSection projectId={1} />, { wrapper: createWrapper() });

    const nav = screen.getByRole('navigation', { name: 'Filtro por estado' });
    await waitFor(() => {
      expect(within(nav).getByRole('button', { name: /desarrollo/i })).toHaveTextContent('12');
    });

    expect(within(nav).getByRole('button', { name: /análisis/i })).toHaveTextContent('8');
    expect(within(nav).getByRole('button', { name: /planificación/i })).toHaveTextContent('5');
    expect(within(nav).getByRole('button', { name: /en cola/i })).toHaveTextContent('3');
    expect(within(nav).getByRole('button', { name: /revisión/i })).toHaveTextContent('4');
    expect(within(nav).getByRole('button', { name: /resuelto/i })).toHaveTextContent('9');
    expect(within(nav).getByRole('button', { name: /cancelado/i })).toHaveTextContent('4');

    const sum = Object.values(DEFAULT_COUNTS).reduce((acc, n) => acc + n, 0);
    expect(sum).toBe(45);
  });

  // TS-7 (CA-1): exactamente 7 conteos, uno por estado, con el projectId correcto
  it('TS-7: dispara exactamente 7 conteos, uno por cada estado, con el projectId correcto', async () => {
    render(<ProjectRequirementsSection projectId={1} />, { wrapper: createWrapper() });

    await waitFor(() => expect(getRequirementsCount).toHaveBeenCalledTimes(7));

    const states: RequirementState[] = [
      'analisis',
      'planificacion',
      'en_cola',
      'desarrollo',
      'revision',
      'resuelto',
      'cancelado',
    ];
    for (const state of states) {
      expect(getRequirementsCount).toHaveBeenCalledWith({ projectId: 1, state });
    }
  });

  it('renderiza 7 tabs', async () => {
    render(<ProjectRequirementsSection projectId={1} />, { wrapper: createWrapper() });

    const nav = screen.getByRole('navigation', { name: 'Filtro por estado' });
    await waitFor(() => {
      const tabs = within(nav).getAllByRole('button', {
        name: /análisis|planificación|en cola|desarrollo|revisión|resuelto|cancelado/i,
      });
      expect(tabs).toHaveLength(7);
    });
  });

  it('renderiza 6 columnas en la tabla', () => {
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

  it('muestra el nombre del responsable cuando existe', async () => {
    vi.mocked(getRequirements).mockResolvedValue([
      makeReq({
        state: 'desarrollo',
        responsiblePeople: [{ id: 1, firstName: 'Ana', lastName: 'Pérez', isLeader: true }],
      }),
    ] as never);

    render(<ProjectRequirementsSection projectId={1} />, { wrapper: createWrapper() });

    expect(await screen.findByText('Ana Pérez')).toBeInTheDocument();
  });

  it('muestra "Sin asignar" cuando no hay responsable asignado', async () => {
    vi.mocked(getRequirements).mockResolvedValue([
      makeReq({ state: 'desarrollo', responsiblePeople: [] }),
    ] as never);

    render(<ProjectRequirementsSection projectId={1} />, { wrapper: createWrapper() });

    await waitFor(() => {
      const cells = screen.getAllByRole('cell');
      expect(cells[2]).toHaveTextContent('Sin asignar');
    });
  });
});

describe('ProjectRequirementsSection — carga inicial y paginación server-side', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCounts();
    vi.mocked(getRequirements).mockResolvedValue([]);
  });

  // TS-8 (CA-2): la carga inicial pide el tab por defecto, página 1 y limit 5
  it('TS-8: la carga inicial pide el listado con state=desarrollo, page=1 y limit=5', async () => {
    render(<ProjectRequirementsSection projectId={1} />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(getRequirements).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: 1, state: 'desarrollo', page: 1, limit: 5 })
      );
    });
  });

  // TS-9 (CA-2): 5 filas y el paginador informa 3 páginas
  it('TS-9: muestra 5 filas y el paginador ofrece hasta la página 3, no la 4', async () => {
    vi.mocked(getRequirements).mockResolvedValue(
      Array.from({ length: 5 }, (_, i) =>
        makeReq({ id: 41 - i, title: `Req ${41 - i}`, state: 'desarrollo' })
      ) as never
    );

    render(<ProjectRequirementsSection projectId={1} />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getAllByRole('row')).toHaveLength(6); // 1 header + 5 datos
    });

    const nav = screen.getByRole('navigation', { name: 'Paginación' });
    expect(within(nav).getByRole('button', { name: 'Página 1' })).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: 'Página 2' })).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: 'Página 3' })).toBeInTheDocument();
    expect(within(nav).queryByRole('button', { name: 'Página 4' })).not.toBeInTheDocument();
  });

  // TS-10 (CA-3): navegar a la página 3 pide esa página a la api
  it('TS-10: navegar a la página 3 pide esa página a la api, no recorta en memoria', async () => {
    const user = userEvent.setup();
    vi.mocked(getRequirements).mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => makeReq({ id: i + 1, state: 'desarrollo' })) as never
    );

    render(<ProjectRequirementsSection projectId={1} />, { wrapper: createWrapper() });

    const nav = await screen.findByRole('navigation', { name: 'Paginación' });
    await user.click(within(nav).getByRole('button', { name: 'Página 3' }));

    await waitFor(() => {
      expect(getRequirements).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: 1, state: 'desarrollo', page: 3, limit: 5 })
      );
    });
  });

  // TS-11 (CA-3): navegar de página no cambia la URL
  it('TS-11: navegar de página no cambia la URL', async () => {
    const user = userEvent.setup();
    vi.mocked(getRequirements).mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => makeReq({ id: i + 1, state: 'desarrollo' })) as never
    );

    render(<ProjectRequirementsSection projectId={1} />, { wrapper: createWrapper() });

    const nav = await screen.findByRole('navigation', { name: 'Paginación' });
    await user.click(within(nav).getByRole('button', { name: 'Página 3' }));

    expect(pushSpy).not.toHaveBeenCalled();
  });

  // TS-24: regresión de accesibilidad
  it('TS-24: conserva <nav aria-label="Paginación"> con aria-current en la página activa', async () => {
    const user = userEvent.setup();
    vi.mocked(getRequirements).mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => makeReq({ id: i + 1, state: 'desarrollo' })) as never
    );

    render(<ProjectRequirementsSection projectId={1} />, { wrapper: createWrapper() });

    const nav = await screen.findByRole('navigation', { name: 'Paginación' });
    await user.click(within(nav).getByRole('button', { name: 'Página 2' }));

    await waitFor(() => {
      const currentBtn = within(nav).getByRole('button', { name: 'Página 2' });
      expect(currentBtn).toHaveAttribute('aria-current', 'page');
      expect(currentBtn).toBeDisabled();
    });
    expect(within(nav).getByRole('button', { name: 'Página anterior' })).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: 'Página siguiente' })).toBeInTheDocument();
  });
});

describe('ProjectRequirementsSection — cambio de tab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCounts();
    vi.mocked(getRequirements).mockResolvedValue([]);
  });

  // TS-12 (CA-4): cambiar de tab resetea a la página 1 y pide el listado del nuevo estado
  it('TS-12: cambiar de tab resetea a la página 1 y pide el listado del nuevo estado', async () => {
    const user = userEvent.setup();
    vi.mocked(getRequirements).mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => makeReq({ id: i + 1, state: 'desarrollo' })) as never
    );

    render(<ProjectRequirementsSection projectId={1} />, { wrapper: createWrapper() });

    const nav = await screen.findByRole('navigation', { name: 'Paginación' });
    await user.click(within(nav).getByRole('button', { name: 'Página 3' }));
    await waitFor(() => {
      expect(getRequirements).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'desarrollo', page: 3 })
      );
    });

    const tabsNav = screen.getByRole('navigation', { name: 'Filtro por estado' });
    await user.click(within(tabsNav).getByRole('button', { name: /análisis/i }));

    await waitFor(() => {
      expect(getRequirements).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: 1, state: 'analisis', page: 1, limit: 5 })
      );
    });
  });

  // TS-13 (CA-4): cambiar de tab refresca los 7 conteos
  it('TS-13: cambiar de tab refresca los 7 conteos (14 llamadas acumuladas)', async () => {
    const user = userEvent.setup();

    render(<ProjectRequirementsSection projectId={1} />, { wrapper: createWrapper() });

    await waitFor(() => expect(getRequirementsCount).toHaveBeenCalledTimes(7));

    const tabsNav = screen.getByRole('navigation', { name: 'Filtro por estado' });
    await user.click(within(tabsNav).getByRole('button', { name: /análisis/i }));

    await waitFor(() => expect(getRequirementsCount).toHaveBeenCalledTimes(14));
  });

  // TS-14 (CA-5): tab sin requisitos
  it('TS-14: un tab con 0 requisitos muestra total 0, tabla vacía y sin paginador', async () => {
    const user = userEvent.setup();
    mockCounts({ revision: 0 });
    vi.mocked(getRequirements).mockImplementation(({ state } = {}) =>
      Promise.resolve(state === 'revision' ? [] : ([makeReq()] as never))
    );

    render(<ProjectRequirementsSection projectId={1} />, { wrapper: createWrapper() });

    const tabsNav = screen.getByRole('navigation', { name: 'Filtro por estado' });
    const revisionTab = within(tabsNav).getByRole('button', { name: /revisión/i });
    await waitFor(() => expect(revisionTab).toHaveTextContent('0'));

    await user.click(revisionTab);

    expect(await screen.findByText('No se encontraron requisitos')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Paginación' })).not.toBeInTheDocument();
  });
});

describe('ProjectRequirementsSection — tamaño de página', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCounts();
    vi.mocked(getRequirements).mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => makeReq({ id: i + 1, state: 'desarrollo' })) as never
    );
  });

  // TS-15 (CA-6): cambiar el tamaño de página resetea a 1 y pide con el nuevo limit
  it('TS-15: cambiar el <select> a 10 resetea a la página 1 y pide limit=10', async () => {
    const user = userEvent.setup();
    render(<ProjectRequirementsSection projectId={1} />, { wrapper: createWrapper() });

    await screen.findByRole('navigation', { name: 'Paginación' });
    await user.selectOptions(screen.getByRole('combobox'), '10');

    await waitFor(() => {
      expect(getRequirements).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: 1, state: 'desarrollo', page: 1, limit: 10 })
      );
    });
  });

  // TS-16 (CA-6): cambiar el tamaño de página mantiene el tab activo
  it('TS-16: cambiar el tamaño de página mantiene el tab activo', async () => {
    const user = userEvent.setup();
    render(<ProjectRequirementsSection projectId={1} />, { wrapper: createWrapper() });

    const tabsNav = screen.getByRole('navigation', { name: 'Filtro por estado' });
    const analisisTab = await within(tabsNav).findByRole('button', { name: /análisis/i });
    await user.click(analisisTab);

    await waitFor(() => {
      expect(getRequirements).toHaveBeenCalledWith(expect.objectContaining({ state: 'analisis' }));
    });

    await user.selectOptions(screen.getByRole('combobox'), '10');

    await waitFor(() => {
      expect(getRequirements).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'analisis', limit: 10 })
      );
    });
    // El tab activo mantiene su estado tras el cambio de tamaño de página, en
    // vez de volver al tab por defecto: sigue siendo el único cuyo listado se pide.
    expect(getRequirements).not.toHaveBeenCalledWith(
      expect.objectContaining({ state: 'desarrollo', limit: 10 })
    );
  });

  // TS-17 (CA-6): el <select> queda fuera del <nav>
  it('TS-17: el <select> de tamaño de página está fuera del <nav> de paginación', async () => {
    render(<ProjectRequirementsSection projectId={1} />, { wrapper: createWrapper() });

    const nav = await screen.findByRole('navigation', { name: 'Paginación' });
    expect(within(nav).queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });
});

describe('ProjectRequirementsSection — proyecto vacío', () => {
  // TS-18 (CA-7): proyecto sin ningún requisito
  it('TS-18: sin requisitos, los 7 tabs muestran 0 y no hay paginador', async () => {
    vi.clearAllMocks();
    mockCounts({
      analisis: 0,
      planificacion: 0,
      en_cola: 0,
      desarrollo: 0,
      revision: 0,
      resuelto: 0,
      cancelado: 0,
    });
    vi.mocked(getRequirements).mockResolvedValue([]);

    render(<ProjectRequirementsSection projectId={1} />, { wrapper: createWrapper() });

    const tabsNav = screen.getByRole('navigation', { name: 'Filtro por estado' });
    await waitFor(() => {
      const tabs = within(tabsNav).getAllByRole('button');
      tabs.forEach((tab) => expect(tab).toHaveTextContent('0'));
    });

    expect(screen.getByText('No se encontraron requisitos')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Paginación' })).not.toBeInTheDocument();
  });
});

describe('ProjectRequirementsSection — aislamiento de fallos (CA-8)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCounts({ revision: 'error' });
    vi.mocked(getRequirements).mockResolvedValue(
      Array.from({ length: 5 }, (_, i) =>
        makeReq({ id: i + 1, title: i === 0 ? 'Req A' : `Req ${i + 1}`, state: 'desarrollo' })
      ) as never
    );
  });

  // TS-19: el tab con fallo muestra un placeholder neutro, no 0
  it('TS-19: el conteo que falla muestra un placeholder neutro, no 0, y los demás quedan bien', async () => {
    render(<ProjectRequirementsSection projectId={1} />, { wrapper: createWrapper() });

    const tabsNav = screen.getByRole('navigation', { name: 'Filtro por estado' });
    const revisionTab = await within(tabsNav).findByRole('button', { name: /revisión/i });

    await waitFor(() => expect(revisionTab).toHaveTextContent('—'));
    expect(revisionTab).not.toHaveTextContent('0');

    expect(within(tabsNav).getByRole('button', { name: /análisis/i })).toHaveTextContent('8');
    expect(within(tabsNav).getByRole('button', { name: /planificación/i })).toHaveTextContent('5');
    expect(within(tabsNav).getByRole('button', { name: /en cola/i })).toHaveTextContent('3');
    expect(within(tabsNav).getByRole('button', { name: /desarrollo/i })).toHaveTextContent('12');
    expect(within(tabsNav).getByRole('button', { name: /resuelto/i })).toHaveTextContent('9');
    expect(within(tabsNav).getByRole('button', { name: /cancelado/i })).toHaveTextContent('4');
  });

  // TS-20: la tabla del tab activo sigue mostrando sus datos
  it('TS-20: un conteo en error no afecta la tabla del tab activo', async () => {
    render(<ProjectRequirementsSection projectId={1} />, { wrapper: createWrapper() });

    expect(await screen.findByText('Req A')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(6); // header + 5
  });

  // TS-21: el paginador del tab activo sigue operativo
  it('TS-21: el paginador del tab activo sigue operativo pese al conteo caído', async () => {
    render(<ProjectRequirementsSection projectId={1} />, { wrapper: createWrapper() });

    const nav = await screen.findByRole('navigation', { name: 'Paginación' });
    expect(within(nav).getByRole('button', { name: 'Página 1' })).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: 'Página 2' })).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: 'Página 3' })).toBeInTheDocument();
  });
});

describe('ProjectRequirementsSection — página fuera de rango (CA-9)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // TS-22: la card clampea al total vigente en vez de quedar vacía
  it('TS-22: si la página deja de existir, clampea al total vigente en vez de quedar vacía', async () => {
    const user = userEvent.setup();
    mockCounts({ desarrollo: 12 });
    vi.mocked(getRequirements).mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => makeReq({ id: i + 1, state: 'desarrollo' })) as never
    );

    const { Wrapper, queryClient } = createWrapperWithClient();
    render(<ProjectRequirementsSection projectId={1} />, { wrapper: Wrapper });

    const nav = await screen.findByRole('navigation', { name: 'Paginación' });
    await user.click(within(nav).getByRole('button', { name: 'Página 3' }));

    await waitFor(() => {
      expect(getRequirements).toHaveBeenCalledWith(expect.objectContaining({ page: 3 }));
    });

    // El total del tab baja a 6 (2 páginas con limit 5): la página 3 ya no existe.
    // Se simula el refresco de conteos sin pasar por un cambio de tab, que resetearía la página.
    mockCounts({ desarrollo: 6 });
    await queryClient.invalidateQueries({ queryKey: ['requirements-count'] });

    await waitFor(() => {
      expect(getRequirements).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'desarrollo', page: 2 })
      );
    });

    const paginationNav = screen.getByRole('navigation', { name: 'Paginación' });
    expect(within(paginationNav).getByRole('button', { name: 'Página 2' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  // TS-23: el clamp no baja nunca de la página 1
  it('TS-23: el clamp nunca produce una página menor a 1', async () => {
    const user = userEvent.setup();
    mockCounts({ desarrollo: 12 });
    vi.mocked(getRequirements).mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => makeReq({ id: i + 1, state: 'desarrollo' })) as never
    );

    const { Wrapper, queryClient } = createWrapperWithClient();
    render(<ProjectRequirementsSection projectId={1} />, { wrapper: Wrapper });

    const nav = await screen.findByRole('navigation', { name: 'Paginación' });
    await user.click(within(nav).getByRole('button', { name: 'Página 3' }));

    await waitFor(() => {
      expect(getRequirements).toHaveBeenCalledWith(expect.objectContaining({ page: 3 }));
    });

    // El estado activo queda sin requisitos: el conteo cae a 0.
    mockCounts({ desarrollo: 0 });
    vi.mocked(getRequirements).mockResolvedValue([]);
    await queryClient.invalidateQueries({ queryKey: ['requirements-count'] });

    await waitFor(() => {
      expect(getRequirements).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'desarrollo', page: 1 })
      );
    });
    expect(screen.queryByRole('navigation', { name: 'Paginación' })).not.toBeInTheDocument();
  });
});
