'use client';

import React from 'react';
import { labelFromDate } from '@/shared/utils/dateFormatter';
import { formatMinutes } from '@/shared/utils/format-minutes';
import { getTypeLabel } from '../../utils/requirementHelpers';
import { RESOLUTION_TYPE_LABELS } from '../../utils/resolutionHelpers';
import styles from './RequirementsReportTable.module.scss';
import type { RequirementReportItem } from '../../types/requirement.types';

interface RequirementsReportTableProps {
  readonly items: RequirementReportItem[];
}

const PLACEHOLDER = '-';

function formatCellDate(value: string | null): string {
  if (!value) return PLACEHOLDER;
  return labelFromDate(new Date(value), 'DD/MM/YYYY');
}

export function RequirementsReportTable({ items }: RequirementsReportTableProps) {
  if (items.length === 0) {
    return (
      <div className={styles.empty}>No se encontraron requisitos con los filtros aplicados</div>
    );
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Tipo</th>
            <th>Título</th>
            <th>Proyecto</th>
            <th>Creado por</th>
            <th>Fecha creación</th>
            <th>Fecha inicio</th>
            <th>Fecha resolución</th>
            <th>Horas</th>
            <th>Tipo de resolución</th>
            <th>Conclusión</th>
            <th>Comentario de resolución</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.id}</td>
              <td>{getTypeLabel(item.type)}</td>
              <td>{item.title}</td>
              <td>{item.project?.name ?? PLACEHOLDER}</td>
              <td>{item.createdBy}</td>
              <td>{formatCellDate(item.createdAt)}</td>
              <td>{formatCellDate(item.inProgressAt)}</td>
              <td>{formatCellDate(item.finishedAt)}</td>
              <td>{formatMinutes(item.totalMinutes)}</td>
              <td>
                {item.resolutionType ? RESOLUTION_TYPE_LABELS[item.resolutionType] : PLACEHOLDER}
              </td>
              <td>{item.resolutionConclusion ?? PLACEHOLDER}</td>
              <td>{item.resolutionComment ?? PLACEHOLDER}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
