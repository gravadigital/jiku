'use client';

import React from 'react';
import { ToggleGroup } from '@/shared/components/ui/ToggleGroup';

export type ReportView = 'by-person' | 'by-project';

interface ViewToggleProps {
  readonly activeView: ReportView;
  readonly onViewChange: (view: ReportView) => void;
}

const VIEW_OPTIONS: readonly { key: ReportView; label: string }[] = [
  { key: 'by-person', label: 'Por persona' },
  { key: 'by-project', label: 'Por proyecto' },
];

export function ViewToggle({ activeView, onViewChange }: ViewToggleProps) {
  return <ToggleGroup options={VIEW_OPTIONS} value={activeView} onChange={onViewChange} />;
}
