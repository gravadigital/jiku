import { describe, expect, it } from 'vitest';
import { getPageWindow } from './getPageWindow';

describe('getPageWindow', () => {
  it.each([
    {
      name: 'TS-1: página 1 de 30, la ventana arranca en 1',
      currentPage: 1,
      totalPages: 30,
      expected: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    },
    {
      name: 'TS-2: página 15 de 30, ventana centrada en el rango 10-19',
      currentPage: 15,
      totalPages: 30,
      expected: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19],
    },
    {
      name: 'TS-3: página 30 de 30, la ventana se ajusta al final',
      currentPage: 30,
      totalPages: 30,
      expected: [21, 22, 23, 24, 25, 26, 27, 28, 29, 30],
    },
    {
      name: 'TS-4: 4 páginas, se muestran todas sin relleno',
      currentPage: 2,
      totalPages: 4,
      expected: [1, 2, 3, 4],
    },
    {
      name: 'TS-5: exactamente 10 páginas, caso borde del máximo',
      currentPage: 7,
      totalPages: 10,
      expected: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    },
    {
      name: 'TS-6: 11 páginas en la página 1, primer caso donde la ventana recorta',
      currentPage: 1,
      totalPages: 11,
      expected: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    },
    {
      name: 'TS-7: una sola página',
      currentPage: 1,
      totalPages: 1,
      expected: [1],
    },
    {
      name: 'TS-8: totalPages 0 devuelve un array vacío sin arrojar',
      currentPage: 1,
      totalPages: 0,
      expected: [],
    },
    {
      name: 'TS-9: página 2 de 30, cerca del inicio, la ventana no puede centrarse',
      currentPage: 2,
      totalPages: 30,
      expected: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    },
    {
      name: 'TS-10: página 29 de 30, cerca del final',
      currentPage: 29,
      totalPages: 30,
      expected: [21, 22, 23, 24, 25, 26, 27, 28, 29, 30],
    },
  ])('$name', ({ currentPage, totalPages, expected }) => {
    expect(getPageWindow({ currentPage, totalPages })).toEqual(expected);
  });

  it('totalPages negativo devuelve un array vacío sin arrojar', () => {
    expect(getPageWindow({ currentPage: 1, totalPages: -5 })).toEqual([]);
  });

  it('la ventana nunca supera los 10 elementos', () => {
    const result = getPageWindow({ currentPage: 50, totalPages: 200 });
    expect(result).toHaveLength(10);
  });
});
