'use client';
import React, { useRef, useState, useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { AreaTag } from '@/features/objectives/components/AreaTag';
import { StateTag } from '@/features/objectives/components/StateTag';
import { TableRow } from '@/features/objectives/components/TableRow';
import { getObjectives, getObjectivesCount } from '@/features/objectives/services/objectivesApi';
import { Loader } from '@/shared/components/ui/Loader';
import { Tooltip } from '@/shared/components/ui/Tooltip';
import styles from './ProjectInactiveObjectivesTable.module.scss';
import type { IObjective } from '@/shared/types';

function ObjectiveTitleCell({
  title,
  className,
}: {
  readonly title: string;
  readonly className: string;
}) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  return (
    <td className={className}>
      <Tooltip message={title} disableTooltip={!isTruncated}>
        <span
          ref={spanRef}
          onMouseEnter={() => {
            if (spanRef.current) {
              setIsTruncated(spanRef.current.scrollWidth > spanRef.current.clientWidth);
            }
          }}
        >
          {title}
        </span>
      </Tooltip>
    </td>
  );
}

interface ProjectInactiveObjectivesTableProps {
  readonly projectId: number;
}

const LIMIT = 20;

export function ProjectInactiveObjectivesTable({ projectId }: ProjectInactiveObjectivesTableProps) {
  const [page, setPage] = useState(1);

  const results = useQueries({
    queries: [
      {
        queryKey: ['objectives', { projectId, state: 'finalizado', page, limit: LIMIT }],
        queryFn: () =>
          getObjectives({ projectId, state: 'finalizado', sort: '-createdAt', page, limit: LIMIT }),
      },
      {
        queryKey: ['objectives', { projectId, state: 'cancelado', page, limit: LIMIT }],
        queryFn: () =>
          getObjectives({ projectId, state: 'cancelado', sort: '-createdAt', page, limit: LIMIT }),
      },
      {
        queryKey: ['objectives-count', { projectId, state: 'finalizado' }],
        queryFn: () => getObjectivesCount({ projectId, state: 'finalizado' }),
      },
      {
        queryKey: ['objectives-count', { projectId, state: 'cancelado' }],
        queryFn: () => getObjectivesCount({ projectId, state: 'cancelado' }),
      },
    ],
  });

  const [finalizados, cancelados, countFin, countCanc] = results;
  const isLoading = results.some((r) => r.isLoading);
  const isError = results.some((r) => r.isError);

  const inactivos = useMemo(() => {
    const all = [...(finalizados.data ?? []), ...(cancelados.data ?? [])];
    return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [finalizados.data, cancelados.data]);

  const totalItems = (countFin.data ?? 0) + (countCanc.data ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalItems / LIMIT));

  if (isLoading) {
    return <Loader label="Cargando tareas inactivas..." />;
  }

  if (isError) {
    return <p className={styles.message}>Error al cargar las tareas inactivas.</p>;
  }

  if (inactivos.length === 0) {
    return <p className={styles.message}>No hay tareas inactivas.</p>;
  }

  return (
    <div className={styles.container}>
      <table className={styles.tableContainer}>
        <thead>
          <tr>
            <th>Tarea</th>
            <th>Estado</th>
            <th>Área y Responsable</th>
            <th>Fecha de Inicio</th>
            <th>Fecha de Cierre</th>
          </tr>
        </thead>
        <tbody>
          {inactivos.map((objective: IObjective) => (
            <TableRow key={objective.id} objective={objective}>
              <ObjectiveTitleCell title={objective.title} className={styles.objectiveCell} />
              <td className={styles.smallTd}>
                <StateTag
                  state={objective.state}
                  objectiveId={objective.id!}
                  priority={objective.priority}
                  estimatedFinishDate={
                    objective.estimatedFinishDate ? new Date(objective.estimatedFinishDate) : null
                  }
                  area={objective.area}
                  persons={objective.persons}
                  title={objective.title}
                  description={objective.description}
                />
              </td>
              <td className={`${styles.smallTd} ${styles.areaTagCell}`}>
                <AreaTag
                  persons={objective.persons}
                  area={objective.area}
                  projectName={objective.project?.name ?? ''}
                />
              </td>
              <td className={styles.smallTd}>
                {new Date(objective.createdAt).toLocaleDateString('es-ES', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </td>
              <td className={styles.smallTd}>
                {objective.finishedAt
                  ? new Date(objective.finishedAt).toLocaleDateString('es-ES', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })
                  : '-'}
              </td>
            </TableRow>
          ))}
        </tbody>
      </table>
      {totalPages > 1 && (
        <nav className={styles.pagination} aria-label="Paginación">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            aria-label="Página anterior"
          >
            {'<'}
          </button>
          {Array.from({ length: totalPages }, (_, i) => {
            const pageNumber = i + 1;
            const isActive = page === pageNumber;
            return (
              <button
                key={pageNumber}
                type="button"
                onClick={() => setPage(pageNumber)}
                disabled={isActive}
                data-active={isActive || undefined}
                aria-label={`Página ${pageNumber}`}
                aria-current={isActive ? 'page' : undefined}
              >
                {pageNumber}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            aria-label="Página siguiente"
          >
            {'>'}
          </button>
        </nav>
      )}
    </div>
  );
}
