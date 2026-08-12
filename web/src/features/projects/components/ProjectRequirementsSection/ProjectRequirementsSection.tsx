'use client';
import React, { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRequirements } from '@/features/requirements/hooks/useRequirements';
import { getTypeLabel } from '@/features/requirements/utils/requirementHelpers';
import styles from './ProjectRequirementsSection.module.scss';
import type {
  Requirement,
  RequirementPriority,
  RequirementState,
} from '@/features/requirements/types/requirement.types';

interface ProjectRequirementsSectionProps {
  readonly projectId: number;
}

const STATE_TABS: { label: string; value: RequirementState }[] = [
  { label: 'Análisis', value: 'analisis' },
  { label: 'Planificación', value: 'planificacion' },
  { label: 'En cola', value: 'en_cola' },
  { label: 'Desarrollo', value: 'desarrollo' },
  { label: 'Revisión', value: 'revision' },
  { label: 'Resuelto', value: 'resuelto' },
  { label: 'Cancelado', value: 'cancelado' },
];

const DEFAULT_PAGE_SIZE = 5;

const PRIORITY_LABELS: Record<RequirementPriority, string> = {
  sin_prioridad: 'Sin prioridad',
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
  urgente: 'Urgente',
};

function formatCreatedDate(value: string): string {
  const date = new Date(value);
  if (isNaN(date.getTime())) return '—';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatResponsible(people: Requirement['responsiblePeople']): string {
  if (!people || people.length === 0) return 'Sin asignar';
  const leader = people.find((person) => person.isLeader) ?? people[0];
  return `${leader.firstName} ${leader.lastName}`.trim();
}

export function ProjectRequirementsSection({ projectId }: ProjectRequirementsSectionProps) {
  const router = useRouter();
  const [activeState, setActiveState] = useState<RequirementState>('desarrollo');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const { data: requirements = [], isLoading } = useRequirements({
    filters: { projectId },
  });

  const countByState = useCallback(
    (state: RequirementState) => requirements.filter((r) => r.state === state).length,
    [requirements]
  );

  const visibleRequirements = requirements.filter((r) => r.state === activeState);
  const totalPages = Math.ceil(visibleRequirements.length / pageSize);
  const paginatedRequirements = visibleRequirements.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleTabChange = (state: RequirementState) => {
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
        <h2 className={styles.sectionTitle}>Requisitos</h2>
        <button
          type="button"
          className={styles.newBtn}
          aria-label="Nuevo requisito"
          onClick={() => router.push(`/requirements/new?projectId=${projectId}`)}
        >
          +
        </button>
      </div>

      <nav className={styles.tabs} aria-label="Filtro por estado">
        {STATE_TABS.map((tab) => {
          const isActive = activeState === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              className={isActive ? `${styles.tab} ${styles.active}` : styles.tab}
              data-state={tab.value}
              onClick={() => handleTabChange(tab.value)}
            >
              <span className={styles.tabLabel}>{tab.label}</span>
              <span className={styles.tabCount}>{countByState(tab.value)}</span>
            </button>
          );
        })}
      </nav>

      <div className={styles.tableWrap}>
        <table className={styles.reqTable}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Título</th>
              <th>Responsable</th>
              <th>Tipo</th>
              <th>Prioridad</th>
              <th>Creación</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className={styles.emptyState}>
                  Cargando requisitos...
                </td>
              </tr>
            ) : paginatedRequirements.length === 0 ? (
              <tr>
                <td colSpan={6} className={styles.emptyState}>
                  No se encontraron requisitos
                </td>
              </tr>
            ) : (
              paginatedRequirements.map((req: Requirement) => (
                <tr
                  key={req.id}
                  className={styles.row}
                  onClick={() => window.open(`/requirements/${req.id}`, '_blank')}
                >
                  <td className={styles.idCell}>{req.id}</td>
                  <td>
                    <span className={styles.titleLink}>{req.title}</span>
                  </td>
                  <td>{formatResponsible(req.responsiblePeople)}</td>
                  <td>{getTypeLabel(req.type)}</td>
                  <td>
                    <span className={styles.priorityPill}>{PRIORITY_LABELS[req.priority]}</span>
                  </td>
                  <td>{formatCreatedDate(req.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <nav className={styles.pagination} aria-label="Paginación">
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
        </nav>
      </div>
    </div>
  );
}
