import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Form from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
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

vi.mock('@/features/projects', () => ({
  useClients: () => ({ data: [{ id: 1, name: 'Cliente A' }], isLoading: false }),
  useProject: () => ({ data: mockProject, isLoading: false }),
  useUpdateProject: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

vi.mock('@/shared/components/layout', () => ({
  PageLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/shared/components/ui', () => ({
  Button: ({ label, onClick }: { label: string; onClick: () => void }) => (
    <button type="button" onClick={onClick}>
      {label}
    </button>
  ),
  InputDate: ({
    label,
    code,
    value,
    onChange,
    required,
  }: {
    label: string;
    code: string;
    value: Date | null;
    onChange: (v: string) => void;
    required?: boolean;
  }) => (
    <div>
      <label htmlFor={code}>{label}</label>
      <input
        id={code}
        type="date"
        value={
          value instanceof Date && !isNaN(value.getTime()) ? value.toISOString().split('T')[0] : ''
        }
        onChange={(e) => onChange(e.target.value)}
        required={required}
      />
    </div>
  ),
  InputSelect: ({
    label,
    code,
    value,
    onChange,
    options,
    required,
    placeholder,
  }: {
    label: string;
    code: string;
    value: string;
    onChange: (v: string) => void;
    options?: { label: string; value: string }[];
    required?: boolean;
    placeholder?: string;
  }) => (
    <div>
      <label htmlFor={code}>{label}</label>
      <select
        id={code}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      >
        <option value="">{placeholder}</option>
        {options?.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  ),
  InputText: ({
    label,
    code,
    value,
    onChange,
    placeholder,
    required,
    disabled,
  }: {
    label: string;
    code: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    required?: boolean;
    disabled?: boolean;
  }) => (
    <div>
      <label htmlFor={code}>{label}</label>
      <input
        id={code}
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
      />
    </div>
  ),
  InputTextarea: ({
    label,
    code,
    value,
    onChange,
    placeholder,
    required,
  }: {
    label: string;
    code: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    required?: boolean;
  }) => (
    <div>
      <label htmlFor={code}>{label}</label>
      <textarea
        id={code}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
      />
    </div>
  ),
  Loader: ({ label }: { label: string }) => <div>{label}</div>,
  SectionCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

function TestWrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <React.Suspense fallback={<div>Loading...</div>}>{children}</React.Suspense>
    </QueryClientProvider>
  );
}

describe('ProjectEditForm — diseño S-050', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TS-2 (edit): contiene dos cards con sus títulos', async () => {
    render(<Form params={Promise.resolve({ id: 1 })} />, { wrapper: TestWrapper });
    await waitFor(
      () => {
        expect(screen.getByText('Información general')).toBeInTheDocument();
        expect(screen.getByText('Propiedades')).toBeInTheDocument();
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

  it('TS-3 (edit): campo Estado presente en información general', async () => {
    render(<Form params={Promise.resolve({ id: 1 })} />, { wrapper: TestWrapper });
    await waitFor(
      () => {
        expect(screen.getByLabelText(/estado/i)).toBeInTheDocument();
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

  it('TS-8 (edit): agregar propiedad dinámica', async () => {
    render(<Form params={Promise.resolve({ id: 1 })} />, { wrapper: TestWrapper });
    await waitFor(
      () => {
        expect(screen.getByText('Información general')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
    const claveInput = screen.getByPlaceholderText(/clave/i);
    const valorInput = screen.getByPlaceholderText(/valor/i);
    fireEvent.change(claveInput, { target: { value: 'repo' } });
    fireEvent.change(valorInput, { target: { value: 'https://github.com/x' } });
    const addBtn = screen.getByRole('button', { name: /agregar/i });
    fireEvent.click(addBtn);
    await waitFor(() => {
      expect(screen.getByText('repo')).toBeInTheDocument();
    });
  });

  it('TS-9 (edit): eliminar propiedad dinámica', async () => {
    render(<Form params={Promise.resolve({ id: 1 })} />, { wrapper: TestWrapper });
    await waitFor(
      () => {
        expect(screen.getByText('Información general')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
    const claveInput = screen.getByPlaceholderText(/clave/i);
    fireEvent.change(claveInput, { target: { value: 'repo' } });
    const addBtn = screen.getByRole('button', { name: /agregar/i });
    fireEvent.click(addBtn);
    await waitFor(() => {
      expect(screen.getByText('repo')).toBeInTheDocument();
    });
    const deleteBtn = screen.getByRole('button', { name: /eliminar link repo/i });
    fireEvent.click(deleteBtn);
    await waitFor(() => {
      expect(screen.queryByText('repo')).not.toBeInTheDocument();
    });
  });
});
