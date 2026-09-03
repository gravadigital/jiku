import React from 'react';
import { ObjectiveDetails, ObjectiveHistoryList, getObjectiveById } from '@/features/objectives';
import { CommentEditor, ViewHeader } from '@/shared/components/ui';

export default async function ObjectiveDetail({
  params,
}: {
  readonly params: Promise<{ id: number }>;
}) {
  const { id } = await params;
  const objective = await getObjectiveById(id);

  return (
    <>
      {/*
        "Volver" no vuelve a donde se venía: siempre va a la misma tarea por proyecto,
        sin importar por dónde se entró (docs/ux/surfaces/web/screens/detalle-tarea.md).
        Ese destino fijo es exactamente el rol de `parent` en variant breadcrumb.
      */}
      <ViewHeader
        variant="breadcrumb"
        title={objective.title}
        parent={{ label: 'Volver', href: `/objectives/by-project#project-${objective.projectId}` }}
        action={{ children: 'Editar', href: `/objectives/edit/${id}` }}
      />
      <ObjectiveDetails objective={objective} />
      <ObjectiveHistoryList
        objectiveActivity={objective.ObjectiveActivity || []}
        objectiveId={id}
      />
      <CommentEditor objectiveId={id} />
    </>
  );
}
