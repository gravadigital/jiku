'use client';
import React, { type FormEvent, use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import * as yup from 'yup';
import { usePersons } from '@/features/auth';
import { useObjective, useUpdateObjective } from '@/features/objectives';
import { useRequirements } from '@/features/requirements';
import { PageLayout } from '@/shared/components/layout';
import {
  Button,
  InputDate,
  InputMultiplePersons,
  InputSelect,
  InputText,
  InputTextarea,
  Loader,
  SectionCard,
} from '@/shared/components/ui';
import styles from './styles.module.scss';

interface Body {
  area: string;
  description?: string;
  title: string;
  estimatedFinishDate?: Date | null;
  priority: string;
  projectName: string;
  state: string;
  personIds: string[];
  visibilityLevel: string;
  requirementId?: string;
}

const defaultValues: Body = {
  area: '',
  description: '',
  estimatedFinishDate: null,
  personIds: [],
  priority: '',
  projectName: '',
  requirementId: '',
  state: '',
  title: '',
  visibilityLevel: '',
};

const validationSchema = yup.object().shape({
  area: yup.string().required(),
  description: yup.string().nullable(),
  estimatedFinishDate: yup.date().nullable(),
  personIds: yup.array().of(yup.string()).min(1).required(),
  priority: yup.number().min(0).max(5).required(),
  state: yup.string().required(),
  title: yup.string().required(),
  visibilityLevel: yup.string().required(),
});

export default function ObjectiveEdition({ params }: { readonly params: Promise<{ id: number }> }) {
  const { id } = use(params);
  const [formData, setFormData] = useState(defaultValues);
  const [formInitialized, setFormInitialized] = useState(false);
  const [initialRequirementId, setInitialRequirementId] = useState<number | null>(null);
  const [generalError, setGeneralError] = useState(false);
  const { push } = useRouter();

  // TanStack Query hooks
  const { data: objective, isLoading: isLoadingObjective } = useObjective({ id });
  const { data: persons = [], isLoading: isLoadingPersons } = usePersons();
  const { data: requirements = [] } = useRequirements({
    enabled: Boolean(objective?.projectId),
    filters: { projectId: objective?.projectId ?? 0 },
  });
  const updateObjectiveMutation = useUpdateObjective();

  // Initialize form when objective data is loaded
  useEffect(() => {
    if (objective && !formInitialized) {
      const sortedObjectivePersons = [...objective.persons].sort((personA, personB) => {
        const isLeaderA = personA.PersonObjective?.isLeader;
        const isLeaderB = personB.PersonObjective?.isLeader;
        if (isLeaderA && !isLeaderB) {
          return -1;
        }
        if (!isLeaderA && isLeaderB) {
          return 1;
        }
        return 0;
      });

      setFormData({
        area: objective.area,
        description: objective.description || '',
        estimatedFinishDate: objective.estimatedFinishDate,
        personIds: sortedObjectivePersons.map((person) => (person.id ? person.id.toString() : '')),
        priority: objective.priority.toString(),
        projectName: objective.project.name,
        requirementId: objective.requirementId ? objective.requirementId.toString() : '',
        state: objective.state,
        title: objective.title,
        visibilityLevel: objective.visibilityLevel,
      });
      setInitialRequirementId(objective.requirementId ?? null);
      setFormInitialized(true);
    }
  }, [objective, formInitialized]);

  // Prepare persons options - combine objective persons first, then all persons
  const objectivePersonsOptions =
    objective?.persons.map((person) => ({
      label: `${person.firstName} ${person.lastName}`,
      value: person.id ? Number(person.id) : 0,
    })) ?? [];

  const allPersonsOptions = persons.map((person) => ({
    label: `${person.firstName} ${person.lastName}`,
    value: person.id ? Number(person.id) : 0,
  }));

  const personsOptions = [
    ...objectivePersonsOptions,
    ...allPersonsOptions.filter(
      (person) => !objectivePersonsOptions.some((op) => op.value === person.value)
    ),
  ];

  const requirementsOptions = [
    ...requirements.map((requirement) => ({
      label: requirement.title,
      value: requirement.id.toString(),
    })),
    { label: 'Sin requisito', value: '' },
  ];

  const mapIdToPerson = (idPersons: string) => {
    const person = personsOptions.find((option) => option.value === Number(idPersons));
    return person && person.value
      ? { label: person.label, value: person.value.toString() }
      : { label: idPersons, value: idPersons };
  };

  const handleInputChange = (field: keyof Body, value: any) => {
    let updatedValue = value;
    if (field === 'estimatedFinishDate' && (value === '' || value === null)) {
      updatedValue = null;
    }
    if (field === 'description' && value === '') {
      updatedValue = null;
    }
    return setFormData((prevData) => ({
      ...prevData,
      [field]: updatedValue,
    }));
  };

  const fieldHasError = (fieldName: string, value: string | string[] | Date) => {
    const fieldToValidate = yup.reach(validationSchema, fieldName);
    if (fieldToValidate instanceof yup.Schema) {
      const isValid = fieldToValidate.isValidSync(value);
      return !isValid;
    }
    return true;
  };

  const processEdition = () => {
    setGeneralError(false);

    const fieldsToUpdate: any = {
      area: formData.area,
      description: formData.description,
      estimatedFinishDate: formData.estimatedFinishDate,
      personIds: formData.personIds,
      priority: formData.priority,
      state: formData.state,
      title: formData.title,
      visibilityLevel: formData.visibilityLevel,
    };

    if (formData.requirementId) {
      fieldsToUpdate.requirementId = Number(formData.requirementId);
    } else if (initialRequirementId !== null) {
      fieldsToUpdate.requirementId = null;
    }

    if (!fieldsToUpdate.description) {
      delete fieldsToUpdate.description;
    }

    if (!fieldsToUpdate.estimatedFinishDate) {
      delete fieldsToUpdate.estimatedFinishDate;
    }

    const isValid = validationSchema.isValidSync(fieldsToUpdate);
    if (!isValid) {
      setGeneralError(true);
      return;
    }

    updateObjectiveMutation.mutate(
      { id: Number(id), payload: fieldsToUpdate },
      {
        onError: (error: any) => {
          setGeneralError(true);
          toast.error(error?.message ?? 'Hubo un error al editar la tarea');
        },
        onSuccess: () => {
          push(`/objectives/${id}`);
          toast.success('Tarea editada con éxito');
        },
      }
    );
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    processEdition();
  };

  const buttons = [
    <Button
      key="action-1"
      label="Guardar"
      onClick={() => {
        processEdition();
      }}
      loading={updateObjectiveMutation.isPending}
      disabled={false}
    />,
  ];

  const isLoading = isLoadingObjective || isLoadingPersons || !formInitialized;

  if (isLoading) {
    return <Loader label="Cargando..." />;
  }

  return (
    <PageLayout title="Tareas / editar" actions={buttons}>
      <SectionCard>
        <form onSubmit={handleSubmit}>
          <div className={styles.formContainer}>
            <div className={styles.textareaCont}>
              <InputText
                label="Título"
                code="title"
                value={formData.title}
                onChange={(value) => {
                  handleInputChange('title', value);
                }}
                error={fieldHasError('title', formData.title)}
                placeholder="Título de la tarea"
                required
              />
              <InputText
                label="Corresponde a..."
                code="projectName"
                value={formData.projectName}
                onChange={(value) => {
                  handleInputChange('projectName', value);
                }}
                disabled
              />
              <InputSelect
                label="Requisito"
                code="requirementId"
                value={formData.requirementId || ''}
                options={requirementsOptions}
                onChange={(value) => {
                  handleInputChange('requirementId', value);
                }}
                placeholder="Seleccionar requisito (opcional)"
              />
              <InputMultiplePersons
                label="Responsable(s)"
                code="personIds"
                value={formData.personIds.map(mapIdToPerson)}
                options={personsOptions.map((person) => ({
                  label: person.label,
                  value: person.value.toString(),
                }))}
                onChange={(value) => {
                  handleInputChange(
                    'personIds',
                    value.map((option) => option.value)
                  );
                }}
                error={fieldHasError('personIds', formData.personIds)}
                placeholder="Nombre(s)"
                required
              />
              <InputSelect
                label="Área"
                code="area"
                value={formData.area}
                options={[
                  {
                    label: 'Diseño',
                    value: 'diseño',
                  },
                  {
                    label: 'Desarrollo',
                    value: 'desarrollo',
                  },
                  {
                    label: 'Gestión',
                    value: 'gestion',
                  },
                  {
                    label: 'Investigación',
                    value: 'investigacion',
                  },
                ]}
                onChange={(value) => {
                  handleInputChange('area', value);
                }}
                error={fieldHasError('area', formData.area)}
                placeholder="Área de la tarea"
                required
              />
            </div>
            <div className={styles.column}>
              <InputSelect
                label="Estado"
                code="state"
                value={formData.state}
                options={[
                  {
                    label: 'Activo',
                    value: 'activo',
                  },
                  {
                    label: 'Backlog',
                    value: 'backlog',
                  },
                  {
                    label: 'En revisión',
                    value: 'en_revision',
                  },
                  {
                    label: 'Finalizado',
                    value: 'finalizado',
                  },
                  {
                    label: 'Cancelado',
                    value: 'cancelado',
                  },
                ]}
                onChange={(value) => {
                  handleInputChange('state', value);
                }}
                error={fieldHasError('state', formData.state)}
                placeholder="Estado de la tarea"
                required
              />
              <InputSelect
                label="Prioridad"
                code="priority"
                value={formData.priority.toString()}
                options={[
                  {
                    label: '0',
                    value: '0',
                  },
                  {
                    label: '1',
                    value: '1',
                  },
                  {
                    label: '2',
                    value: '2',
                  },
                  {
                    label: '3',
                    value: '3',
                  },
                  {
                    label: '4',
                    value: '4',
                  },
                  {
                    label: '5',
                    value: '5',
                  },
                ]}
                onChange={(value) => {
                  handleInputChange('priority', value);
                }}
                error={fieldHasError('priority', formData.priority.toString())}
                placeholder="Prioridad de la tarea"
                required
              />
              <InputSelect
                label="Nivel de visibilidad"
                code="visibilityLevel"
                value={formData.visibilityLevel}
                options={[
                  {
                    label: 'Público',
                    value: 'public',
                  },
                  {
                    label: 'Interno',
                    value: 'internal',
                  },
                ]}
                onChange={(value) => {
                  handleInputChange('visibilityLevel', value);
                }}
              />
              <InputDate
                label="Fecha de finalización estimada"
                code="estimatedFinishDate"
                value={formData.estimatedFinishDate as Date}
                onChange={(value) => {
                  handleInputChange('estimatedFinishDate', value);
                }}
                error={fieldHasError(
                  'estimatedFinishDate',
                  formData.estimatedFinishDate || new Date()
                )}
              />
              <InputTextarea
                code="description"
                label="Descripción"
                value={formData.description || ''}
                onChange={(value) => {
                  handleInputChange('description', value);
                }}
                error={fieldHasError('description', formData.description || '')}
                placeholder="Descripción de la tarea"
                required
              />
            </div>
          </div>
          <div className={styles.generalError}>
            {generalError === true && <p>* Campos incompletos</p>}
          </div>
        </form>
      </SectionCard>
    </PageLayout>
  );
}
