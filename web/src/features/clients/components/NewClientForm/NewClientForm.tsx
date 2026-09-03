'use client';

import React, { useState, useMemo } from 'react';
import * as yup from 'yup';
import { Button, Card, Input } from '@/shared/components/ui';
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
    <Card variant="panel">
      <div className={styles.formContainer}>
        <div className={styles.leftColumn}>
          <Input
            label="Nombre"
            value={name}
            onChange={setName}
            placeholder="Nombre del actor"
            required
            error={errors.name}
          />

          <div className={styles.descriptionField}>
            <Input
              variant="textarea"
              label="Descripción"
              value={description}
              onChange={setDescription}
              placeholder="Descripción del actor (soporta **markdown**)"
              error={errors.description}
            />
          </div>
        </div>

        <div className={styles.buttonRow}>
          {generalError && <p className={styles.errorText}>{generalError}</p>}
          <Button loading={loading} onClick={processSubmit}>
            Guardar
          </Button>
        </div>
      </div>
    </Card>
  );
}
