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
          variant="secondary-nav"
          href={`/objectives/by-project#project-${objective.projectId}`}
        >
          Volver
        </Button>,
        <Button key="action-edit" variant="secondary-nav" href={`/objectives/edit/${id}`}>
          Editar
        </Button>,
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
