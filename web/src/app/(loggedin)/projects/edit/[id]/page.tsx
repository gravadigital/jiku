'use client';
import React, { type FormEvent, use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ReactSelect from 'react-select';
import { toast } from 'react-toastify';
import * as yup from 'yup';
import { useClients, useProject, useUpdateProject } from '@/features/projects';
import { Loader } from '@/shared/components/ui';
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

const selectStyles = {
  control: (base: Record<string, unknown>, state: { isFocused: boolean }) => ({
    ...base,
    height: '45px',
    minHeight: '45px',
    border: '1px solid var(--color-general-border)',
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

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Editar Proyecto</h1>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.backButton}
            onClick={() => push(`/projects/${id}`)}
          >
            Volver
          </button>
          <button
            type="button"
            className={styles.saveButton}
            onClick={processEdition}
            disabled={updateProjectMutation.isPending}
          >
            {updateProjectMutation.isPending ? 'Guardando...' : 'Guardar'}
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
                  clientsData
                    .map((c) => ({ label: c.name, value: String(c.id) }))
                    .find((o) => o.value === String(formData.clientId)) ?? null
                }
                onChange={(opt) => setField('clientId', opt ? Number(opt.value) : null)}
                options={clientsData.map((c) => ({ label: c.name, value: String(c.id) }))}
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
                value={TYPE_OPTIONS.find((o) => o.value === formData.type) ?? null}
                onChange={(opt) => setField('type', opt?.value ?? '')}
                options={TYPE_OPTIONS}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="f-status">
                Estado {!formData.status && <span className={styles.required}>(obligatorio)</span>}
              </label>
              <ReactSelect
                inputId="f-status"
                instanceId="f-status"
                styles={selectStyles}
                placeholder="Estado del proyecto"
                value={STATUS_OPTIONS.find((o) => o.value === formData.status) ?? null}
                onChange={(opt) => setField('status', opt?.value ?? '')}
                options={STATUS_OPTIONS}
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
              <label className={styles.fieldLabel} htmlFor="f-mattermost">
                Mattermost group name
              </label>
              <input
                id="f-mattermost"
                className={styles.fieldInput}
                type="text"
                value={formData.keyValuePairs?.mattermost_group_name || ''}
                onChange={(e) => setField('keyValuePairs.mattermost_group_name', e.target.value)}
                placeholder="Nombre del grupo"
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
            {dynamicPairs.map(([key, val]) => (
              <div key={key} className={styles.field}>
                <label className={styles.fieldLabel}>{key}</label>
                <div className={styles.dynamicPropRow}>
                  <input
                    className={styles.fieldInput}
                    type="text"
                    value={val || ''}
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

            {/* Formulario agregar propiedad */}
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
