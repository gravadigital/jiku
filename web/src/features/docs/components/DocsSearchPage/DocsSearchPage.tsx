'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, ToggleGroup, ViewHeader } from '@/shared/components/ui';
import { useDocsHome } from '../../hooks/useDocsHome';
import { useDocsList } from '../../hooks/useDocsList';
import { useDocsTextSearch } from '../../hooks/useDocsTextSearch';
import { useModule } from '../../hooks/useModules';
import { DOCS_UNAVAILABLE_MESSAGE } from '../../utils/docsErrors';
import {
  addToken,
  clearTokens,
  parseDocsSearch,
  removeTokenAt,
  serializeDocsSearch,
  setOrden,
  setPagina,
  setPublico,
  toListFilters,
  toSearchQuery,
  tokenKey,
  viewOf,
  type DocsOrder,
  type DocsSearchState,
  type DocsToken,
} from '../../utils/docsSearchParams';
import { AssignProjectAction, SuggestedProjectLine } from '../AssignProjectAction';
import { DocsNotice } from '../DocsNotice';
import { DocsResults } from '../DocsResults';
import { DocsSearchBar, useTokenLabel } from '../DocsSearchBar';
import { toRowModel, type RowLayout } from '../DocumentRow';
import { NewDocumentDialog } from '../NewDocumentDialog';
import styles from './DocsSearchPage.module.scss';

const SIN_PROYECTO_SUBTITLE =
  'Documentos que todavía no están vinculados a un proyecto. Asignarlos hace que aparezcan en los filtros y en el detalle de cada proyecto.';
const BACK_LABELS = {
  proyecto: 'Volver al proyecto',
  requisito: 'Volver al requisito',
  tarea: 'Volver a la tarea',
} as const;

const VISIBILITY_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'public', label: 'Visibles para el cliente' },
] as const;

const ORDER_LABELS: Record<DocsOrder, string> = {
  recientes: 'Más recientes',
  az: 'A–Z',
  relevancia: 'Relevancia',
};

const TEXT_PAGE = 20;
// Un token cualquiera sin consultas: `useTokenLabel` necesita un token aun sin origen.
const NO_ORIGIN_TOKEN: DocsToken = { kind: 'sinProyecto' };

export function DocsSearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const state = useMemo(
    () => parseDocsSearch(new URLSearchParams(searchParams.toString())),
    [searchParams]
  );
  const view = viewOf(state);

  const { status } = useModule('docs');
  const available = status === 'available';
  const unavailable = status === 'unavailable';

  const [knownLabels, setKnownLabels] = useState<Record<string, string>>({});
  const [dialogOpen, setDialogOpen] = useState(false);

  const write = (next: DocsSearchState) => {
    const qs = serializeDocsSearch(next);
    router.replace(`/docs${qs ? `?${qs}` : ''}`, { scroll: false });
  };

  const sort = state.orden === 'az' ? 'title' : '-updatedAt';
  const home = useDocsHome({ sort, enabled: available && view.mode === 'inicio' });
  const list = useDocsList({
    filters: toListFilters(state),
    pagina: state.pagina,
    enabled: available && view.mode === 'listado',
  });
  const text = useDocsTextSearch({
    query: toSearchQuery(state),
    enabled: available && view.mode === 'texto',
  });

  // La URL pide una página que no existe (recarga o link viejo): se corrige a la última.
  const lastListPage = view.mode === 'listado' ? list.lastAvailablePage : null;
  const textCount = view.mode === 'texto' ? text.data?.items.length : undefined;
  const lastTextPage =
    textCount === undefined ? null : Math.max(1, Math.ceil(textCount / TEXT_PAGE));
  const lastPage = lastListPage ?? lastTextPage;
  useEffect(() => {
    if (lastPage !== null && lastPage < state.pagina) {
      const qs = serializeDocsSearch(setPagina(state, lastPage));
      router.replace(`/docs${qs ? `?${qs}` : ''}`, { scroll: false });
    }
  }, [lastPage, state, router]);

  const originToken = view.origin
    ? (state.tokens.find((t) => t.kind === view.origin?.kind) ?? NO_ORIGIN_TOKEN)
    : NO_ORIGIN_TOKEN;
  const originName = useTokenLabel(originToken, knownLabels);

  let title = 'Documentación';
  if (view.origin) title = `Documentos · ${originName}`;
  else if (view.sinProyecto) title = 'Sin proyecto';

  const firstClient = state.tokens.find((t) => t.kind === 'cliente');
  const clientIdForSuggestions = firstClient && 'id' in firstClient ? firstClient.id : undefined;

  const orderOptions: DocsOrder[] =
    view.mode === 'texto' ? ['relevancia', 'recientes'] : ['recientes', 'az'];

  let layout: RowLayout = 'default';
  if (view.sinProyecto) layout = 'sinProyecto';
  else if (view.origin?.kind === 'proyecto' && view.mode !== 'texto') layout = 'temas';

  if (status === 'not_installed') return null;

  const results = (() => {
    if (view.mode === 'inicio') {
      return {
        mine: home.mine.map(toRowModel),
        recent: home.recent?.map(toRowModel),
        isLoading: home.isLoading,
        error: home.isError ? home.error : null,
      };
    }
    if (view.mode === 'listado') {
      return {
        items: list.pageItems?.map(toRowModel),
        total: list.total,
        isLoading: list.isLoading,
        error: list.isError ? list.error : null,
      };
    }
    return {
      items: text.data?.items.map(toRowModel),
      isLoading: text.isLoading,
      error: text.isError ? text.error : null,
    };
  })();

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.heading}>
          <ViewHeader variant="list" title={title} />
          {view.sinProyecto && <p className={styles.subtitle}>{SIN_PROYECTO_SUBTITLE}</p>}
        </div>
        <div className={styles.actions}>
          {view.origin && (
            <Button variant="secondary-nav" icon="←" href={view.origin.href}>
              {BACK_LABELS[view.origin.kind]}
            </Button>
          )}
          <Button
            variant="primary"
            icon="+"
            disabled={unavailable}
            onClick={() => setDialogOpen(true)}
          >
            Nuevo documento
          </Button>
        </div>
      </div>

      <DocsSearchBar
        tokens={state.tokens}
        knownLabels={knownLabels}
        clientIdForSuggestions={clientIdForSuggestions}
        disabled={unavailable}
        onAdd={(token, label) => {
          setKnownLabels((prev) => ({ ...prev, [tokenKey(token)]: label }));
          write(addToken(state, token));
        }}
        onRemove={(index) => write(removeTokenAt(state, index))}
        onClear={() => write(clearTokens(state))}
      />

      <div className={styles.options}>
        <p className={styles.help}>
          {unavailable ? null : view.sinProyecto ? (
            <>
              Escribí «sin» para encontrar Sin proyecto, Sin cliente o Sin tema · <kbd>⌫</kbd> quita
              el último filtro
            </>
          ) : (
            <>
              Elegí una sugerencia para sumarla como filtro · <kbd>Enter</kbd> agrega el texto
              escrito · <kbd>⌫</kbd> quita el último filtro
            </>
          )}
        </p>
        <div className={styles.toggles}>
          <ToggleGroup
            variant="segmented"
            label="Visibilidad"
            options={VISIBILITY_OPTIONS.map((o) => ({ ...o, disabled: unavailable }))}
            value={state.publico ? 'public' : 'all'}
            onChange={(value) => write(setPublico(state, value === 'public'))}
          />
          {!unavailable && (
            <ToggleGroup
              variant="segmented"
              label="Ordenar por"
              options={orderOptions.map((value) => ({ value, label: ORDER_LABELS[value] }))}
              value={state.orden}
              onChange={(value) => write(setOrden(state, value as DocsOrder))}
            />
          )}
        </div>
      </div>

      {unavailable ? (
        <DocsNotice intent="warning">{DOCS_UNAVAILABLE_MESSAGE}</DocsNotice>
      ) : (
        <DocsResults
          mode={view.mode}
          layout={layout}
          orden={state.orden}
          pagina={state.pagina}
          onPageChange={(page) => write(setPagina(state, page))}
          q={toSearchQuery(state).q}
          renderTitleExtra={
            layout === 'sinProyecto' ? (row) => <SuggestedProjectLine id={row.id} /> : undefined
          }
          renderAction={
            layout === 'sinProyecto'
              ? (row) => (
                  <AssignProjectAction
                    item={{ id: row.id, version: row.version, title: row.title }}
                  />
                )
              : undefined
          }
          {...results}
        />
      )}

      <NewDocumentDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}
