import React from 'react';
import { notFound } from 'next/navigation';
import { EditRequirementForm } from '@/features/requirements/components/EditRequirementForm';
import { getRequirementById } from '@/features/requirements/services/requirementsApi';

export default async function EditRequirementPage({
  params,
}: {
  readonly params: Promise<{ reqid: string }>;
}) {
  const { reqid } = await params;
  const id = Number(reqid);

  if (isNaN(id)) notFound();

  const requirement = await getRequirementById(id);

  return <EditRequirementForm requirement={requirement} />;
}
