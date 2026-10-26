import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { toDocumentRow, toRowModel, type DocsRowModel, type RowContext } from './DocumentRow';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));

const NOW = new Date('2026-10-25T12:00:00.000Z');
const ID = '01J9Z3K8M2Q4R6T8V0W2Y4A6C8';

const ROW: DocsRowModel = {
  id: ID,
  version: 6,
  title: 'Arquitectura de videoconferencia',
  clientRefs: [{ id: 4, name: null }],
  projectRefs: [],
  topics: ['a', 'b', 'c', 'd', 'e'],
  visibility: 'restricted',
  lock: {
    sessionId: 's',
    holder: 'sub-luis',
    holderName: 'Luis Gómez',
    via: 'human',
    expiresAt: '2026-10-25T12:05:00.000Z',
  },
  updatedAt: '2026-10-24T14:30:00.000Z',
  updatedBy: 'sub-yo',
  updatedByName: 'Yo',
};

const ctx = (patch: Partial<RowContext> = {}): RowContext => ({
  layout: 'default',
  currentUserSub: 'sub-yo',
  now: NOW,
  ...patch,
});

function renderRow(row: DocsRowModel, c: RowContext) {
  const cells = toDocumentRow(row, c);
  return render(
    <div>
      {Object.entries(cells).map(([key, node]) => (
        <div key={key} data-testid={key}>
          {node as React.ReactNode}
        </div>
      ))}
    </div>
  );
}

describe('DocumentRow', () => {
  it('TS-35: celdas de la fila', () => {
    renderRow(ROW, ctx());
    expect(screen.getByTestId('clientProject')).toHaveTextContent('#4 · Sin proyecto');
    expect(screen.getByTestId('by')).toHaveTextContent('vos');
    expect(screen.getByTestId('updatedAt')).toHaveTextContent('24/10/2026');
    expect(screen.getByText('Restringido')).toBeInTheDocument();
    ['a', 'b', 'c', '+2'].forEach((t) => expect(screen.getByText(t)).toBeInTheDocument());
    expect(screen.getByText('En edición')).toBeInTheDocument();
    expect(screen.getByText('Luis Gómez lo está editando')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: ROW.title })).toHaveAttribute('href', `/docs/${ID}`);
  });

  it('lock sin nombre: "Otra persona lo está editando"; public: "Visible para el cliente"', () => {
    renderRow(
      { ...ROW, visibility: 'public', lock: { ...ROW.lock!, holderName: null } },
      ctx()
    );
    expect(screen.getByText('Otra persona lo está editando')).toBeInTheDocument();
    expect(screen.getByText('Visible para el cliente')).toBeInTheDocument();
  });

  describe('identidad por sub (S-101)', () => {
    const own = { ...ROW.lock!, holder: 'sub-yo', holderName: 'Yo' };
    it('TS-14: lock propio', () => {
      renderRow({ ...ROW, lock: own }, ctx());
      expect(screen.getByText('En edición')).toBeInTheDocument();
      expect(screen.getByText('Lo estás editando')).toBeInTheDocument();
      expect(screen.queryByText('Yo lo está editando')).not.toBeInTheDocument();
    });
    it('TS-15: lock de otro', () => {
      renderRow(ROW, ctx());
      expect(screen.getByText('Luis Gómez lo está editando')).toBeInTheDocument();
      expect(screen.queryByText('Lo estás editando')).not.toBeInTheDocument();
    });
    it('TS-16: sin sub no reconoce', () => {
      renderRow({ ...ROW, lock: own }, ctx({ currentUserSub: null }));
      expect(screen.getByText('Yo lo está editando')).toBeInTheDocument();
      expect(screen.queryByText('Lo estás editando')).not.toBeInTheDocument();
      expect(screen.getByTestId('by')).toHaveTextContent('Yo');
    });
    it('TS-17: "vos" en la celda by', () => {
      renderRow(ROW, ctx());
      expect(screen.getByTestId('by')).toHaveTextContent('vos');
    });
  });

  it('lock vencido: sin marca', () => {
    renderRow({ ...ROW, lock: { ...ROW.lock!, expiresAt: '2026-10-25T11:00:00.000Z' } }, ctx());
    expect(screen.queryByText('En edición')).not.toBeInTheDocument();
  });

  it('sin cliente ni proyecto, sin nombre de editor', () => {
    renderRow(
      { ...ROW, clientRefs: [], topics: [], updatedBy: 'sub-bot', updatedByName: null },
      ctx()
    );
    expect(screen.getByTestId('clientProject')).toHaveTextContent('Sin cliente · Sin proyecto');
    expect(screen.getByTestId('by')).toHaveTextContent('—');
  });

  it('layout de proyecto: columna Temas con "Sin tema" y sin pills en el título', () => {
    renderRow({ ...ROW, topics: [] }, ctx({ layout: 'temas' }));
    expect(screen.getByTestId('topics')).toHaveTextContent('Sin tema');
    expect(screen.queryByTestId('clientProject')).not.toBeInTheDocument();
  });

  it('sin proyecto: cliente y acción; fragmento con <mark> si hay texto', () => {
    renderRow(
      { ...ROW, snippet: '…la <b>arquitectura</b> del…' },
      ctx({ layout: 'sinProyecto', q: 'arquitectura', renderAction: () => <button>Acción</button> })
    );
    expect(screen.getByTestId('client')).toHaveTextContent('#4');
    expect(screen.getByRole('button', { name: 'Acción' })).toBeInTheDocument();
    expect(screen.getByText('arquitectura').tagName).toBe('MARK');
  });

  it('toRowModel normaliza un hit de búsqueda', () => {
    const model = toRowModel({
      documentId: ID,
      version: 2,
      title: 'T',
      path: '/x.md',
      headingPath: [],
      snippet: 's',
      score: 1,
      updatedAt: ROW.updatedAt,
      updatedBy: 'u',
    });
    expect(model).toMatchObject({ id: ID, snippet: 's', topics: undefined, lock: undefined });
  });
});
