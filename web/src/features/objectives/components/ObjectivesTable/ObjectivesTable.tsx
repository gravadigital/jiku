import 'react-toastify/dist/ReactToastify.css';
import React from 'react';
import { getObjectives, getObjectivesCount } from '@/features/objectives';
import { Pagination } from '@/shared/components/ui';
import { calculateDaysLeft, calculateTimeSince } from '@/shared/utils';
import { isOverdue } from '../../utils/objectiveHelpers';
import { AreaTag } from '../AreaTag';
import { StateTag } from '../StateTag';
import { TableRow } from '../TableRow';
import styles from './ObjectivesTable.module.scss';
import type { Objective, ObjectiveFilters } from '@/features/objectives';

export async function ObjectivesTable({ filters }: { readonly filters: ObjectiveFilters }) {
  const objectivesCount = await getObjectivesCount(filters);
  const objectives = await getObjectives(filters);

  const getFinishDateText = (estimatedFinishDate: Date | null) => {
    if (!estimatedFinishDate) {
      return 'No definida';
    }
    const date = new Date(estimatedFinishDate);
    const formattedDate = date.toLocaleDateString('es-ES', { month: 'short' });
    const day = date.getDate();

    return `Hasta: ${day} ${formattedDate} | `;
  };

  const getDaysLeftText = (estimatedFinishDate: Date | null, state: string) => {
    if (!estimatedFinishDate) {
      return '';
    }
    const date = new Date(estimatedFinishDate);
    const daysLeft = calculateDaysLeft(date);

    if (daysLeft === 0) {
      return 'Vence hoy';
    }
    if (daysLeft < 0) {
      if (!isOverdue(state, estimatedFinishDate)) return '';
      return `Vencido hace: ${Math.abs(daysLeft)} día(s)`;
    }

    return `Falta: ${daysLeft} día(s)`;
  };

  const isCloseToDeadline = (estimatedFinishDate: Date | null, state: string) => {
    if (!estimatedFinishDate) {
      return false;
    }
    const daysLeft = calculateDaysLeft(new Date(estimatedFinishDate));
    if (daysLeft < 0 && !isOverdue(state, estimatedFinishDate)) return false;
    return daysLeft <= 4;
  };

  return (
    <div>
      {objectives.length === 0 ? (
        <h3 className={styles.noObjectives}>No hay tareas que coincidan con estos filtros.</h3>
      ) : (
        <div>
          <div>
            <table className={styles.tableContainer}>
              <thead>
                <tr>
                  <th>Proyecto</th>
                  <th>Tarea</th>
                  <th>Estado</th>
                  <th>Área y Responsable</th>
                  <th>Prioridad</th>
                  <th>Fecha de Inicio</th>
                  <th>Fecha de Cierre</th>
                </tr>
              </thead>
              <tbody>
                {objectives.map((objective: Objective) => (
                  <TableRow key={objective.id} objective={objective}>
                    <td>{objective.project.name}</td>
                    <td>{objective.title}</td>
                    <td className={styles.smallTd}>
                      <StateTag
                        state={objective.state}
                        objectiveId={objective.id || 0}
                        priority={objective.priority}
                        area={objective.area}
                        estimatedFinishDate={objective.estimatedFinishDate}
                        persons={objective.persons}
                        title={objective.title}
                        description={objective.description}
                      />
                    </td>
                    <td className={styles.smallTd}>
                      <AreaTag
                        persons={objective.persons}
                        area={objective.area}
                        projectName={objective.project.name}
                        showProject={false}
                      />
                    </td>
                    <td className={styles.smallTd}>{objective.priority}</td>
                    <td className={styles.smallTd}>
                      {new Date(objective.createdAt).toLocaleDateString('es-ES', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td>
                      {objective.finishedAt ? (
                        <span className={styles.finished}>
                          Cerrado hace {calculateTimeSince(new Date(objective.finishedAt))}
                        </span>
                      ) : (
                        <>
                          <span>{getFinishDateText(objective.estimatedFinishDate)}</span>
                          <span
                            className={
                              isCloseToDeadline(objective.estimatedFinishDate, objective.state)
                                ? styles.closeToDeadline
                                : ''
                            }
                          >
                            {getDaysLeftText(objective.estimatedFinishDate, objective.state)}
                          </span>
                        </>
                      )}
                    </td>
                  </TableRow>
                ))}
              </tbody>
            </table>
            <Pagination
              totalItems={objectivesCount}
              limit={Number(filters.limit) || 20}
              basePath="/objectives"
            />
          </div>
        </div>
      )}
    </div>
  );
}
