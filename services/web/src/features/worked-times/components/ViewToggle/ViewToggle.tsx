'use client';

import React from 'react';
import { ToggleGroup } from '@/shared/components/ui/ToggleGroup';

export type ReportView = 'by-person' | 'by-project';

interface ViewToggleProps {
  readonly activeView: ReportView;
  readonly onViewChange: (view: ReportView) => void;
}

const VIEW_OPTIONS: readonly { value: ReportView; label: string }[] = [
  { value: 'by-person', label: 'Por persona' },
  { value: 'by-project', label: 'Por proyecto' },
];

export function ViewToggle({ activeView, onViewChange }: ViewToggleProps) {
  return (
    <ToggleGroup
      label="Vista del reporte"
      options={VIEW_OPTIONS}
      value={activeView}
      onChange={(value) => onViewChange(value as ReportView)}
    />
  );
}
