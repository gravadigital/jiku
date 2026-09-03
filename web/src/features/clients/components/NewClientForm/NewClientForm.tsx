'use client';

import React, { useState, useMemo } from 'react';
import * as yup from 'yup';
import { InputText, Button, SectionCard } from '@/shared/components/ui';
import { InputTextarea } from '@/shared/components/ui/InputTextarea/InputTextarea';
import styles from './NewClientForm.module.scss';

interface NewClientFormProps {
  readonly onSubmit: (payload: { name: string; description: string }) => void;
  readonly loading?: boolean;
}

const schema = yup.object().shape({
  name: yup.string().required('El nombre es obligatorio'),
  description: yup.string().optional(),
});

export function NewClientForm({ onSubmit, loading = false }: NewClientFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  const initialSnapshot = useMemo(() => JSON.stringify({ name: '', description: '' }), []);
  const currentSnapshot = JSON.stringify({ name, description });
  const hasChanges = currentSnapshot !== initialSnapshot;

  const processSubmit = () => {
    setGeneralError(null);
    setErrors({});

    if (!hasChanges) {
      setGeneralError('No hay cambios para guardar');
      return;
    }

    try {
      schema.validateSync({ name, description }, { abortEarly: false });
    } catch (err) {
      if (err instanceof yup.ValidationError) {
        const fieldErrors: Record<string, string> = {};
        err.inner.forEach((e) => {
          if (e.path) fieldErrors[e.path] = e.message;
        });
        setErrors(fieldErrors);
      }
      return;
    }

    onSubmit({
      name: name.trim(),
      description: description.trim(),
    });
  };

  return (
    <SectionCard>
      <div className={styles.formContainer}>
        <div className={styles.leftColumn}>
          <div className={styles.fieldCol}>
            <InputText
              label="Nombre"
              code="name"
              value={name}
              onChange={(value) => setName(value)}
              placeholder="Nombre del actor"
              required
            />
            {errors.name && <p className={styles.error}>{errors.name}</p>}
          </div>

          <div className={styles.descriptionField}>
            <InputTextarea
              label="Descripción"
              code="description"
              value={description}
              onChange={(value: string) => setDescription(value)}
              placeholder="Descripción del actor (soporta **markdown**)"
              error={false}
            />
            {errors.description && <p className={styles.error}>{errors.description}</p>}
          </div>
        </div>

        <div className={styles.buttonRow}>
          {generalError && <p className={styles.errorText}>{generalError}</p>}
          <Button loading={loading} onClick={processSubmit}>
            Guardar
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}
