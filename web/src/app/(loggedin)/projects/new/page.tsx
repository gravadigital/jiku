'use client';
import React, { type FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import * as yup from 'yup';
import { useClients, useCreateProject } from '@/features/projects';
import { Button, Card, Input, Loader, Select } from '@/shared/components/ui';
import { labelFromDate } from '@/shared/utils/dateFormatter';
import styles from './styles.module.scss';

interface Body {
  clientId?: number | null;
  code: string;
  description: string;
  initDate: Date;
  endDate?: Date | null;
  name: string;
  status: string;
  type: string;
  keyValuePairs?: Record<string, string | null> | null;
}

const defaultValues: Body = {
  clientId: null,
  code: '',
  description: '',
  endDate: null,
  initDate: new Date(''),
  keyValuePairs: {
    board_de_tareas: '',
    diseño: '',
    documentacion: '',
  },
  name: '',
  status: 'analisis',
  type: '',
};

const FIXED_KEYS = ['board_de_tareas', 'diseño', 'documentacion'];

const TYPE_OPTIONS = [
  { label: 'Interno', value: 'interno' },
  { label: 'Comercial', value: 'comercial' },
  { label: 'Investigación', value: 'investigacion' },
  { label: 'Propuesta', value: 'propuesta' },
];

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
    }),
  name: yup.string().required('El nombre es requerido'),
  type: yup.string().required('El tipo es requerido'),
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
  const [formData, setFormData] = useState(defaultValues);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const { push } = useRouter();

  const { data: clients = [], isLoading: isLoadingClients } = useClients();
  const createProjectMutation = useCreateProject();

  const setField = (field: string, value: string | number | Date | null | undefined) => {
    setFormData((prev) => {
      const parts = field.split('.');
      if (parts.length === 2) {
        const [parentKey, childKey] = parts;
        const parent =
          (prev as unknown as Record<string, Record<string, unknown>>)[parentKey] ?? {};
        return { ...prev, [parentKey]: { ...parent, [childKey]: value } };
      }
      return { ...prev, [field]: value };
    });
  };

  const processCreation = () => {
    const dataToSend = { ...formData };
    if (!dataToSend.endDate) delete dataToSend.endDate;
    if (!dataToSend.clientId) delete dataToSend.clientId;
    if (isNaN(new Date(dataToSend.initDate).getTime())) {
      (dataToSend as Partial<Body>).initDate = undefined;
    }

    if (dataToSend.keyValuePairs) {
      const transformed: Record<string, string | null> = {};
      let hasValue = false;
      for (const [k, v] of Object.entries(dataToSend.keyValuePairs)) {
        const tv = v === '' || v === null ? null : v;
        transformed[k] = tv;
        if (tv !== null) hasValue = true;
      }
      if (hasValue) dataToSend.keyValuePairs = transformed;
      else delete dataToSend.keyValuePairs;
    }

    let transformedData: Body;
    try {
      transformedData = validationSchema.validateSync(dataToSend, { abortEarly: false }) as Body;
    } catch {
      toast.error('Hay campos obligatorios sin completar');
      return;
    }

    createProjectMutation.mutate(transformedData, {
      onError: () => {
        toast.error('Hubo un error al crear el proyecto');
      },
      onSuccess: (created) => {
        push(`/projects/${created.id}`);
        toast.success('Proyecto creado con éxito');
      },
    });
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    processCreation();
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

  if (isLoadingClients) return <Loader label="Cargando..." />;

  const clientOptions = clients.map((c) => ({ label: c.name, value: String(c.id ?? '') }));

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Nuevo Proyecto</h1>
        <div className={styles.headerActions}>
          <Button variant="secondary-nav" href="/projects">
            Volver
          </Button>
          <Button
            onClick={processCreation}
            disabled={createProjectMutation.isPending}
            loading={createProjectMutation.isPending}
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
                label="Diseño"
                value={formData.keyValuePairs?.diseño || ''}
                onChange={(value) => setField('keyValuePairs.diseño', value)}
                placeholder="URL de diseño"
              />
            </div>

            {/* Propiedades dinámicas agregadas */}
            {dynamicPairs.map(([key, value]) => (
              <div key={key} className={styles.field}>
                <div className={styles.dynamicPropRow}>
                  <Input
                    label={key}
                    value={value || ''}
                    onChange={(v) => setField(`keyValuePairs.${key}`, v)}
                    placeholder="Valor"
                  />
                  <Button variant="secondary-dismiss" onClick={() => handleRemovePair(key)}>
                    Eliminar {key}
                  </Button>
                </div>
              </div>
            ))}

            {/* Formulario agregar propiedad — ocupa la celda siguiente libre */}
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
