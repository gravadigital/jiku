import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Form from './page';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('next-auth', () => ({
  default: vi.fn(() => ({ handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() })),
}));
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null }),
}));

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    use: (p: unknown) => {
      if (p && typeof (p as Promise<unknown>).then === 'function') {
        return { id: 1 };
      }
      return actual.use(p as Parameters<typeof actual.use>[0]);
    },
  };
});

const mockProject = {
  id: 1,
  name: 'Proyecto Test',
  code: 'PT',
  description: 'Descripción del proyecto',
  initDate: new Date('2026-01-01'),
  endDate: new Date('2026-12-31'),
  status: 'activo',
  type: 'interno',
  client: { id: 1, name: 'Cliente A' },
  keyValuePairs: {
    board_de_tareas: 'https://board.example.com',
    diseño: '',
    documentacion: 'https://docs.example.com',
    mattermost_group_name: 'grava-team',
  },
};

const updateProjectMutate = vi.fn();

vi.mock('@/features/projects', () => ({
  useClients: () => ({ data: [{ id: 1, name: 'Cliente A' }], isLoading: false }),
  useProject: () => ({ data: mockProject, isLoading: false }),
  useUpdateProject: () => ({
    mutate: updateProjectMutate,
    isPending: false,
  }),
}));

vi.mock('@/shared/components/layout', () => ({
  PageLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

function TestWrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <React.Suspense fallback={<div>Loading...</div>}>{children}</React.Suspense>
    </QueryClientProvider>
  );
}

describe('ProjectEditForm — migración al Design System (S-056)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TS-2 (edit): contiene dos cards con sus títulos', async () => {
    render(<Form params={Promise.resolve({ id: 1 })} />, { wrapper: TestWrapper });
    await waitFor(
      () => {
        expect(screen.getByRole('heading', { name: 'Información general' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Propiedades' })).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it('TS-6: formulario pre-populado con datos del proyecto', async () => {
    render(<Form params={Promise.resolve({ id: 1 })} />, { wrapper: TestWrapper });
    await waitFor(
      () => {
        expect(screen.getByDisplayValue('Proyecto Test')).toBeInTheDocument();
        expect(screen.getByDisplayValue('PT')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Descripción del proyecto')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  // TS-16: la edición migra sus tres selects conservando el valor actual del proyecto
  it('TS-16: migra los tres selects (Cliente, Tipo, Estado) mostrando el valor actual', async () => {
    render(<Form params={Promise.resolve({ id: 1 })} />, { wrapper: TestWrapper });

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Cliente' })).toHaveTextContent('Cliente A');
    });
    expect(screen.getByRole('combobox', { name: 'Tipo' })).toHaveTextContent('Interno');
    expect(screen.getByRole('combobox', { name: 'Estado' })).toHaveTextContent('Activo');
  });

  it('TS-3 (edit): campo Estado presente en información general', async () => {
    render(<Form params={Promise.resolve({ id: 1 })} />, { wrapper: TestWrapper });
    await waitFor(
      () => {
        expect(screen.getByRole('combobox', { name: 'Estado' })).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it('TS-1 (edit): labels sin uppercase', async () => {
    render(<Form params={Promise.resolve({ id: 1 })} />, { wrapper: TestWrapper });
    await waitFor(
      () => {
        const nombreLabel = Array.from(document.querySelectorAll('label')).find((el) =>
          el.textContent?.toLowerCase().includes('nombre')
        );
        expect(nombreLabel).toBeTruthy();
        expect(nombreLabel?.textContent).toContain('Nombre');
        expect(nombreLabel?.textContent).not.toBe(nombreLabel?.textContent?.toUpperCase());
      },
      { timeout: 3000 }
    );
  });

  it('TS-8 (edit): agregar propiedad dinámica no dispara el submit', async () => {
    render(<Form params={Promise.resolve({ id: 1 })} />, { wrapper: TestWrapper });
    await waitFor(
      () => {
        expect(screen.getByRole('heading', { name: 'Información general' })).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
    const claveInput = screen.getByLabelText('Clave');
    const valorInput = screen.getByLabelText('Valor');
    fireEvent.change(claveInput, { target: { value: 'repo' } });
    fireEvent.change(valorInput, { target: { value: 'https://github.com/x' } });
    const addBtn = screen.getByRole('button', { name: /agregar/i });
    fireEvent.click(addBtn);
    await waitFor(() => {
      expect(screen.getByLabelText('repo')).toBeInTheDocument();
    });
    expect(updateProjectMutate).not.toHaveBeenCalled();
  });

  it('TS-9 (edit): eliminar propiedad dinámica no dispara el submit', async () => {
    render(<Form params={Promise.resolve({ id: 1 })} />, { wrapper: TestWrapper });
    await waitFor(
      () => {
        expect(screen.getByRole('heading', { name: 'Información general' })).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
    const claveInput = screen.getByLabelText('Clave');
    fireEvent.change(claveInput, { target: { value: 'repo' } });
    const addBtn = screen.getByRole('button', { name: /agregar/i });
    fireEvent.click(addBtn);
    await waitFor(() => {
      expect(screen.getByLabelText('repo')).toBeInTheDocument();
    });
    const deleteBtn = screen.getByRole('button', { name: /eliminar repo/i });
    fireEvent.click(deleteBtn);
    await waitFor(() => {
      expect(screen.queryByLabelText('repo')).not.toBeInTheDocument();
    });
    expect(updateProjectMutate).not.toHaveBeenCalled();
  });

  // TS-22: TS-22 no existe en este alcance; se agrega verificación de que no queda
  // rastro de selectStyles ni react-select en el árbol renderizado.
  it('TS-22: no queda rastro de selectStyles ni react-select en el árbol renderizado', async () => {
    const { container } = render(<Form params={Promise.resolve({ id: 1 })} />, {
      wrapper: TestWrapper,
    });
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Cliente' })).toBeInTheDocument();
    });
    expect(container.querySelector('[class*="css-"]')).toBeNull();
    expect(container.querySelector('[class*="react-select"]')).toBeNull();
  });
});
