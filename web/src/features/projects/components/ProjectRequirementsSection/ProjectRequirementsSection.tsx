'use client';
import React, { useState } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useRequirements } from '@/features/requirements/hooks/useRequirements';
import { getRequirementsCount } from '@/features/requirements/services/requirementsApi';
import { getTypeLabel, PRIORITY_LABELS } from '@/features/requirements/utils/requirementHelpers';
import { Pagination } from '@/shared/components/ui/Pagination';
import styles from './ProjectRequirementsSection.module.scss';
import type {
  Requirement,
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

const STATE_VALUES = STATE_TABS.map((tab) => tab.value);

const DEFAULT_PAGE_SIZE = 5;

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
  const queryClient = useQueryClient();
  const [activeState, setActiveState] = useState<RequirementState>('desarrollo');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const countResults = useQueries({
    queries: STATE_VALUES.map((state) => ({
      queryKey: ['requirements-count', { projectId, state }],
      queryFn: () => getRequirementsCount({ projectId, state }),
    })),
  });

  const activeIndex = STATE_VALUES.indexOf(activeState);
  const activeCount = countResults[activeIndex]?.data ?? 0;
  const totalPages = Math.ceil(activeCount / pageSize);
  const page = Math.min(currentPage, Math.max(1, totalPages));

  const { data: requirements = [], isLoading } = useRequirements({
    filters: { projectId, state: activeState, page, limit: pageSize },
  });

  const handleTabChange = (state: RequirementState) => {
    setActiveState(state);
    setCurrentPage(1);
    queryClient.invalidateQueries({ queryKey: ['requirements-count'] });
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
        {STATE_TABS.map((tab, index) => {
          const isActive = activeState === tab.value;
          const countQuery = countResults[index];
          const countLabel = countQuery.isError ? '—' : (countQuery.data ?? '—');
          return (
            <button
              key={tab.value}
              type="button"
              className={isActive ? `${styles.tab} ${styles.active}` : styles.tab}
              data-state={tab.value}
              onClick={() => handleTabChange(tab.value)}
            >
              <span className={styles.tabLabel}>{tab.label}</span>
              <span className={styles.tabCount}>{countLabel}</span>
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
            ) : requirements.length === 0 ? (
              <tr>
                <td colSpan={6} className={styles.emptyState}>
                  No se encontraron requisitos
                </td>
              </tr>
            ) : (
              requirements.map((req: Requirement) => (
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

        <div className={styles.paginationRow}>
          <Pagination
            totalItems={activeCount}
            limit={pageSize}
            currentPage={page}
            onPageChange={setCurrentPage}
          />
          <select
            className={styles.perPageSelect}
            value={pageSize}
            onChange={handlePageSizeChange}
          >
            <option value={5}>5 por página</option>
            <option value={10}>10 por página</option>
          </select>
        </div>
      </div>
    </div>
  );
}
