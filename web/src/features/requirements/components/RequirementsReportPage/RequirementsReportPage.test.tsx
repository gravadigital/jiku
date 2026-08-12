import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as useRequirementsReportModule from '../../hooks/useRequirementsReport';
import * as csvModule from '../../utils/requirementsReportCsv';
import { RequirementsReportPage } from './RequirementsReportPage';

vi.mock('../../hooks/useRequirementsReport', () => ({
  useRequirementsReport: vi.fn(),
}));

vi.mock('../RequirementsReportFilters', () => ({
  RequirementsReportFilters: (props: {
    search: string;
    createdFrom: string;
    createdTo: string;
    projectId: string;
    onSearchChange: (v: string) => void;
    onCreatedFromChange: (v: string) => void;
    onCreatedToChange: (v: string) => void;
    onProjectIdChange: (v: string) => void;
    onExportCsv: () => void;
  }) => (
    <div>
      <input
        aria-label="search"
        value={props.search}
        onChange={(e) => props.onSearchChange(e.target.value)}
      />
      <input
        aria-label="createdFrom"
        value={props.createdFrom}
        onChange={(e) => props.onCreatedFromChange(e.target.value)}
      />
      <input
        aria-label="createdTo"
        value={props.createdTo}
        onChange={(e) => props.onCreatedToChange(e.target.value)}
      />
      <input
        aria-label="projectId"
        value={props.projectId}
        onChange={(e) => props.onProjectIdChange(e.target.value)}
      />
      <button type="button" onClick={props.onExportCsv}>
        Exportar CSV
      </button>
    </div>
  ),
}));

vi.mock('../RequirementsReportTable', () => ({
  RequirementsReportTable: ({ items }: { items: any[] }) => (
    <div data-testid="report-table">{items.length} items</div>
  ),
}));

const mockItems = [
  {
    id: 1,
    title: 'Req A',
    type: 'incidencia',
    state: 'resuelto',
    createdBy: 'a@a.com',
    createdAt: '2026-06-01',
    inProgressAt: null,
    finishedAt: null,
    totalMinutes: 90,
    resolutionType: 'error_interno',
    resolutionConclusion: null,
    resolutionComment: null,
    project: null,
  },
];

describe('RequirementsReportPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TS-1: carga inicial sin filtros muestra los items del hook', () => {
    vi.mocked(useRequirementsReportModule.useRequirementsReport).mockReturnValue({
      data: mockItems,
      isLoading: false,
      isError: false,
    } as any);

    render(<RequirementsReportPage />);

    expect(useRequirementsReportModule.useRequirementsReport).toHaveBeenCalledWith({
      search: '',
      createdFrom: '',
      createdTo: '',
      projectId: '',
    });
    expect(screen.getByTestId('report-table')).toHaveTextContent('1 items');
  });

  it('TS-4/TS-16: combina todos los filtros en una sola llamada al hook', () => {
    vi.mocked(useRequirementsReportModule.useRequirementsReport).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as any);

    render(<RequirementsReportPage />);

    fireEvent.change(screen.getByLabelText('search'), { target: { value: 'login' } });
    fireEvent.change(screen.getByLabelText('createdFrom'), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText('createdTo'), { target: { value: '2026-06-30' } });
    fireEvent.change(screen.getByLabelText('projectId'), { target: { value: '1' } });

    expect(useRequirementsReportModule.useRequirementsReport).toHaveBeenLastCalledWith({
      search: 'login',
      createdFrom: '2026-01-01',
      createdTo: '2026-06-30',
      projectId: '1',
    });
  });

  it('TS-6: click en Exportar CSV llama a downloadCsv con el contenido generado', () => {
    vi.mocked(useRequirementsReportModule.useRequirementsReport).mockReturnValue({
      data: mockItems,
      isLoading: false,
      isError: false,
    } as any);
    const downloadCsvSpy = vi.spyOn(csvModule, 'downloadCsv').mockImplementation(() => {});

    render(<RequirementsReportPage />);

    fireEvent.click(screen.getByRole('button', { name: /exportar csv/i }));

    expect(downloadCsvSpy).toHaveBeenCalledWith(expect.any(String), 'reporte-requisitos.csv');
  });

  it('TS-15: muestra estado de error cuando la request falla', () => {
    vi.mocked(useRequirementsReportModule.useRequirementsReport).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    } as any);

    render(<RequirementsReportPage />);

    expect(screen.queryByTestId('report-table')).not.toBeInTheDocument();
    expect(screen.getByText(/error/i)).toBeInTheDocument();
  });
});
