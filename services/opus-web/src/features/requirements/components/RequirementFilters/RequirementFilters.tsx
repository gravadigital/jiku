import styles from './RequirementFilters.module.scss';

const FILTER_OPTIONS: Array<{ value: string | null; label: string }> = [
  { value: null, label: 'Todos' },
  { value: 'Backlog', label: 'Backlog' },
  { value: 'Activo', label: 'Activo' },
  { value: 'En revisión', label: 'En revisión' },
  { value: 'Finalizado', label: 'Finalizado' },
];

interface RequirementFiltersProps {
  selectedState: string | null;
  onStateChange: (state: string | null) => void;
}

export function RequirementFilters({ selectedState, onStateChange }: RequirementFiltersProps) {
  return (
    <div className={styles.filters} role="group" aria-label="Filtrar por estado">
      {FILTER_OPTIONS.map((option) => (
        <button
          key={option.label}
          type="button"
          className={styles.chip}
          data-active={selectedState === option.value}
          onClick={() => onStateChange(option.value)}
          aria-pressed={selectedState === option.value}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
