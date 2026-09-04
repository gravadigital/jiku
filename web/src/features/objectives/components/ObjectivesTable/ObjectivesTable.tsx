import 'react-toastify/dist/ReactToastify.css';
import React from 'react';
import Link from 'next/link';
import { getObjectives, getObjectivesCount } from '@/features/objectives';
import { Card, EmptyState, Pagination, Table } from '@/shared/components/ui';
import { calculateDaysLeft, calculateTimeSince } from '@/shared/utils';
import { isOverdue } from '../../utils/objectiveHelpers';
import { AreaTag } from '../AreaTag';
import { StateTag } from '../StateTag';
import styles from './ObjectivesTable.module.scss';
import type { Objective, ObjectiveFilters } from '@/features/objectives';
import type { TableColumn, TableRow } from '@/shared/components/ui/Table';

const COLUMNS: readonly TableColumn[] = [
  { key: 'project', label: 'Proyecto' },
  { key: 'title', label: 'Tarea' },
  { key: 'state', label: 'Estado' },
  { key: 'areaResponsible', label: 'Área y Responsable' },
  { key: 'priority', label: 'Prioridad' },
  { key: 'startDate', label: 'Fecha de Inicio' },
  { key: 'endDate', label: 'Fecha de Cierre' },
];

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

  const rows: TableRow[] = objectives.map((objective: Objective) => ({
    areaResponsible: (
      <AreaTag
        persons={objective.persons}
        area={objective.area}
        projectName={objective.project.name}
        showProject={false}
      />
    ),
    endDate: objective.finishedAt ? (
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
    ),
    priority: objective.priority,
    project: objective.project.name,
    startDate: new Date(objective.createdAt).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }),
    state: (
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
    ),
    title: (
      <Link href={`/objectives/${objective.id}`} className={styles.titleLink}>
        {objective.title}
      </Link>
    ),
  }));

  return (
    // Igual que el listado de requisitos: la tabla vive dentro de una card. Sin ella la tabla
    // quedaba directamente sobre el canvas, sin el borde ni el radio que enmarcan al resto de
    // los listados.
    <Card variant="panel">
      <Table
        // `light`, no `dense`: el criterio del DS para la cabecera oscura es "tabla para mirar
        // de un vistazo, NO para navegar", y las filas de este listado sí navegan — el título
        // de cada tarea linkea a su detalle. Es el mismo tipo de pantalla que el listado de
        // requisitos, así que comparte su densidad.
        //
        // `dense` quedó SIN consumidores: el reporte de requisitos, que era el último, también
        // pasó a `light`. Se conserva declarado un release por la política del DS.
        variant="light"
        columns={COLUMNS}
        rows={rows}
        ariaLabel="Tabla de tareas"
        emptyState={
          <EmptyState variant="filtered" message="No hay tareas que coincidan con estos filtros." />
        }
      />
      {objectives.length > 0 && (
        <Pagination totalItems={objectivesCount} limit={Number(filters.limit) || 20} basePath="/objectives" />
      )}
    </Card>
  );
}
