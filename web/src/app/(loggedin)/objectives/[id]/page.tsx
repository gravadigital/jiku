import React from 'react';
import { ObjectiveDetails, ObjectiveHistoryList, getObjectiveById } from '@/features/objectives';
import { PageLayout } from '@/shared/components/layout';
import { Button, CommentEditor } from '@/shared/components/ui';

export default async function ObjectiveDetail({
  params,
}: {
  readonly params: Promise<{ id: number }>;
}) {
  const { id } = await params;
  const objective = await getObjectiveById(id);

  return (
    <PageLayout
      title={objective.title}
      actions={[
        <Button
          key="action-back"
          label="Volver"
          href={`/objectives/by-project#project-${objective.projectId}`}
        />,
        <Button key="action-edit" label="Editar" href={`/objectives/edit/${id}`} />,
      ]}
    >
      <ObjectiveDetails objective={objective} />
      <ObjectiveHistoryList
        objectiveActivity={objective.ObjectiveActivity || []}
        objectiveId={id}
      />
      <CommentEditor objectiveId={id} />
    </PageLayout>
  );
}
