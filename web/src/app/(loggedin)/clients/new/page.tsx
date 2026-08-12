'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import { NewClientForm, useCreateClient } from '@/features/clients';
import { PageLayout } from '@/shared/components/layout';
import styles from './styles.module.scss';

export default function NewClient() {
  const { push } = useRouter();
  const createClientMutation = useCreateClient();

  const handleSubmit = (payload: { name: string; description: string }) => {
    createClientMutation.mutate(payload, {
      onError: (error: unknown) => {
        console.error('Client creation failed:', error);
        const err = error as { message?: string; code?: string; status?: number };
        const message =
          err?.message || (error instanceof Error ? error.message : JSON.stringify(error));
        toast.error(message || 'Hubo un error al crear el actor');
      },
      onSuccess: () => {
        push('/clients');
        toast.success('Actor creado con éxito');
      },
    });
  };

  return (
    <PageLayout title="Crear actor">
      <div className={styles.wrapper}>
        <NewClientForm onSubmit={handleSubmit} loading={createClientMutation.isPending} />
      </div>
    </PageLayout>
  );
}
