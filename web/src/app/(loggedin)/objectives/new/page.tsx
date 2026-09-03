'use client';
import React, { type FormEvent, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import * as yup from 'yup';
import { usePersons } from '@/features/auth';
import { useCreateObjective } from '@/features/objectives';
import { useProjects } from '@/features/projects';
import { useRequirements } from '@/features/requirements';
import { PageLayout } from '@/shared/components/layout';
import { Button, Card, Input, Loader, Select } from '@/shared/components/ui';
import { labelFromDate } from '@/shared/utils/dateFormatter';
import styles from './styles.module.scss';

interface Body {
  id?: number;
  area: string;
  invalid?: boolean | null;
  description?: string;
  estimatedFinishDate?: Date | null;
  priority: string;
  projectId: string;
  state: string;
  personIds: string[];
  title: string;
  visibilityLevel: string;
  requirementId?: string;
}

interface ProjectOption {
  label: string;
  value: string;
}

const defaultValues: Body = {
  area: 'desarrollo',
  description: '',
  estimatedFinishDate: null,
  id: 0,
  invalid: null,
  personIds: [],
  priority: '0',
  projectId: '',
  requirementId: '',
  state: 'activo',
  title: '',
  visibilityLevel: 'internal',
};

const validationSchema = yup.object().shape({
  area: yup.string().required(),
  description: yup.string().nullable(),
  estimatedFinishDate: yup.date().nullable(),
  personIds: yup.array().of(yup.string()).min(1).required(),
  priority: yup.number().min(0).max(5).required(),
  projectId: yup.number().required(),
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

export default function Form() {
  const [canCreate, setCanCreate] = useState<{ valid: boolean | null }>({ valid: null });
  const [formsData, setFormsData] = useState<Body[]>([defaultValues]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const { push } = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  // TanStack Query hooks
  const { data: persons = [], isLoading: isLoadingPersons } = usePersons();
  const { data: allProjects = [], isLoading: isLoadingProjects } = useProjects({
    filters: { sort: 'name', state: 'activo,analisis' },
  });
  const { data: requirements = [] } = useRequirements({
    enabled: Boolean(selectedProjectId),
    filters: { projectId: Number(selectedProjectId) || 0 },
  });
  const createObjectiveMutation = useCreateObjective();

  // Set initial projectId and requirementId from URL params
  useEffect(() => {
    const projectId = searchParams?.get('projectId') || null;
    const requirementId = searchParams?.get('requirementId') || null;
    if (projectId) {
      setSelectedProjectId(projectId);
      setFormsData((prevData) => [
        {
          ...prevData[0],
          projectId: projectId.toString(),
          ...(requirementId && { requirementId: requirementId.toString() }),
        },
      ]);
    }
  }, [searchParams]);

  // Process creation when canCreate is true
  useEffect(() => {
    if (canCreate.valid === true) {
      const objectivesToCreate = formsData.map((formData) => {
        const objectiveData: any = {
          area: formData.area,
          personIds: formData.personIds,
          priority: formData.priority,
          projectId: Number(formData.projectId),
          state: formData.state,
          title: formData.title,
          visibilityLevel: formData.visibilityLevel,
        };

        if (formData.estimatedFinishDate) {
          objectiveData.estimatedFinishDate = formData.estimatedFinishDate;
        }

        if (formData.description) {
          objectiveData.description = formData.description;
        }

        if (formData.requirementId) {
          objectiveData.requirementId = Number(formData.requirementId);
        }

        return objectiveData;
      });

      Promise.all(objectivesToCreate.map((data) => createObjectiveMutation.mutateAsync(data)))
        .then(() => {
          toast.success('Tareas creadas con éxito');
          const originRequirementId = searchParams?.get('requirementId');
          if (originRequirementId) {
            queryClient.invalidateQueries({
              queryKey: ['requirement', Number(originRequirementId)],
            });
            push(`/requirements/${originRequirementId}`);
          } else {
            push('/objectives');
          }
        })
        .catch((error) => {
          toast.error(error?.message ?? 'Error al crear algunas tareas');
        });

      setCanCreate({ valid: null });
    }
  }, [canCreate, formsData, push, createObjectiveMutation, searchParams, queryClient]);

  // Prepare options
  const personsOptions = persons.map((person) => ({
    label: `${person.firstName} ${person.lastName}`,
    value: person.id ? String(person.id) : '0',
  }));

  const projectsOptions: ProjectOption[] = allProjects.map((project) => ({
    label: project.name,
    value: project.id?.toString() ?? '',
  }));

  const requirementsOptions = requirements.map((requirement) => ({
    label: requirement.title,
    value: requirement.id.toString(),
  }));

  const handleInputChange = (
    field: string,
    value: string | string[],
    id: number
  ) => {
    setFormsData((prevFormsData) => {
      return prevFormsData.map((formData) => {
        if (formData.id === id) {
          const updatedFormData = { ...formData, [field]: value };

          if (field === 'projectId') {
            setSelectedProjectId(value as string);
            updatedFormData.requirementId = '';
          }

          return updatedFormData;
        }
        return formData;
      });
    });
  };

  const fieldHasError = (fieldName: string, value: string | string[] | Date) => {
    const fieldToValidate = yup.reach(validationSchema, fieldName);
    if (fieldToValidate instanceof yup.Schema) {
      const isValid = fieldToValidate.isValidSync(value);
      return !isValid;
    }
    return true;
  };

  const processCreation = () => {
    setFormsData((prevFormsData: Body[]) => {
      let allFormsAreValid = true;
      const updatedForms = prevFormsData.map((formData) => {
        const isValid = validationSchema.isValidSync(formData);
        if (!isValid) {
          allFormsAreValid = false;
        }
        return {
          ...formData,
          invalid: !isValid,
        };
      });

      setCanCreate({ valid: allFormsAreValid });
      return updatedForms;
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    processCreation();
  };

  const buttons = [
    <Button
      key="action-1"
      onClick={() => {
        processCreation();
      }}
      loading={createObjectiveMutation.isPending}
      disabled={createObjectiveMutation.isPending}
    >
      Guardar
    </Button>,
  ];

  const cloneForm = (id: number) => {
    let targetForm = formsData.find((form) => form.id! === id);
    if (!targetForm) {
      return;
    }
    targetForm = { ...targetForm, id: Date.now() };
    setFormsData((prevState) => {
      return [...prevState, targetForm];
    });
  };

  const deleteForm = (id: number) => {
    setFormsData((prevState) => {
      return prevState.filter((form) => form.id! !== id);
    });
  };

  const isLoading = isLoadingPersons || isLoadingProjects;

  if (isLoading) {
    return <Loader label="Cargando..." />;
  }

  return (
    <PageLayout title="Tareas / crear" actions={buttons}>
      {formsData.map((form) => {
        return (
          <Card key={form.id!} variant="panel">
            <form onSubmit={handleSubmit}>
              <div className={styles.formContainer}>
                <div className={styles.textareaCont}>
                  <Input
                    label="Título"
                    value={form.title}
                    onChange={(value) => {
                      handleInputChange('title', value, form.id!);
                    }}
                    error={fieldHasError('title', form.title) ? 'Este campo es requerido' : undefined}
                    placeholder="Título de la tarea"
                    required
                  />
                  <Select
                    label="Corresponde a..."
                    value={form.projectId}
                    options={projectsOptions}
                    onChange={(value) => {
                      handleInputChange('projectId', value, form.id!);
                    }}
                    error={fieldHasError('projectId', form.projectId) ? 'Elegí un proyecto' : undefined}
                    placeholder="Nombre del proyecto"
                    required
                  />
                  {Boolean(form.projectId) && (
                    <Select
                      label="Requisito"
                      value={form.requirementId || ''}
                      options={requirementsOptions}
                      onChange={(value) => {
                        handleInputChange('requirementId', value, form.id!);
                      }}
                      placeholder="Seleccionar requisito (opcional)"
                    />
                  )}
                  <Select
                    variant="multiple"
                    label="Responsable(s)"
                    value={form.personIds}
                    options={personsOptions}
                    onChange={(value) => {
                      handleInputChange('personIds', value, form.id!);
                    }}
                    error={
                      fieldHasError('personIds', form.personIds)
                        ? 'Elegí al menos un responsable'
                        : undefined
                    }
                    placeholder="Nombre(s)"
                    required
                  />
                  <Select
                    label="Área"
                    value={form.area}
                    options={[
                      { label: 'Diseño', value: 'diseño' },
                      { label: 'Desarrollo', value: 'desarrollo' },
                      { label: 'Gestión', value: 'gestion' },
                      { label: 'Investigación', value: 'investigacion' },
                    ]}
                    onChange={(value) => {
                      handleInputChange('area', value, form.id!);
                    }}
                    error={fieldHasError('area', form.area) ? 'Elegí un área' : undefined}
                    placeholder="Área de la tarea"
                    required
                  />
                  <Select
                    label="Nivel de visibilidad"
                    value={form.visibilityLevel}
                    options={[
                      { label: 'Público', value: 'public' },
                      { label: 'Interno', value: 'internal' },
                    ]}
                    onChange={(value) => {
                      handleInputChange('visibilityLevel', value, form.id!);
                    }}
                    placeholder="Nivel de visibilidad de la tarea"
                    required
                  />
                </div>
                <div className={styles.column}>
                  <Input
                    variant="date"
                    label="Fecha de finalización estimada"
                    value={dateToInputValue(form.estimatedFinishDate)}
                    onChange={(value) => {
                      handleInputChange('estimatedFinishDate', inputValueToDate(value) as any, form.id!);
                    }}
                  />
                  <Input
                    variant="textarea"
                    label="Descripción"
                    value={form.description || ''}
                    onChange={(value) => {
                      handleInputChange('description', value, form.id!);
                    }}
                    error={
                      fieldHasError('description', form.description || '')
                        ? 'Este campo es requerido'
                        : undefined
                    }
                    placeholder="Descripción de la tarea"
                    required
                  />
                </div>
              </div>
              <div className={styles.generalError}>
                {form.invalid === true ? (
                  <div className={styles.invalidFormContainer}>
                    <p>Revisá que no haya campos incompletos</p>
                  </div>
                ) : null}
              </div>
            </form>
            <div className={styles.buttonsContainer}>
              <div className={styles.deleteFormButton}>
                {formsData.length > 1 && (
                  <Button variant="secondary-dismiss" onClick={() => deleteForm(form.id!)}>
                    Borrar
                  </Button>
                )}
              </div>
              <div className={styles.cloneButtonContainer}>
                <Button variant="secondary-dismiss" onClick={() => cloneForm(form.id!)}>
                  Clonar
                </Button>
              </div>
            </div>
          </Card>
        );
      })}
    </PageLayout>
  );
}
