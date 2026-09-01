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

  // Actualizado por S-041: InputMultipleSelect renderiza el label en MAYÚSCULAS ("ESTADO"), a
  // diferencia de los otros filtros. Se verifica por texto insensible a mayúsculas para no
  // acoplar el test al case.
  it('muestra label "Estado"', () => {
    render(<RequirementFilters filters={filters} onChange={onChange} />, {
      wrapper: createWrapper(),
    });
    expect(screen.getByText(/^estado$/i)).toBeInTheDocument();
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

  // TS-4 (S-041/CA-5): el filtro renderiza un chip por cada estado del CSV recibido
  it('TS-4: renderiza un chip por cada estado del CSV recibido (S-041)', () => {
    render(
      <RequirementFilters
        filters={{ ...filters, state: 'desarrollo,revision' }}
        onChange={onChange}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Desarrollo')).toBeInTheDocument();
    expect(screen.getByText('Revisión')).toBeInTheDocument();
    expect(screen.queryByText('Análisis')).not.toBeInTheDocument();
    expect(screen.queryByText('Resuelto')).not.toBeInTheDocument();
  });

  // TS-5 (S-041/CA-1): el filtro renderiza los cuatro chips del default
  it('TS-5: renderiza los cuatro chips del default (S-041)', () => {
    render(
      <RequirementFilters
        filters={{ ...filters, state: 'planificacion,en_cola,desarrollo,revision' }}
        onChange={onChange}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Planificación')).toBeInTheDocument();
    expect(screen.getByText('En cola')).toBeInTheDocument();
    expect(screen.getByText('Desarrollo')).toBeInTheDocument();
    expect(screen.getByText('Revisión')).toBeInTheDocument();
    expect(screen.queryByText('Cancelado')).not.toBeInTheDocument();
  });

  function getStateSelectContainer(): HTMLElement {
    return screen.getByText(/^estado$/i).closest('div') as HTMLElement;
  }

  // TS-6 (S-041/CA-4): con state='all' el control queda sin chips y muestra el placeholder
  it('TS-6: con state="all" no hay chips y se ve el placeholder "Todos los estados" (S-041)', () => {
    render(<RequirementFilters filters={{ ...filters, state: 'all' }} onChange={onChange} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText('Todos los estados')).toBeInTheDocument();
    expect(screen.queryByText('Planificación')).not.toBeInTheDocument();
  });

  // TS-7 (S-041/CA-4): la opción "Todos los estados" ya no existe en la lista de opciones.
  // Nota: react-select con isMulti excluye del menú la opción ya seleccionada ("Desarrollo"),
  // así que con un estado elegido el menú muestra las 6 restantes, no las 7 completas.
  it('TS-7: la opción "Todos los estados" no está en el desplegable (S-041)', () => {
    render(
      <RequirementFilters filters={{ ...filters, state: 'desarrollo' }} onChange={onChange} />,
      { wrapper: createWrapper() }
    );

    const container = getStateSelectContainer();
    const input = within(container).getByRole('combobox');
    fireEvent.keyDown(input, { key: 'ArrowDown' });

    const options = screen.getAllByRole('option').map((el) => el.textContent);
    expect(options).not.toContain('Todos los estados');
    expect(options).toHaveLength(6);
  });

  // TS-8 (S-041/CA-2): las opciones se listan en el orden del enum, no alfabético
  it('TS-8: las opciones se listan en el orden del enum requirement_state (S-041)', () => {
    render(<RequirementFilters filters={{ ...filters, state: 'all' }} onChange={onChange} />, {
      wrapper: createWrapper(),
    });

    const container = getStateSelectContainer();
    const input = within(container).getByRole('combobox');
    fireEvent.keyDown(input, { key: 'ArrowDown' });

    const options = screen.getAllByRole('option').map((el) => el.textContent);
    expect(options).toEqual([
      'Análisis',
      'Planificación',
      'En cola',
      'Desarrollo',
      'Revisión',
      'Resuelto',
      'Cancelado',
    ]);
  });

  // TS-9 (S-041/CA-2): agregar un estado emite el CSV completo por onChange
  it('TS-9: agregar un estado emite el CSV completo por onChange (S-041)', () => {
    render(
      <RequirementFilters
        filters={{ ...filters, state: 'planificacion,en_cola,desarrollo,revision' }}
        onChange={onChange}
      />,
      { wrapper: createWrapper() }
    );

    const container = getStateSelectContainer();
    const input = within(container).getByRole('combobox');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.click(screen.getByText('Análisis'));

    expect(onChange).toHaveBeenCalledWith(
      'state',
      'planificacion,en_cola,desarrollo,revision,analisis'
    );
  });

  // TS-10 (S-041/CA-3): quitar un estado emite el CSV sin ese estado
  it('TS-10: quitar un estado emite el CSV sin ese estado (S-041)', () => {
    render(
      <RequirementFilters
        filters={{ ...filters, state: 'planificacion,en_cola,desarrollo,revision' }}
        onChange={onChange}
      />,
      { wrapper: createWrapper() }
    );

    const removeButton = screen.getByLabelText('Remove Revisión');
    fireEvent.click(removeButton);

    expect(onChange).toHaveBeenCalledWith('state', 'planificacion,en_cola,desarrollo');
  });

  // TS-11 (S-041/CA-4): quitar el último estado emite el sentinel 'all', no un string vacío
  it('TS-11: quitar el último estado emite el sentinel "all" (S-041)', () => {
    render(<RequirementFilters filters={{ ...filters, state: 'revision' }} onChange={onChange} />, {
      wrapper: createWrapper(),
    });

    const removeButton = screen.getByLabelText('Remove Revisión');
    fireEvent.click(removeButton);

    expect(onChange).toHaveBeenCalledWith('state', 'all');
  });

  // TS-20 (S-041/CA-1): el label del filtro de estado queda asociado a su control
  it('TS-20: el label del filtro de estado tiene htmlFor asociado a su control (S-041)', () => {
    render(
      <RequirementFilters filters={{ ...filters, state: 'desarrollo' }} onChange={onChange} />,
      { wrapper: createWrapper() }
    );

    const label = screen.getByText(/^estado$/i);
    const htmlFor = label.getAttribute('for');
    expect(htmlFor).toBeTruthy();
    const control = document.getElementById(htmlFor as string);
    expect(control).toBeTruthy();
  });

  // TS-21 (S-041/CA-5): remontar el filtro con state ya definido no dispara un onChange espontáneo
  it('TS-21: remontar con filters.state ya definido no dispara onChange espontáneo (S-041)', async () => {
    const remountOnChange = vi.fn();
    const { unmount } = render(
      <RequirementFilters
        filters={{ ...filters, state: 'desarrollo,revision', search: 'login', page: 1 }}
        onChange={remountOnChange}
      />,
      { wrapper: createWrapper() }
    );
    unmount();

    render(
      <RequirementFilters
        filters={{ ...filters, state: 'desarrollo,revision', search: 'login', page: 2 }}
        onChange={remountOnChange}
      />,
      { wrapper: createWrapper() }
    );

    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(remountOnChange).not.toHaveBeenCalled();
  });
});
