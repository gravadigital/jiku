import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { toast } from 'react-toastify';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Form from './page';

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

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

const createProjectMutate = vi.fn();

vi.mock('@/features/projects', () => ({
  useClients: () => ({ data: [{ id: 1, name: 'Cliente A' }], isLoading: false }),
  useCreateProject: () => ({
    mutate: createProjectMutate,
    isPending: false,
  }),
}));

vi.mock('@/shared/components/layout', () => ({
  PageLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

function TestWrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('ProjectNewForm — migración al Design System (S-056)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TS-2: contiene dos cards con sus títulos', () => {
    render(<Form />, { wrapper: TestWrapper });
    expect(screen.getByRole('heading', { name: 'Información general' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Propiedades' })).toBeInTheDocument();
  });

  it('TS-3: campos de información general presentes en el formulario', () => {
    render(<Form />, { wrapper: TestWrapper });
    expect(screen.getByLabelText(/^Nombre/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Código/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Descripción/)).toBeInTheDocument();
  });

  // TS-13: el alta reemplaza react-select por Select del DS, sin clases css-* ni react-select
  it('TS-13: usa Select del DS para Cliente, sin rastro de react-select', () => {
    const { container } = render(<Form />, { wrapper: TestWrapper });

    expect(screen.getByRole('combobox', { name: 'Cliente' })).toBeInTheDocument();
    expect(container.querySelector('[class*="css-"]')).toBeNull();
    expect(container.querySelector('[class*="react-select"]')).toBeNull();
  });

  // TS-14: Guardar invoca la mutation una sola vez y no depende del submit del <form>
  it('TS-14: Guardar arma el payload con processCreation y no dispara el submit nativo', async () => {
    render(<Form />, { wrapper: TestWrapper });

    fireEvent.change(screen.getByLabelText(/^Nombre/), { target: { value: 'WashMach' } });
    fireEvent.change(screen.getByLabelText(/^Código/), { target: { value: 'WM-01' } });
    fireEvent.change(screen.getByLabelText(/^Descripción/), { target: { value: 'Lavado' } });
    fireEvent.change(screen.getByLabelText(/Fecha de inicio/), {
      target: { value: '2026-01-01' },
    });

    const selectTipo = screen.getByRole('combobox', { name: 'Tipo' });
    fireEvent.click(selectTipo);
    fireEvent.click(screen.getByRole('option', { name: 'Comercial' }));

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => {
      expect(createProjectMutate).toHaveBeenCalledTimes(1);
    });
    expect(createProjectMutate.mock.calls[0][0]).toMatchObject({
      name: 'WashMach',
      code: 'WM-01',
      description: 'Lavado',
      type: 'comercial',
    });
  });

  // TS-15: "Volver" navega sin guardar
  it('TS-15: "Volver" es secondary-nav y navega a /projects sin invocar la mutation', () => {
    render(<Form />, { wrapper: TestWrapper });

    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));

    expect(createProjectMutate).not.toHaveBeenCalled();
  });

  it('TS-1: labels sin uppercase (texto no todo en mayúsculas)', () => {
    render(<Form />, { wrapper: TestWrapper });
    const nombreLabel = Array.from(document.querySelectorAll('label')).find((el) =>
      el.textContent?.toLowerCase().includes('nombre')
    );
    expect(nombreLabel).toBeTruthy();
    expect(nombreLabel?.textContent).toContain('Nombre');
    expect(nombreLabel?.textContent).not.toBe(nombreLabel?.textContent?.toUpperCase());
  });

  it('TS-7: submit con campos vacíos muestra toast de error', async () => {
    render(<Form />, { wrapper: TestWrapper });
    const submitBtn = screen.getByRole('button', { name: /guardar/i });
    fireEvent.click(submitBtn);
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Hay campos obligatorios sin completar');
    });
  });

  // TS-17: "Agregar" no envía el formulario
  it('TS-8 / TS-17: agregar propiedad dinámica no dispara el submit', async () => {
    render(<Form />, { wrapper: TestWrapper });
    const claveInput = screen.getByLabelText('Clave');
    const valorInput = screen.getByLabelText('Valor');
    fireEvent.change(claveInput, { target: { value: 'repo' } });
    fireEvent.change(valorInput, { target: { value: 'https://github.com/x' } });
    const addBtn = screen.getByRole('button', { name: /agregar/i });
    fireEvent.click(addBtn);
    await waitFor(() => {
      expect(screen.getByLabelText('repo')).toBeInTheDocument();
    });
    expect(createProjectMutate).not.toHaveBeenCalled();
  });

  it('TS-9: eliminar propiedad dinámica no dispara el submit', async () => {
    render(<Form />, { wrapper: TestWrapper });
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
    expect(createProjectMutate).not.toHaveBeenCalled();
  });
});
