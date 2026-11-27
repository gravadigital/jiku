'use client';

import { useParams } from 'next/navigation';
import { DocumentView } from '@/features/docs';

export default function DocumentPage() {
  const params = useParams<{ projectId: string; documentId: string }>();
  return <DocumentView projectId={Number(params.projectId)} documentId={params.documentId} />;
}
