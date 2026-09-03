'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useObjectives } from '@/features/objectives/hooks/useObjectives';
import { Button, Card, Pagination, Table, Tabs } from '@/shared/components/ui';
import styles from './ProjectObjectivesSection.module.scss';
import type { ObjectiveState } from '@/features/objectives/types/objective.types';
import type { Objective } from '@/features/objectives/types/objective.types';
import type { TableColumn, TableRow } from '@/shared/components/ui/Table';

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

const COLUMNS: readonly TableColumn[] = [
  { key: 'id', label: 'ID' },
  { key: 'title', label: 'Título' },
  { key: 'responsible', label: 'Responsable' },
  { key: 'createdAt', label: 'Creación' },
  { key: 'estimatedFinishDate', label: 'Cierre estimado' },
];

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
  const paginated = visibleObjectives.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleTabChange = (state: string) => {
    setActiveState(state as ObjectiveState);
    setCurrentPage(1);
  };

  const tabs = STATE_TABS.map((tab) => ({
    key: tab.value,
    label: tab.label,
    count: countByState(tab.value),
  }));

  const rows: TableRow[] = paginated.map((obj: Objective) => ({
    id: obj.id,
    title: (
      <a
        href={`/objectives/${obj.id}`}
        target="_blank"
        rel="noreferrer"
        className={styles.titleLink}
      >
        {obj.title}
      </a>
    ),
    responsible:
      obj.persons && obj.persons.length > 1 ? (
        <span className={styles.personsLabel} title={formatPersonsFullList(obj.persons)}>
          {formatPersons(obj.persons)}
        </span>
      ) : (
        formatPersons(obj.persons)
      ),
    createdAt: formatDate(obj.createdAt),
    estimatedFinishDate: formatDate(obj.estimatedFinishDate),
  }));

  return (
    <Card variant="panel">
      <div className={styles.wrapper}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Tareas</h2>
          <Button
            fab
            aria-label="Nueva tarea"
            onClick={() => router.push(`/objectives/new?projectId=${projectId}`)}
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
            ariaLabel="Tareas del proyecto"
            emptyState={<span>No se encontraron tareas</span>}
          />

          <div className={styles.paginationRow}>
            <Pagination
              totalItems={visibleObjectives.length}
              limit={pageSize}
              currentPage={currentPage}
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
