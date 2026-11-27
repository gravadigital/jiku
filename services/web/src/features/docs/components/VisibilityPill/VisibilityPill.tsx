import React from 'react';
import { Badge } from '@/shared/components/ui';
import { visibilityLabel } from '../../utils/documentLabels';
import type { DocsVisibility } from '../../types/docs.types';

interface VisibilityPillProps {
  readonly visibility?: DocsVisibility;
}

/** `internal` no lleva marca. El texto siempre acompaña: el estado nunca va solo en color. */
export function VisibilityPill({ visibility }: VisibilityPillProps) {
  if (!visibility || visibility === 'internal') return null;
  return <Badge variant="outline" family="neutral" label={visibilityLabel(visibility)} />;
}
