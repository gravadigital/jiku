'use client';
import React, { type FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import ReactSelect from 'react-select';
import { toast } from 'react-toastify';
import * as yup from 'yup';
import { useClients, useCreateProject } from '@/features/projects';
import { Loader } from '@/shared/components/ui';
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

const selectStyles = {
  control: (base: Record<string, unknown>, state: { isFocused: boolean }) => ({
    ...base,
    height: '45px',
    minHeight: '45px',
    border: `1px solid var(--color-general-border)`,
    borderRadius: 'var(--radius-items)',
    boxShadow: 'none',
    outline: state.isFocused ? '2px solid var(--color-highlighted)' : 'none',
    fontSize: '0.9375rem',
    fontWeight: 400,
    backgroundColor: '#fff',
    cursor: 'pointer',
    '&:hover': { border: '1px solid var(--color-general-border)' },
  }),
  valueContainer: (base: Record<string, unknown>) => ({
    ...base,
    padding: '0 0.75rem',
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'nowrap' as const,
  }),
  input: (base: Record<string, unknown>) => ({
    ...base,
    margin: 0,
    paddingTop: 0,
    paddingBottom: 0,
  }),
  indicatorsContainer: (base: Record<string, unknown>) => ({
    ...base,
    height: '45px',
    display: 'flex',
    alignItems: 'center',
  }),
  indicatorSeparator: () => ({ display: 'none' }),
  menu: (base: Record<string, unknown>) => ({
    ...base,
    zIndex: 10,
    fontSize: '0.9375rem',
    borderRadius: 'var(--radius-items)',
    border: '1px solid var(--color-general-border)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  }),
  option: (base: Record<string, unknown>, state: { isSelected: boolean; isFocused: boolean }) => ({
    ...base,
    backgroundColor: state.isSelected ? '#DA2C6A' : state.isFocused ? '#E2E8F0' : '#fff',
    color: state.isSelected ? '#fff' : '#1F2633',
    cursor: 'pointer',
  }),
  singleValue: (base: Record<string, unknown>) => ({ ...base, color: '#1F2633' }),
  placeholder: (base: Record<string, unknown>) => ({ ...base, color: '#aaa' }),
};

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

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Nuevo Proyecto</h1>
        <div className={styles.headerActions}>
          <button type="button" className={styles.backButton} onClick={() => push('/projects')}>
            Volver
          </button>
          <button
            type="button"
            className={styles.saveButton}
            onClick={processCreation}
            disabled={createProjectMutation.isPending}
          >
            {createProjectMutation.isPending ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Card: Información general */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Información general</h2>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="f-name">
                Nombre {!formData.name && <span className={styles.required}>(obligatorio)</span>}
              </label>
              <input
                id="f-name"
                className={styles.fieldInput}
                type="text"
                value={formData.name}
                onChange={(e) => setField('name', e.target.value)}
                placeholder="Nombre del proyecto"
                required
              />
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="f-initDate">
                Fecha de inicio{' '}
                {!dateToInputValue(formData.initDate) && (
                  <span className={styles.required}>(obligatorio)</span>
                )}
              </label>
              <input
                id="f-initDate"
                className={styles.fieldInput}
                type="date"
                value={dateToInputValue(formData.initDate)}
                onChange={(e) => setField('initDate', inputValueToDate(e.target.value))}
                required
              />
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="f-code">
                Código {!formData.code && <span className={styles.required}>(obligatorio)</span>}
              </label>
              <input
                id="f-code"
                className={styles.fieldInput}
                type="text"
                value={formData.code}
                onChange={(e) => setField('code', e.target.value)}
                placeholder="Código del proyecto"
                required
              />
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="f-endDate">
                Fecha de cierre estimada
              </label>
              <input
                id="f-endDate"
                className={styles.fieldInput}
                type="date"
                value={dateToInputValue(formData.endDate)}
                onChange={(e) => setField('endDate', inputValueToDate(e.target.value))}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="f-clientId">
                Cliente
              </label>
              <ReactSelect
                inputId="f-clientId"
                instanceId="f-clientId"
                styles={selectStyles}
                placeholder="Cliente del proyecto"
                value={
                  clients
                    .map((c) => ({ label: c.name, value: String(c.id) }))
                    .find((o) => o.value === String(formData.clientId)) ?? null
                }
                onChange={(opt) => setField('clientId', opt ? Number(opt.value) : null)}
                options={clients.map((c) => ({ label: c.name, value: String(c.id) }))}
                isClearable
              />
            </div>

            <div className={`${styles.field} ${styles.fieldSpan3}`}>
              <label className={styles.fieldLabel} htmlFor="f-description">
                Descripción{' '}
                {!formData.description && <span className={styles.required}>(obligatorio)</span>}
              </label>
              <textarea
                id="f-description"
                className={styles.fieldTextarea}
                value={formData.description}
                onChange={(e) => setField('description', e.target.value)}
                placeholder="Descripción del proyecto"
                required
              />
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="f-type">
                Tipo {!formData.type && <span className={styles.required}>(obligatorio)</span>}
              </label>
              <ReactSelect
                inputId="f-type"
                instanceId="f-type"
                styles={selectStyles}
                placeholder="Tipo de proyecto"
                value={
                  [
                    { label: 'Interno', value: 'interno' },
                    { label: 'Comercial', value: 'comercial' },
                    { label: 'Investigación', value: 'investigacion' },
                    { label: 'Propuesta', value: 'propuesta' },
                  ].find((o) => o.value === formData.type) ?? null
                }
                onChange={(opt) => setField('type', opt?.value ?? '')}
                options={[
                  { label: 'Interno', value: 'interno' },
                  { label: 'Comercial', value: 'comercial' },
                  { label: 'Investigación', value: 'investigacion' },
                  { label: 'Propuesta', value: 'propuesta' },
                ]}
              />
            </div>
          </div>
        </div>

        {/* Card: Propiedades */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Propiedades</h2>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="f-documentacion">
                Documentación
              </label>
              <input
                id="f-documentacion"
                className={styles.fieldInput}
                type="text"
                value={formData.keyValuePairs?.documentacion || ''}
                onChange={(e) => setField('keyValuePairs.documentacion', e.target.value)}
                placeholder="URL de documentación"
              />
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="f-board">
                Board de Tareas
              </label>
              <input
                id="f-board"
                className={styles.fieldInput}
                type="text"
                value={formData.keyValuePairs?.board_de_tareas || ''}
                onChange={(e) => setField('keyValuePairs.board_de_tareas', e.target.value)}
                placeholder="URL del board"
              />
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="f-diseno">
                Diseño
              </label>
              <input
                id="f-diseno"
                className={styles.fieldInput}
                type="text"
                value={formData.keyValuePairs?.diseño || ''}
                onChange={(e) => setField('keyValuePairs.diseño', e.target.value)}
                placeholder="URL de diseño"
              />
            </div>

            {/* Propiedades dinámicas agregadas */}
            {dynamicPairs.map(([key, value]) => (
              <div key={key} className={styles.field}>
                <label className={styles.fieldLabel}>{key}</label>
                <div className={styles.dynamicPropRow}>
                  <input
                    className={styles.fieldInput}
                    type="text"
                    value={value || ''}
                    onChange={(e) => setField(`keyValuePairs.${key}`, e.target.value)}
                    placeholder="Valor"
                  />
                  <button
                    type="button"
                    className={styles.removePropBtn}
                    onClick={() => handleRemovePair(key)}
                    aria-label={`Eliminar link ${key}`}
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 16 16"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M2 4h12M6.5 4V2.5a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1V4M6 7v4M10 7v4M3.5 4l.6 8.4a1 1 0 0 0 1 .93h5.8a1 1 0 0 0 1-.93L12.5 4"
                        stroke="currentColor"
                        strokeWidth="1.3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ))}

            {/* Formulario agregar propiedad — ocupa la celda siguiente libre */}
            <div className={styles.addPropCell}>
              <div className={styles.addPropRow}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel} htmlFor="f-newKey">
                    Clave
                  </label>
                  <input
                    id="f-newKey"
                    className={styles.fieldInput}
                    type="text"
                    placeholder="Clave"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel} htmlFor="f-newValue">
                    Valor
                  </label>
                  <input
                    id="f-newValue"
                    className={styles.fieldInput}
                    type="text"
                    placeholder="Valor"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                  />
                </div>
                <div className={styles.addPropBtnWrap}>
                  <span className={styles.fieldLabel}>&nbsp;</span>
                  <button type="button" className={styles.addPropBtn} onClick={handleAddPair}>
                    Agregar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
