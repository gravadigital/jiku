'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useObjectives } from '@/features/objectives/hooks/useObjectives';
import styles from './ProjectObjectivesSection.module.scss';
import type { ObjectiveState } from '@/features/objectives/types/objective.types';
import type { Objective } from '@/features/objectives/types/objective.types';

interface ProjectObjectivesSectionProps {
  readonly projectId: number;
}

const STATE_TABS: { label: string; value: ObjectiveState }[] = [
  { label: 'Backlog', value: 'backlog' },
  { label: 'Activo', value: 'activo' },
  { label: 'En revisión', value: 'en_revision' },
  { label: 'Finalizado', value: 'finalizado' },
  { label: 'Cancelado', value: 'cancelado' },
];

const DEFAULT_PAGE_SIZE = 5;

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (isNaN(date.getTime())) return '—';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatPersons(persons: Objective['persons']): string {
  if (!persons || persons.length === 0) return '—';
  const first = persons[0];
  const name = `${first.firstName} ${first.lastName}`.trim();
  if (persons.length === 1) return name;
  return `${name} +${persons.length - 1}`;
}

function formatPersonsFullList(persons: Objective['persons']): string {
  if (!persons || persons.length === 0) return '';
  return persons.map((p) => `${p.firstName} ${p.lastName}`.trim()).join(', ');
}

export function ProjectObjectivesSection({ projectId }: ProjectObjectivesSectionProps) {
  const router = useRouter();
  const [activeState, setActiveState] = useState<ObjectiveState>('activo');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const { data: objectives = [], isLoading } = useObjectives({
    filters: { projectId },
  });

  const countByState = (state: ObjectiveState) =>
    objectives.filter((o) => o.state === state).length;

  const visibleObjectives = objectives.filter((o) => o.state === activeState);
  const totalPages = Math.ceil(visibleObjectives.length / pageSize);
  const paginated = visibleObjectives.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleTabChange = (state: ObjectiveState) => {
    setActiveState(state);
    setCurrentPage(1);
  };

  const handlePageSizeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setPageSize(Number(event.target.value));
    setCurrentPage(1);
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Tareas</h2>
        <button
          type="button"
          className={styles.newBtn}
          aria-label="Nueva tarea"
          onClick={() => router.push(`/objectives/new?projectId=${projectId}`)}
        >
          +
        </button>
      </div>

      <nav className={styles.tabs} aria-label="Filtro por estado de tarea">
        {STATE_TABS.map((tab) => {
          const isActive = activeState === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              className={isActive ? `${styles.tab} ${styles.active}` : styles.tab}
              onClick={() => handleTabChange(tab.value)}
            >
              <span className={styles.tabLabel}>{tab.label}</span>
              <span className={styles.tabCount}>{countByState(tab.value)}</span>
            </button>
          );
        })}
      </nav>

      <div className={styles.tableWrap}>
        <table className={styles.objTable}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Título</th>
              <th>Responsable</th>
              <th>Creación</th>
              <th>Cierre estimado</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className={styles.emptyState}>
                  Cargando tareas...
                </td>
              </tr>
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan={5} className={styles.emptyState}>
                  No se encontraron tareas
                </td>
              </tr>
            ) : (
              paginated.map((obj: Objective) => (
                <tr
                  key={obj.id}
                  className={styles.row}
                  onClick={() => window.open(`/objectives/${obj.id}`, '_blank')}
                >
                  <td className={styles.idCell}>{obj.id}</td>
                  <td>
                    <span className={styles.titleLink}>{obj.title}</span>
                  </td>
                  <td>
                    {obj.persons && obj.persons.length > 1 ? (
                      <span
                        className={styles.personsLabel}
                        title={formatPersonsFullList(obj.persons)}
                      >
                        {formatPersons(obj.persons)}
                      </span>
                    ) : (
                      formatPersons(obj.persons)
                    )}
                  </td>
                  <td>{formatDate(obj.createdAt)}</td>
                  <td>{formatDate(obj.estimatedFinishDate)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className={styles.pagination}>
          <button
            type="button"
            className={styles.pageBtn}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            ‹
          </button>
          {Array.from({ length: Math.max(totalPages, 1) }, (_, i) => i + 1)
            .filter((page) => page <= 3 || page === Math.max(totalPages, 1))
            .reduce<(number | 'ellipsis')[]>((acc, page, idx, arr) => {
              if (idx > 0 && page - (arr[idx - 1] as number) > 1) acc.push('ellipsis');
              acc.push(page);
              return acc;
            }, [])
            .map((item, idx) =>
              item === 'ellipsis' ? (
                <span key={`ellipsis-${idx}`} className={styles.ellipsis}>
                  …
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  className={`${styles.pageBtn}${currentPage === item ? ` ${styles.active}` : ''}`}
                  onClick={() => setCurrentPage(item)}
                  aria-current={currentPage === item ? 'page' : undefined}
                >
                  {item}
                </button>
              )
            )}
          <button
            type="button"
            className={styles.pageBtn}
            onClick={() => setCurrentPage((p) => Math.min(Math.max(totalPages, 1), p + 1))}
            disabled={currentPage === Math.max(totalPages, 1)}
          >
            ›
          </button>
          <select className={styles.perPageSelect} value={pageSize} onChange={handlePageSizeChange}>
            <option value={5}>5 por página</option>
            <option value={10}>10 por página</option>
          </select>
        </div>
      </div>
    </div>
  );
}
