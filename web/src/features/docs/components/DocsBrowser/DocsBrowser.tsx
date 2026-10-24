'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePersons } from '@/features/auth/hooks/usePersons';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Loader,
  Table,
  ViewHeader,
} from '@/shared/components/ui';
import { useDocsSearch, MIN_SEARCH_LENGTH } from '../../hooks/useDocsSearch';
import { useFolderContents } from '../../hooks/useFolderContents';
import { useFolderTrail } from '../../hooks/useFolderTrail';
import { useModule } from '../../hooks/useModules';
import { useRootFolders } from '../../hooks/useRootFolders';
import { formatDateTime } from '../../utils/dates';
import { codeOf, DOCS_UNAVAILABLE_MESSAGE } from '../../utils/docsErrors';
import { ULID_PATTERN } from '../../utils/docsUrlTransform';
import { isLockActive } from '../../utils/lockState';
import { displayTitle, folderPathOf } from '../../utils/paths';
import { personName } from '../../utils/persons';
import { DocsNotice } from '../DocsNotice';
import { FolderBreadcrumb } from '../FolderBreadcrumb';
import { NewDocumentDialog } from '../NewDocumentDialog';
import { SearchSnippet } from '../SearchSnippet';
import styles from './DocsBrowser.module.scss';
import type { DocsDocument, DocsFolder } from '../../types/docs.types';
import type { TableColumn, TableRow } from '@/shared/components/ui/Table';

const SEARCH_DEBOUNCE_MS = 300;
const MAX_QUERY_LENGTH = 1000;

const FOLDER_COLUMNS: readonly TableColumn[] = [
  { key: 'name', label: 'Nombre' },
  { key: 'updatedAt', label: 'Actualizado' },
  { key: 'by', label: 'Por' },
];
const RESULT_COLUMNS: readonly TableColumn[] = [
  { key: 'title', label: 'Documento' },
  { key: 'folder', label: 'Carpeta' },
  { key: 'updatedAt', label: 'Actualizado' },
];

const NOT_FOUND_MESSAGE = 'Esta carpeta no existe o no tenés permiso para verla.';
const LIST_ERROR_MESSAGE = 'No se pudo cargar la carpeta. Actualizá la página.';
const FORBIDDEN_MESSAGE = 'No tenés permiso para ver esta carpeta.';
const SEARCH_ERROR_MESSAGE = 'No se pudo buscar. Intentá de nuevo.';

const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

const urlFor = (folder: string | null, q: string): string => {
  const params = new URLSearchParams();
  if (folder) params.set('folder', folder);
  if (q) params.set('q', q);
  const query = params.toString();
  return query ? `/docs?${query}` : '/docs';
};

// Íconos de fila: decorativos, el significado lo lleva el nombre.
const RowIcon = ({ kind }: { kind: 'folder' | 'file' }) => (
  <span className={styles.rowIcon} aria-hidden="true">
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" focusable="false">
      <path
        d={
          kind === 'folder'
            ? 'M1.5 4.5a1 1 0 0 1 1-1H6l1.5 1.5h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-7.5Z'
            : 'M4 1.5h5l3.5 3.5v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-11.5a1 1 0 0 1 1-1Zm5 0V5h3.5'
        }
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  </span>
);

export function DocsBrowser() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const folderParam = searchParams.get('folder');
  const qParam = (searchParams.get('q') ?? '').slice(0, MAX_QUERY_LENGTH);

  const { status } = useModule('docs');
  const available = status === 'available';
  const unavailable = status === 'unavailable';

  const folderInvalid = folderParam !== null && !ULID_PATTERN.test(folderParam);
  const folderId = folderParam && !folderInvalid ? folderParam : undefined;
  const qTrim = qParam.trim();
  const searching = qTrim.length >= MIN_SEARCH_LENGTH;

  // El campo es estado local; la URL (`?q=`) se actualiza con debounce y la sobrevive.
  const [text, setText] = useState(qParam);
  useEffect(() => {
    const normalized = text.trim().slice(0, MAX_QUERY_LENGTH);
    if (normalized === qParam.trim()) return undefined;
    const timer = setTimeout(() => {
      router.replace(urlFor(folderParam, normalized));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text, qParam, folderParam, router]);

  const trailQuery = useFolderTrail({ folderId, enabled: available });
  const rootQuery = useRootFolders({ enabled: available && !folderId && !searching });
  const root = rootQuery.data?.root ?? null;
  const contentsFolderId = folderId ?? root?.id;
  const contents = useFolderContents({
    folderId: contentsFolderId,
    enabled: available && !searching && !(folderId && trailQuery.isError),
  });
  const search = useDocsSearch({ q: qParam, enabled: available });

  const folderDocs: DocsDocument[] = contents.data?.pages.flatMap((page) => page.documents) ?? [];
  const folderRows: DocsFolder[] =
    folderId || root
      ? (contents.data?.pages.flatMap((page) => page.folders) ?? [])
      : (rootQuery.data?.tops ?? []);

  const { data: persons } = usePersons({
    enabled: available && (folderDocs.length > 0 || (search.data?.items.length ?? 0) > 0),
  });

  const trailError = folderId ? trailQuery.error : null;
  const folderGone =
    folderInvalid ||
    (Boolean(trailError) &&
      ['folder_not_found', 'permission_denied'].includes(codeOf(trailError) ?? ''));

  const permission = folderId ? trailQuery.data?.folder.effectivePermission : null;
  const canCreate = Boolean(folderId) && (permission === 'write' || permission === 'manage');
  const showCreate = canCreate && !searching && !folderGone;
  const [dialogOpen, setDialogOpen] = useState(false);

  const trail = folderId && !folderGone ? (trailQuery.data?.trail ?? []) : [];
  const now = new Date();

  const renderFolderTable = () => {
    const rows: TableRow[] = [
      ...folderRows.map((folder) => ({
        name: (
          <span className={styles.titleCell}>
            <RowIcon kind="folder" />
            <Link href={`/docs?folder=${folder.id}`} className={styles.titleLink}>
              {folder.name}
            </Link>
          </span>
        ),
        updatedAt: '',
        by: '',
      })),
      ...folderDocs.map((doc) => {
        const locked = isLockActive(doc.lock, now, null);
        return {
          name: (
            <span className={styles.titleCell}>
              <RowIcon kind="file" />
              <Link href={`/docs/${doc.id}`} className={styles.titleLink}>
                {displayTitle(doc)}
              </Link>
              {locked && doc.lock && (
                <>
                  <span aria-hidden="true">
                    <Badge variant="outline" family="neutral" label="En edición" />
                  </span>
                  <span className={styles.srOnly}>
                    {personName(persons, doc.lock.holder)} lo está editando
                  </span>
                </>
              )}
            </span>
          ),
          updatedAt: formatDateTime(doc.updatedAt),
          by: capitalize(personName(persons, doc.updatedBy)),
        };
      }),
    ];

    return (
      <div className={styles.content}>
        <Table
          variant="light"
          columns={FOLDER_COLUMNS}
          rows={rows}
          ariaLabel="Contenido de la carpeta"
        />
        {contents.hasNextPage && (
          <Button
            variant="secondary-dismiss"
            loading={contents.isFetchingNextPage}
            onClick={() => contents.fetchNextPage()}
          >
            Ver más
          </Button>
        )}
      </div>
    );
  };

  const renderSearch = () => {
    if (search.isError) {
      return <DocsNotice intent="error">{SEARCH_ERROR_MESSAGE}</DocsNotice>;
    }
    if (search.isLoading || !search.data) {
      return <Loader variant="block" label="Cargando documentación…" />;
    }
    const items = search.data.items;
    const live = (
      <p className={styles.srOnly} aria-live="polite">
        {items.length === 0 ? 'Sin resultados' : `${items.length} resultados`}
      </p>
    );
    if (items.length === 0) {
      return (
        <>
          {live}
          <EmptyState
            variant="filtered"
            message={`No hay documentos que coincidan con «${qTrim}». Probá con otras palabras.`}
          />
        </>
      );
    }
    const rows: TableRow[] = items.map((hit) => ({
      title: (
        <span className={styles.resultCell}>
          <Link href={`/docs/${hit.documentId}`} className={styles.titleLink}>
            {hit.title}
          </Link>
          <SearchSnippet snippet={hit.snippet} q={qTrim} />
        </span>
      ),
      folder: folderPathOf(hit.path),
      updatedAt: formatDateTime(hit.updatedAt),
    }));
    return (
      <>
        {live}
        <Table
          variant="light"
          columns={RESULT_COLUMNS}
          rows={rows}
          ariaLabel="Resultados de la búsqueda"
        />
      </>
    );
  };

  const renderBody = () => {
    if (unavailable || !available) return null;
    if (searching) return renderSearch();
    if (folderGone) return <DocsNotice intent="error">{NOT_FOUND_MESSAGE}</DocsNotice>;

    const listError = contents.isError
      ? contents.error
      : !folderId && rootQuery.isError
        ? rootQuery.error
        : null;
    if (listError) {
      return (
        <DocsNotice intent="error">
          {codeOf(listError) === 'permission_denied' ? FORBIDDEN_MESSAGE : LIST_ERROR_MESSAGE}
        </DocsNotice>
      );
    }

    const loading =
      contents.isLoading ||
      (!folderId && rootQuery.isLoading) ||
      Boolean(folderId && trailQuery.isLoading && !trailQuery.data);
    if (loading) return <Loader variant="block" label="Cargando documentación…" />;

    if (folderRows.length === 0 && folderDocs.length === 0) {
      return (
        <EmptyState
          variant="list"
          message={
            canCreate
              ? 'Esta carpeta está vacía. Creá el primer documento con «Nuevo documento».'
              : 'Esta carpeta está vacía.'
          }
        />
      );
    }
    return renderFolderTable();
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.heading}>
          <ViewHeader variant="list" title="Documentación" />
          {!searching && <FolderBreadcrumb trail={trail} />}
        </div>
        <div className={styles.actions}>
          {showCreate && (
            <Button
              variant="primary"
              icon="+"
              disabled={unavailable}
              onClick={() => setDialogOpen(true)}
            >
              Nuevo documento
            </Button>
          )}
        </div>
      </div>

      <Input
        variant="search"
        label="Buscar en la documentación"
        hideLabel
        placeholder="Buscar en la documentación"
        value={text}
        disabled={unavailable}
        onChange={setText}
      />

      {unavailable && <DocsNotice intent="warning">{DOCS_UNAVAILABLE_MESSAGE}</DocsNotice>}

      <Card variant="panel">{renderBody()}</Card>

      {showCreate && trailQuery.data && (
        <NewDocumentDialog
          open={dialogOpen}
          folder={{ id: trailQuery.data.folder.id, path: trailQuery.data.folder.path }}
          onClose={() => setDialogOpen(false)}
        />
      )}
    </div>
  );
}
