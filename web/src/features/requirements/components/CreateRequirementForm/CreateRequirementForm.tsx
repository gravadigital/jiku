'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'react-toastify';
import * as Yup from 'yup';
import { extractFileIds } from '@/features/attachments/utils/extractFileIds';
import { fileErrorMessage } from '@/features/attachments/utils/fileErrorMessages';
import { usePersons } from '@/features/auth';
import { useProjects } from '@/features/projects/hooks/useProjects';
import { Badge, Button, Card, Input, Select } from '@/shared/components/ui';
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
  const [isUploading, setIsUploading] = useState(false);
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

  const projectOptions = [...projects]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => ({ label: p.name, value: String(p.id) }));

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

  // `Button` renderiza `type="button"` fijo y no acepta prop `type`: no puede ser el submit
  // nativo de un `<form>`. La mecánica de submit se preserva disparando el mismo handler por
  // `onClick` que hoy corre en `onSubmit` — no se cambia el componente compartido.
  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
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
      fileIds: extractFileIds(form.description),
    };

    createRequirement(payload, {
      onSuccess: () => {
        toast.success('Requisito creado correctamente');
        router.push('/requirements');
      },
      onError: (error: unknown) => {
        // Los fileIds se conservan en `form.description`: el fallo no borra ni
        // desvincula nada, así que el usuario puede reintentar tal cual.
        toast.error(fileErrorMessage(error, 'Hubo un error al crear el requisito'));
      },
    });
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Nuevo Requisito</h1>
        </div>
        <div className={styles.headerActions}>
          <Button variant="secondary-nav" href="/requirements">
            Volver
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={isPending || isUploading}
            loading={isPending}
            ariaDescribedBy={isUploading ? 'create-upload-in-progress' : undefined}
          >
            {isPending ? 'Creando...' : 'Crear Requisito'}
          </Button>
          {isUploading && (
            <span id="create-upload-in-progress" className={styles.srOnly}>
              Hay una subida en curso: esperá a que el archivo termine de subir para guardar
            </span>
          )}
        </div>
      </header>

      <div className={styles.panels}>
        {/* Panel izquierdo */}
        <div className={styles.panelLeft} ref={panelLeftRef}>
          <Card variant="panel" title="Detalle" headingLevel="h2">
            <div className={styles.field}>
              <Input
                variant="text"
                label="Título"
                value={form.title}
                onChange={(value) => setForm((f) => ({ ...f, title: value }))}
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
                onUploadingChange={setIsUploading}
              />
            </div>
          </Card>

          {/* Etiquetas */}
          <Card variant="panel" title="Etiquetas" headingLevel="h2">
            {tagSuggestions.length > 0 && (
              <div className={styles.suggestions}>
                {tagSuggestions.flatMap((s) =>
                  s.values.map((v) => (
                    <Button
                      key={`${s.key}:${v}`}
                      variant="secondary-dismiss"
                      onClick={() => handleSuggestionClick(s.key, v)}
                    >
                      {s.key}: {v}
                    </Button>
                  ))
                )}
              </div>
            )}

            <div className={styles.tagList}>
              {tags.map((tag, i) => (
                <span key={i} className={styles.chip}>
                  <Badge variant="card-tag" label={`${tag.key}: ${tag.value}`} />
                  <Button variant="secondary-dismiss" onClick={() => handleRemoveTag(i)}>
                    <span aria-hidden="true">×</span>
                    <span className={styles.srOnly}>
                      Eliminar tag {tag.key}:{tag.value}
                    </span>
                  </Button>
                </span>
              ))}
            </div>

            <div className={styles.tagInputRow}>
              <Input
                variant="text"
                label="Clave"
                value={tagKey}
                onChange={setTagKey}
              />
              <Input
                variant="text"
                label="Valor"
                value={tagValue}
                onChange={setTagValue}
              />
              <Button
                variant="secondary-dismiss"
                onClick={handleAddTag}
                disabled={!tagKey.trim() || !tagValue.trim()}
              >
                Agregar
              </Button>
            </div>
          </Card>
        </div>

        {/* Panel derecho — Información general */}
        <aside className={styles.panelRight} ref={panelRightRef}>
          <Card variant="panel" title="Información general" headingLevel="h2">
            <div className={styles.field}>
              <Select
                variant="single"
                label="Proyecto"
                required
                placeholder="Seleccionar proyecto..."
                options={projectOptions}
                value={form.projectId}
                onChange={handleProjectChange}
              />
            </div>

            <div className={styles.field}>
              <Select
                variant="locked"
                label="Estado"
                options={STATE_OPTIONS}
                value={form.state}
                onChange={() => {}}
              />
            </div>

            <div className={styles.field}>
              <Select
                variant="single"
                label="Tipo"
                placeholder="Sin tipo"
                options={TYPE_OPTIONS}
                value={form.type}
                onChange={(value) => setForm((f) => ({ ...f, type: value }))}
              />
            </div>

            <div className={styles.field}>
              <Select
                variant="single"
                label="Prioridad"
                options={PRIORITY_OPTIONS}
                value={form.priority}
                onChange={(value) => setForm((f) => ({ ...f, priority: value }))}
              />
            </div>

            <div className={styles.field}>
              <Select
                variant="single"
                label="Visibilidad"
                options={VISIBILITY_OPTIONS}
                value={form.visibilityLevel}
                onChange={(value) => setForm((f) => ({ ...f, visibilityLevel: value }))}
              />
            </div>

            <div className={styles.field}>
              <Select
                variant="multiple"
                label="Responsable(s)"
                placeholder="Seleccionar responsable(s)..."
                options={responsibleOptions}
                value={form.responsiblePersonIds}
                onChange={(values) =>
                  setForm((f) => ({
                    ...f,
                    responsiblePersonIds: values,
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
          </Card>
        </aside>
      </div>
    </form>
  );
}
