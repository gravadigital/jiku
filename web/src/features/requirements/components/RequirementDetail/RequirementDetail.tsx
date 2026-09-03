'use client';

import React, { useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import { MarkdownViewer } from '@/features/attachments/components/MarkdownViewer';
import { Badge, Button, Card, EmptyState, Pagination, Table, Tabs } from '@/shared/components/ui';
import { AutomatedIdentityBadge } from '@/shared/components/ui/AutomatedIdentityBadge';
import { useUpdateRequirement } from '../../hooks/useUpdateRequirement';
import { RequirementActivityFeed } from '../RequirementActivityFeed';
import { RequirementActivityForm } from '../RequirementActivityForm';
import { RequirementHeader } from '../RequirementHeader';
import { RequirementResolutionCard } from '../RequirementResolutionCard';
import { RequirementStatusCard } from '../RequirementStatusCard';
import { RequirementWorkedHoursCard } from '../RequirementWorkedHoursCard';
import styles from './RequirementDetail.module.scss';
import type {
  Requirement,
  RequirementDetail as RequirementDetailData,
  RequirementTag,
  UpdateRequirementPayload,
} from '../../types/requirement.types';
import type { Objective, ObjectiveState } from '@/features/objectives/types/objective.types';
import type { TableColumn, TableRow } from '@/shared/components/ui/Table';

const OBJ_TABS: { key: ObjectiveState; label: string }[] = [
  { key: 'backlog', label: 'Backlog' },
  { key: 'activo', label: 'Activo' },
  { key: 'en_revision', label: 'En revisión' },
  { key: 'finalizado', label: 'Finalizado' },
  { key: 'cancelado', label: 'Cancelado' },
];

const OBJ_PAGE_SIZE_OPTIONS = [5, 10];

const OBJ_COLUMNS: readonly TableColumn[] = [
  { key: 'id', label: 'ID' },
  { key: 'title', label: 'Título' },
  { key: 'responsible', label: 'Responsable' },
  { key: 'createdAt', label: 'Creación' },
  { key: 'estimatedFinishDate', label: 'Cierre estimado' },
];

interface RequirementDetailProps {
  readonly requirement: Requirement & Partial<Pick<RequirementDetailData, 'linkedObjectives'>>;
}

function formatDate(isoString: string | Date | null | undefined): string {
  if (!isoString) return '-';
  const d = new Date(isoString);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatPersons(persons: Objective['persons']): string {
  if (!persons || persons.length === 0) return '-';
  const first = persons[0];
  const name = `${first.firstName} ${first.lastName}`.trim();
  if (persons.length === 1) return name;
  return `${name} +${persons.length - 1}`;
}

function formatPersonsFullList(persons: Objective['persons']): string {
  if (!persons || persons.length === 0) return '';
  return persons.map((p) => `${p.firstName} ${p.lastName}`.trim()).join(', ');
}

function formatResponsibles(people: Requirement['responsiblePeople']): string {
  const first = people[0];
  const name = `${first.firstName} ${first.lastName}`.trim();
  if (people.length === 1) return name;
  return `${name} +${people.length - 1}`;
}

function formatResponsiblesFullList(people: Requirement['responsiblePeople']): string {
  return people.map((p) => `${p.firstName} ${p.lastName}`.trim()).join(', ');
}

function formatRelative(isoString: string | null | undefined): string {
  if (!isoString) return '-';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} día${days !== 1 ? 's' : ''}`;
}

export function RequirementDetail({ requirement }: RequirementDetailProps) {
  const { push } = useRouter();
  const { mutate: updateRequirement, isPending } = useUpdateRequirement();
  const [localTags, setLocalTags] = useState<RequirementTag[]>(requirement.tags ?? []);
  const [activeObjTab, setActiveObjTab] = useState<ObjectiveState>('activo');
  const [objPage, setObjPage] = useState(1);
  const [objPageSize, setObjPageSize] = useState(OBJ_PAGE_SIZE_OPTIONS[0]);
  const objectives = requirement.linkedObjectives ?? [];

  const handleCreateObjective = useCallback(() => {
    push(`/objectives/new?requirementId=${requirement.id}&projectId=${requirement.projectId}`);
  }, [push, requirement.id, requirement.projectId]);

  const basePayload: UpdateRequirementPayload = {
    title: requirement.title,
    description: requirement.description,
    type: requirement.type,
    priority: requirement.priority,
    state: requirement.state,
    tags: localTags,
    ...(requirement.estimatedFinishDate && {
      estimatedFinishDate: requirement.estimatedFinishDate,
    }),
  };

  const handleUpdate = useCallback(
    (payload: UpdateRequirementPayload) => {
      updateRequirement(
        { reqid: requirement.id, payload: { ...basePayload, ...payload } },
        {
          onError: (error: any) => {
            toast.error(error?.message ?? 'Error al actualizar el requisito');
          },
        }
      );
    },
    [updateRequirement, requirement.id, basePayload]
  );

  const handleRemoveTag = useCallback(
    (index: number) => {
      const newTags = localTags.filter((_, i) => i !== index);
      setLocalTags(newTags);
      handleUpdate({ tags: newTags });
    },
    [localTags, handleUpdate]
  );

  const objTabs = OBJ_TABS.map((tab) => ({
    ...tab,
    count: objectives.filter((o) => o.state === tab.key).length,
  }));

  const filteredObjectives = objectives.filter((o) => o.state === activeObjTab);
  const objTotalPages = Math.max(1, Math.ceil(filteredObjectives.length / objPageSize));
  const objCurrentPage = Math.min(objPage, objTotalPages);
  const objPageItems = filteredObjectives.slice(
    (objCurrentPage - 1) * objPageSize,
    objCurrentPage * objPageSize
  );

  const objRows: TableRow[] = objPageItems.map((obj) => ({
    id: obj.id,
    title: (
      <Link href={`/objectives/${obj.id}`} target="_blank" className={styles.objTitleCell}>
        {obj.title}
      </Link>
    ),
    responsible:
      obj.persons && obj.persons.length > 1 ? (
        <span title={formatPersonsFullList(obj.persons)}>{formatPersons(obj.persons)}</span>
      ) : (
        formatPersons(obj.persons)
      ),
    createdAt: formatDate(obj.createdAt),
    estimatedFinishDate: formatDate(obj.estimatedFinishDate),
  }));

  return (
    <>
      <RequirementHeader requirement={requirement} onUpdate={handleUpdate} isPending={isPending} />
      <div className={styles.container}>
        {/* Left column */}
        <div className={styles.leftColumn}>
          {/* Card: Contexto */}
          <Card variant="panel" title="Contexto" headingLevel="h2">
            <div className={styles.contextBody}>
              <MarkdownViewer content={requirement.description} />
            </div>
          </Card>

          {/* Card: Estado */}
          <RequirementStatusCard
            requirement={requirement}
            onUpdate={handleUpdate}
            isPending={isPending}
          />

          {/* Card: Objetivos */}
          <Card
            variant="panel"
            headingLevel="h2"
            header={
              <>
                <h2 className={styles.cardTitle}>Tareas</h2>
                <Button variant="secondary-dismiss" onClick={handleCreateObjective}>
                  <span aria-hidden="true">+</span>
                  <span className={styles.srOnly}>Nueva tarea</span>
                </Button>
              </>
            }
          >
            <Tabs
              tabs={objTabs}
              activeKey={activeObjTab}
              onChange={(key) => {
                setActiveObjTab(key as ObjectiveState);
                setObjPage(1);
              }}
            >
              <div className={styles.tableWrap}>
                <Table
                  variant="light"
                  columns={OBJ_COLUMNS}
                  rows={objRows}
                  ariaLabel="Tabla de tareas"
                  emptyState={
                    <EmptyState variant="filtered" message="Sin tareas en esta etapa" />
                  }
                />
                <div className={styles.paginationRow}>
                  <Pagination
                    totalItems={filteredObjectives.length}
                    limit={objPageSize}
                    currentPage={objCurrentPage}
                    onPageChange={setObjPage}
                    pageSizeOptions={OBJ_PAGE_SIZE_OPTIONS}
                    onPageSizeChange={(size) => {
                      setObjPageSize(size);
                      setObjPage(1);
                    }}
                  />
                </div>
              </div>
            </Tabs>
          </Card>

          {/* Card: Actividad */}
          <Card variant="panel" title="Actividad" headingLevel="h2">
            <div className={styles.activityScroll}>
              <RequirementActivityFeed activity={requirement.activity ?? []} reqid={requirement.id} />
            </div>
            <RequirementActivityForm reqid={requirement.id} />
          </Card>
        </div>

        {/* Right column */}
        <div className={styles.rightColumn}>
          {/* Card: Información General */}
          <Card variant="panel" title="Información General" headingLevel="h2">
            <dl className={styles.grid}>
              {requirement.project && (
                <div className={styles.row}>
                  <dt>Proyecto</dt>
                  <dd>{requirement.project.name}</dd>
                </div>
              )}

              {(() => {
                const leader = requirement.responsiblePeople?.find((p) => p.isLeader === true);
                const others = (requirement.responsiblePeople ?? []).filter(
                  (p) => p.isLeader !== true
                );
                return (
                  <>
                    {leader && (
                      <div className={styles.row} data-leader="true">
                        <dt>Responsable (líder)</dt>
                        <dd className={styles.responsibleLeader}>
                          {leader.firstName} {leader.lastName}
                        </dd>
                      </div>
                    )}
                    {others.length > 0 && (
                      <div className={styles.row} data-leader="false">
                        <dt>Responsable(s)</dt>
                        <dd>
                          {others.length > 1 ? (
                            <span
                              className={styles.responsiblesGrouped}
                              title={formatResponsiblesFullList(others)}
                            >
                              {formatResponsibles(others)}
                            </span>
                          ) : (
                            formatResponsibles(others)
                          )}
                        </dd>
                      </div>
                    )}
                  </>
                );
              })()}

              <div className={styles.row}>
                <dt>Visibilidad</dt>
                <dd>{requirement.visibilityLevel === 'public' ? 'Público' : 'Interno'}</dd>
              </div>

              <div className={styles.row}>
                <dt>Creado por</dt>
                <dd>
                  {requirement.creator.name}{' '}
                  <AutomatedIdentityBadge identityType={requirement.creator.identityType} />
                </dd>
              </div>

              <div className={styles.row}>
                <dt>Fecha de creación</dt>
                <dd>{formatDate(requirement.createdAt)}</dd>
              </div>

              <div className={styles.row}>
                <dt>Última actualización</dt>
                <dd>{formatRelative(requirement.updatedAt)}</dd>
              </div>
            </dl>
          </Card>

          {/* Card: Horas Trabajadas — se carga sola, con su propia query; no cuelga del
              payload del requisito (S-045). Va justo debajo de "Información General": es el
              dato de consulta que se lee junto a los datos de identificación del requisito. */}
          <Card variant="panel" title="Horas Trabajadas" headingLevel="h2">
            <RequirementWorkedHoursCard reqid={requirement.id} />
          </Card>

          {/* Card: Etiquetas */}
          <Card variant="panel" title="Etiquetas" headingLevel="h2">
            <div className={styles.tagList}>
              {localTags.length === 0 && (
                <span className={styles.emptyText}>Sin etiquetas registradas</span>
              )}
              {localTags.map((tag, i) => (
                <span key={i} className={styles.tagPill}>
                  <Badge variant="card-tag" label={`${tag.key}: ${tag.value}`} />
                  <Button
                    variant="secondary-dismiss"
                    onClick={() => handleRemoveTag(i)}
                    disabled={isPending}
                  >
                    <span aria-hidden="true">×</span>
                    <span className={styles.srOnly}>
                      Eliminar etiqueta {tag.key}:{tag.value}
                    </span>
                  </Button>
                </span>
              ))}
            </div>
          </Card>

          {/* Card: Resolución */}
          <RequirementResolutionCard
            requirement={requirement}
            onUpdate={handleUpdate}
            isPending={isPending}
          />
        </div>
      </div>
    </>
  );
}
