'use client';
import React from 'react';
import { cn } from '@/shared/utils/cn';
import styles from './Table.module.scss';

export type TableVariant = 'light' | 'dense' | 'matrix';

export interface TableColumn {
  readonly key: string;
  readonly label: string;
  readonly sortable?: boolean;
  /** `'row'` marca esta columna como encabezado de fila (th scope="row"), sólo tiene
   * sentido en variant `matrix`. */
  readonly scope?: 'row';
}

export interface TableSort {
  readonly key: string;
  readonly direction: 'asc' | 'desc';
}

export interface TableRow {
  readonly [key: string]: React.ReactNode;
  /**
   * Claves de columna cuyo valor está vencido en esta fila. La celda se marca con
   * texto (nunca sólo color) vía la clase `overdue`. Contenido — "N/D"/"0 h" en
   * celdas sin dato — es responsabilidad de quien arma `rows`, no de `Table`.
   */
  readonly _overdue?: readonly string[];
}

export interface TableProps {
  readonly variant?: TableVariant;
  readonly columns: readonly TableColumn[];
  readonly rows: readonly TableRow[];
  readonly sort?: TableSort;
  readonly onSortChange?: (sort: TableSort) => void;
  readonly emptyState?: React.ReactNode;
  readonly loading?: boolean;
  /** Nombre accesible de la región con scroll horizontal. */
  readonly ariaLabel?: string;
}

const VARIANT_CLASS: Record<TableVariant, string> = {
  light: styles.light,
  dense: styles.dense,
  matrix: styles.matrix,
};

function nextDirection(current: TableSort | undefined, key: string): 'asc' | 'desc' {
  if (current?.key === key && current.direction === 'asc') {
    return 'desc';
  }
  return 'asc';
}

export function Table({
  variant = 'light',
  columns,
  rows,
  sort,
  onSortChange,
  emptyState,
  loading = false,
  ariaLabel = 'Tabla de datos',
}: TableProps) {
  const isEmpty = rows.length === 0;

  const handleSort = (column: TableColumn) => {
    if (!column.sortable || !onSortChange) return;
    onSortChange({ key: column.key, direction: nextDirection(sort, column.key) });
  };

  return (
    <div
      className={styles.scrollRegion}
      role="region"
      aria-label={ariaLabel}
      tabIndex={0}
    >
      <table className={cn(styles.table, VARIANT_CLASS[variant])}>
        <thead>
          <tr>
            {columns.map((column) => {
              const isSorted = sort?.key === column.key;
              const ariaSort = column.sortable
                ? isSorted
                  ? sort?.direction === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none'
                : undefined;
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={column.sortable ? ariaSort : undefined}
                  className={cn(styles.headerCell, { [styles.sortable]: !!column.sortable })}
                  onClick={column.sortable ? () => handleSort(column) : undefined}
                >
                  {column.sortable ? (
                    <button type="button" className={styles.sortButton}>
                      {column.label}
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        {!loading && !isEmpty && (
          <tbody>
            {rows.map((row, rowIndex) => (
               
              <tr key={rowIndex} className={styles.row}>
                {columns.map((column) => {
                  const isOverdue = Boolean(row._overdue?.includes(column.key));
                  const cellContent = row[column.key];
                  if (column.scope === 'row') {
                    return (
                      <th
                        key={column.key}
                        scope="row"
                        className={cn(styles.rowHeaderCell, { [styles.overdue]: isOverdue })}
                      >
                        {cellContent}
                      </th>
                    );
                  }
                  return (
                    <td
                      key={column.key}
                      className={cn(styles.dataCell, { [styles.overdue]: isOverdue })}
                    >
                      {cellContent}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        )}
      </table>
      {loading && (
        <span role="status" className={styles.loadingState}>
          Cargando…
        </span>
      )}
      {!loading && isEmpty && <div className={styles.emptyState}>{emptyState}</div>}
    </div>
  );
}
