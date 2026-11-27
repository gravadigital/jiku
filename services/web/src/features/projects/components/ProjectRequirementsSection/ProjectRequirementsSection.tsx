'use client';
import React, { useState } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useRequirements } from '@/features/requirements/hooks/useRequirements';
import { getRequirementsCount } from '@/features/requirements/services/requirementsApi';
import { getTypeLabel, PRIORITY_LABELS } from '@/features/requirements/utils/requirementHelpers';
import { Badge, Button, Card, Pagination, Tabs, Table } from '@/shared/components/ui';
import styles from './ProjectRequirementsSection.module.scss';
import type {
  Requirement,
  RequirementPriority,
  RequirementState,
} from '@/features/requirements/types/requirement.types';
import type { BadgeFamily } from '@/shared/components/ui/Badge';
import type { TableColumn, TableRow } from '@/shared/components/ui/Table';

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

const PRIORITY_FAMILY: Record<RequirementPriority, BadgeFamily> = {
  urgente: 'urgent',
  alta: 'urgent',
  media: 'review',
  baja: 'neutral',
  sin_prioridad: 'neutral',
};

const DEFAULT_PAGE_SIZE = 5;

const COLUMNS: readonly TableColumn[] = [
  { key: 'id', label: 'ID' },
  { key: 'title', label: 'Título' },
  { key: 'responsible', label: 'Responsable' },
  { key: 'type', label: 'Tipo' },
  { key: 'priority', label: 'Prioridad' },
  { key: 'createdAt', label: 'Creación' },
];

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

  const handleTabChange = (state: string) => {
    setActiveState(state as RequirementState);
    setCurrentPage(1);
    queryClient.invalidateQueries({ queryKey: ['requirements-count'] });
  };

  const tabs = STATE_TABS.map((tab, index) => ({
    key: tab.value,
    label: tab.label,
    count: countResults[index].isError ? 0 : (countResults[index].data ?? 0),
  }));

  const rows: TableRow[] = requirements.map((req: Requirement) => ({
    id: req.id,
    title: (
      <a
        href={`/requirements/${req.id}`}
        target="_blank"
        rel="noreferrer"
        className={styles.titleLink}
      >
        {req.title}
      </a>
    ),
    responsible: formatResponsible(req.responsiblePeople),
    type: getTypeLabel(req.type),
    priority: (
      <Badge variant="outline" family={PRIORITY_FAMILY[req.priority]} label={PRIORITY_LABELS[req.priority]} />
    ),
    createdAt: formatCreatedDate(req.createdAt),
  }));

  return (
    <Card variant="panel">
      <div className={styles.wrapper}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Requisitos</h2>
          <Button
            fab
            aria-label="Nuevo requisito"
            onClick={() => router.push(`/requirements/new?projectId=${projectId}`)}
          >
            +
          </Button>
        </div>

        <Tabs tabs={tabs} activeKey={activeState} onChange={handleTabChange} />

        <div className={styles.tableWrap}>
          <Table
            variant="light"
            columns={COLUMNS}
            rows={rows}
            loading={isLoading}
            ariaLabel="Requisitos del proyecto"
            emptyState={<span>No se encontraron requisitos</span>}
          />

          <div className={styles.paginationRow}>
            <Pagination
              totalItems={activeCount}
              limit={pageSize}
              currentPage={page}
              onPageChange={setCurrentPage}
              pageSizeOptions={[5, 10]}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}
