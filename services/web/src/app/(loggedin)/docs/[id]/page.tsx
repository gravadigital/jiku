import { notFound } from 'next/navigation';
import { DocumentView } from '@/features/docs/components/DocumentView';
import { getModules } from '@/features/docs/services/modulesApi';
import { ULID_PATTERN } from '@/features/docs/utils/docsUrlTransform';

// El corte real de acceso: con el módulo `not_installed` la ruta no existe. Un id que no es
// ULID (p. ej. `/docs/attachments` sin id, R-6) responde 404 antes de llamar a nada.
export default async function DocumentPage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!ULID_PATTERN.test(id)) {
    notFound();
  }

  const modules = await getModules();
  const docs = modules.find((m) => m.module === 'docs');
  if (!docs || docs.status === 'not_installed') {
    notFound();
  }

  return <DocumentView id={id} />;
}
