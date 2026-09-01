'use client';

import React, { useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { labelFromDate } from '@/shared/utils/dateFormatter';
import { useRequirements } from '../../hooks/useRequirements';
import { getTypeLabel } from '../../utils/requirementHelpers';
import { RequirementFilters } from '../RequirementFilters';
import styles from './RequirementList.module.scss';
import type {
  Requirement,
  RequirementFilters as Filters,
  RequirementPriority,
  RequirementState,
} from '../../types/requirement.types';

interface RequirementListProps {
  readonly filters: Filters;
}

const STATE_LABELS: Record<RequirementState, string> = {
  analisis: 'Análisis',
  planificacion: 'Planificación',
  en_cola: 'En cola',
  desarrollo: 'Desarrollo',
  revision: 'Revisión',
  resuelto: 'Resuelto',
  cancelado: 'Cancelado',
};

const PRIORITY_LABELS: Record<RequirementPriority, string> = {
  sin_prioridad: 'Sin prioridad',
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
  urgente: 'Urgente',
};

function formatStartDate(value: string): string {
  try {
    return labelFromDate(new Date(value), 'DD/MM/YYYY');
  } catch {
    return '—';
  }
}

function sortByLeaderFirst(
  people: Requirement['responsiblePeople']
): Requirement['responsiblePeople'] {
  const leader = people.find((person) => person.isLeader);
  if (!leader) return people;
  return [leader, ...people.filter((person) => person !== leader)];
}

function formatResponsiblePeople(people: Requirement['responsiblePeople']): string {
  if (!people || people.length === 0) return 'Sin asignar';
  const sorted = sortByLeaderFirst(people);
  const first = sorted[0];
  const name = `${first.firstName} ${first.lastName}`.trim();
  if (sorted.length === 1) return name;
  return `${name} +${sorted.length - 1}`;
}

function formatResponsiblePeopleFullList(people: Requirement['responsiblePeople']): string {
  if (!people || people.length === 0) return '';
  return sortByLeaderFirst(people)
    .map((p) => `${p.firstName} ${p.lastName}`.trim())
    .join(', ');
}

export function RequirementList({ filters }: RequirementListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: requirements = [], isLoading } = useRequirements({ filters });

  const currentPage = Number(filters.page) || 1;
  const limit = Number(filters.limit) || 15;

  const updateFilter = useCallback(
    (key: keyof Filters, value: string) => {
      const params = new URLSearchParams(searchParams?.toString());
      // `state` es la excepción: con un default de cuatro estados en page.tsx, una URL sin
      // `state` significa "el default", no "sin filtro". Por eso el sentinel 'all' se escribe
      // en vez de borrarse. Ver S-041 / REQ-009 (riesgo R1). El resto de los filtros conserva
      // el borrado. `cleanFilters` descarta 'all' al serializar, así que la api recibe la
      // request sin `state` y devuelve los siete estados.
      if (key === 'state' ? !value : !value || value === 'all') {
        params.delete(key as string);
      } else {
        params.set(key as string, value);
      }
      params.delete('page');
      router.push(`/requirements?${params.toString()}`);
    },
    [router, searchParams]
  );

  const handlePageChange = useCallback(
    (newPage: number) => {
      if (newPage < 1) return;
      const params = new URLSearchParams(searchParams?.toString());
      params.set('page', String(newPage));
      router.push(`/requirements?${params.toString()}`);
    },
    [router, searchParams]
  );

  const handleLimitChange = useCallback(
    (newLimit: string) => {
      const params = new URLSearchParams(searchParams?.toString());
      params.set('limit', newLimit);
      params.set('page', '1');
      router.push(`/requirements?${params.toString()}`);
    },
    [router, searchParams]
  );

  return (
    <div className={styles.wrapper}>
      <RequirementFilters filters={filters} onChange={updateFilter} />

      <div className={styles.tableCard}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.thId}>ID</th>
              <th className={styles.thProyecto}>Proyecto</th>
              <th className={styles.thRequisito}>Título</th>
              <th className={styles.thResponsable}>Responsable</th>
              <th className={styles.thCompact}>Estado</th>
              <th className={styles.thCompact}>Tipo</th>
              <th className={styles.thCompact}>Prioridad</th>
              <th className={styles.thCompact}>Creación</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} className={styles.emptyState}>
                  Cargando requisitos...
                </td>
              </tr>
            ) : requirements.length === 0 ? (
              <tr>
                <td colSpan={8} className={styles.emptyState}>
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
                  <td className={styles.tdCompact}>{req.id}</td>
                  <td className={styles.tdProyecto}>
                    <span className={styles.projectLink} title={req.project?.name ?? '—'}>
                      {req.project?.name ?? '—'}
                    </span>
                  </td>
                  <td className={styles.titleCell}>
                    <span className={styles.titleLink} title={req.title}>
                      {req.title}
                    </span>
                  </td>
                  <td className={styles.tdResponsable}>
                    {req.responsiblePeople && req.responsiblePeople.length > 1 ? (
                      <span
                        className={styles.responsibleLabel}
                        title={formatResponsiblePeopleFullList(req.responsiblePeople)}
                      >
                        {formatResponsiblePeople(req.responsiblePeople)}
                      </span>
                    ) : (
                      formatResponsiblePeople(req.responsiblePeople)
                    )}
                  </td>
                  <td className={styles.tdCompact}>
                    <span className={styles.sTag} data-state={req.state}>
                      <span className={styles.dot} />
                      {STATE_LABELS[req.state]}
                    </span>
                  </td>
                  <td className={styles.tdCompact}>
                    <span className={styles.pill} data-type={req.type}>
                      {getTypeLabel(req.type)}
                    </span>
                  </td>
                  <td className={styles.tdCompact}>
                    <span className={styles.pill} data-priority={req.priority}>
                      {PRIORITY_LABELS[req.priority]}
                    </span>
                  </td>
                  <td className={styles.tdCompact}>{formatStartDate(req.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className={styles.pagination}>
          <button
            type="button"
            className={styles.pageBtn}
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            aria-label="Página anterior"
          >
            {'‹'}
          </button>
          {currentPage > 1 && (
            <button
              type="button"
              className={styles.pageBtn}
              onClick={() => handlePageChange(currentPage - 1)}
            >
              {currentPage - 1}
            </button>
          )}
          <button type="button" className={styles.pageBtn} data-active="true" aria-current="page">
            {currentPage}
          </button>
          {requirements.length >= limit && (
            <button
              type="button"
              className={styles.pageBtn}
              onClick={() => handlePageChange(currentPage + 1)}
            >
              {currentPage + 1}
            </button>
          )}
          <button
            type="button"
            className={styles.pageBtn}
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={requirements.length < limit}
            aria-label="Página siguiente"
          >
            {'›'}
          </button>
          <select
            className={styles.perPageSelect}
            value={String(limit)}
            onChange={(e) => handleLimitChange(e.target.value)}
            aria-label="Elementos por página"
          >
            <option value="15">15 por página</option>
            <option value="20">20 por página</option>
            <option value="25">25 por página</option>
          </select>
        </div>
      </div>
    </div>
  );
}
