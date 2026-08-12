'use client';
import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import styles from './Pagination.module.scss';

interface PaginationProps {
  readonly totalItems: number;
  readonly limit: number;
}

export function Pagination({ totalItems, limit }: PaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState<number | null>(null);

  useEffect(() => {
    const page = searchParams?.get('page');
    const calculatedTotalPages = Math.ceil(totalItems / limit);
    setTotalPages(calculatedTotalPages);
    if (!page || page === '1') {
      setCurrentPage(1);
    } else {
      setCurrentPage(Number(page));
    }
  }, [searchParams, totalItems, limit]);

  const createQueryString = (field: string, value: string) => {
    const params = new URLSearchParams(searchParams?.toString());
    params.set(field, value);
    return params.toString();
  };

  const handlePageChange = (newPage: number) => {
    router.push(`/objectives?${createQueryString('page', newPage.toString())}`);
  };

  if (totalItems === 0) {
    return null;
  }

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
      {Array.from({ length: totalPages || 0 }, (__, index) => {
        const pageNumber = index + 1;
        const isCurrentPage = currentPage === pageNumber;
        return (
          <button
            type="button"
            key={index}
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
