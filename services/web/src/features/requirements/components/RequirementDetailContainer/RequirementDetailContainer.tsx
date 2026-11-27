'use client';

import React from 'react';
import { useRequirement } from '../../hooks/useRequirement';
import { RequirementDetail } from '../RequirementDetail';
import type { RequirementDetail as RequirementDetailType } from '../../types/requirement.types';

interface RequirementDetailContainerProps {
  readonly reqid: number;
  readonly initialRequirement: RequirementDetailType;
}

export function RequirementDetailContainer({
  reqid,
  initialRequirement,
}: RequirementDetailContainerProps) {
  const { data: requirement } = useRequirement(reqid, { initialData: initialRequirement });

  return <RequirementDetail requirement={requirement ?? initialRequirement} />;
}
