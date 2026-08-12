'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Select from 'react-select';
import { toast } from 'react-toastify';
import * as Yup from 'yup';
import { extractAttachmentIds } from '@/features/attachments/utils/extractAttachmentIds';
import { usePersons } from '@/features/auth';
import { useProjects } from '@/features/projects/hooks/useProjects';
import { transformYupErrors } from '@/shared/utils/transform-yup-errors';
import { useCreateRequirement } from '../../hooks/useCreateRequirement';
import { useRequirementTagSuggestions } from '../../hooks/useRequirementTagSuggestions';
import {
  RequirementRichTextEditor,
  type RequirementRichTextEditorHandle,
} from '../RequirementRichTextEditor';
import styles from './CreateRequirementForm.module.scss';
import type {
  CreateRequirementPayload,
  RequirementPriority,
  RequirementState,
  RequirementTag,
  RequirementType,
  VisibilityLevel,
} from '../../types/requirement.types';

const TYPE_OPTIONS = [
  { label: 'Sin tipo', value: '' },
  { label: 'Funcionalidad', value: 'funcionalidad' },
  { label: 'Mejora', value: 'mejora' },
  { label: 'Incidencia', value: 'incidencia' },
  { label: 'Otro', value: 'otro' },
];

const PRIORITY_OPTIONS = [
  { label: 'Sin prioridad', value: 'sin_prioridad' },
  { label: 'Baja', value: 'baja' },
  { label: 'Media', value: 'media' },
  { label: 'Alta', value: 'alta' },
  { label: 'Urgente', value: 'urgente' },
];

const STATE_OPTIONS = [
  { label: 'Análisis', value: 'analisis' },
  { label: 'Planificación', value: 'planificacion' },
  { label: 'En cola', value: 'en_cola' },
  { label: 'Desarrollo', value: 'desarrollo' },
  { label: 'Revisión', value: 'revision' },
  { label: 'Resuelto', value: 'resuelto' },
  { label: 'Cancelado', value: 'cancelado' },
];

const VISIBILITY_OPTIONS = [
  { label: 'Público', value: 'public' },
  { label: 'Interno', value: 'internal' },
];

const selectStyles = {
  control: (base: Record<string, unknown>, state: { isFocused: boolean }) => ({
    ...base,
    height: '40px',
    minHeight: '40px',
    border: state.isFocused ? '1px solid var(--color-highlighted)' : '1px solid #e6e8ed',
    borderRadius: '8px',
    boxShadow: 'none',
    outline: 'none',
    fontSize: '0.875rem',
    fontWeight: 400,
    backgroundColor: '#fff',
    cursor: 'pointer',
    '&:hover': {
      border: state.isFocused ? '1px solid var(--color-highlighted)' : '1px solid #e6e8ed',
    },
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
    height: '40px',
    display: 'flex',
    alignItems: 'center',
  }),
  indicatorSeparator: () => ({ display: 'none' }),
  menu: (base: Record<string, unknown>) => ({
    ...base,
    zIndex: 10,
    fontSize: '0.875rem',
    borderRadius: '8px',
    border: '1px solid #e6e8ed',
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

// Estilos calcados de InputMultiplePersons (usado en creación/edición de tarea) para que el
// multi-select de Responsables se comporte igual: chips que no se achican, wrap sin altura fija.
const responsibleSelectStyles = {
  control: (base: Record<string, unknown>, state: { isFocused: boolean }) => ({
    ...base,
    '&:hover': { cursor: 'pointer' },
    backgroundColor: '#fff',
    border: '0.5px solid var(--color-general-border)',
    borderRadius: 'var(--radius-items)',
    boxSizing: 'border-box' as const,
    color: 'var(--color-general-title)',
    fontSize: '1rem',
    fontWeight: 400,
    lineHeight: '1.5rem',
    outline: state.isFocused ? '2px solid var(--color-highlighted)' : 'none',
    width: '100%',
  }),
  multiValue: (base: Record<string, unknown>, state: { index: number }) => ({
    ...base,
    alignItems: 'center',
    backgroundColor: state.index === 0 ? '#D9D9D9' : '#f5f2f0',
    borderRadius: 'var(--radius-items)',
    color: '#666',
    display: 'flex',
    fontFamily: 'var(--font-primary)',
    fontSize: '1rem',
    margin: '5px',
    padding: '2px 6px',
  }),
  multiValueLabel: (base: Record<string, unknown>, state: { index: number }) => ({
    ...base,
    color: state.index === 0 ? '#000' : 'var(--color-general-title)',
  }),
  multiValueRemove: (base: Record<string, unknown>) => ({
    cursor: 'pointer',
    ...base,
    '&:hover': { color: 'darkred' },
    background: 'none',
    border: 'none',
    color: 'red',
    fontSize: '1rem',
    marginLeft: '5px',
  }),
  input: (base: Record<string, unknown>) => ({
    ...base,
    margin: 0,
    paddingTop: 0,
    paddingBottom: 0,
  }),
  placeholder: (base: Record<string, unknown>) => ({
    ...base,
    fontSize: '0.875rem',
    color: '#aaa',
  }),
};

const selectStylesDisabled = {
  ...selectStyles,
  control: (base: Record<string, unknown>, _state: { isFocused: boolean }) => ({
    ...base,
    height: '40px',
    minHeight: '40px',
    border: '1px solid #e6e8ed',
    borderRadius: '8px',
    boxShadow: 'none',
    outline: 'none',
    fontSize: '0.875rem',
    fontWeight: 400,
    backgroundColor: '#f0f1f3',
    opacity: 0.7,
    cursor: 'not-allowed',
    pointerEvents: 'none' as const,
  }),
  dropdownIndicator: () => ({ display: 'none' }),
  indicatorsContainer: () => ({ display: 'none' }),
  singleValue: (base: Record<string, unknown>) => ({ ...base, color: '#1f2633' }),
};

const schema = Yup.object({
  title: Yup.string()
    .required('El título es requerido')
    .test('not-blank', 'El título es requerido', (v) => !!v && v.trim().length > 0),
  description: Yup.string()
    .required('La descripción es requerida')
    .test('not-blank', 'La descripción es requerida', (v) => !!v && v.trim().length > 0),
  projectId: Yup.number()
    .typeError('El proyecto es requerido')
    .required('El proyecto es requerido'),
});

interface FormState {
  title: string;
  description: string;
  type: string;
  priority: string;
  state: string;
  visibilityLevel: string;
  estimatedFinishDate: string;
  projectId: string;
  responsiblePersonIds: string[];
}

export function CreateRequirementForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetProjectId = searchParams?.get('projectId');
  const { mutate: createRequirement, isPending } = useCreateRequirement();
  const { data: projects = [] } = useProjects({ filters: { state: 'analisis,activo' } });
  const { data: persons = [] } = usePersons();

  const [form, setForm] = useState<FormState>({
    title: '',
    description: '',
    type: '',
    priority: 'sin_prioridad',
    state: 'analisis',
    visibilityLevel: 'public',
    estimatedFinishDate: '',
    projectId: '',
    responsiblePersonIds: [],
  });
  const [, setErrors] = useState<Record<string, string>>({});
  const [tagKey, setTagKey] = useState('');
  const [tagValue, setTagValue] = useState('');
  const [tags, setTags] = useState<RequirementTag[]>([]);
  const [uploadError, setUploadError] = useState('');

  const editorRef = useRef<RequirementRichTextEditorHandle>(null);
  const panelLeftRef = useRef<HTMLDivElement>(null);
  const panelRightRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const right = panelRightRef.current;
    const left = panelLeftRef.current;
    if (!right || !left) return;
    const observer = new ResizeObserver(() => {
      left.style.maxHeight = right.offsetHeight + 'px';
    });
    observer.observe(right);
    return () => observer.disconnect();
  }, []);

  const selectedProjectId = form.projectId ? Number(form.projectId) : null;
  const { data: tagSuggestions = [] } = useRequirementTagSuggestions(selectedProjectId);

  const todayISO = new Date().toISOString().split('T')[0];

  const projectOptions = [
    { label: 'Seleccionar proyecto...', value: '' },
    ...[...projects]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((p) => ({ label: p.name, value: String(p.id) })),
  ];

  const responsibleOptions = persons
    .filter((p) => p.id != null)
    .map((p) => ({
      label: `${p.firstName} ${p.lastName}`,
      value: String(p.id),
    }));

  useEffect(() => {
    if (!presetProjectId || projects.length === 0) return;
    const projectExists = projects.find((p) => String(p.id) === presetProjectId);
    if (!projectExists) return;
    setForm((f) => (f.projectId ? f : { ...f, projectId: presetProjectId }));
  }, [presetProjectId, projects]);

  function handleProjectChange(value: string) {
    setForm((f) => (f.projectId === value ? f : { ...f, projectId: value }));
  }

  function handleDescriptionChange(value: string) {
    setForm((f) => ({ ...f, description: value }));
  }

  function handleAddTag() {
    if (!tagKey.trim() || !tagValue.trim()) return;
    setTags((prev) => [...prev, { key: tagKey.trim(), value: tagValue.trim() }]);
    setTagKey('');
    setTagValue('');
  }

  function handleRemoveTag(index: number) {
    setTags((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSuggestionClick(key: string, value: string) {
    setTagKey(key);
    setTagValue(value);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    const dataToValidate = {
      title: form.title,
      description: form.description,
      projectId: form.projectId ? Number(form.projectId) : undefined,
    };

    try {
      await schema.validate(dataToValidate, { abortEarly: false });
    } catch (err) {
      if (err instanceof Yup.ValidationError) {
        setErrors(transformYupErrors(err));
        return;
      }
    }

    const payload: CreateRequirementPayload = {
      title: form.title,
      description: form.description,
      type: (form.type === '' ? null : form.type) as RequirementType,
      priority: form.priority as RequirementPriority,
      state: form.state as RequirementState,
      visibilityLevel: form.visibilityLevel as VisibilityLevel,
      projectId: Number(form.projectId),
      ...(form.estimatedFinishDate && { estimatedFinishDate: form.estimatedFinishDate }),
      ...(form.responsiblePersonIds.length > 0 && {
        responsiblePersonIds: form.responsiblePersonIds.map(Number),
      }),
      ...(tags.length > 0 && { tags }),
      attachmentIds: extractAttachmentIds(form.description),
    };

    createRequirement(payload, {
      onSuccess: () => {
        toast.success('Requisito creado correctamente');
        router.push('/requirements');
      },
      onError: (error: unknown) => {
        const msg =
          (error instanceof Error ? error.message : null) ??
          (error != null && typeof error === 'object' && 'message' in error
            ? String((error as { message: unknown }).message)
            : 'Error al crear el requisito');
        toast.error(msg);
      },
    });
  }

  const tagIcon = (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2H2v10l9.29 9.29a1 1 0 0 0 1.42 0l7.29-7.29a1 1 0 0 0 0-1.42L12 2z" />
      <circle cx="7" cy="7" r="1" fill="currentColor" stroke="none" />
    </svg>
  );

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Nuevo Requisito</h1>
        </div>
        <div className={styles.headerActions}>
          <Link href="/requirements" className={styles.backButton}>
            Volver
          </Link>
          <button
            type="submit"
            className={styles.submitButton}
            disabled={isPending}
            aria-busy={isPending}
          >
            {isPending ? 'Creando...' : 'Crear Requisito'}
          </button>
        </div>
      </header>

      <div className={styles.panels}>
        {/* Panel izquierdo */}
        <div className={styles.panelLeft} ref={panelLeftRef}>
          <div className={styles.panelCard}>
            <h2 className={styles.panelTitle}>Detalle</h2>

            <div className={styles.field}>
              <label htmlFor="title" className={styles.fieldLabel}>
                Título{' '}
                {!form.title.trim() && <span className={styles.required}>(obligatorio)</span>}
              </label>
              <input
                id="title"
                type="text"
                className={styles.fieldInput}
                aria-label="Título"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                required
              />
            </div>

            <div className={styles.field}>
              <label id="description-label" className={styles.fieldLabel}>
                Contexto{' '}
                {!form.description.trim() && <span className={styles.required}>(obligatorio)</span>}
              </label>
              {uploadError && <span className={styles.fieldError}>{uploadError}</span>}
              <RequirementRichTextEditor
                ref={editorRef}
                ariaLabel="Contexto"
                placeholder="Describe el requisito..."
                onChange={handleDescriptionChange}
                onUploadError={setUploadError}
              />
            </div>
          </div>

          {/* Etiquetas */}
          <div className={styles.tagsSection}>
            <label className={styles.tagsLabel}>Etiquetas</label>

            {tagSuggestions.length > 0 && (
              <div className={styles.suggestions}>
                {tagSuggestions.flatMap((s) =>
                  s.values.map((v) => (
                    <button
                      key={`${s.key}:${v}`}
                      type="button"
                      className={styles.suggestionChip}
                      onClick={() => handleSuggestionClick(s.key, v)}
                    >
                      {tagIcon}
                      {s.key}: {v}
                    </button>
                  ))
                )}
              </div>
            )}

            <div className={styles.tagList}>
              {tags.map((tag, i) => (
                <span key={i} className={styles.chip}>
                  {tagIcon}
                  {tag.key}: {tag.value}
                  <button
                    type="button"
                    className={styles.chipRemove}
                    onClick={() => handleRemoveTag(i)}
                    aria-label={`Eliminar tag ${tag.key}:${tag.value}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            <div className={styles.tagInputRow}>
              <div className={styles.tagField}>
                <label htmlFor="tagKey" className={styles.tagFieldLabel}>
                  Clave
                </label>
                <input
                  id="tagKey"
                  type="text"
                  className={styles.tagInput}
                  aria-label="Clave"
                  value={tagKey}
                  onChange={(e) => setTagKey(e.target.value)}
                />
              </div>
              <div className={styles.tagField}>
                <label htmlFor="tagValue" className={styles.tagFieldLabel}>
                  Valor
                </label>
                <input
                  id="tagValue"
                  type="text"
                  className={styles.tagInput}
                  aria-label="Valor"
                  value={tagValue}
                  onChange={(e) => setTagValue(e.target.value)}
                />
              </div>
              <button
                type="button"
                className={styles.addTagButton}
                onClick={handleAddTag}
                disabled={!tagKey.trim() || !tagValue.trim()}
              >
                Agregar
              </button>
            </div>
          </div>
        </div>

        {/* Panel derecho — Información general */}
        <aside className={styles.panelRight} ref={panelRightRef}>
          <h2 className={styles.panelTitle}>Información general</h2>

          <div className={styles.field}>
            <label htmlFor="projectId" className={styles.fieldLabel}>
              Proyecto {!form.projectId && <span className={styles.required}>(obligatorio)</span>}
            </label>
            <Select
              inputId="projectId"
              aria-label="Proyecto"
              styles={selectStyles}
              options={projectOptions}
              value={projectOptions.find((o) => o.value === form.projectId) ?? projectOptions[0]}
              onChange={(opt) => handleProjectChange(opt?.value ?? '')}
              placeholder="Seleccionar proyecto..."
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="state" className={styles.fieldLabel}>
              Estado
            </label>
            <Select
              inputId="state"
              aria-label="Estado"
              styles={selectStylesDisabled}
              isDisabled
              options={STATE_OPTIONS}
              value={STATE_OPTIONS.find((o) => o.value === form.state) ?? STATE_OPTIONS[0]}
              onChange={() => {}}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="type" className={styles.fieldLabel}>
              Tipo
            </label>
            <Select
              inputId="type"
              aria-label="Tipo"
              styles={selectStyles}
              options={TYPE_OPTIONS}
              value={TYPE_OPTIONS.find((o) => o.value === form.type) ?? TYPE_OPTIONS[0]}
              onChange={(opt) => setForm((f) => ({ ...f, type: opt?.value ?? '' }))}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="priority" className={styles.fieldLabel}>
              Prioridad
            </label>
            <Select
              inputId="priority"
              aria-label="Prioridad"
              styles={selectStyles}
              options={PRIORITY_OPTIONS}
              value={PRIORITY_OPTIONS.find((o) => o.value === form.priority) ?? PRIORITY_OPTIONS[0]}
              onChange={(opt) =>
                setForm((f) => ({ ...f, priority: opt?.value ?? 'sin_prioridad' }))
              }
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="visibilityLevel" className={styles.fieldLabel}>
              Visibilidad
            </label>
            <Select
              inputId="visibilityLevel"
              aria-label="Visibilidad"
              styles={selectStyles}
              options={VISIBILITY_OPTIONS}
              value={
                VISIBILITY_OPTIONS.find((o) => o.value === form.visibilityLevel) ??
                VISIBILITY_OPTIONS[0]
              }
              onChange={(opt) =>
                setForm((f) => ({ ...f, visibilityLevel: opt?.value ?? 'public' }))
              }
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="responsiblePersonIds" className={styles.fieldLabel}>
              Responsable(s)
            </label>
            <Select
              inputId="responsiblePersonIds"
              aria-label="Responsable(s)"
              isMulti
              isClearable={false}
              placeholder="Seleccionar responsable(s)..."
              styles={responsibleSelectStyles}
              options={responsibleOptions}
              value={form.responsiblePersonIds
                .map((id) => responsibleOptions.find((o) => o.value === id))
                .filter((o): o is { label: string; value: string } => !!o)}
              onChange={(opts) =>
                setForm((f) => ({
                  ...f,
                  responsiblePersonIds: (opts ?? []).map((opt) => opt.value),
                }))
              }
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="createdAt" className={styles.fieldLabel}>
              Fecha de creación
            </label>
            <input
              id="createdAt"
              type="date"
              className={styles.fieldInput}
              aria-label="Fecha de creación"
              value={todayISO}
              disabled
              readOnly
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="estimatedFinishDate" className={styles.fieldLabel}>
              Fecha de finalización estimada
            </label>
            <input
              id="estimatedFinishDate"
              type="date"
              className={styles.fieldInput}
              aria-label="Fecha de finalización estimada"
              value={form.estimatedFinishDate}
              onChange={(e) => setForm((f) => ({ ...f, estimatedFinishDate: e.target.value }))}
            />
          </div>
        </aside>
      </div>
    </form>
  );
}
