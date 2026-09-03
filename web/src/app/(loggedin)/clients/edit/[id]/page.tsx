'use client';

import React, { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import { useClient, useUpdateClient } from '@/features/clients';
import { ClientForm } from '@/features/clients/components/ClientForm/ClientForm';
import { Loader, ViewHeader } from '@/shared/components/ui';
import styles from './styles.module.scss';

export default function EditClient({ params }: { readonly params: Promise<{ id: number }> }) {
  const { id } = use(params);
  const { push } = useRouter();
  const { data: client, isLoading: isLoadingClient } = useClient({ id });
  const updateClientMutation = useUpdateClient();
  const [initialValues, setInitialValues] = useState<
    { name: string; description: string } | undefined
  >(undefined);

  useEffect(() => {
    if (client) {
      setInitialValues({
        name: client.name,
        description: client.description || '',
      });
    }
  }, [client]);

  const handleSubmit = (payload: any) => {
    updateClientMutation.mutate(
      { id, payload },
      {
        onError: (error: unknown) => {
          const err = error as { message?: string; code?: string; status?: number };
          const message = err?.message || 'Hubo un error al editar el actor';
          toast.error(message);
        },
        onSuccess: () => {
          push('/clients');
          toast.success('Actor actualizado con éxito');
        },
      }
    );
  };

  if (isLoadingClient || !initialValues) {
    return <Loader label="Cargando..." />;
  }

  return (
    <>
      <ViewHeader variant="list" title="Editar actor" />
      <div className={styles.wrapper}>
        <ClientForm
          initialValues={initialValues}
          onSubmit={handleSubmit}
          submitLabel="Guardar cambios"
          loading={updateClientMutation.isPending}
          clientId={id}
        />
      </div>
    </>
  );
}
