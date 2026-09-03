'use client';
import React, { type FormEvent, use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import * as yup from 'yup';
import { usePersons } from '@/features/auth';
import { useObjective, useUpdateObjective } from '@/features/objectives';
import { useRequirements } from '@/features/requirements';
import { Card, Input, Loader, Select, ViewHeader } from '@/shared/components/ui';
import { labelFromDate } from '@/shared/utils/dateFormatter';
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

function dateToInputValue(date: Date | null | undefined): string {
  if (!date) return '';
  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) return '';
  try {
    return labelFromDate(parsed, 'YYYY-MM-DD');
  } catch {
    return '';
  }
}

function inputValueToDate(value: string): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

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
      value: person.id ? String(person.id) : '0',
    })) ?? [];

  const allPersonsOptions = persons.map((person) => ({
    label: `${person.firstName} ${person.lastName}`,
    value: person.id ? String(person.id) : '0',
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

  const isLoading = isLoadingObjective || isLoadingPersons || !formInitialized;

  if (isLoading) {
    return <Loader label="Cargando..." />;
  }

  return (
    <>
      <ViewHeader
        variant="list"
        title="Tareas / editar"
        action={{
          children: 'Guardar',
          onClick: () => {
            processEdition();
          },
          loading: updateObjectiveMutation.isPending,
          disabled: false,
        }}
      />
      <Card variant="panel">
        <form onSubmit={handleSubmit}>
          <div className={styles.formContainer}>
            <div className={styles.textareaCont}>
              <Input
                label="Título"
                value={formData.title}
                onChange={(value) => {
                  handleInputChange('title', value);
                }}
                error={fieldHasError('title', formData.title) ? 'Este campo es requerido' : undefined}
                placeholder="Título de la tarea"
                required
              />
              <Input variant="locked" label="Corresponde a..." value={formData.projectName} onChange={() => {}} />
              <Select
                label="Requisito"
                value={formData.requirementId || ''}
                options={requirementsOptions}
                onChange={(value) => {
                  handleInputChange('requirementId', value);
                }}
                placeholder="Seleccionar requisito (opcional)"
              />
              <Select
                variant="multiple"
                label="Responsable(s)"
                value={formData.personIds}
                options={personsOptions}
                onChange={(value) => {
                  handleInputChange('personIds', value);
                }}
                error={
                  fieldHasError('personIds', formData.personIds)
                    ? 'Elegí al menos un responsable'
                    : undefined
                }
                placeholder="Nombre(s)"
                required
              />
              <Select
                label="Área"
                value={formData.area}
                options={[
                  { label: 'Diseño', value: 'diseño' },
                  { label: 'Desarrollo', value: 'desarrollo' },
                  { label: 'Gestión', value: 'gestion' },
                  { label: 'Investigación', value: 'investigacion' },
                ]}
                onChange={(value) => {
                  handleInputChange('area', value);
                }}
                error={fieldHasError('area', formData.area) ? 'Elegí un área' : undefined}
                placeholder="Área de la tarea"
                required
              />
            </div>
            <div className={styles.column}>
              <Select
                label="Estado"
                value={formData.state}
                options={[
                  { label: 'Activo', value: 'activo' },
                  { label: 'Backlog', value: 'backlog' },
                  { label: 'En revisión', value: 'en_revision' },
                  { label: 'Finalizado', value: 'finalizado' },
                  { label: 'Cancelado', value: 'cancelado' },
                ]}
                onChange={(value) => {
                  handleInputChange('state', value);
                }}
                error={fieldHasError('state', formData.state) ? 'Elegí un estado' : undefined}
                placeholder="Estado de la tarea"
                required
              />
              <Select
                label="Prioridad"
                value={formData.priority.toString()}
                options={[
                  { label: '0', value: '0' },
                  { label: '1', value: '1' },
                  { label: '2', value: '2' },
                  { label: '3', value: '3' },
                  { label: '4', value: '4' },
                  { label: '5', value: '5' },
                ]}
                onChange={(value) => {
                  handleInputChange('priority', value);
                }}
                error={
                  fieldHasError('priority', formData.priority.toString())
                    ? 'Elegí una prioridad'
                    : undefined
                }
                placeholder="Prioridad de la tarea"
                required
              />
              <Select
                label="Nivel de visibilidad"
                value={formData.visibilityLevel}
                options={[
                  { label: 'Público', value: 'public' },
                  { label: 'Interno', value: 'internal' },
                ]}
                onChange={(value) => {
                  handleInputChange('visibilityLevel', value);
                }}
              />
              <Input
                variant="date"
                label="Fecha de finalización estimada"
                value={dateToInputValue(formData.estimatedFinishDate)}
                onChange={(value) => {
                  handleInputChange('estimatedFinishDate', inputValueToDate(value));
                }}
              />
              <Input
                variant="textarea"
                label="Descripción"
                value={formData.description || ''}
                onChange={(value) => {
                  handleInputChange('description', value);
                }}
                error={
                  fieldHasError('description', formData.description || '')
                    ? 'Este campo es requerido'
                    : undefined
                }
                placeholder="Descripción de la tarea"
                required
              />
            </div>
          </div>
          <div className={styles.generalError}>
            {generalError === true && <p>* Campos incompletos</p>}
          </div>
        </form>
      </Card>
    </>
  );
}
