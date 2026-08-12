import { KanbanColumn } from '../KanbanColumn';
import { KanbanCard } from './components/KanbanCard';
import type { Requirement } from '../../types/requirement.types';
import styles from './KanbanBoard.module.scss';

export interface ColumnData {
  requirements: Requirement[];
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
}

interface KanbanBoardProps {
  columns: Record<string, ColumnData>;
  projectId: number;
  onRequirementClick?: (requirementId: number) => void;
}

interface ColumnConfig {
  id: string;
  title: string;
  defaultCollapsed: boolean;
}

export const KANBAN_COLUMNS: ColumnConfig[] = [
  { id: 'analisis', title: 'Análisis', defaultCollapsed: false },
  { id: 'planificacion', title: 'Planificación', defaultCollapsed: false },
  { id: 'en_cola', title: 'En cola', defaultCollapsed: false },
  { id: 'desarrollo', title: 'Desarrollo', defaultCollapsed: false },
  { id: 'revision', title: 'Revisión', defaultCollapsed: false },
  { id: 'resuelto', title: 'Resuelto', defaultCollapsed: true },
  { id: 'cancelado', title: 'Cancelado', defaultCollapsed: true },
];

const ALWAYS_COLLAPSED = new Set(['resuelto', 'cancelado']);

export function KanbanBoard({
  columns,
  projectId: _projectId,
  onRequirementClick,
}: KanbanBoardProps) {
  return (
    <div className={styles.board}>
      {KANBAN_COLUMNS.map((column) => {
        const columnData = columns[column.id];
        return (
          <KanbanColumn
            key={column.id}
            title={column.title}
            count={columnData?.requirements.length ?? 0}
            columnId={column.id}
            hasMore={columnData?.hasMore}
            isLoadingMore={columnData?.isLoadingMore}
            onLoadMore={columnData?.onLoadMore}
            defaultCollapsed={
              ALWAYS_COLLAPSED.has(column.id) || (columnData?.requirements.length ?? 0) === 0
            }
          >
            {columnData?.requirements.map((requirement) => (
              <KanbanCard
                key={requirement.id}
                requirement={requirement}
                stateLabel={column.title}
                onClick={() => onRequirementClick?.(requirement.id)}
              />
            ))}
          </KanbanColumn>
        );
      })}
    </div>
  );
}
