import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import * as useProjectsModule from '@/features/projects/hooks/useProjects';
import { RequirementFilters } from './RequirementFilters';
import type { RequirementFilters as Filters } from '../../types/requirement.types';

function getProjectSelectContainer(): HTMLElement {
  return screen.getByText('Proyecto').closest('div') as HTMLElement;
}

const mockProjects = [
  { id: 3, name: 'Zeta' },
  { id: 1, name: 'Alfa' },
  { id: 2, name: 'Beta' },
];

vi.mock('@/features/projects/hooks/useProjects', () => ({
  useProjects: vi.fn(() => ({ data: mockProjects })),
}));

vi.mock('@/features/auth/hooks/usePersons', () => ({
  usePersons: vi.fn(() => ({ data: [] })),
}));

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({ data: null })),
}));

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

describe('RequirementFilters — S-051', () => {
  const filters: Filters = { page: 1, limit: 10 };
  const onChange = vi.fn();

  // TS-13: Label "Búsqueda" presente y sin uppercase
  it('TS-13: label "Búsqueda" presente en el DOM sin uppercase', () => {
    render(<RequirementFilters filters={filters} onChange={onChange} />, {
      wrapper: createWrapper(),
    });
    const label = screen.getByText('Búsqueda');
    expect(label).toBeInTheDocument();
    const style = window.getComputedStyle(label);
    expect(style.textTransform).not.toBe('uppercase');
  });

  it('muestra label "Estado"', () => {
    render(<RequirementFilters filters={filters} onChange={onChange} />, {
      wrapper: createWrapper(),
    });
    expect(screen.getByText('Estado')).toBeInTheDocument();
  });

  it('muestra label "Proyecto"', () => {
    render(<RequirementFilters filters={filters} onChange={onChange} />, {
      wrapper: createWrapper(),
    });
    expect(screen.getByText('Proyecto')).toBeInTheDocument();
  });

  it('muestra label "Ordenar por"', () => {
    render(<RequirementFilters filters={filters} onChange={onChange} />, {
      wrapper: createWrapper(),
    });
    expect(screen.getByText('Ordenar por')).toBeInTheDocument();
  });

  it('el input de búsqueda tiene placeholder "Buscar requisito"', () => {
    render(<RequirementFilters filters={filters} onChange={onChange} />, {
      wrapper: createWrapper(),
    });
    expect(screen.getByPlaceholderText('Buscar requisito')).toBeInTheDocument();
  });

  // Debounce: escribir no debe notificar ni navegar en cada tecla
  it('escribir en el campo de búsqueda no notifica onChange inmediatamente', () => {
    render(<RequirementFilters filters={filters} onChange={onChange} />, {
      wrapper: createWrapper(),
    });
    const input = screen.getByPlaceholderText('Buscar requisito');

    fireEvent.change(input, { target: { value: 'login' } });

    expect(onChange).not.toHaveBeenCalled();
  });

  // TS-1 (S-066/CA-1): el debounce debe notificar con la key 'search', no 'tag'
  it('TS-1: escribir y esperar el debounce notifica onChange con "search", no "tag" (S-066)', async () => {
    render(<RequirementFilters filters={filters} onChange={onChange} />, {
      wrapper: createWrapper(),
    });
    const input = screen.getByPlaceholderText('Buscar requisito');

    fireEvent.change(input, { target: { value: 'l' } });
    fireEvent.change(input, { target: { value: 'lo' } });
    fireEvent.change(input, { target: { value: 'log' } });
    fireEvent.change(input, { target: { value: 'login' } });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith('search', 'login');
    });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  // TS-2 (S-066/CA-1): el input debe inicializarse desde filters.search, no filters.tag
  it('TS-2: el input de búsqueda se inicializa desde filters.search, no desde filters.tag (S-066)', () => {
    render(
      <RequirementFilters
        filters={{ ...filters, search: 'incidencia', tag: 'cliente:acme' }}
        onChange={onChange}
      />,
      { wrapper: createWrapper() }
    );

    const input = screen.getByPlaceholderText('Buscar requisito') as HTMLInputElement;
    expect(input.value).toBe('incidencia');
  });

  it('el input permite escribir varios caracteres seguidos sin perder el valor', () => {
    render(<RequirementFilters filters={filters} onChange={onChange} />, {
      wrapper: createWrapper(),
    });
    const input = screen.getByPlaceholderText('Buscar requisito') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'l' } });
    fireEvent.change(input, { target: { value: 'lo' } });
    fireEvent.change(input, { target: { value: 'log' } });

    expect(input.value).toBe('log');
  });

  // Fix: el selector de Proyecto listaba en el orden crudo de useProjects (desordenado) y no
  // permitía buscar. Debe ordenar alfabéticamente y ser buscable, igual que en CreateRequirementForm.
  it('el selector de Proyecto lista las opciones ordenadas alfabéticamente por nombre', () => {
    render(<RequirementFilters filters={filters} onChange={onChange} />, {
      wrapper: createWrapper(),
    });

    const container = getProjectSelectContainer();
    const input = within(container).getByRole('combobox');
    fireEvent.keyDown(input, { key: 'ArrowDown' });

    const options = screen.getAllByRole('option').map((el) => el.textContent);
    expect(options).toEqual(['Todos los proyectos', 'Alfa', 'Beta', 'Zeta']);
  });

  it('el selector de Proyecto solo trae proyectos en estado analisis o activo', () => {
    render(<RequirementFilters filters={filters} onChange={onChange} />, {
      wrapper: createWrapper(),
    });

    expect(useProjectsModule.useProjects).toHaveBeenCalledWith({
      filters: { state: 'analisis,activo' },
    });
  });

  it('el selector de Proyecto permite buscar por texto (no es isSearchable=false)', () => {
    render(<RequirementFilters filters={filters} onChange={onChange} />, {
      wrapper: createWrapper(),
    });

    const container = getProjectSelectContainer();
    const input = within(container).getByRole('combobox');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.change(input, { target: { value: 'Bet' } });

    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.queryByText('Alfa')).not.toBeInTheDocument();
    expect(screen.queryByText('Zeta')).not.toBeInTheDocument();
  });

  // Regresión: al cambiar de página, el Suspense padre remonta RequirementFilters con
  // filters.search ya definido; eso no debe disparar onChange('search', ...) y pisar "page"
  it('remontar con filters.search ya definido no dispara onChange espontáneo (regresión paginado)', async () => {
    const remountOnChange = vi.fn();
    const { unmount } = render(
      <RequirementFilters
        filters={{ ...filters, page: 1, search: 'login' }}
        onChange={remountOnChange}
      />,
      { wrapper: createWrapper() }
    );
    unmount();

    render(
      <RequirementFilters
        filters={{ ...filters, page: 2, search: 'login' }}
        onChange={remountOnChange}
      />,
      { wrapper: createWrapper() }
    );

    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(remountOnChange).not.toHaveBeenCalled();
  });
});
