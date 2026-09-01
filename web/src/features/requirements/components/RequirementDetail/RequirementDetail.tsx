'use client';

import React, { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import { MarkdownViewer } from '@/features/attachments/components/MarkdownViewer';
import { AutomatedIdentityBadge } from '@/shared/components/ui/AutomatedIdentityBadge';
import { Pagination } from '@/shared/components/ui/Pagination';
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

const OBJ_TABS: { key: ObjectiveState; label: string }[] = [
  { key: 'backlog', label: 'Backlog' },
  { key: 'activo', label: 'Activo' },
  { key: 'en_revision', label: 'En revisión' },
  { key: 'finalizado', label: 'Finalizado' },
  { key: 'cancelado', label: 'Cancelado' },
];

const OBJ_PAGE_SIZE_OPTIONS = [5, 10];

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

  return (
    <>
      <RequirementHeader requirement={requirement} onUpdate={handleUpdate} isPending={isPending} />
      <div className={styles.container}>
        {/* Left column */}
        <div className={styles.leftColumn}>
          {/* Card: Contexto */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>Contexto</div>
            <div className={styles.contextBody}>
              <MarkdownViewer content={requirement.description} />
            </div>
          </div>

          {/* Card: Estado */}
          <RequirementStatusCard
            requirement={requirement}
            onUpdate={handleUpdate}
            isPending={isPending}
          />

          {/* Card: Objetivos */}
          <div className={styles.card}>
            <div className={styles.objSectionHeader}>
              <span className={styles.cardTitle}>Tareas</span>
              <button
                type="button"
                className={styles.addBtn}
                aria-label="Nueva tarea"
                onClick={handleCreateObjective}
              >
                +
              </button>
            </div>
            <div className={styles.tabs}>
              {OBJ_TABS.map((tab) => {
                const count = objectives.filter((o) => o.state === tab.key).length;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    className={`${styles.tab}${activeObjTab === tab.key ? ` ${styles.tabActive}` : ''}`}
                    onClick={() => {
                      setActiveObjTab(tab.key);
                      setObjPage(1);
                    }}
                  >
                    {tab.label}
                    <span className={styles.tabCount}>{count}</span>
                  </button>
                );
              })}
            </div>
            {(() => {
              const filtered = objectives.filter((o) => o.state === activeObjTab);
              const totalPages = Math.max(1, Math.ceil(filtered.length / objPageSize));
              const page = Math.min(objPage, totalPages);
              const pageItems = filtered.slice((page - 1) * objPageSize, page * objPageSize);
              return (
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
                      {pageItems.length === 0 ? (
                        <tr>
                          <td colSpan={5} className={styles.objEmpty}>
                            Sin tareas en esta etapa
                          </td>
                        </tr>
                      ) : (
                        pageItems.map((obj) => (
                          <tr
                            key={obj.id}
                            className={styles.objRow}
                            onClick={() => window.open(`/objectives/${obj.id}`, '_blank')}
                          >
                            <td>{obj.id}</td>
                            <td className={styles.objTitleCell}>{obj.title}</td>
                            <td>
                              {obj.persons && obj.persons.length > 1 ? (
                                <span title={formatPersonsFullList(obj.persons)}>
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
                  <div className={styles.paginationRow}>
                    <Pagination
                      totalItems={filtered.length}
                      limit={objPageSize}
                      currentPage={page}
                      onPageChange={setObjPage}
                    />
                    <select
                      className={styles.perPageSelect}
                      value={objPageSize}
                      onChange={(event) => {
                        setObjPageSize(Number(event.target.value));
                        setObjPage(1);
                      }}
                    >
                      {OBJ_PAGE_SIZE_OPTIONS.map((size) => (
                        <option key={size} value={size}>
                          {size} por página
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Card: Actividad */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>Actividad</div>
            <div className={styles.activityScroll}>
              <RequirementActivityFeed activity={requirement.activity ?? []} />
            </div>
            <RequirementActivityForm reqid={requirement.id} />
          </div>
        </div>

        {/* Right column */}
        <div className={styles.rightColumn}>
          {/* Card: Información General */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>Información General</div>
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
          </div>

          {/* Card: Horas Trabajadas — se carga sola, con su propia query; no cuelga del
              payload del requisito (S-045). Va justo debajo de "Información General": es el
              dato de consulta que se lee junto a los datos de identificación del requisito. */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>Horas Trabajadas</div>
            <RequirementWorkedHoursCard reqid={requirement.id} />
          </div>

          {/* Card: Etiquetas */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>Etiquetas</div>
            <div className={styles.tagList}>
              {localTags.length === 0 && (
                <span className={styles.emptyText}>Sin etiquetas registradas</span>
              )}
              {localTags.map((tag, i) => (
                <span key={i} className={styles.tagPill}>
                  {tag.key}:{tag.value}
                  <button
                    type="button"
                    className={styles.tagPillRemove}
                    onClick={() => handleRemoveTag(i)}
                    aria-label={`Eliminar etiqueta ${tag.key}:${tag.value}`}
                    disabled={isPending}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

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
