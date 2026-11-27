import { ChevronDown } from 'lucide-react';
import styles from './RequirementGroupRow.module.scss';

type GroupState =
  'analisis' | 'planificacion' | 'en_cola' | 'desarrollo' | 'revision' | 'resuelto' | 'cancelado';

interface RequirementGroupRowProps {
  state: string;
  count: number;
  isCollapsed: boolean;
  onToggle: () => void;
}

const STATE_LABELS: Record<GroupState, string> = {
  analisis: 'Análisis',
  planificacion: 'Planificación',
  en_cola: 'En cola',
  desarrollo: 'Desarrollo',
  revision: 'Revisión',
  resuelto: 'Resuelto',
  cancelado: 'Cancelado',
};

export function RequirementGroupRow({
  state,
  count,
  isCollapsed,
  onToggle,
}: RequirementGroupRowProps) {
  const label = STATE_LABELS[state as GroupState] ?? state;
  return (
    <button className={`${styles.groupRow} ${styles[state] ?? ''}`} onClick={onToggle}>
      <span className={`${styles.chevron} ${isCollapsed ? styles.collapsed : ''}`}>
        <ChevronDown size={14} strokeWidth={2.5} />
      </span>
      <span className={styles.dot} />
      <span className={styles.name}>{label}</span>
      <span className={styles.count}>{count}</span>
    </button>
  );
}
