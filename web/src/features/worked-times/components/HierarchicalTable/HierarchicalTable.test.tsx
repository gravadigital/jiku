import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { HierarchicalTable } from './HierarchicalTable';
import type { ReportByPerson, ReportByProject } from '../../types/worked-time.types';

vi.mock('@/shared/utils/cn', () => ({
  cn: (...args: unknown[]) =>
    args
      .flatMap((a) =>
        typeof a === 'object' && a !== null
          ? Object.entries(a)
              .filter(([, v]) => v)
              .map(([k]) => k)
          : [a]
      )
      .filter(Boolean)
      .join(' '),
}));

// Objetivo X (id 1) está vinculado al requisito 5 (Login SSO) via objectiveRequirementId.
// El requisito 5 tiene además horas directas (90min).
const byPerson: ReportByPerson[] = [
  {
    personId: 1,
    personFirstName: 'Ivan',
    personLastName: 'Maldonado',
    totalMinutes: 170,
    projects: [
      {
        projectId: 1,
        projectName: 'Verifarma - CheckList',
        projectCode: 'CL',
        totalMinutes: 170,
        objectives: [
          {
            objectiveId: 1,
            objectiveTitle: 'Objetivo X',
            requirementId: null,
            requirementTitle: null,
            objectiveRequirementId: 5,
            objectiveRequirementTitle: 'Login SSO',
            totalMinutes: 60,
          },
          {
            objectiveId: null,
            objectiveTitle: null,
            requirementId: 5,
            requirementTitle: 'Login SSO',
            objectiveRequirementId: null,
            objectiveRequirementTitle: null,
            totalMinutes: 90,
          },
          {
            objectiveId: null,
            objectiveTitle: null,
            requirementId: null,
            requirementTitle: null,
            objectiveRequirementId: null,
            objectiveRequirementTitle: null,
            totalMinutes: 20,
          },
        ],
      },
    ],
  },
];

const byProject: ReportByProject[] = [
  {
    projectId: 1,
    projectName: 'Verifarma - CheckList',
    projectCode: 'CL',
    totalMinutes: 150,
    objectives: [
      {
        objectiveId: 1,
        objectiveTitle: 'Objetivo X',
        requirementId: null,
        requirementTitle: null,
        objectiveRequirementId: 5,
        objectiveRequirementTitle: 'Login SSO',
        totalMinutes: 60,
        persons: [],
      },
      {
        objectiveId: null,
        objectiveTitle: null,
        requirementId: 5,
        requirementTitle: 'Login SSO',
        objectiveRequirementId: null,
        objectiveRequirementTitle: null,
        totalMinutes: 90,
        persons: [
          { personId: 2, personFirstName: 'Ana', personLastName: 'Gomez', totalMinutes: 90 },
        ],
      },
    ],
    persons: [
      { personId: 1, personFirstName: 'Ivan', personLastName: 'Maldonado', totalMinutes: 20 },
    ],
  },
];

describe('HierarchicalTable — agrupación jerárquica por requisito (S-070)', () => {
  it('CA-1/TS-1 (by-person): el nodo "Login SSO" agrupa "Sin tarea" (90min) y "Objetivo X" (60min)', async () => {
    const user = userEvent.setup();
    render(<HierarchicalTable dataByPerson={byPerson} activeView="by-person" />);

    await user.click(screen.getByText('Ivan Maldonado'));
    await user.click(screen.getByText(/Verifarma - CheckList/));

    const reqNode = screen.getByText('Login SSO');
    expect(reqNode).toBeInTheDocument();
    // Total del nodo: 90 (directas) + 60 (tarea) = 150min = 2h 30m
    expect(reqNode.closest('button')).toHaveTextContent('2h 30m');

    await user.click(reqNode);

    expect(screen.getByText('Sin tarea')).toBeInTheDocument();
    expect(screen.getByText('Objetivo X')).toBeInTheDocument();
  });

  it('"Sin tarea" se renderiza al final del desplegable de requisito, después de las tareas (by-person)', async () => {
    const user = userEvent.setup();
    render(<HierarchicalTable dataByPerson={byPerson} activeView="by-person" />);

    await user.click(screen.getByText('Ivan Maldonado'));
    await user.click(screen.getByText(/Verifarma - CheckList/));
    await user.click(screen.getByText('Login SSO'));

    const names = screen.getAllByText(/^(Sin tarea|Objetivo X)$/).map((el) => el.textContent);
    expect(names).toEqual(['Objetivo X', 'Sin tarea']);
  });

  it('CA-4/TS-4 (by-person): las horas solo-proyecto siguen mostrando "Sin requisito/tarea" fuera de cualquier nodo de requisito', async () => {
    const user = userEvent.setup();
    render(<HierarchicalTable dataByPerson={byPerson} activeView="by-person" />);

    await user.click(screen.getByText('Ivan Maldonado'));
    await user.click(screen.getByText(/Verifarma - CheckList/));

    expect(screen.getByText('Sin requisito/tarea')).toBeInTheDocument();
  });

  it('CA-1/TS-1 (by-project): el nodo "Login SSO" agrupa "Sin tarea" y "Objetivo X"', async () => {
    const user = userEvent.setup();
    render(<HierarchicalTable dataByProject={byProject} activeView="by-project" />);

    await user.click(screen.getByText(/Verifarma - CheckList/));

    const reqNode = screen.getByText('Login SSO');
    expect(reqNode).toBeInTheDocument();

    await user.click(reqNode);

    expect(screen.getByText('Sin tarea')).toBeInTheDocument();
    expect(screen.getByText('Objetivo X')).toBeInTheDocument();
  });

  it('CA-5/TS-6: la agrupación jerárquica es consistente entre by-person y by-project para el mismo requisito y tarea', async () => {
    const user = userEvent.setup();

    const { unmount } = render(
      <HierarchicalTable dataByPerson={byPerson} activeView="by-person" />
    );
    await user.click(screen.getByText('Ivan Maldonado'));
    await user.click(screen.getByText(/Verifarma - CheckList/));
    const reqNodePerson = screen.getByText('Login SSO');
    await user.click(reqNodePerson);
    expect(screen.getByText('Sin tarea')).toBeInTheDocument();
    expect(screen.getByText('Objetivo X')).toBeInTheDocument();
    unmount();

    render(<HierarchicalTable dataByProject={byProject} activeView="by-project" />);
    await user.click(screen.getByText(/Verifarma - CheckList/));
    const reqNodeProject = screen.getByText('Login SSO');
    await user.click(reqNodeProject);
    expect(screen.getByText('Sin tarea')).toBeInTheDocument();
    expect(screen.getByText('Objetivo X')).toBeInTheDocument();
  });

  it('CA-4/TS-5 (by-project): el nodo "Sin requisito/tarea" (persons[]) sigue intacto, con desglose por persona', async () => {
    const user = userEvent.setup();
    render(<HierarchicalTable dataByProject={byProject} activeView="by-project" />);

    await user.click(screen.getByText(/Verifarma - CheckList/));

    const noTaskNode = screen.getByText('Sin requisito/tarea');
    expect(noTaskNode).toBeInTheDocument();

    await user.click(noTaskNode);

    expect(screen.getByText('Ivan Maldonado')).toBeInTheDocument();
  });

  it('CA-3/TS-3: una tarea sin objectiveRequirementId aparece bajo el nodo "Tareas sin requisito"', async () => {
    const user = userEvent.setup();
    const dataByPerson: ReportByPerson[] = [
      {
        personId: 1,
        personFirstName: 'Ana',
        personLastName: 'Perez',
        totalMinutes: 30,
        projects: [
          {
            projectId: 2,
            projectName: 'Proyecto suelto',
            projectCode: 'PS',
            totalMinutes: 30,
            objectives: [
              {
                objectiveId: 9,
                objectiveTitle: 'Suelta',
                requirementId: null,
                requirementTitle: null,
                objectiveRequirementId: null,
                objectiveRequirementTitle: null,
                totalMinutes: 30,
              },
            ],
          },
        ],
      },
    ];
    render(<HierarchicalTable dataByPerson={dataByPerson} activeView="by-person" />);

    await user.click(screen.getByText('Ana Perez'));
    await user.click(screen.getByText('Proyecto suelto'));

    const noReqNode = screen.getByText('Tareas sin requisito');
    expect(noReqNode).toBeInTheDocument();

    await user.click(noReqNode);

    expect(screen.getByText('Suelta')).toBeInTheDocument();
  });

  it('CA-2/TS-2: un requisito sin horas directas no muestra el hijo "Sin tarea", y usa el título real vía objectiveRequirementTitle', async () => {
    const user = userEvent.setup();
    const dataByPerson: ReportByPerson[] = [
      {
        personId: 1,
        personFirstName: 'Ana',
        personLastName: 'Perez',
        totalMinutes: 40,
        projects: [
          {
            projectId: 2,
            projectName: 'Proyecto B',
            projectCode: 'PB',
            totalMinutes: 40,
            objectives: [
              {
                objectiveId: 9,
                objectiveTitle: 'Fix bug',
                requirementId: null,
                requirementTitle: null,
                objectiveRequirementId: 7,
                objectiveRequirementTitle: 'Requisito 6',
                totalMinutes: 40,
              },
            ],
          },
        ],
      },
    ];
    render(<HierarchicalTable dataByPerson={dataByPerson} activeView="by-person" />);

    await user.click(screen.getByText('Ana Perez'));
    await user.click(screen.getByText('Proyecto B'));
    await user.click(screen.getByText('Requisito 6'));

    expect(screen.queryByText('Sin tarea')).not.toBeInTheDocument();
    expect(screen.getByText('Fix bug')).toBeInTheDocument();
  });

  it('sin título disponible en ninguna fuente, usa el fallback "Requisito #{id}"', async () => {
    const user = userEvent.setup();
    const dataByPerson: ReportByPerson[] = [
      {
        personId: 1,
        personFirstName: 'Ana',
        personLastName: 'Perez',
        totalMinutes: 40,
        projects: [
          {
            projectId: 2,
            projectName: 'Proyecto B',
            projectCode: 'PB',
            totalMinutes: 40,
            objectives: [
              {
                objectiveId: 9,
                objectiveTitle: 'Fix bug',
                requirementId: null,
                requirementTitle: null,
                objectiveRequirementId: 7,
                objectiveRequirementTitle: null,
                totalMinutes: 40,
              },
            ],
          },
        ],
      },
    ];
    render(<HierarchicalTable dataByPerson={dataByPerson} activeView="by-person" />);

    await user.click(screen.getByText('Ana Perez'));
    await user.click(screen.getByText('Proyecto B'));

    expect(screen.getByText('Requisito #7')).toBeInTheDocument();
  });

  it('CA-7/TS-8: un requisito sin ninguna hora no genera ningún nodo', async () => {
    const user = userEvent.setup();
    render(<HierarchicalTable dataByPerson={byPerson} activeView="by-person" />);

    await user.click(screen.getByText('Ivan Maldonado'));
    await user.click(screen.getByText(/Verifarma - CheckList/));

    expect(screen.queryByText(/Requisito #9/)).not.toBeInTheDocument();
  });

  it('no muestra ícono de Proyecto en la fila de proyecto (by-person)', async () => {
    const user = userEvent.setup();
    render(<HierarchicalTable dataByPerson={byPerson} activeView="by-person" />);

    await user.click(screen.getByText('Ivan Maldonado'));

    expect(screen.queryByRole('img', { name: 'Proyecto' })).not.toBeInTheDocument();
  });

  it('muestra ícono de Requisito en el nodo de requisito y de Tarea en su hijo, sin ícono de Proyecto (by-project)', async () => {
    const user = userEvent.setup();
    render(<HierarchicalTable dataByProject={byProject} activeView="by-project" />);

    await user.click(screen.getByText(/Verifarma - CheckList/));
    expect(screen.queryByRole('img', { name: 'Proyecto' })).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Requisito' })).toBeInTheDocument();

    await user.click(screen.getByText('Login SSO'));
    expect(screen.getByRole('img', { name: 'Tarea' })).toBeInTheDocument();
  });

  it('muestra ícono de Tarea al comienzo del nodo "Tareas sin requisito" (by-person)', async () => {
    const user = userEvent.setup();
    const dataByPerson: ReportByPerson[] = [
      {
        personId: 1,
        personFirstName: 'Ana',
        personLastName: 'Perez',
        totalMinutes: 30,
        projects: [
          {
            projectId: 2,
            projectName: 'Proyecto suelto',
            projectCode: 'PS',
            totalMinutes: 30,
            objectives: [
              {
                objectiveId: 9,
                objectiveTitle: 'Suelta',
                requirementId: null,
                requirementTitle: null,
                objectiveRequirementId: null,
                objectiveRequirementTitle: null,
                totalMinutes: 30,
              },
            ],
          },
        ],
      },
    ];
    render(<HierarchicalTable dataByPerson={dataByPerson} activeView="by-person" />);

    await user.click(screen.getByText('Ana Perez'));
    await user.click(screen.getByText('Proyecto suelto'));

    expect(screen.getByText('Tareas sin requisito')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Tarea' })).toBeInTheDocument();
  });

  it('"Sin tarea" es desplegable en by-project y muestra el desglose por persona', async () => {
    const user = userEvent.setup();
    render(<HierarchicalTable dataByProject={byProject} activeView="by-project" />);

    await user.click(screen.getByText(/Verifarma - CheckList/));
    await user.click(screen.getByText('Login SSO'));

    const sinTareaNode = screen.getByText('Sin tarea');
    expect(sinTareaNode.closest('button')).not.toBeNull();

    await user.click(sinTareaNode);

    expect(screen.getByText('Ana Gomez')).toBeInTheDocument();
  });
});
