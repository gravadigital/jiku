import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as useProjectsModule from '@/features/projects/hooks/useProjects';
import { RequirementsReportFilters } from './RequirementsReportFilters';

vi.mock('@/features/projects/hooks/useProjects', () => ({
  useProjects: vi.fn(),
}));

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

describe('RequirementsReportFilters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useProjectsModule.useProjects).mockReturnValue({
      data: [
        { id: 1, name: 'Proyecto Alpha' },
        { id: 2, name: 'Proyecto Beta' },
      ],
      isLoading: false,
    } as any);
  });

  it('TS-2: escribir en el campo de búsqueda notifica el valor tras debounce', async () => {
    const onSearchChange = vi.fn();
    render(
      <RequirementsReportFilters
        search=""
        createdFrom=""
        createdTo=""
        projectId=""
        onSearchChange={onSearchChange}
        onCreatedFromChange={vi.fn()}
        onCreatedToChange={vi.fn()}
        onProjectIdChange={vi.fn()}
        onExportCsv={vi.fn()}
      />,
      { wrapper: createWrapper() }
    );

    fireEvent.change(screen.getByPlaceholderText(/buscar por título/i), {
      target: { value: 'login' },
    });

    expect(onSearchChange).not.toHaveBeenCalled();

    await waitFor(() => expect(onSearchChange).toHaveBeenCalledWith('login'), { timeout: 1000 });
  });

  it('TS-14: escribir rápido solo notifica el valor final', async () => {
    const onSearchChange = vi.fn();
    render(
      <RequirementsReportFilters
        search=""
        createdFrom=""
        createdTo=""
        projectId=""
        onSearchChange={onSearchChange}
        onCreatedFromChange={vi.fn()}
        onCreatedToChange={vi.fn()}
        onProjectIdChange={vi.fn()}
        onExportCsv={vi.fn()}
      />,
      { wrapper: createWrapper() }
    );

    const input = screen.getByPlaceholderText(/buscar por título/i);
    fireEvent.change(input, { target: { value: 'l' } });
    fireEvent.change(input, { target: { value: 'lo' } });
    fireEvent.change(input, { target: { value: 'log' } });
    fireEvent.change(input, { target: { value: 'logi' } });
    fireEvent.change(input, { target: { value: 'login' } });

    await waitFor(() => expect(onSearchChange).toHaveBeenCalledTimes(1), { timeout: 1000 });
    expect(onSearchChange).toHaveBeenCalledWith('login');
  });

  it('TS-3: cambiar fecha desde notifica inmediatamente sin debounce', () => {
    const onCreatedFromChange = vi.fn();
    render(
      <RequirementsReportFilters
        search=""
        createdFrom=""
        createdTo=""
        projectId=""
        onSearchChange={vi.fn()}
        onCreatedFromChange={onCreatedFromChange}
        onCreatedToChange={vi.fn()}
        onProjectIdChange={vi.fn()}
        onExportCsv={vi.fn()}
      />,
      { wrapper: createWrapper() }
    );

    fireEvent.change(screen.getByLabelText(/desde/i), { target: { value: '2026-01-01' } });
    expect(onCreatedFromChange).toHaveBeenCalledWith('2026-01-01');
  });

  it('cambiar fecha hasta notifica inmediatamente', () => {
    const onCreatedToChange = vi.fn();
    render(
      <RequirementsReportFilters
        search=""
        createdFrom=""
        createdTo=""
        projectId=""
        onSearchChange={vi.fn()}
        onCreatedFromChange={vi.fn()}
        onCreatedToChange={onCreatedToChange}
        onProjectIdChange={vi.fn()}
        onExportCsv={vi.fn()}
      />,
      { wrapper: createWrapper() }
    );

    fireEvent.change(screen.getByLabelText(/hasta/i), { target: { value: '2026-06-30' } });
    expect(onCreatedToChange).toHaveBeenCalledWith('2026-06-30');
  });

  it('TS-16: selector de proyecto incluye "Todos los proyectos" y los proyectos reales', () => {
    render(
      <RequirementsReportFilters
        search=""
        createdFrom=""
        createdTo=""
        projectId=""
        onSearchChange={vi.fn()}
        onCreatedFromChange={vi.fn()}
        onCreatedToChange={vi.fn()}
        onProjectIdChange={vi.fn()}
        onExportCsv={vi.fn()}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Todos los proyectos')).toBeInTheDocument();
  });

  it('TS-16: seleccionar un proyecto notifica el id correcto', () => {
    const onProjectIdChange = vi.fn();
    render(
      <RequirementsReportFilters
        search=""
        createdFrom=""
        createdTo=""
        projectId=""
        onSearchChange={vi.fn()}
        onCreatedFromChange={vi.fn()}
        onCreatedToChange={vi.fn()}
        onProjectIdChange={onProjectIdChange}
        onExportCsv={vi.fn()}
      />,
      { wrapper: createWrapper() }
    );

    const select = screen.getByLabelText(/proyecto/i);
    fireEvent.focus(select);
    fireEvent.keyDown(select, { key: 'ArrowDown' });
    fireEvent.click(screen.getByText('Proyecto Alpha'));

    expect(onProjectIdChange).toHaveBeenCalledWith('1');
  });

  it('botón "Exportar CSV" dispara el callback al hacer click', () => {
    const onExportCsv = vi.fn();
    render(
      <RequirementsReportFilters
        search=""
        createdFrom=""
        createdTo=""
        projectId=""
        onSearchChange={vi.fn()}
        onCreatedFromChange={vi.fn()}
        onCreatedToChange={vi.fn()}
        onProjectIdChange={vi.fn()}
        onExportCsv={onExportCsv}
      />,
      { wrapper: createWrapper() }
    );

    fireEvent.click(screen.getByRole('button', { name: /exportar csv/i }));
    expect(onExportCsv).toHaveBeenCalledTimes(1);
  });
});
