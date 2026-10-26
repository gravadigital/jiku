import React from 'react';
import { Badge } from '@/shared/components/ui';
import type { DocsVisibility } from '../../types/docs.types';

interface VisibilityPillProps {
  readonly visibility?: DocsVisibility;
}

const LABELS: Partial<Record<DocsVisibility, string>> = {
  public: 'Visible para el cliente',
  restricted: 'Restringido',
};

/** `internal` no lleva marca. El texto siempre acompaña: el estado nunca va solo en color. */
export function VisibilityPill({ visibility }: VisibilityPillProps) {
  const label = visibility ? LABELS[visibility] : undefined;
  return label ? <Badge variant="outline" family="neutral" label={label} /> : null;
}
