'use client';
import React, { type FormEvent, use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import * as yup from 'yup';
import { useClients, useProject, useUpdateProject } from '@/features/projects';
import { Button, Card, Input, Loader, Select } from '@/shared/components/ui';
import { labelFromDate } from '@/shared/utils/dateFormatter';
import styles from './styles.module.scss';

interface Body {
  clientId?: number | null;
  code: string;
  description: string;
  endDate?: Date | null;
  initDate: Date;
  name: string;
  status: string;
  type: string;
  keyValuePairs?: Record<string, string | ''>;
}

const defaultValues: Body = {
  clientId: null,
  code: '',
  description: '',
  endDate: null,
  initDate: new Date(),
  keyValuePairs: {
    board_de_tareas: '',
    diseño: '',
    documentacion: '',
    mattermost_group_name: '',
  },
  name: '',
  status: '',
  type: '',
};

const FIXED_KEYS = ['board_de_tareas', 'diseño', 'documentacion', 'mattermost_group_name'];

const validationSchema = yup.object().shape({
  clientId: yup.number().nullable(),
  code: yup.string().required('El código es requerido'),
  description: yup.string().required('La descripción es requerida'),
  endDate: yup.date().nullable(),
  initDate: yup.date().required('La fecha de inicio es requerida'),
  keyValuePairs: yup
    .object()
    .nullable()
    .transform((obj) => {
      if (!obj) return {};
      const transformed: Record<string, string | null> = {};
      for (const key in obj) {
        if (Object.hasOwn(obj, key)) {
          transformed[key] = obj[key] === '' || typeof obj[key] === 'undefined' ? null : obj[key];
        }
      }
      return transformed;
    })
    .shape({
      board_de_tareas: yup.string().nullable(),
      diseño: yup.string().nullable(),
      documentacion: yup.string().nullable(),
      mattermost_group_name: yup.string().nullable(),
    }),
  name: yup.string().required('El nombre es requerido'),
  status: yup.string().required('El estado es requerido'),
  type: yup.string().required('El tipo es requerido'),
});

const prepareKeyValuePairsForBackend = (
  pairs: Record<string, string | undefined | null>
): Record<string, string | null> => {
  const result: Record<string, string | null> = {};
  for (const key in pairs) {
    if (Object.hasOwn(pairs, key)) {
      const v = pairs[key];
      result[key] = v && v.trim() !== '' ? v : null;
    }
  }
  return Object.keys(result).length ? result : {};
};

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

const TYPE_OPTIONS = [
  { label: 'Interno', value: 'interno' },
  { label: 'Comercial', value: 'comercial' },
  { label: 'Investigación', value: 'investigacion' },
  { label: 'Propuesta', value: 'propuesta' },
];

const STATUS_OPTIONS = [
  { label: 'Activo', value: 'activo' },
  { label: 'Análisis', value: 'analisis' },
  { label: 'Inactivo', value: 'inactivo' },
  { label: 'Finalizado', value: 'finalizado' },
  { label: 'Cancelado', value: 'cancelado' },
];

export default function Form({ params }: { readonly params: Promise<{ id: number }> }) {
  const { id } = use(params);
  const [formData, setFormData] = useState<Body>(defaultValues);
  const [formInitialized, setFormInitialized] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const { push } = useRouter();

  const { data: projectData, isLoading: isLoadingProject } = useProject({ id });
  const { data: clientsData = [], isLoading: isLoadingClients } = useClients();
  const updateProjectMutation = useUpdateProject();

  useEffect(() => {
    if (projectData && !formInitialized) {
      setFormData({
        clientId: projectData.client?.id ?? null,
        code: projectData.code,
        description: projectData.description,
        endDate: projectData.endDate,
        initDate: projectData.initDate,
        keyValuePairs: { ...defaultValues.keyValuePairs, ...projectData.keyValuePairs },
        name: projectData.name,
        status: projectData.status,
        type: projectData.type,
      });
      setFormInitialized(true);
    }
  }, [projectData, formInitialized]);

  const setField = (field: string, value: string | number | Date | null | undefined) => {
    let val = value;
    if (field === 'endDate' && value === '') val = null;
    if (field === 'clientId' && value === 0) val = null;

    setFormData((prev) => {
      const parts = field.split('.');
      if (parts.length > 1) {
        const data = { ...prev };
        let cur: Record<string, unknown> = data as unknown as Record<string, unknown>;
        for (let i = 0; i < parts.length - 1; i++) {
          cur[parts[i]] = { ...(cur[parts[i]] as Record<string, unknown>) };
          cur = cur[parts[i]] as Record<string, unknown>;
        }
        cur[parts[parts.length - 1]] = val;
        return data;
      }
      return { ...prev, [field]: val };
    });
  };

  const dynamicPairs = Object.entries(formData.keyValuePairs ?? {}).filter(
    ([k]) => !FIXED_KEYS.includes(k)
  );

  const handleAddPair = () => {
    const key = newKey.trim();
    if (!key || FIXED_KEYS.includes(key) || Object.hasOwn(formData.keyValuePairs || {}, key))
      return;
    setFormData((prev) => ({ ...prev, keyValuePairs: { ...prev.keyValuePairs, [key]: newValue } }));
    setNewKey('');
    setNewValue('');
  };

  const handleRemovePair = (key: string) => {
    setFormData((prev) => {
      const pairs = { ...(prev.keyValuePairs || {}) };
      delete pairs[key];
      return { ...prev, keyValuePairs: pairs };
    });
  };

  const processEdition = () => {
    const fieldsToUpdate = {
      clientId: formData.clientId,
      code: formData.code,
      description: formData.description,
      endDate: formData.endDate,
      initDate: formData.initDate,
      keyValuePairs: prepareKeyValuePairsForBackend(formData.keyValuePairs || {}),
      name: formData.name,
      status: formData.status,
      type: formData.type,
    };
    if (!fieldsToUpdate.endDate) delete fieldsToUpdate.endDate;
    if (!fieldsToUpdate.clientId) delete fieldsToUpdate.clientId;

    let transformedData;
    try {
      transformedData = validationSchema.validateSync(fieldsToUpdate, { abortEarly: false });
    } catch {
      toast.error('Hay campos obligatorios sin completar');
      return;
    }

    updateProjectMutation.mutate(
      { id: Number(id), payload: transformedData },
      {
        onError: () => {
          toast.error('Hubo un error al editar el proyecto');
        },
        onSuccess: () => {
          push(`/projects/${id}`);
          toast.success('Proyecto editado con éxito');
        },
      }
    );
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    processEdition();
  };

  if (isLoadingProject || isLoadingClients || !formInitialized) {
    return <Loader label="Cargando..." />;
  }

  const clientOptions = clientsData.map((c) => ({ label: c.name, value: String(c.id ?? '') }));

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Editar Proyecto</h1>
        <div className={styles.headerActions}>
          <Button variant="secondary-nav" href={`/projects/${id}`}>
            Volver
          </Button>
          <Button
            onClick={processEdition}
            disabled={updateProjectMutation.isPending}
            loading={updateProjectMutation.isPending}
          >
            Guardar
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card variant="panel" title="Información general" headingLevel="h2">
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <Input
                label="Nombre"
                value={formData.name}
                onChange={(value) => setField('name', value)}
                placeholder="Nombre del proyecto"
                required
              />
            </div>

            <div className={styles.field}>
              <Input
                variant="date"
                label="Fecha de inicio"
                value={dateToInputValue(formData.initDate)}
                onChange={(value) => setField('initDate', inputValueToDate(value))}
                required
              />
            </div>

            <div className={styles.field}>
              <Input
                label="Código"
                value={formData.code}
                onChange={(value) => setField('code', value)}
                placeholder="Código del proyecto"
                required
              />
            </div>

            <div className={styles.field}>
              <Input
                variant="date"
                label="Fecha de cierre estimada"
                value={dateToInputValue(formData.endDate)}
                onChange={(value) => setField('endDate', inputValueToDate(value))}
              />
            </div>

            <div className={styles.field}>
              <Select
                label="Cliente"
                placeholder="Cliente del proyecto"
                value={formData.clientId ? String(formData.clientId) : ''}
                onChange={(value) => setField('clientId', value ? Number(value) : null)}
                options={clientOptions}
              />
            </div>

            <div className={`${styles.field} ${styles.fieldSpan3}`}>
              <Input
                variant="textarea"
                label="Descripción"
                value={formData.description}
                onChange={(value) => setField('description', value)}
                placeholder="Descripción del proyecto"
                required
              />
            </div>

            <div className={styles.field}>
              <Select
                label="Tipo"
                placeholder="Tipo de proyecto"
                value={formData.type}
                onChange={(value) => setField('type', value)}
                options={TYPE_OPTIONS}
                required
              />
            </div>

            <div className={styles.field}>
              <Select
                label="Estado"
                placeholder="Estado del proyecto"
                value={formData.status}
                onChange={(value) => setField('status', value)}
                options={STATUS_OPTIONS}
                required
              />
            </div>
          </div>
        </Card>

        <Card variant="panel" title="Propiedades" headingLevel="h2">
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <Input
                label="Documentación"
                value={formData.keyValuePairs?.documentacion || ''}
                onChange={(value) => setField('keyValuePairs.documentacion', value)}
                placeholder="URL de documentación"
              />
            </div>

            <div className={styles.field}>
              <Input
                label="Board de Tareas"
                value={formData.keyValuePairs?.board_de_tareas || ''}
                onChange={(value) => setField('keyValuePairs.board_de_tareas', value)}
                placeholder="URL del board"
              />
            </div>

            <div className={styles.field}>
              <Input
                label="Mattermost group name"
                value={formData.keyValuePairs?.mattermost_group_name || ''}
                onChange={(value) => setField('keyValuePairs.mattermost_group_name', value)}
                placeholder="Nombre del grupo"
              />
            </div>

            <div className={styles.field}>
              <Input
                label="Diseño"
                value={formData.keyValuePairs?.diseño || ''}
                onChange={(value) => setField('keyValuePairs.diseño', value)}
                placeholder="URL de diseño"
              />
            </div>

            {/* Propiedades dinámicas agregadas */}
            {dynamicPairs.map(([key, val]) => (
              <div key={key} className={styles.field}>
                <div className={styles.dynamicPropRow}>
                  <Input
                    label={key}
                    value={val || ''}
                    onChange={(v) => setField(`keyValuePairs.${key}`, v)}
                    placeholder="Valor"
                  />
                  <Button variant="secondary-dismiss" onClick={() => handleRemovePair(key)}>
                    Eliminar {key}
                  </Button>
                </div>
              </div>
            ))}

            {/* Formulario agregar propiedad */}
            <div className={styles.addPropCell}>
              <div className={styles.addPropRow}>
                <div className={styles.field}>
                  <Input label="Clave" placeholder="Clave" value={newKey} onChange={setNewKey} />
                </div>
                <div className={styles.field}>
                  <Input
                    label="Valor"
                    placeholder="Valor"
                    value={newValue}
                    onChange={setNewValue}
                  />
                </div>
                <div className={styles.addPropBtnWrap}>
                  <Button variant="secondary-dismiss" onClick={handleAddPair}>
                    Agregar
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </form>
    </div>
  );
}
