import { useState } from 'react';
import Link from 'next/link';
import { StateAccordion } from '../StateAccordion';
import { RequirementCard } from '../RequirementCard';
import type { Requirement } from '../../types/requirement.types';
import styles from './MobileRequirementsBoard.module.scss';

export interface StateData {
  requirements: Requirement[];
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
}

interface MobileRequirementsBoardProps {
  states: Record<string, StateData>;
  projectId: number;
}

interface StateConfig {
  id: string;
  title: string;
}

export const MOBILE_STATES_ORDER: StateConfig[] = [
  { id: 'analisis', title: 'Análisis' },
  { id: 'planificacion', title: 'Planificación' },
  { id: 'en_cola', title: 'En cola' },
  { id: 'desarrollo', title: 'Desarrollo' },
  { id: 'revision', title: 'Revisión' },
  { id: 'resuelto', title: 'Resuelto' },
  { id: 'cancelado', title: 'Cancelado' },
];

export function MobileRequirementsBoard({ states, projectId }: MobileRequirementsBoardProps) {
  const [expandedStates, setExpandedStates] = useState<Set<string>>(new Set());

  function toggleState(stateId: string) {
    setExpandedStates((prev) => {
      const next = new Set(prev);
      if (next.has(stateId)) {
        next.delete(stateId);
      } else {
        next.add(stateId);
      }
      return next;
    });
  }

  return (
    <div className={styles.container}>
      <div className={styles.accordionList}>
        {MOBILE_STATES_ORDER.map((stateConfig) => {
          const stateData = states[stateConfig.id];
          const stateRequirements = stateData?.requirements ?? [];

          return (
            <StateAccordion
              key={stateConfig.id}
              state={stateConfig.title}
              count={stateRequirements.length}
              isExpanded={expandedStates.has(stateConfig.id)}
              onToggle={() => toggleState(stateConfig.id)}
              hasMore={stateData?.hasMore}
              isLoadingMore={stateData?.isLoadingMore}
              onLoadMore={stateData?.onLoadMore}
            >
              {stateRequirements.length > 0 ? (
                <div className={styles.cardList}>
                  {stateRequirements.map((requirement) => (
                    <Link
                      key={requirement.id}
                      href={`/projects/${projectId}/requirements/${requirement.id}`}
                      className={styles.cardLink}
                    >
                      <RequirementCard
                        id={requirement.id}
                        title={requirement.title}
                        state={requirement.state}
                        createdAt={requirement.createdAt}
                      />
                    </Link>
                  ))}
                </div>
              ) : (
                <p className={styles.emptyState}>Sin requisitos en este estado</p>
              )}
            </StateAccordion>
          );
        })}
      </div>
    </div>
  );
}
