'use client';
import React, { useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Select } from '../Select';
import { getPageWindow } from './getPageWindow';
import styles from './Pagination.module.scss';

interface PaginationBaseProps {
  readonly totalItems: number;
  readonly limit: number;
  /** Default [5, 10, 25]. El selector sólo se dibuja si además se pasa `onPageSizeChange`. */
  readonly pageSizeOptions?: readonly number[];
  readonly onPageSizeChange?: (pageSize: number) => void;
}

type PaginationUrlProps = PaginationBaseProps & {
  /** Ruta base a la que navegar; el resto de los searchParams se preservan. */
  readonly basePath: string;
  readonly currentPage?: never;
  readonly onPageChange?: never;
};

type PaginationControlledProps = PaginationBaseProps & {
  readonly currentPage: number;
  readonly onPageChange: (page: number) => void;
  readonly basePath?: never;
};

type PaginationProps = PaginationUrlProps | PaginationControlledProps;

const DEFAULT_PAGE_SIZE_OPTIONS = [5, 10, 25];

function isControlled(
  props: PaginationProps,
): props is PaginationControlledProps {
  return props.onPageChange !== undefined;
}

export function Pagination(props: PaginationProps) {
  const { totalItems, limit, pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS, onPageSizeChange } = props;
  const controlled = isControlled(props);
  const basePath = controlled ? undefined : props.basePath;
  const onPageChange = controlled ? props.onPageChange : undefined;

  const router = useRouter();
  const searchParams = useSearchParams();

  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams?.toString());
      params.set(name, value);
      return params.toString();
    },
    [searchParams],
  );

  const derivedPage = (() => {
    const pageParam = searchParams?.get('page');
    const parsed = Number(pageParam);
    return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 1;
  })();

  const currentPage = controlled ? props.currentPage : derivedPage;
  // totalPages nunca baja de 1: con 0 ítems, o con una sola página, la paginación se
  // dibuja igual, deshabilitada — no se oculta (spec Pagination v1.0.0).
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));

  const handlePageChange = useCallback(
    (newPage: number) => {
      if (onPageChange) {
        onPageChange(newPage);
        return;
      }
      router.push(`${basePath}?${createQueryString('page', String(newPage))}`);
    },
    [onPageChange, router, basePath, createQueryString],
  );

  const pageNumbers = getPageWindow({ currentPage, totalPages });

  const pageSizeSelectOptions = pageSizeOptions.map((size) => ({
    value: String(size),
    label: `${size} por página`,
  }));

  return (
    <nav className={styles.pagination} aria-label="Paginación" role="navigation">
      <div className={styles.controls}>
        <button
          type="button"
          className={styles.arrowButton}
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          aria-label="Página anterior"
        >
          {'‹'}
        </button>
        {pageNumbers.map((pageNumber) => {
          const isCurrentPage = currentPage === pageNumber;
          return (
            <button
              type="button"
              key={pageNumber}
              className={styles.pageButton}
              onClick={() => handlePageChange(pageNumber)}
              disabled={isCurrentPage}
              data-active={isCurrentPage || undefined}
              aria-label={`Página ${pageNumber}`}
              aria-current={isCurrentPage ? 'page' : undefined}
            >
              {pageNumber}
            </button>
          );
        })}
        <button
          type="button"
          className={styles.arrowButton}
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          aria-label="Página siguiente"
        >
          {'›'}
        </button>
      </div>
      {onPageSizeChange && (
        <div className={styles.pageSize}>
          <Select
            variant="inline"
            label="Cantidad por página"
            value={String(limit)}
            onChange={(value) => onPageSizeChange(Number(value))}
            options={pageSizeSelectOptions}
          />
        </div>
      )}
      <span className={styles.liveRegion} aria-live="polite" role="status">
        {`Página ${currentPage} de ${totalPages}`}
      </span>
    </nav>
  );
}
