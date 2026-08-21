import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCurrentUser } from '@root/hooks/use-current-user';
import { ObjectiveHistoryList } from './ObjectiveHistoryList';
import type { ObjectiveActivity } from '@/shared/types';

vi.mock('@root/assets/edit.svg', () => ({ default: 'edit-icon.svg' }));

vi.mock('@/lib/auth', () => ({
  auth: () => Promise.resolve(null),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={typeof src === 'string' ? src : ''} alt={alt} />
  ),
}));

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('@root/hooks/use-current-user', () => ({
  useCurrentUser: vi.fn(),
}));

vi.mock('@/features/objectives/services/commentsApi', () => ({
  updateComment: vi.fn(),
}));

vi.mock('@/features/attachments/components/MarkdownViewer', () => ({
  MarkdownViewer: ({ content }: { content: string }) => (
    <div data-testid="markdown-viewer">{content}</div>
  ),
}));

const baseComment: ObjectiveActivity = {
  id: 100,
  typeOfActivity: 'comment',
  previousValue: '',
  newValue: 'Un comentario',
  objectiveId: 42,
  createdAt: new Date('2026-04-24T10:00:00Z'),
  updatedAt: new Date('2026-04-24T10:00:00Z'),
  projectId: 5,
  user: { id: 'u-1', name: 'Ana Pérez', username: 'aperez', email: 'ana@grava.io' },
  visibilityLevel: 'internal',
};

describe('ObjectiveHistoryList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCurrentUser).mockReturnValue(null);
  });

  it('firma cada comentario con el nombre del usuario de Jiku', () => {
    render(<ObjectiveHistoryList objectiveId={42} objectiveActivity={[baseComment]} />);

    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.queryByText(/En sistema externo/)).not.toBeInTheDocument();
  });

  it('firma con el usuario de Jiku aunque el backend mande los campos de la integración', () => {
    // El objeto simula un backend que todavía manda los campos de la integración dada de
    // baja (REQ-003). Los campos ya no existen en `ObjectiveActivity`, de ahí el cast: el
    // test prueba que la rama de atribución externa fue ELIMINADA, no solo no satisfecha.
    const comentarioConCamposExternos = {
      ...baseComment,
      externalUserId: 'jira-99',
      externalUserName: 'Bruno Externo',
      externalReferenceUrl: 'https://jira.example/c/1',
    } as unknown as ObjectiveActivity;

    render(
      <ObjectiveHistoryList objectiveId={42} objectiveActivity={[comentarioConCamposExternos]} />
    );

    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.queryByText(/En sistema externo/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Bruno Externo/)).not.toBeInTheDocument();
  });

  it('deja editar su propio comentario aunque el backend mande externalUserId', () => {
    vi.mocked(useCurrentUser).mockReturnValue({ id: 'u-1', name: 'Ana Pérez' });

    const comentarioConCamposExternos = {
      ...baseComment,
      externalUserId: 'jira-99',
      externalUserName: 'Bruno Externo',
      externalReferenceUrl: 'https://jira.example/c/1',
    } as unknown as ObjectiveActivity;

    render(
      <ObjectiveHistoryList objectiveId={42} objectiveActivity={[comentarioConCamposExternos]} />
    );

    expect(screen.getByRole('button', { name: 'Editar comentario' })).toBeInTheDocument();
  });

  it('marca "(editado)" solo cuando el comentario tiene previousValue', () => {
    const { unmount } = render(
      <ObjectiveHistoryList objectiveId={42} objectiveActivity={[baseComment]} />
    );
    expect(screen.queryByText('(editado)')).not.toBeInTheDocument();
    unmount();

    render(
      <ObjectiveHistoryList
        objectiveId={42}
        objectiveActivity={[{ ...baseComment, previousValue: 'texto viejo' }]}
      />
    );
    expect(screen.getByText('(editado)')).toBeInTheDocument();
  });

  it('muestra los dos estados vacíos y los dos encabezados sin actividad', () => {
    render(<ObjectiveHistoryList objectiveId={42} objectiveActivity={[]} />);

    expect(screen.getByText('No hay cambios aún')).toBeInTheDocument();
    expect(screen.getByText('No hay comentarios aún')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Historial de cambios', level: 2 })
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Comentarios', level: 2 })).toBeInTheDocument();
  });
});
