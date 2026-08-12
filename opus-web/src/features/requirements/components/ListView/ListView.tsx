'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { RequirementGroupRow } from './components/RequirementGroupRow';
import { ListRequirementRow } from '../ListRequirementRow';
import type { Requirement } from '../../types/requirement.types';
import styles from './ListView.module.scss';

interface SectionData {
  requirements: Requirement[];
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
}

interface ListViewProps {
  sections: Record<string, SectionData>;
  projectId: number;
  onRequirementClick?: (requirementId: number) => void;
}

export const LIST_SECTIONS: { id: string; title: string; stateLabel: string }[] = [
  { id: 'analisis', title: 'Análisis', stateLabel: 'Análisis' },
  { id: 'planificacion', title: 'Planificación', stateLabel: 'Planificación' },
  { id: 'en_cola', title: 'En cola', stateLabel: 'En cola' },
  { id: 'desarrollo', title: 'Desarrollo', stateLabel: 'Desarrollo' },
  { id: 'revision', title: 'Revisión', stateLabel: 'Revisión' },
  { id: 'resuelto', title: 'Resuelto', stateLabel: 'Resuelto' },
  { id: 'cancelado', title: 'Cancelado', stateLabel: 'Cancelado' },
];

const ALWAYS_COLLAPSED = new Set(['resuelto', 'cancelado']);

export function ListView({ sections, projectId: _projectId, onRequirementClick }: ListViewProps) {
  const initialCollapsed = useMemo(
    () =>
      new Set([
        ...ALWAYS_COLLAPSED,
        ...LIST_SECTIONS.filter((s) => (sections[s.id]?.requirements.length ?? 0) === 0).map(
          (s) => s.id
        ),
      ]),
    [sections]
  );

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(initialCollapsed);
  const [isScrolled, setIsScrolled] = useState(false);
  const tableWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = tableWrapRef.current;
    if (!el) return;
    function handleScroll() {
      setIsScrolled(el!.scrollTop > 0);
    }
    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleGroup = (id: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className={styles.tableWrap} ref={tableWrapRef}>
      {/* Sticky column header */}
      <div className={`${styles.colHeader} ${isScrolled ? styles.colHeaderScrolled : ''}`}>
        <div className={styles.rowGrid}>
          <div className={styles.th}>ID</div>
          <div className={styles.th}>TÍTULO</div>
          <div className={styles.th}>ESTADO</div>
          <div className={styles.th}>CREACIÓN</div>
          <div className={styles.th}>AUTOR</div>
          <div className={styles.th}>TIPO</div>
          <div className={styles.th}>PRIORIDAD</div>
        </div>
      </div>

      {/* Groups */}
      {LIST_SECTIONS.map((section) => {
        const sectionData = sections[section.id];
        const requirements = sectionData?.requirements ?? [];
        const isCollapsed = collapsedGroups.has(section.id);

        return (
          <div key={section.id}>
            <RequirementGroupRow
              state={section.id}
              count={requirements.length}
              isCollapsed={isCollapsed}
              onToggle={() => toggleGroup(section.id)}
            />
            {!isCollapsed && (
              <div className={styles.taskRows}>
                {requirements.map((requirement) => (
                  <ListRequirementRow
                    key={requirement.id}
                    requirement={requirement}
                    stateLabel={section.stateLabel}
                    onRowClick={() => onRequirementClick?.(requirement.id)}
                  />
                ))}
                {requirements.length === 0 && (
                  <div className={styles.emptyState}>Sin elementos</div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
