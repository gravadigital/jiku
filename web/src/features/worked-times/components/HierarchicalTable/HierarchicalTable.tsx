'use client';

import { useCallback, useState } from 'react';
import { TintedIcon } from '@/shared/components/ui/TintedIcon';
import { cn } from '@/shared/utils/cn';
import { formatMinutes } from '@/shared/utils/format-minutes';
import objectivesLogo from '@root/assets/objetivosLogo.svg';
import requirementsLogo from '@root/assets/requisitosLogo.svg';
import { groupObjectivesByRequirement } from '../../utils/groupObjectivesByRequirement';
import styles from './HierarchicalTable.module.scss';
import type { UnworkedTimeReportDay } from '../../types/unworked-time.types';
import type { ReportByPerson, ReportByProject } from '../../types/worked-time.types';
import type { ReportView } from '../ViewToggle';

const ABSENCE_CODE = 'AUS';

interface HierarchicalTableProps {
  readonly dataByPerson?: ReportByPerson[];
  readonly dataByProject?: ReportByProject[];
  readonly activeView: ReportView;
  readonly absencesByPerson?: Map<number, UnworkedTimeReportDay[]>;
  readonly reasonLabels?: Record<string, string>;
}

// Etiqueta del destino más profundo: objetivo > requisito > solo-proyecto.
function getEntryLabel(entry: {
  objectiveTitle: string | null;
  requirementTitle: string | null;
}): string {
  if (entry.objectiveTitle) return entry.objectiveTitle;
  if (entry.requirementTitle) return entry.requirementTitle;
  return 'Sin requisito/tarea';
}

// Ícono del destino más profundo: objetivo > requisito > ninguno (sin destino específico).
function getEntryIcon(entry: {
  objectiveTitle: string | null;
  requirementTitle: string | null;
}): { src: typeof objectivesLogo; alt: string } | null {
  if (entry.objectiveTitle) return { src: objectivesLogo, alt: 'Tarea' };
  if (entry.requirementTitle) return { src: requirementsLogo, alt: 'Requisito' };
  return null;
}

function sortByMinutesDesc<T extends { totalMinutes: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.totalMinutes - a.totalMinutes);
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function getAvatarColor(firstName: string, lastName: string): string {
  const colors = [
    '#5B6ABF',
    '#3D8B7A',
    '#C4534E',
    '#7B68AE',
    '#4A90D9',
    '#D97A1E',
    '#2E8B57',
    '#6B5FF8',
    '#8B4513',
    '#DA2C6A',
    '#1E88A8',
    '#9C27B0',
    '#E65100',
    '#00897B',
    '#5C6BC0',
  ];
  const str = `${firstName}${lastName}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function HierarchicalTable({
  dataByPerson,
  dataByProject,
  activeView,
  absencesByPerson,
  reasonLabels = {},
}: HierarchicalTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = useCallback((key: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const isEmpty =
    activeView === 'by-person'
      ? !dataByPerson || dataByPerson.length === 0
      : !dataByProject || dataByProject.length === 0;

  if (isEmpty) {
    return <div className={styles.empty}>No hay horas registradas para este período</div>;
  }

  if (activeView === 'by-person' && dataByPerson) {
    return (
      <div className={styles.table}>
        {sortByMinutesDesc(dataByPerson).map((person) => {
          const personKey = `person-${person.personId}`;
          const isPersonExpanded = expandedRows.has(personKey);

          return (
            <div key={personKey} className={styles.group}>
              <button
                type="button"
                className={cn(styles.row, styles.level1)}
                onClick={() => toggleRow(personKey)}
              >
                <span className={styles.chevron}>{isPersonExpanded ? '\u25BC' : '\u25B6'}</span>
                <span
                  className={styles.avatar}
                  style={{
                    backgroundColor: getAvatarColor(person.personFirstName, person.personLastName),
                  }}
                >
                  {getInitials(person.personFirstName, person.personLastName)}
                </span>
                <span className={styles.name}>
                  {person.personFirstName} {person.personLastName}
                </span>
                <span className={styles.hours}>{formatMinutes(person.totalMinutes)}</span>
              </button>

              {isPersonExpanded &&
                sortByMinutesDesc(
                  person.projects.filter((p) => p.projectCode !== ABSENCE_CODE)
                ).map((project) => {
                  const projectKey = `${personKey}-project-${project.projectId}`;
                  const isProjectExpanded = expandedRows.has(projectKey);
                  const pct = Math.round((project.totalMinutes / person.totalMinutes) * 100);

                  return (
                    <div key={projectKey}>
                      <button
                        type="button"
                        className={cn(styles.row, styles.level2)}
                        onClick={() => toggleRow(projectKey)}
                      >
                        <span className={styles.barBg} style={{ width: `${pct}%` }} />
                        <span className={styles.chevron}>
                          {isProjectExpanded ? '\u25BC' : '\u25B6'}
                        </span>
                        <span className={styles.name}>
                          {project.projectName}
                          <span className={styles.code}>{project.projectCode}</span>
                        </span>
                        <span className={styles.hours}>{formatMinutes(project.totalMinutes)}</span>
                        <span className={styles.pct}>{pct}%</span>
                      </button>

                      {isProjectExpanded &&
                        (() => {
                          const { requirementGroups, noRequirementTasks, soloProjectEntries } =
                            groupObjectivesByRequirement(project.objectives);

                          return (
                            <>
                              {sortByMinutesDesc(
                                requirementGroups.map((group) => ({
                                  ...group,
                                  totalMinutes:
                                    group.direct +
                                    group.tasks.reduce((sum, t) => sum + t.totalMinutes, 0),
                                }))
                              ).map((group) => {
                                const reqKey = `${projectKey}-req-${group.requirementId}`;
                                const isReqExpanded = expandedRows.has(reqKey);

                                return (
                                  <div key={reqKey}>
                                    <button
                                      type="button"
                                      className={cn(styles.row, styles.level3)}
                                      onClick={() => toggleRow(reqKey)}
                                    >
                                      <span className={styles.chevron}>
                                        {isReqExpanded ? '▼' : '▶'}
                                      </span>
                                      <TintedIcon
                                        src={requirementsLogo}
                                        alt="Requisito"
                                        size={16}
                                        className={styles.entryIcon}
                                      />
                                      <span className={styles.name}>{group.requirementTitle}</span>
                                      <span className={styles.hours}>
                                        {formatMinutes(group.totalMinutes)}
                                      </span>
                                    </button>

                                    {isReqExpanded && (
                                      <>
                                        {sortByMinutesDesc(group.tasks).map((task) => {
                                          const icon = getEntryIcon(task);
                                          return (
                                            <div
                                              key={`${reqKey}-obj-${task.objectiveId}`}
                                              className={cn(styles.row, styles.level4)}
                                            >
                                              {icon && (
                                                <TintedIcon
                                                  src={icon.src}
                                                  alt={icon.alt}
                                                  size={16}
                                                  className={styles.entryIcon}
                                                />
                                              )}
                                              <span className={styles.name}>
                                                {getEntryLabel(task)}
                                              </span>
                                              <span className={styles.hours}>
                                                {formatMinutes(task.totalMinutes)}
                                              </span>
                                            </div>
                                          );
                                        })}
                                        {group.direct > 0 && (
                                          <div className={cn(styles.row, styles.level4)}>
                                            <span className={styles.name}>Sin tarea</span>
                                            <span className={styles.hours}>
                                              {formatMinutes(group.direct)}
                                            </span>
                                          </div>
                                        )}
                                      </>
                                    )}
                                  </div>
                                );
                              })}

                              {noRequirementTasks.length > 0 &&
                                (() => {
                                  const noReqKey = `${projectKey}-no-requirement`;
                                  const isNoReqExpanded = expandedRows.has(noReqKey);
                                  const noReqTotal = noRequirementTasks.reduce(
                                    (sum, t) => sum + t.totalMinutes,
                                    0
                                  );

                                  return (
                                    <div key={noReqKey}>
                                      <button
                                        type="button"
                                        className={cn(styles.row, styles.level3)}
                                        onClick={() => toggleRow(noReqKey)}
                                      >
                                        <span className={styles.chevron}>
                                          {isNoReqExpanded ? '▼' : '▶'}
                                        </span>
                                        <TintedIcon
                                          src={objectivesLogo}
                                          alt="Tarea"
                                          size={16}
                                          className={styles.entryIcon}
                                        />
                                        <span className={styles.name}>Tareas sin requisito</span>
                                        <span className={styles.hours}>
                                          {formatMinutes(noReqTotal)}
                                        </span>
                                      </button>

                                      {isNoReqExpanded &&
                                        sortByMinutesDesc(noRequirementTasks).map((task) => {
                                          const icon = getEntryIcon(task);
                                          return (
                                            <div
                                              key={`${noReqKey}-obj-${task.objectiveId}`}
                                              className={cn(styles.row, styles.level4)}
                                            >
                                              {icon && (
                                                <TintedIcon
                                                  src={icon.src}
                                                  alt={icon.alt}
                                                  size={16}
                                                  className={styles.entryIcon}
                                                />
                                              )}
                                              <span className={styles.name}>
                                                {getEntryLabel(task)}
                                              </span>
                                              <span className={styles.hours}>
                                                {formatMinutes(task.totalMinutes)}
                                              </span>
                                            </div>
                                          );
                                        })}
                                    </div>
                                  );
                                })()}

                              {sortByMinutesDesc(soloProjectEntries).map((entry) => {
                                const objKey = `${projectKey}-obj-none-req-none`;
                                const icon = getEntryIcon(entry);
                                return (
                                  <div key={objKey} className={cn(styles.row, styles.level3)}>
                                    {icon && (
                                      <TintedIcon
                                        src={icon.src}
                                        alt={icon.alt}
                                        size={16}
                                        className={styles.entryIcon}
                                      />
                                    )}
                                    <span className={styles.name}>{getEntryLabel(entry)}</span>
                                    <span className={styles.hours}>
                                      {formatMinutes(entry.totalMinutes)}
                                    </span>
                                  </div>
                                );
                              })}
                            </>
                          );
                        })()}
                    </div>
                  );
                })}

              {isPersonExpanded &&
                (() => {
                  const absenceProject = person.projects.find(
                    (p) => p.projectCode === ABSENCE_CODE
                  );
                  if (!absenceProject) return null;
                  const absencesKey = `${personKey}-absences`;
                  const isAbsencesExpanded = expandedRows.has(absencesKey);
                  const pct = Math.round((absenceProject.totalMinutes / person.totalMinutes) * 100);

                  return (
                    <div key={absencesKey}>
                      <button
                        type="button"
                        className={cn(styles.row, styles.level2)}
                        onClick={() => toggleRow(absencesKey)}
                      >
                        <span className={styles.barBg} style={{ width: `${pct}%` }} />
                        <span className={styles.chevron}>
                          {isAbsencesExpanded ? '\u25BC' : '\u25B6'}
                        </span>
                        <span className={styles.name}>Ausencias</span>
                        <span className={styles.hours}>
                          {formatMinutes(absenceProject.totalMinutes)}
                        </span>
                        <span className={styles.pct}>{pct}%</span>
                      </button>

                      {isAbsencesExpanded &&
                        (() => {
                          const personDays = absencesByPerson?.get(person.personId) ?? [];
                          const byReason = new Map<string, number>();
                          for (const day of personDays) {
                            for (const entry of day.entries) {
                              byReason.set(
                                entry.reason,
                                (byReason.get(entry.reason) ?? 0) + entry.minutes
                              );
                            }
                          }
                          const sortedReasons = Array.from(byReason.entries()).sort(
                            (a, b) => b[1] - a[1]
                          );

                          return sortedReasons.map(([reason, minutes]) => (
                            <div
                              key={`${absencesKey}-${reason}`}
                              className={cn(styles.row, styles.level3)}
                            >
                              <span className={styles.name}>{reasonLabels[reason] ?? reason}</span>
                              <span className={styles.hours}>{formatMinutes(minutes)}</span>
                            </div>
                          ));
                        })()}
                    </div>
                  );
                })()}
            </div>
          );
        })}
      </div>
    );
  }

  if (activeView === 'by-project' && dataByProject) {
    const totalMinutes = dataByProject.reduce((sum, p) => sum + p.totalMinutes, 0);

    return (
      <div className={styles.table}>
        {sortByMinutesDesc(dataByProject).map((project) => {
          const projectKey = `project-${project.projectId}`;
          const isProjectExpanded = expandedRows.has(projectKey);
          const pct =
            totalMinutes > 0 ? Math.round((project.totalMinutes / totalMinutes) * 100) : 0;

          return (
            <div key={projectKey} className={styles.group}>
              <button
                type="button"
                className={cn(styles.row, styles.level1)}
                onClick={() => toggleRow(projectKey)}
              >
                <span className={styles.barBg} style={{ width: `${pct}%` }} />
                <span className={styles.chevron}>{isProjectExpanded ? '\u25BC' : '\u25B6'}</span>
                <span className={styles.name}>
                  {project.projectName}
                  <span className={styles.code}>{project.projectCode}</span>
                </span>
                <span className={styles.hours}>{formatMinutes(project.totalMinutes)}</span>
                <span className={styles.pct}>{pct}%</span>
              </button>

              {isProjectExpanded && (
                <>
                  {(() => {
                    const { requirementGroups, noRequirementTasks, soloProjectEntries } =
                      groupObjectivesByRequirement(project.objectives);

                    const renderPersonBreakdown = (
                      parentKey: string,
                      persons: typeof project.persons
                    ) =>
                      sortByMinutesDesc(persons).map((person) => (
                        <div
                          key={`${parentKey}-person-${person.personId}`}
                          className={cn(styles.row, styles.level4)}
                        >
                          <span
                            className={cn(styles.avatar, styles.avatarSm)}
                            style={{
                              backgroundColor: getAvatarColor(
                                person.personFirstName,
                                person.personLastName
                              ),
                            }}
                          >
                            {getInitials(person.personFirstName, person.personLastName)}
                          </span>
                          <span className={styles.name}>
                            {person.personFirstName} {person.personLastName}
                          </span>
                          <span className={styles.hours}>{formatMinutes(person.totalMinutes)}</span>
                        </div>
                      ));

                    return (
                      <>
                        {sortByMinutesDesc(
                          requirementGroups.map((group) => ({
                            ...group,
                            totalMinutes:
                              group.direct +
                              group.tasks.reduce((sum, t) => sum + t.totalMinutes, 0),
                          }))
                        ).map((group) => {
                          const reqKey = `${projectKey}-req-${group.requirementId}`;
                          const isReqExpanded = expandedRows.has(reqKey);

                          return (
                            <div key={reqKey}>
                              <button
                                type="button"
                                className={cn(styles.row, styles.level2)}
                                onClick={() => toggleRow(reqKey)}
                              >
                                <span className={styles.chevron}>
                                  {isReqExpanded ? '\u25BC' : '\u25B6'}
                                </span>
                                <TintedIcon
                                  src={requirementsLogo}
                                  alt="Requisito"
                                  size={16}
                                  className={styles.entryIcon}
                                />
                                <span className={styles.name}>{group.requirementTitle}</span>
                                <span className={styles.hours}>
                                  {formatMinutes(group.totalMinutes)}
                                </span>
                              </button>

                              {isReqExpanded && (
                                <>
                                  {sortByMinutesDesc(group.tasks).map((task) => {
                                    const taskKey = `${reqKey}-obj-${task.objectiveId}`;
                                    const isTaskExpanded = expandedRows.has(taskKey);
                                    const icon = getEntryIcon(task);
                                    return (
                                      <div key={taskKey}>
                                        <button
                                          type="button"
                                          className={cn(styles.row, styles.level3)}
                                          onClick={() => toggleRow(taskKey)}
                                        >
                                          <span className={styles.chevron}>
                                            {isTaskExpanded ? '\u25BC' : '\u25B6'}
                                          </span>
                                          {icon && (
                                            <TintedIcon
                                              src={icon.src}
                                              alt={icon.alt}
                                              size={16}
                                              className={styles.entryIcon}
                                            />
                                          )}
                                          <span className={styles.name}>{getEntryLabel(task)}</span>
                                          <span className={styles.hours}>
                                            {formatMinutes(task.totalMinutes)}
                                          </span>
                                        </button>
                                        {isTaskExpanded &&
                                          renderPersonBreakdown(taskKey, task.persons)}
                                      </div>
                                    );
                                  })}
                                  {group.direct > 0 &&
                                    group.directEntry &&
                                    (() => {
                                      const directKey = `${reqKey}-direct`;
                                      const isDirectExpanded = expandedRows.has(directKey);
                                      return (
                                        <div key={directKey}>
                                          <button
                                            type="button"
                                            className={cn(styles.row, styles.level3)}
                                            onClick={() => toggleRow(directKey)}
                                          >
                                            <span className={styles.chevron}>
                                              {isDirectExpanded ? '▼' : '▶'}
                                            </span>
                                            <span className={styles.name}>Sin tarea</span>
                                            <span className={styles.hours}>
                                              {formatMinutes(group.direct)}
                                            </span>
                                          </button>
                                          {isDirectExpanded &&
                                            renderPersonBreakdown(
                                              directKey,
                                              group.directEntry.persons
                                            )}
                                        </div>
                                      );
                                    })()}
                                </>
                              )}
                            </div>
                          );
                        })}

                        {noRequirementTasks.length > 0 &&
                          (() => {
                            const noReqKey = `${projectKey}-no-requirement`;
                            const isNoReqExpanded = expandedRows.has(noReqKey);
                            const noReqTotal = noRequirementTasks.reduce(
                              (sum, t) => sum + t.totalMinutes,
                              0
                            );

                            return (
                              <div key={noReqKey}>
                                <button
                                  type="button"
                                  className={cn(styles.row, styles.level2)}
                                  onClick={() => toggleRow(noReqKey)}
                                >
                                  <span className={styles.chevron}>
                                    {isNoReqExpanded ? '\u25BC' : '\u25B6'}
                                  </span>
                                  <TintedIcon
                                    src={objectivesLogo}
                                    alt="Tarea"
                                    size={16}
                                    className={styles.entryIcon}
                                  />
                                  <span className={styles.name}>Tareas sin requisito</span>
                                  <span className={styles.hours}>{formatMinutes(noReqTotal)}</span>
                                </button>

                                {isNoReqExpanded &&
                                  sortByMinutesDesc(noRequirementTasks).map((task) => {
                                    const taskKey = `${noReqKey}-obj-${task.objectiveId}`;
                                    const isTaskExpanded = expandedRows.has(taskKey);
                                    const icon = getEntryIcon(task);
                                    return (
                                      <div key={taskKey}>
                                        <button
                                          type="button"
                                          className={cn(styles.row, styles.level3)}
                                          onClick={() => toggleRow(taskKey)}
                                        >
                                          <span className={styles.chevron}>
                                            {isTaskExpanded ? '\u25BC' : '\u25B6'}
                                          </span>
                                          {icon && (
                                            <TintedIcon
                                              src={icon.src}
                                              alt={icon.alt}
                                              size={16}
                                              className={styles.entryIcon}
                                            />
                                          )}
                                          <span className={styles.name}>{getEntryLabel(task)}</span>
                                          <span className={styles.hours}>
                                            {formatMinutes(task.totalMinutes)}
                                          </span>
                                        </button>
                                        {isTaskExpanded &&
                                          renderPersonBreakdown(taskKey, task.persons)}
                                      </div>
                                    );
                                  })}
                              </div>
                            );
                          })()}

                        {sortByMinutesDesc(soloProjectEntries).map((entry) => {
                          const objKey = `${projectKey}-obj-none-req-none`;
                          const isObjExpanded = expandedRows.has(objKey);
                          const icon = getEntryIcon(entry);
                          return (
                            <div key={objKey}>
                              <button
                                type="button"
                                className={cn(styles.row, styles.level2)}
                                onClick={() => toggleRow(objKey)}
                              >
                                <span className={styles.chevron}>
                                  {isObjExpanded ? '\u25BC' : '\u25B6'}
                                </span>
                                {icon && (
                                  <TintedIcon
                                    src={icon.src}
                                    alt={icon.alt}
                                    size={16}
                                    className={styles.entryIcon}
                                  />
                                )}
                                <span className={styles.name}>{getEntryLabel(entry)}</span>
                                <span className={styles.hours}>
                                  {formatMinutes(entry.totalMinutes)}
                                </span>
                              </button>
                              {isObjExpanded && renderPersonBreakdown(objKey, entry.persons)}
                            </div>
                          );
                        })}
                      </>
                    );
                  })()}

                  {project.persons.length > 0 && (
                    <div>
                      {(() => {
                        const noObjKey = `${projectKey}-no-objective`;
                        const isNoObjExpanded = expandedRows.has(noObjKey);
                        const noObjTotal = project.persons.reduce(
                          (sum, p) => sum + p.totalMinutes,
                          0
                        );

                        return (
                          <>
                            <button
                              type="button"
                              className={cn(styles.row, styles.level2)}
                              onClick={() => toggleRow(noObjKey)}
                            >
                              <span className={styles.chevron}>
                                {isNoObjExpanded ? '\u25BC' : '\u25B6'}
                              </span>
                              <span className={styles.name}>Sin requisito/tarea</span>
                              <span className={styles.hours}>{formatMinutes(noObjTotal)}</span>
                            </button>

                            {isNoObjExpanded &&
                              sortByMinutesDesc(project.persons).map((person) => (
                                <div
                                  key={`${noObjKey}-person-${person.personId}`}
                                  className={cn(styles.row, styles.level3)}
                                >
                                  <span
                                    className={cn(styles.avatar, styles.avatarSm)}
                                    style={{
                                      backgroundColor: getAvatarColor(
                                        person.personFirstName,
                                        person.personLastName
                                      ),
                                    }}
                                  >
                                    {getInitials(person.personFirstName, person.personLastName)}
                                  </span>
                                  <span className={styles.name}>
                                    {person.personFirstName} {person.personLastName}
                                  </span>
                                  <span className={styles.hours}>
                                    {formatMinutes(person.totalMinutes)}
                                  </span>
                                </div>
                              ))}
                          </>
                        );
                      })()}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return null;
}
