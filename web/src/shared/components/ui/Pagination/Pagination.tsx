'use client';
import React, { useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getPageWindow } from './getPageWindow';
import styles from './Pagination.module.scss';

interface PaginationBaseProps {
  readonly totalItems: number;
  readonly limit: number;
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

function isControlled(
  props: PaginationProps,
): props is PaginationControlledProps {
  return props.onPageChange !== undefined;
}

export function Pagination(props: PaginationProps) {
  const { totalItems, limit } = props;
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
  const totalPages = Math.ceil(totalItems / limit);

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

  if (totalItems === 0) {
    return null;
  }

  const pageNumbers = getPageWindow({ currentPage, totalPages });

  return (
    <nav className={styles.pagination} aria-label="Paginación" role="navigation">
      <button
        type="button"
        onClick={() => handlePageChange(currentPage - 1)}
        disabled={currentPage === 1}
        aria-label="Página anterior"
      >
        {'<'}
      </button>
      {pageNumbers.map((pageNumber) => {
        const isCurrentPage = currentPage === pageNumber;
        return (
          <button
            type="button"
            key={pageNumber}
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
        onClick={() => handlePageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        aria-label="Página siguiente"
      >
        {'>'}
      </button>
    </nav>
  );
}
