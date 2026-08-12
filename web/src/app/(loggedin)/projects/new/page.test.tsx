import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { toast } from 'react-toastify';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Form from './page';

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null }),
}));

vi.mock('@/features/projects', () => ({
  useClients: () => ({ data: [{ id: 1, name: 'Cliente A' }], isLoading: false }),
  useCreateProject: () => ({
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
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('ProjectNewForm — diseño S-050', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TS-2: contiene dos cards con sus títulos', () => {
    render(<Form />, { wrapper: TestWrapper });
    expect(screen.getByText('Información general')).toBeInTheDocument();
    expect(screen.getByText('Propiedades')).toBeInTheDocument();
  });

  it('TS-3: campos de información general presentes en el formulario', () => {
    render(<Form />, { wrapper: TestWrapper });
    expect(screen.getByLabelText(/nombre/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/código/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/descripción/i)).toBeInTheDocument();
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

  it('TS-8: agregar propiedad dinámica', async () => {
    render(<Form />, { wrapper: TestWrapper });
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

  it('TS-9: eliminar propiedad dinámica', async () => {
    render(<Form />, { wrapper: TestWrapper });
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
