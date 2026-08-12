import { labelFromDate } from '@/shared/utils/dateFormatter';
import { formatMinutes } from '@/shared/utils/format-minutes';
import { getTypeLabel } from './requirementHelpers';
import { RESOLUTION_TYPE_LABELS } from './resolutionHelpers';
import type { RequirementReportItem } from '../types/requirement.types';

const PLACEHOLDER = '-';
const BOM = '﻿';

const CSV_HEADERS = [
  'ID',
  'Tipo',
  'Título',
  'Proyecto',
  'Creado por',
  'Fecha creación',
  'Fecha inicio',
  'Fecha resolución',
  'Horas',
  'Tipo de resolución',
  'Conclusión',
  'Comentario de resolución',
];

function formatCellDate(value: string | null): string {
  if (!value) return PLACEHOLDER;
  return labelFromDate(new Date(value), 'DD/MM/YYYY');
}

function escapeCsvValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function itemToRow(item: RequirementReportItem): string[] {
  return [
    String(item.id),
    getTypeLabel(item.type),
    item.title,
    item.project?.name ?? PLACEHOLDER,
    item.createdBy,
    formatCellDate(item.createdAt),
    formatCellDate(item.inProgressAt),
    formatCellDate(item.finishedAt),
    formatMinutes(item.totalMinutes),
    item.resolutionType ? RESOLUTION_TYPE_LABELS[item.resolutionType] : PLACEHOLDER,
    item.resolutionConclusion ?? PLACEHOLDER,
    item.resolutionComment ?? PLACEHOLDER,
  ];
}

export function buildRequirementsReportCsv(items: RequirementReportItem[]): string {
  const lines = [
    CSV_HEADERS.join(','),
    ...items.map((item) => itemToRow(item).map(escapeCsvValue).join(',')),
  ];
  return BOM + lines.join('\n');
}

export function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
