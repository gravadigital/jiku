const PAGE_WINDOW_SIZE = 10;

interface GetPageWindowParams {
  readonly currentPage: number;
  readonly totalPages: number;
}

/**
 * Calcula el rango de números de página a mostrar en el paginador: una ventana
 * de tamaño máximo `PAGE_WINDOW_SIZE`, centrada en `currentPage` y ajustada a
 * los extremos `[1, totalPages]` cuando la ventana ideal se saldría del rango.
 *
 * No produce elipsis ni huecos: solo números contiguos.
 */
export function getPageWindow({ currentPage, totalPages }: GetPageWindowParams): number[] {
  if (totalPages <= 0) {
    return [];
  }

  if (totalPages <= PAGE_WINDOW_SIZE) {
    return Array.from({ length: totalPages }, (__, index) => index + 1);
  }

  const idealStart = currentPage - Math.floor(PAGE_WINDOW_SIZE / 2);
  const maxStart = totalPages - PAGE_WINDOW_SIZE + 1;
  const start = Math.min(Math.max(idealStart, 1), maxStart);
  const end = start + PAGE_WINDOW_SIZE - 1;

  return Array.from({ length: end - start + 1 }, (__, index) => start + index);
}
