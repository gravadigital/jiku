'use client';

import React from 'react';
import { Card, EmptyState, Table } from '@/shared/components/ui';
import { labelFromDate } from '@/shared/utils/dateFormatter';
import { formatMinutes } from '@/shared/utils/format-minutes';
import { getTypeLabel } from '../../utils/requirementHelpers';
import { RESOLUTION_TYPE_LABELS } from '../../utils/resolutionHelpers';
import type { RequirementReportItem } from '../../types/requirement.types';
import type { TableColumn, TableRow } from '@/shared/components/ui/Table';

interface RequirementsReportTableProps {
  readonly items: RequirementReportItem[];
}

const PLACEHOLDER = '-';

const COLUMNS: readonly TableColumn[] = [
  { key: 'id', label: 'ID' },
  { key: 'type', label: 'Tipo' },
  { key: 'title', label: 'Título' },
  { key: 'project', label: 'Proyecto' },
  { key: 'createdBy', label: 'Creado por' },
  { key: 'createdAt', label: 'Fecha creación' },
  { key: 'inProgressAt', label: 'Fecha inicio' },
  { key: 'finishedAt', label: 'Fecha resolución' },
  { key: 'totalMinutes', label: 'Horas' },
  { key: 'resolutionType', label: 'Tipo de resolución' },
  { key: 'resolutionConclusion', label: 'Conclusión' },
  { key: 'resolutionComment', label: 'Comentario de resolución' },
];

function formatCellDate(value: string | null): string {
  if (!value) return PLACEHOLDER;
  return labelFromDate(new Date(value), 'DD/MM/YYYY');
}

export function RequirementsReportTable({ items }: RequirementsReportTableProps) {
  const rows: TableRow[] = items.map((item) => ({
    id: item.id,
    type: getTypeLabel(item.type),
    title: item.title,
    project: item.project?.name ?? PLACEHOLDER,
    createdBy: item.createdBy,
    createdAt: formatCellDate(item.createdAt),
    inProgressAt: formatCellDate(item.inProgressAt),
    finishedAt: formatCellDate(item.finishedAt),
    totalMinutes: formatMinutes(item.totalMinutes),
    resolutionType: item.resolutionType
      ? RESOLUTION_TYPE_LABELS[item.resolutionType]
      : PLACEHOLDER,
    resolutionConclusion: item.resolutionConclusion ?? PLACEHOLDER,
    resolutionComment: item.resolutionComment ?? PLACEHOLDER,
  }));

  return (
    // Misma presentación que los demás listados: card contenedora y cabecera clara.
    //
    // Estaba en `variant="dense"` por la letra del spec del DS, que reserva la cabecera azul
    // para "tablas densas de seguimiento" y nombra el reporte como uno de esos casos. En la
    // pantalla real esa cabecera es lo único oscuro de todo el producto y se lee como un
    // error, no como una señal: ninguna otra tabla la usa. La consistencia entre pantallas
    // pesa más que la distinción de densidad, que además nadie más ejerce.
    <Card variant="panel">
      <Table
        variant="light"
        columns={COLUMNS}
        rows={rows}
        ariaLabel="Tabla de reporte de requisitos"
        emptyState={
          <EmptyState
            variant="filtered"
            message="No se encontraron requisitos con los filtros aplicados"
          />
        }
      />
    </Card>
  );
}
