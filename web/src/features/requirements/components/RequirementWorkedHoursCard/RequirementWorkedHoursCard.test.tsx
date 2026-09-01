import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useRequirementWorkedHours } from '../../hooks/useRequirementWorkedHours';
import { RequirementWorkedHoursCard } from './RequirementWorkedHoursCard';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));

vi.mock('next/image', () => ({
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

vi.mock('../../hooks/useRequirementWorkedHours', () => ({
  useRequirementWorkedHours: vi.fn(),
}));

describe('RequirementWorkedHoursCard — S-045', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // TS-12 (CA-4): total y una fila por persona, en el orden que llega (Ana antes que Beto)
  it('TS-12: muestra el total y una fila por persona, con Ana antes que Beto (CA-4)', () => {
    vi.mocked(useRequirementWorkedHours).mockReturnValue({
      data: {
        requirementId: 12,
        totalMinutes: 300,
        byPerson: [
          { personId: 7, firstName: 'Ana', lastName: 'García', minutes: 180 },
          { personId: 9, firstName: 'Beto', lastName: 'Ruiz', minutes: 120 },
        ],
      },
      isLoading: false,
      isError: false,
    } as any);

    render(<RequirementWorkedHoursCard reqid={12} />);

    expect(screen.getByText('5h 0m')).toBeInTheDocument();
    const names = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(names[0]).toContain('Ana García');
    expect(names[0]).toContain('3h 0m');
    expect(names[1]).toContain('Beto Ruiz');
    expect(names[1]).toContain('2h 0m');
  });

  // TS-13 (CA-4): el componente no reordena el desglose que llega de la api
  it('TS-13: no reordena un byPerson deliberadamente desordenado (CA-4)', () => {
    vi.mocked(useRequirementWorkedHours).mockReturnValue({
      data: {
        requirementId: 12,
        totalMinutes: 300,
        byPerson: [
          { personId: 9, firstName: 'Beto', lastName: 'Ruiz', minutes: 120 },
          { personId: 7, firstName: 'Ana', lastName: 'García', minutes: 180 },
        ],
      },
      isLoading: false,
      isError: false,
    } as any);

    render(<RequirementWorkedHoursCard reqid={12} />);

    const names = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(names[0]).toContain('Beto Ruiz');
    expect(names[1]).toContain('Ana García');
  });

  // TS-14 (CA-5): sin horas muestra "Sin horas cargadas" y no el total ni "0h 0m"
  it('TS-14: sin horas muestra "Sin horas cargadas" y no el total (CA-5)', () => {
    vi.mocked(useRequirementWorkedHours).mockReturnValue({
      data: { requirementId: 12, totalMinutes: 0, byPerson: [] },
      isLoading: false,
      isError: false,
    } as any);

    render(<RequirementWorkedHoursCard reqid={12} />);

    expect(screen.getByText('Sin horas cargadas')).toBeInTheDocument();
    expect(screen.queryByText('0h 0m')).not.toBeInTheDocument();
  });

  // TS-15 (CA-8): cargando muestra el loader con su label
  it('TS-15: mientras carga muestra el loader "Cargando horas..." (CA-8)', () => {
    vi.mocked(useRequirementWorkedHours).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as any);

    render(<RequirementWorkedHoursCard reqid={12} />);

    expect(screen.getByText('Cargando horas...')).toBeInTheDocument();
    expect(screen.queryByText('Sin horas cargadas')).not.toBeInTheDocument();
  });

  // TS-16 (CA-8): en error muestra "No se pudieron cargar las horas" y no el empty
  it('TS-16: en error muestra "No se pudieron cargar las horas" y no el empty (CA-8)', () => {
    vi.mocked(useRequirementWorkedHours).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    } as any);

    render(<RequirementWorkedHoursCard reqid={12} />);

    expect(screen.getByText('No se pudieron cargar las horas')).toBeInTheDocument();
    expect(screen.queryByText('Sin horas cargadas')).not.toBeInTheDocument();
  });
});
