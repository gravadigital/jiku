import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DocsResults } from './DocsResults';
import type { DocsRowModel } from '../DocumentRow';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/hooks/use-current-user', () => ({
  useCurrentUser: () => ({ id: 'sub-yo', name: 'Yo' }),
}));

const row = (id: string, patch: Partial<DocsRowModel> = {}): DocsRowModel => ({
  id,
  version: 1,
  title: `Doc ${id}`,
  updatedAt: '2026-10-24T14:30:00.000Z',
  updatedBy: 'sub-ana',
  updatedByName: 'Ana Pérez',
  clientRefs: [{ id: 4, name: 'EXO' }],
  projectRefs: [{ id: 12, name: 'Videoconferencia', code: 'VID', clientId: 4 }],
  ...patch,
});

const rows = (n: number, prefix = 'd', patch: Partial<DocsRowModel> = {}) =>
  Array.from({ length: n }, (_, i) => row(`${prefix}${i + 1}`, patch));

const base = {
  mode: 'listado' as const,
  layout: 'default' as const,
  orden: 'recientes' as const,
  pagina: 1,
  onPageChange: vi.fn(),
  isLoading: false,
  q: '',
};

describe('DocsResults', () => {
  beforeEach(() => vi.clearAllMocks());

  it('TS-30: inicio con dos grupos y sin paginación', () => {
    render(
      <DocsResults
        {...base}
        mode="inicio"
        mine={[row('a')]}
        recent={[row('a'), row('b', { clientRefs: [], projectRefs: [], updatedByName: null })]}
      />
    );
    expect(screen.getByText('En mis proyectos activos')).toBeInTheDocument();
    expect(screen.getByText('Editados recientemente')).toBeInTheDocument();
    expect(screen.getAllByText('EXO · Videoconferencia').length).toBeGreaterThan(0);
    expect(screen.getByText('Sin cliente · Sin proyecto')).toBeInTheDocument();
    expect(screen.getAllByText('24/10/2026').length).toBeGreaterThan(0);
    expect(screen.queryByRole('navigation', { name: 'Paginación' })).not.toBeInTheDocument();
    for (const forbidden of ['Vistas', 'Carpeta', '/clientes']) {
      expect(screen.queryByText(forbidden)).not.toBeInTheDocument();
    }
  });

  it('TS-31: sin "mis proyectos" ese grupo no se muestra', () => {
    render(<DocsResults {...base} mode="inicio" mine={[]} recent={[row('a')]} />);
    expect(screen.queryByText('En mis proyectos activos')).not.toBeInTheDocument();
    expect(screen.getByText('Editados recientemente')).toBeInTheDocument();
  });

  it('TS-32: texto con fragmento resaltado, orden Relevancia por defecto', () => {
    render(
      <DocsResults
        {...base}
        mode="texto"
        orden="relevancia"
        q="arquitectura"
        items={[row('a', { snippet: '…la <b>arquitectura</b> del…' })]}
      />
    );
    expect(screen.getByRole('columnheader', { name: 'Documento · 1 de 1' })).toBeInTheDocument();
    expect(screen.getByText('arquitectura').tagName).toBe('MARK');
  });

  it('TS-33: texto en el tope, paginado en memoria', async () => {
    const onPageChange = vi.fn();
    render(
      <DocsResults
        {...base}
        mode="texto"
        orden="relevancia"
        q="arquitectura"
        items={rows(50)}
        onPageChange={onPageChange}
      />
    );
    expect(screen.getByRole('columnheader', { name: 'Documento · 20 de 50+' })).toBeInTheDocument();
    expect(screen.getByText('Página 1 de 3')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('texto: "Más recientes" ordena por fecha y pagina la segunda página', () => {
    const items = [
      ...rows(20, 'old', { updatedAt: '2026-01-01T00:00:00.000Z' }),
      row('new', { updatedAt: '2026-12-01T00:00:00.000Z' }),
    ];
    const { rerender } = render(
      <DocsResults {...base} mode="texto" orden="recientes" q="doc" items={items} />
    );
    expect(screen.getByText('Doc new')).toBeInTheDocument();
    rerender(<DocsResults {...base} mode="texto" orden="recientes" q="doc" items={items} pagina={2} />);
    expect(screen.getByText('Doc old20')).toBeInTheDocument();
    expect(screen.queryByText('Doc new')).not.toBeInTheDocument();
  });

  it('TS-34: listado con conteo y total de páginas', () => {
    render(<DocsResults {...base} items={rows(20)} total={45} />);
    expect(screen.getByRole('columnheader', { name: 'Documento · 20 de 45' })).toBeInTheDocument();
    expect(screen.getByText('Página 1 de 3')).toBeInTheDocument();
  });

  it('TS-36: columna Temas desde un proyecto', () => {
    render(<DocsResults {...base} layout="temas" items={[row('a', { topics: [] })]} total={1} />);
    expect(screen.getByRole('columnheader', { name: 'Temas' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Cliente · Proyecto' })).not.toBeInTheDocument();
    expect(screen.getByText('Sin tema')).toBeInTheDocument();
  });

  it('TS-46: columnas de sin proyecto', () => {
    render(
      <DocsResults
        {...base}
        layout="sinProyecto"
        items={[row('a')]}
        total={1}
        renderAction={() => <button>Asignar proyecto</button>}
      />
    );
    for (const name of ['Documento · 1 de 1', 'Cliente', 'Actualizado', 'Acción']) {
      expect(screen.getByRole('columnheader', { name })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'Asignar proyecto' })).toBeInTheDocument();
  });
});

describe('DocsResults — estados', () => {
  it('TS-37: vacíos y región live', () => {
    const { container, rerender } = render(<DocsResults {...base} items={[]} total={0} />);
    expect(
      screen.getByText('Ningún documento cumple estos filtros. Quitá alguno o probá con otras palabras.')
    ).toBeInTheDocument();
    expect(container.querySelector('[aria-live="polite"]')).toHaveTextContent('Sin resultados');
    rerender(<DocsResults {...base} layout="sinProyecto" items={[]} total={0} />);
    expect(screen.getByText('Todos los documentos tienen proyecto.')).toBeInTheDocument();
    rerender(<DocsResults {...base} mode="inicio" mine={[]} recent={[]} />);
    expect(
      screen.getByText('Todavía no hay documentos. Creá el primero con «Nuevo documento».')
    ).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Paginación' })).not.toBeInTheDocument();
  });

  it('cargando: loader y sin paginación', () => {
    render(<DocsResults {...base} isLoading />);
    expect(within(screen.getByRole('status')).getByText('Cargando documentación…')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Paginación' })).not.toBeInTheDocument();
  });

  it('TS-38: errores de consulta', () => {
    const error = { code: 'internal_error', message: 'x', status: 500 };
    const { rerender } = render(<DocsResults {...base} error={error} />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'No se pudo cargar la documentación. Actualizá la página.'
    );
    rerender(<DocsResults {...base} mode="texto" q="ab" error={error} />);
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo buscar. Intentá de nuevo.');
  });
});
