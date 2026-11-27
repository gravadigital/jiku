'use client';

import { Accordion } from '@/shared/components/ui/Accordion';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import { TintedIcon } from '@/shared/components/ui/TintedIcon';
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

// Paleta de avatares: derivada de foundations/color.md — variaciones de grafito y azul oscuro,
// sin magenta ni ningún color fuera de la paleta del manual (ver TS-20/TS-49 del guardia).
const AVATAR_COLORS = [
  'var(--color-graphite)',
  'var(--color-deep-blue)',
  'var(--color-aqua-deep)',
  'var(--color-system-analysis)',
  'var(--color-system-medium)',
  'var(--color-system-resolved)',
];

function getAvatarColor(firstName: string, lastName: string): string {
  const str = `${firstName}${lastName}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// Fila expandible: usa el Accordion del DS (S-058 amplía su `title` a ReactNode y agrega
// `showStatus`) para conservar el patrón de disclosure accesible real que ya implementa
// internamente (botón con aria-expanded/aria-controls + panel role="region" con hidden) con
// contenido rico de fila (avatar/ícono + nombre + horas + %), sin la marca de completitud
// (ajena a una fila de datos).
// La barra de proporción (`barra-proporcion`, gap `chart` aceptado por el REQ) se dibuja como
// decoración de fondo, posicionada absoluta, detrás del Accordion.
interface RowProps {
  readonly level: 1 | 2 | 3 | 4;
  readonly title: React.ReactNode;
  readonly pct?: number;
  readonly defaultExpanded?: boolean;
  readonly onToggle?: (expanded: boolean) => void;
  readonly children?: React.ReactNode;
}

function ExpandableRow({ level, title, pct, onToggle, children }: RowProps) {
  return (
    <div className={styles.rowWrapper}>
      {pct !== undefined && <span className={styles.barBg} style={{ width: `${pct}%` }} />}
      <Accordion
        title={title}
        showStatus={false}
        onToggle={onToggle}
        headingLevel={level === 1 ? 'h3' : 'h4'}
      >
        {children}
      </Accordion>
    </div>
  );
}

function LeafRow({ level, children }: { readonly level: 3 | 4; readonly children: React.ReactNode }) {
  return <div className={styles[`level${level}`]}>{children}</div>;
}

export function HierarchicalTable({
  dataByPerson,
  dataByProject,
  activeView,
  absencesByPerson,
  reasonLabels = {},
}: HierarchicalTableProps) {
  const isEmpty =
    activeView === 'by-person'
      ? !dataByPerson || dataByPerson.length === 0
      : !dataByProject || dataByProject.length === 0;

  if (isEmpty) {
    return <EmptyState variant="list" message="No hay horas registradas para este período" />;
  }

  if (activeView === 'by-person' && dataByPerson) {
    return (
      <div className={styles.table}>
        {sortByMinutesDesc(dataByPerson).map((person) => {
          const personKey = `person-${person.personId}`;

          return (
            <div key={personKey} className={styles.group}>
              <ExpandableRow
                level={1}
                title={
                  <span className={styles.rowContent}>
                    <span
                      className={styles.avatar}
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
                  </span>
                }
              >
                <>
                  {sortByMinutesDesc(
                    person.projects.filter((p) => p.projectCode !== ABSENCE_CODE)
                  ).map((project) => {
                    const projectKey = `${personKey}-project-${project.projectId}`;
                    const pct = Math.round((project.totalMinutes / person.totalMinutes) * 100);

                    return (
                      <div key={projectKey}>
                        <ExpandableRow
                          level={2}
                          pct={pct}
                          title={
                            <span className={styles.rowContent}>
                              <span className={styles.name}>
                                {project.projectName}
                                <span className={styles.code}>{project.projectCode}</span>
                              </span>
                              <span className={styles.hours}>
                                {formatMinutes(project.totalMinutes)}
                              </span>
                              <span className={styles.pct}>{pct}%</span>
                            </span>
                          }
                        >
                          {(() => {
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

                                  return (
                                    <div key={reqKey}>
                                      <ExpandableRow
                                        level={3}
                                        title={
                                          <span className={styles.rowContent}>
                                            <TintedIcon
                                              src={requirementsLogo}
                                              alt="Requisito"
                                              size={16}
                                              className={styles.entryIcon}
                                            />
                                            <span className={styles.name}>
                                              {group.requirementTitle}
                                            </span>
                                            <span className={styles.hours}>
                                              {formatMinutes(group.totalMinutes)}
                                            </span>
                                          </span>
                                        }
                                      >
                                        <>
                                          {sortByMinutesDesc(group.tasks).map((task) => {
                                            const icon = getEntryIcon(task);
                                            return (
                                              <LeafRow
                                                key={`${reqKey}-obj-${task.objectiveId}`}
                                                level={4}
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
                                              </LeafRow>
                                            );
                                          })}
                                          {group.direct > 0 && (
                                            <LeafRow level={4}>
                                              <span className={styles.name}>Sin tarea</span>
                                              <span className={styles.hours}>
                                                {formatMinutes(group.direct)}
                                              </span>
                                            </LeafRow>
                                          )}
                                        </>
                                      </ExpandableRow>
                                    </div>
                                  );
                                })}

                                {noRequirementTasks.length > 0 &&
                                  (() => {
                                    const noReqKey = `${projectKey}-no-requirement`;
                                    const noReqTotal = noRequirementTasks.reduce(
                                      (sum, t) => sum + t.totalMinutes,
                                      0
                                    );

                                    return (
                                      <div key={noReqKey}>
                                        <ExpandableRow
                                          level={3}
                                          title={
                                            <span className={styles.rowContent}>
                                              <TintedIcon
                                                src={objectivesLogo}
                                                alt="Tarea"
                                                size={16}
                                                className={styles.entryIcon}
                                              />
                                              <span className={styles.name}>
                                                Tareas sin requisito
                                              </span>
                                              <span className={styles.hours}>
                                                {formatMinutes(noReqTotal)}
                                              </span>
                                            </span>
                                          }
                                        >
                                          <>
                                            {sortByMinutesDesc(noRequirementTasks).map((task) => {
                                              const icon = getEntryIcon(task);
                                              return (
                                                <LeafRow
                                                  key={`${noReqKey}-obj-${task.objectiveId}`}
                                                  level={4}
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
                                                </LeafRow>
                                              );
                                            })}
                                          </>
                                        </ExpandableRow>
                                      </div>
                                    );
                                  })()}

                                {sortByMinutesDesc(soloProjectEntries).map((entry) => {
                                  const objKey = `${projectKey}-obj-none-req-none`;
                                  const icon = getEntryIcon(entry);
                                  return (
                                    <LeafRow key={objKey} level={3}>
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
                                    </LeafRow>
                                  );
                                })}
                              </>
                            );
                          })()}
                        </ExpandableRow>
                      </div>
                    );
                  })}

                  {(() => {
                    const absenceProject = person.projects.find(
                      (p) => p.projectCode === ABSENCE_CODE
                    );
                    if (!absenceProject) return null;
                    const absencesKey = `${personKey}-absences`;
                    const pct = Math.round(
                      (absenceProject.totalMinutes / person.totalMinutes) * 100
                    );

                    return (
                      <div key={absencesKey}>
                        <ExpandableRow
                          level={2}
                          pct={pct}
                          title={
                            <span className={styles.rowContent}>
                              <span className={styles.name}>Ausencias</span>
                              <span className={styles.hours}>
                                {formatMinutes(absenceProject.totalMinutes)}
                              </span>
                              <span className={styles.pct}>{pct}%</span>
                            </span>
                          }
                        >
                          <>
                            {(() => {
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
                                <LeafRow key={`${absencesKey}-${reason}`} level={3}>
                                  <span className={styles.name}>
                                    {reasonLabels[reason] ?? reason}
                                  </span>
                                  <span className={styles.hours}>{formatMinutes(minutes)}</span>
                                </LeafRow>
                              ));
                            })()}
                          </>
                        </ExpandableRow>
                      </div>
                    );
                  })()}
                </>
              </ExpandableRow>
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
          const pct = totalMinutes > 0 ? Math.round((project.totalMinutes / totalMinutes) * 100) : 0;

          return (
            <div key={projectKey} className={styles.group}>
              <ExpandableRow
                level={1}
                pct={pct}
                title={
                  <span className={styles.rowContent}>
                    <span className={styles.name}>
                      {project.projectName}
                      <span className={styles.code}>{project.projectCode}</span>
                    </span>
                    <span className={styles.hours}>{formatMinutes(project.totalMinutes)}</span>
                    <span className={styles.pct}>{pct}%</span>
                  </span>
                }
              >
                <>
                  {(() => {
                    const { requirementGroups, noRequirementTasks, soloProjectEntries } =
                      groupObjectivesByRequirement(project.objectives);

                    const renderPersonBreakdown = (
                      parentKey: string,
                      persons: typeof project.persons
                    ) =>
                      sortByMinutesDesc(persons).map((person) => (
                        <LeafRow key={`${parentKey}-person-${person.personId}`} level={4}>
                          <span
                            className={`${styles.avatar} ${styles.avatarSm}`}
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
                        </LeafRow>
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

                          return (
                            <div key={reqKey}>
                              <ExpandableRow
                                level={2}
                                title={
                                  <span className={styles.rowContent}>
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
                                  </span>
                                }
                              >
                                <>
                                  {sortByMinutesDesc(group.tasks).map((task) => {
                                    const taskKey = `${reqKey}-obj-${task.objectiveId}`;
                                    const icon = getEntryIcon(task);
                                    return (
                                      <div key={taskKey}>
                                        <ExpandableRow
                                          level={3}
                                          title={
                                            <span className={styles.rowContent}>
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
                                            </span>
                                          }
                                        >
                                          <>{renderPersonBreakdown(taskKey, task.persons)}</>
                                        </ExpandableRow>
                                      </div>
                                    );
                                  })}
                                  {group.direct > 0 &&
                                    group.directEntry &&
                                    (() => {
                                      const directKey = `${reqKey}-direct`;
                                      return (
                                        <div key={directKey}>
                                          <ExpandableRow
                                            level={3}
                                            title={
                                              <span className={styles.rowContent}>
                                                <span className={styles.name}>Sin tarea</span>
                                                <span className={styles.hours}>
                                                  {formatMinutes(group.direct)}
                                                </span>
                                              </span>
                                            }
                                          >
                                            <>
                                              {renderPersonBreakdown(
                                                directKey,
                                                group.directEntry.persons
                                              )}
                                            </>
                                          </ExpandableRow>
                                        </div>
                                      );
                                    })()}
                                </>
                              </ExpandableRow>
                            </div>
                          );
                        })}

                        {noRequirementTasks.length > 0 &&
                          (() => {
                            const noReqKey = `${projectKey}-no-requirement`;
                            const noReqTotal = noRequirementTasks.reduce(
                              (sum, t) => sum + t.totalMinutes,
                              0
                            );

                            return (
                              <div key={noReqKey}>
                                <ExpandableRow
                                  level={2}
                                  title={
                                    <span className={styles.rowContent}>
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
                                    </span>
                                  }
                                >
                                  <>
                                    {sortByMinutesDesc(noRequirementTasks).map((task) => {
                                      const taskKey = `${noReqKey}-obj-${task.objectiveId}`;
                                      const icon = getEntryIcon(task);
                                      return (
                                        <div key={taskKey}>
                                          <ExpandableRow
                                            level={3}
                                            title={
                                              <span className={styles.rowContent}>
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
                                              </span>
                                            }
                                          >
                                            <>{renderPersonBreakdown(taskKey, task.persons)}</>
                                          </ExpandableRow>
                                        </div>
                                      );
                                    })}
                                  </>
                                </ExpandableRow>
                              </div>
                            );
                          })()}

                        {sortByMinutesDesc(soloProjectEntries).map((entry) => {
                          const objKey = `${projectKey}-obj-none-req-none`;
                          const icon = getEntryIcon(entry);
                          return (
                            <div key={objKey}>
                              <ExpandableRow
                                level={2}
                                title={
                                  <span className={styles.rowContent}>
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
                                  </span>
                                }
                              >
                                <>{renderPersonBreakdown(objKey, entry.persons)}</>
                              </ExpandableRow>
                            </div>
                          );
                        })}
                      </>
                    );
                  })()}

                  {project.persons.length > 0 &&
                    (() => {
                      const noObjKey = `${projectKey}-no-objective`;
                      const noObjTotal = project.persons.reduce((sum, p) => sum + p.totalMinutes, 0);

                      return (
                        <div key={noObjKey}>
                          <ExpandableRow
                            level={2}
                            title={
                              <span className={styles.rowContent}>
                                <span className={styles.name}>Sin requisito/tarea</span>
                                <span className={styles.hours}>{formatMinutes(noObjTotal)}</span>
                              </span>
                            }
                          >
                            <>
                              {sortByMinutesDesc(project.persons).map((person) => (
                                <LeafRow key={`${noObjKey}-person-${person.personId}`} level={3}>
                                  <span
                                    className={`${styles.avatar} ${styles.avatarSm}`}
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
                                </LeafRow>
                              ))}
                            </>
                          </ExpandableRow>
                        </div>
                      );
                    })()}
                </>
              </ExpandableRow>
            </div>
          );
        })}
      </div>
    );
  }

  return null;
}
