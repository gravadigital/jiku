'use client';

import React, { useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Badge,
  Card,
  EmptyState,
  Pagination,
  Table,
  STATE_TO_FAMILY,
  type BadgeFamily,
} from '@/shared/components/ui';
import { labelFromDate } from '@/shared/utils/dateFormatter';
import { formatMinutes } from '@/shared/utils/format-minutes';
import { useRequirements } from '../../hooks/useRequirements';
import { useRequirementsCount } from '../../hooks/useRequirementsCount';
import { getTypeLabel } from '../../utils/requirementHelpers';
import { RequirementFilters } from '../RequirementFilters';
import styles from './RequirementList.module.scss';
import type {
  Requirement,
  RequirementFilters as Filters,
  RequirementPriority,
  RequirementState,
} from '../../types/requirement.types';
import type { TableColumn, TableRow } from '@/shared/components/ui/Table';

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

// La prioridad no forma parte de STATE_TO_FAMILY (ese mapa cubre los estados del requisito):
// tiene su propia correspondencia, del spec de Badge.
const PRIORITY_TO_FAMILY: Record<RequirementPriority, BadgeFamily> = {
  sin_prioridad: 'neutral',
  baja: 'neutral',
  media: 'review',
  alta: 'urgent',
  urgente: 'urgent',
};

const COLUMNS: readonly TableColumn[] = [
  { key: 'id', label: 'ID' },
  { key: 'project', label: 'Proyecto' },
  { key: 'title', label: 'Título' },
  { key: 'responsible', label: 'Responsable' },
  { key: 'state', label: 'Estado' },
  { key: 'type', label: 'Tipo' },
  { key: 'priority', label: 'Prioridad' },
  { key: 'workedHours', label: 'Hs. Trab.' },
  { key: 'createdAt', label: 'Creación' },
];

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
  // `count=true` ignora `include` en la api: el conteo devuelve un entero y no hay dónde poner
  // el campo. Se recorta acá para que la request de conteo no lo arrastre sin efecto (S-045).
  const { include: _include, ...countFilters } = filters;
  void _include;
  const { data: count = 0 } = useRequirementsCount(countFilters);

  const limit = Number(filters.limit) || 15;
  const isFiltered = Boolean(
    filters.search ||
      filters.projectId ||
      filters.type ||
      filters.priority ||
      filters.tag ||
      (filters.state && filters.state !== 'all')
  );

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

  const handleLimitChange = useCallback(
    (newLimit: number) => {
      const params = new URLSearchParams(searchParams?.toString());
      params.set('limit', String(newLimit));
      params.set('page', '1');
      router.push(`/requirements?${params.toString()}`);
    },
    [router, searchParams]
  );

  const rows: TableRow[] = requirements.map((req: Requirement) => ({
    id: req.id,
    project: (
      <span className={styles.projectLink} title={req.project?.name ?? '—'}>
        {req.project?.name ?? '—'}
      </span>
    ),
    title: (
      <Link href={`/requirements/${req.id}`} className={styles.titleLink} title={req.title}>
        {req.title}
      </Link>
    ),
    responsible:
      req.responsiblePeople && req.responsiblePeople.length > 1 ? (
        <span
          className={styles.responsibleLabel}
          title={formatResponsiblePeopleFullList(req.responsiblePeople)}
        >
          {formatResponsiblePeople(req.responsiblePeople)}
        </span>
      ) : (
        formatResponsiblePeople(req.responsiblePeople)
      ),
    state: (
      <Badge variant="state" family={STATE_TO_FAMILY[req.state] ?? 'neutral'} label={STATE_LABELS[req.state]} />
    ),
    type: <Badge variant="outline" label={getTypeLabel(req.type)} />,
    priority: (
      <Badge variant="outline" family={PRIORITY_TO_FAMILY[req.priority]} label={PRIORITY_LABELS[req.priority]} />
    ),
    workedHours: req.totalMinutes ? formatMinutes(req.totalMinutes) : '—',
    createdAt: formatStartDate(req.createdAt),
  }));

  return (
    <div className={styles.wrapper}>
      <RequirementFilters filters={filters} onChange={updateFilter} />

      <Card variant="panel">
        <Table
          variant="light"
          columns={COLUMNS}
          rows={rows}
          loading={isLoading}
          ariaLabel="Tabla de requisitos"
          emptyState={
            <EmptyState
              variant={isFiltered ? 'filtered' : 'list'}
              message="No se encontraron requisitos"
            />
          }
        />
        <div className={styles.pagination}>
          <Pagination
            totalItems={count}
            limit={limit}
            basePath="/requirements"
            pageSizeOptions={[15, 20, 25]}
            onPageSizeChange={handleLimitChange}
          />
        </div>
      </Card>
    </div>
  );
}
