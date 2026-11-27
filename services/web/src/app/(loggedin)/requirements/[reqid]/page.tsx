import React from 'react';
import { notFound } from 'next/navigation';
import { RequirementDetailContainer } from '@/features/requirements';
import { getRequirementById } from '@/features/requirements/services/requirementsApi';
import styles from './page.module.scss';

export default async function RequirementDetailPage({
  params,
}: {
  readonly params: Promise<{ reqid: string }>;
}) {
  const { reqid } = await params;
  const id = Number(reqid);

  if (isNaN(id)) notFound();

  const requirement = await getRequirementById(id);

  return (
    <div className={styles.pageContainer}>
      <RequirementDetailContainer reqid={id} initialRequirement={requirement} />
    </div>
  );
}
