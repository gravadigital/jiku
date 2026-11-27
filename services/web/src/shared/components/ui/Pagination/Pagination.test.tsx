import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Pagination } from './Pagination';

const pushSpy = vi.fn();
let currentSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushSpy }),
  useSearchParams: () => currentSearchParams,
}));

beforeEach(() => {
  pushSpy.mockClear();
  currentSearchParams = new URLSearchParams();
});

describe('Pagination — render de la ventana (modo URL)', () => {
  it('TS-11: página 1 de 30 dibuja 10 números, del 1 al 10', () => {
    currentSearchParams = new URLSearchParams();
    render(<Pagination totalItems={600} limit={20} basePath="/objectives" />);

    for (let n = 1; n <= 10; n += 1) {
      expect(screen.getByRole('button', { name: `Página ${n}` })).toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: 'Página 11' })).not.toBeInTheDocument();
  });

  it('TS-12: página 15 de 30 dibuja el rango 10-19', () => {
    currentSearchParams = new URLSearchParams('page=15');
    render(<Pagination totalItems={600} limit={20} basePath="/objectives" />);

    for (let n = 10; n <= 19; n += 1) {
      expect(screen.getByRole('button', { name: `Página ${n}` })).toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: 'Página 9' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Página 20' })).not.toBeInTheDocument();
  });

  it('TS-13: la página actual está activa y deshabilitada, y ninguna otra lo está', () => {
    currentSearchParams = new URLSearchParams('page=15');
    render(<Pagination totalItems={600} limit={20} basePath="/objectives" />);

    const current = screen.getByRole('button', { name: 'Página 15' });
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(current).toBeDisabled();

    for (let n = 10; n <= 19; n += 1) {
      if (n === 15) continue;
      expect(screen.getByRole('button', { name: `Página ${n}` })).not.toHaveAttribute('aria-current');
    }
  });

  it('TS-14: última página dibuja el rango 21-30 y "siguiente" está deshabilitado', () => {
    currentSearchParams = new URLSearchParams('page=30');
    render(<Pagination totalItems={600} limit={20} basePath="/objectives" />);

    for (let n = 21; n <= 30; n += 1) {
      expect(screen.getByRole('button', { name: `Página ${n}` })).toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: 'Página 20' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Página 31' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Página siguiente' })).toBeDisabled();
  });

  it('TS-15: con 4 páginas se muestran los 4 números, sin elipsis ni huecos', () => {
    currentSearchParams = new URLSearchParams('page=2');
    const { container } = render(<Pagination totalItems={70} limit={20} basePath="/objectives" />);

    for (let n = 1; n <= 4; n += 1) {
      expect(screen.getByRole('button', { name: `Página ${n}` })).toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: 'Página 5' })).not.toBeInTheDocument();
    expect(container.textContent).not.toContain('…');
    expect(container.textContent).not.toContain('...');
  });
});

describe('Pagination — modo URL: navegación (regresión de CA-5)', () => {
  it('TS-16: click en un número navega con el page actualizado', async () => {
    currentSearchParams = new URLSearchParams('page=15');
    const user = userEvent.setup();
    render(<Pagination totalItems={600} limit={20} basePath="/objectives" />);

    await user.click(screen.getByRole('button', { name: 'Página 17' }));

    expect(pushSpy).toHaveBeenCalledTimes(1);
    const calledWith = pushSpy.mock.calls[0][0] as string;
    expect(calledWith.startsWith('/objectives?')).toBe(true);
    const params = new URLSearchParams(calledWith.split('?')[1]);
    expect(params.get('page')).toBe('17');
  });

  it('TS-17: la navegación preserva los demás searchParams', async () => {
    currentSearchParams = new URLSearchParams('page=15&state=activo&search=api&limit=20');
    const user = userEvent.setup();
    render(<Pagination totalItems={600} limit={20} basePath="/objectives" />);

    await user.click(screen.getByRole('button', { name: 'Página 16' }));

    const calledWith = pushSpy.mock.calls[0][0] as string;
    const params = new URLSearchParams(calledWith.split('?')[1]);
    expect(params.get('page')).toBe('16');
    expect(params.get('state')).toBe('activo');
    expect(params.get('search')).toBe('api');
    expect(params.get('limit')).toBe('20');
  });

  it('TS-18: las flechas navegan a la página contigua', async () => {
    currentSearchParams = new URLSearchParams('page=15');
    const user = userEvent.setup();
    const { unmount } = render(<Pagination totalItems={600} limit={20} basePath="/objectives" />);

    await user.click(screen.getByRole('button', { name: 'Página siguiente' }));
    let params = new URLSearchParams((pushSpy.mock.calls[0][0] as string).split('?')[1]);
    expect(params.get('page')).toBe('16');
    unmount();

    pushSpy.mockClear();
    currentSearchParams = new URLSearchParams('page=15');
    render(<Pagination totalItems={600} limit={20} basePath="/objectives" />);
    await user.click(screen.getByRole('button', { name: 'Página anterior' }));
    params = new URLSearchParams((pushSpy.mock.calls[0][0] as string).split('?')[1]);
    expect(params.get('page')).toBe('14');
  });

  // Cambia de conducta por mandato del spec Pagination v1.0.0 ("NO SE DEBE ocultar la
  // paginación cuando hay una sola página: se muestra deshabilitada") — anteriormente
  // (S-037) con 0 ítems el componente no renderizaba nada. Ver TS-59 de S-054.
  it('TS-59 (antes TS-19): con 0 ítems el nav se sigue renderizando, deshabilitado', () => {
    currentSearchParams = new URLSearchParams();
    render(<Pagination totalItems={0} limit={20} basePath="/objectives" />);

    expect(screen.getByRole('navigation', { name: 'Paginación' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Página siguiente' })).toBeDisabled();
  });
});

describe('Pagination — modo controlado (CA-6)', () => {
  it('TS-20: click invoca el callback con la página nueva (número, no string)', async () => {
    const onPageChange = vi.fn();
    const user = userEvent.setup();
    render(<Pagination totalItems={600} limit={20} currentPage={15} onPageChange={onPageChange} />);

    await user.click(screen.getByRole('button', { name: 'Página 17' }));

    expect(onPageChange).toHaveBeenCalledTimes(1);
    expect(onPageChange).toHaveBeenCalledWith(17);
  });

  it('TS-21: el modo controlado no navega', async () => {
    const onPageChange = vi.fn();
    const user = userEvent.setup();
    render(<Pagination totalItems={600} limit={20} currentPage={15} onPageChange={onPageChange} />);

    await user.click(screen.getByRole('button', { name: 'Página 17' }));

    expect(pushSpy).not.toHaveBeenCalled();
  });

  it('TS-22: en modo controlado la página la manda la prop, no la URL', () => {
    currentSearchParams = new URLSearchParams('page=3');
    render(
      <Pagination totalItems={600} limit={20} currentPage={15} onPageChange={vi.fn()} />,
    );

    for (let n = 10; n <= 19; n += 1) {
      expect(screen.getByRole('button', { name: `Página ${n}` })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'Página 15' })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('button', { name: 'Página 3' })).not.toBeInTheDocument();
  });
});

describe('Pagination — higiene arquitectónica y accesibilidad', () => {
  it('TS-23: la página se deriva, no se guarda — cambiar searchParams cambia la ventana sin remontar', () => {
    currentSearchParams = new URLSearchParams('page=1');
    const { rerender } = render(<Pagination totalItems={600} limit={20} basePath="/objectives" />);

    currentSearchParams = new URLSearchParams('page=25');
    rerender(<Pagination totalItems={600} limit={20} basePath="/objectives" />);

    expect(screen.getByRole('button', { name: 'Página 25' })).toHaveAttribute('aria-current', 'page');
    for (let n = 20; n <= 29; n += 1) {
      expect(screen.getByRole('button', { name: `Página ${n}` })).toBeInTheDocument();
    }
  });

  it('TS-25: la accesibilidad se preserva', () => {
    currentSearchParams = new URLSearchParams('page=15');
    render(<Pagination totalItems={600} limit={20} basePath="/objectives" />);

    const nav = screen.getByRole('navigation', { name: 'Paginación' });
    expect(nav).toBeInTheDocument();
    const numberedButton = within(nav).getByRole('button', { name: 'Página 15' });
    expect(numberedButton).toHaveAttribute('type', 'button');
    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Página siguiente' })).toBeInTheDocument();
    expect(numberedButton).toHaveAttribute('aria-current', 'page');
  });

  it('TS-26: el barrel público sigue exportando el componente', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const barrelSource = await fs.readFile(path.resolve(__dirname, '../index.ts'), 'utf-8');
    expect(barrelSource).toContain("export { Pagination } from './Pagination';");

    const { Pagination: PaginationFromLocalIndex } = await import('./index');
    expect(typeof PaginationFromLocalIndex).toBe('function');
  });
});

describe('Pagination — grep de control (sin regresiones arquitectónicas)', () => {
  it('no contiene la ruta /objectives hardcodeada, useEffect ni useState en el código fuente', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const source = await fs.readFile(
      path.resolve(__dirname, './Pagination.tsx'),
      'utf-8',
    );

    expect(source).not.toContain('/objectives');
    expect(source).not.toContain('useEffect');
    expect(source).not.toContain('useState');
    expect(source).not.toContain('…');
    expect(source).not.toContain('ellipsis');
  });

  it('TS-55: sigue sin hardcodear ninguna ruta (regresión de CA-1)', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const source = await fs.readFile(path.resolve(__dirname, './Pagination.tsx'), 'utf-8');

    expect(source).not.toContain('/objectives');
  });
});

describe('Pagination — spec v1.0.0 (S-054): selector de cantidad, región viva, capa DS', () => {
  it('TS-56: modo controlado avisa la página nueva y no navega', async () => {
    const onPageChange = vi.fn();
    const user = userEvent.setup();
    render(<Pagination totalItems={40} limit={10} currentPage={1} onPageChange={onPageChange} />);

    await user.click(screen.getByRole('button', { name: 'Página 2' }));

    expect(onPageChange).toHaveBeenCalledWith(2);
    expect(pushSpy).not.toHaveBeenCalled();
  });

  it('TS-57: modo URL navega preservando los demás searchParams', async () => {
    currentSearchParams = new URLSearchParams('status=activo&page=1');
    const user = userEvent.setup();
    render(<Pagination totalItems={40} limit={10} basePath="/requirements" />);

    await user.click(screen.getByRole('button', { name: 'Página 3' }));

    const calledWith = pushSpy.mock.calls[0][0] as string;
    const params = new URLSearchParams(calledWith.split('?')[1]);
    expect(params.get('page')).toBe('3');
    expect(params.get('status')).toBe('activo');
  });

  it('TS-58: con una sola página se muestra deshabilitada, no se oculta', () => {
    render(<Pagination totalItems={3} limit={10} currentPage={1} onPageChange={vi.fn()} />);

    expect(screen.getByRole('navigation', { name: 'Paginación' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Página siguiente' })).toBeDisabled();
  });

  it('TS-60: los extremos están disabled de verdad y no disparan el callback', async () => {
    const onPageChange = vi.fn();
    const user = userEvent.setup();
    render(<Pagination totalItems={40} limit={10} currentPage={1} onPageChange={onPageChange} />);

    const prevButton = screen.getByRole('button', { name: 'Página anterior' });
    expect(prevButton).toHaveAttribute('disabled');
    await user.click(prevButton);

    expect(onPageChange).not.toHaveBeenCalled();
  });

  it('TS-61: ofrece el selector de cantidad con unidad explícita', () => {
    render(
      <Pagination
        totalItems={40}
        limit={5}
        currentPage={1}
        onPageChange={vi.fn()}
        pageSizeOptions={[5, 10, 25]}
        onPageSizeChange={vi.fn()}
      />
    );

    expect(screen.getByText('5 por página')).toBeInTheDocument();
  });

  it('TS-62: el selector de cantidad avisa el tamaño elegido como número', async () => {
    const onPageSizeChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Pagination
        totalItems={40}
        limit={5}
        currentPage={1}
        onPageChange={vi.fn()}
        pageSizeOptions={[5, 10, 25]}
        onPageSizeChange={onPageSizeChange}
      />
    );

    await user.click(screen.getByRole('combobox', { name: /por página/i }));
    await user.click(screen.getByRole('option', { name: '25 por página' }));

    expect(onPageSizeChange).toHaveBeenCalledWith(25);
  });

  it('TS-63: anuncia el cambio de página en una región viva', () => {
    render(<Pagination totalItems={40} limit={10} currentPage={2} onPageChange={vi.fn()} />);

    const liveRegion = document.querySelector('[aria-live="polite"]');
    expect(liveRegion).toBeTruthy();
    expect(liveRegion?.textContent).toMatch(/Página 2 de 4/);
  });

  it('TS-64: conserva la ventana deslizante de 10 números', () => {
    render(<Pagination totalItems={300} limit={10} currentPage={15} onPageChange={vi.fn()} />);

    for (let n = 10; n <= 19; n += 1) {
      expect(screen.getByRole('button', { name: `Página ${n}` })).toBeInTheDocument();
    }
  });

  it('TS-65: conserva aria-current="page" en la página actual', () => {
    render(<Pagination totalItems={300} limit={10} currentPage={15} onPageChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Página 15' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });
});
