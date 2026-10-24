import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { DocsBrowser } from '@/features/docs/components/DocsBrowser';
import { getModules } from '@/features/docs/services/modulesApi';

// El corte real de acceso: con el módulo `not_installed` (o sin entrada) la ruta no existe.
// `available` y `unavailable` renderizan; el aviso de módulo caído lo muestra la pantalla.
export default async function DocsPage() {
  const modules = await getModules();
  const docs = modules.find((m) => m.module === 'docs');
  if (!docs || docs.status === 'not_installed') {
    notFound();
  }

  return (
    <Suspense fallback={null}>
      <DocsBrowser />
    </Suspense>
  );
}
