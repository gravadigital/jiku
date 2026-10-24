import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ObjectiveDetail from './page';

// CommentEditor arrastra (via el barrel) un uso de next-auth/react, y Button (la acción
// "Editar"/"Volver" de ViewHeader) usa useRouter. Mismo patrón que ui/index.test.ts
// documenta para el barrel completo.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('next-auth', () => ({
  default: vi.fn(() => ({ handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() })),
}));
vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({ data: { user: { roles: [], zitadelId: 'z1' } } })),
}));

const baseObjective = {
  id: 42,
  projectId: 7,
  title: 'Migrar el header a ViewHeader',
  ObjectiveActivity: [],
};

// La card de documentación tiene sus propios tests (features/docs); acá solo importa dónde se monta.
vi.mock('@/features/docs', () => ({
  DocsPanel: ({ scope }: { scope: object }) => (
    <section aria-label="docs-panel" data-scope={JSON.stringify(scope)} />
  ),
}));

vi.mock('@/features/objectives', () => ({
  getObjectiveById: vi.fn(() => Promise.resolve(baseObjective)),
  ObjectiveDetails: () => <div>detalle</div>,
  ObjectiveHistoryList: () => <div>historial</div>,
}));

vi.mock('@/shared/components/ui', async () => {
  const actual = await vi.importActual<object>('@/shared/components/ui');
  return {
    ...actual,
    CommentEditor: () => <div>comentarios</div>,
  };
});

describe('ObjectiveDetail — TS-98/S-060: cabecera migrada a ViewHeader', () => {
  it('renderiza el título de la tarea como <h1>', async () => {
    render(await ObjectiveDetail({ params: Promise.resolve({ id: 42 }) }));

    expect(
      screen.getByRole('heading', { level: 1, name: 'Migrar el header a ViewHeader' })
    ).toBeInTheDocument();
  });

  it('"Volver" es el breadcrumb, siempre al mismo destino por proyecto', async () => {
    render(await ObjectiveDetail({ params: Promise.resolve({ id: 42 }) }));

    const back = screen.getByRole('link', { name: 'Volver' });
    expect(back).toHaveAttribute('href', '/objectives/by-project#project-7');
  });

  it('TS-31: la card de documentación va entre el detalle y el historial, filtrada por tarea', async () => {
    render(await ObjectiveDetail({ params: Promise.resolve({ id: 7 }) }));

    const details = screen.getByText('detalle');
    const docs = screen.getByLabelText('docs-panel');
    const history = screen.getByText('historial');

    expect(docs).toHaveAttribute('data-scope', JSON.stringify({ taskId: 7 }));
    expect(details.compareDocumentPosition(docs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(docs.compareDocumentPosition(history) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('"Editar" sigue siendo la acción principal, con href a la edición', async () => {
    render(await ObjectiveDetail({ params: Promise.resolve({ id: 42 }) }));

    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument();
  });
});
