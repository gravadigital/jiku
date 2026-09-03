'use client';
import React, { type FormEvent, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import * as yup from 'yup';
import { usePersons } from '@/features/auth';
import { useCreateObjective } from '@/features/objectives';
import { useProjects } from '@/features/projects';
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
import errorIcon from '@root/assets/error.svg';
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
    value: person.id ? Number(person.id) : 0,
  }));

  const projectsOptions: ProjectOption[] = allProjects.map((project) => ({
    label: project.name,
    value: project.id?.toString() ?? '',
  }));

  const requirementsOptions = requirements.map((requirement) => ({
    label: requirement.title,
    value: requirement.id.toString(),
  }));

  const mapIdToPerson = (id: string) => {
    const person = personsOptions.find((option) => option.value === Number(id));
    return person && person.value
      ? { label: person.label, value: person.value.toString() }
      : { label: id, value: id };
  };

  const handleInputChange = (field: string, value: string | string[], id: number) => {
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
          <SectionCard key={form.id!}>
            <form onSubmit={handleSubmit}>
              <div className={styles.formContainer}>
                <div className={styles.textareaCont}>
                  <InputText
                    label="Título"
                    code="title"
                    value={form.title}
                    onChange={(value) => {
                      handleInputChange('title', value, form.id!);
                    }}
                    error={fieldHasError('title', form.title)}
                    placeholder="Título de la tarea"
                    required
                  />
                  <InputSelect
                    label="Corresponde a..."
                    code="projectId"
                    value={form.projectId}
                    options={projectsOptions}
                    onChange={(value) => {
                      handleInputChange('projectId', value, form.id!);
                    }}
                    error={fieldHasError('projectId', form.projectId)}
                    placeholder="Nombre del proyecto"
                    required
                  />
                  {Boolean(form.projectId) && (
                    <InputSelect
                      label="Requisito"
                      code="requirementId"
                      value={form.requirementId || ''}
                      options={requirementsOptions}
                      onChange={(value) => {
                        handleInputChange('requirementId', value, form.id!);
                      }}
                      placeholder="Seleccionar requisito (opcional)"
                    />
                  )}
                  <InputMultiplePersons
                    label="Responsable(s)"
                    code="personIds"
                    value={form.personIds.map(mapIdToPerson)}
                    options={personsOptions.map((person) => ({
                      label: person.label,
                      value: person.value.toString(),
                    }))}
                    onChange={(value) => {
                      handleInputChange(
                        'personIds',
                        value.map((option) => option.value),
                        form.id!
                      );
                    }}
                    error={fieldHasError('personIds', form.personIds)}
                    placeholder="Nombre(s)"
                    required
                  />
                  <InputSelect
                    label="Área"
                    code="area"
                    value={form.area}
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
                      handleInputChange('area', value, form.id!);
                    }}
                    error={fieldHasError('area', form.area)}
                    placeholder="Área de la tarea"
                    required
                  />
                  <InputSelect
                    label="Nivel de visibilidad"
                    code="visibilityLevel"
                    value={form.visibilityLevel}
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
                      handleInputChange('visibilityLevel', value, form.id!);
                    }}
                    placeholder="Nivel de visibilidad de la tarea"
                    required
                  />
                </div>
                <div className={styles.column}>
                  <InputDate
                    label="Fecha de finalización estimada"
                    code="estimatedFinishDate"
                    value={form.estimatedFinishDate as Date}
                    onChange={(value) => {
                      handleInputChange('estimatedFinishDate', value, form.id!);
                    }}
                    error={fieldHasError(
                      'estimatedFinishDate',
                      form.estimatedFinishDate || new Date()
                    )}
                  />
                  <InputTextarea
                    code="description"
                    label="Descripción"
                    value={form.description || ''}
                    onChange={(value) => {
                      handleInputChange('description', value, form.id!);
                    }}
                    error={fieldHasError('description', form.description || '')}
                    placeholder="Descripción de la tarea"
                    required
                  />
                </div>
              </div>
              <div className={styles.generalError}>
                {form.invalid === true ? (
                  <div className={styles.invalidFormContainer}>
                    <Image alt="error icon" src={errorIcon} height={20} />
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
          </SectionCard>
        );
      })}
    </PageLayout>
  );
}
