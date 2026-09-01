import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectiveHistoryList } from './ObjectiveHistoryList';
import type { ObjectiveActivity } from '@/shared/types';

vi.mock('@root/assets/edit.svg', () => ({ default: 'edit-icon.svg' }));

vi.mock('@/lib/auth', () => ({
  auth: () => Promise.resolve(null),
}));

let sessionData: { user: { id: string; roles: string[] } } | null = null;

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: sessionData }),
}));

function mockSession(userId: string, roles: string[] = ['user']) {
  sessionData = { user: { id: userId, roles } };
}

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

vi.mock('@/features/objectives/services/commentsApi', () => ({
  updateComment: vi.fn(),
}));

vi.mock('@/features/attachments/hooks/useAttachments', () => ({
  useAttachments: () => ({ data: [], isLoading: false }),
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
  user: { id: 'u-1', name: 'Ana Pérez', email: 'ana@grava.io' },
  visibilityLevel: 'internal',
  editedAt: null,
  editedBy: null,
};

const serviceStateActivity: ObjectiveActivity = {
  id: 100,
  typeOfActivity: 'state',
  previousValue: 'activo',
  newValue: 'finalizado',
  objectiveId: 12,
  createdAt: new Date('2026-06-01'),
  updatedAt: new Date('2026-06-01'),
  projectId: 5,
  user: {
    id: 'u-svc',
    name: 'Conector Portal',
    email: 'conector@grava.io',
    identityType: 'service',
  },
  visibilityLevel: 'public',
  editedAt: null,
  editedBy: null,
};

const personStateActivity: ObjectiveActivity = {
  ...serviceStateActivity,
  id: 101,
  previousValue: 'backlog',
  newValue: 'activo',
  user: { id: 'u1', name: 'Ana Pérez', email: 'ana@grava.io', identityType: 'person' },
};

const personComment: ObjectiveActivity = {
  ...baseComment,
  id: 301,
  user: { id: 'u1', name: 'Ana Pérez', email: 'ana@grava.io', identityType: 'person' },
};

const serviceComment: ObjectiveActivity = {
  ...baseComment,
  id: 300,
  newValue: 'sincronizado desde el portal',
  user: {
    id: 'u-svc',
    name: 'Conector Portal',
    email: 'conector@grava.io',
    identityType: 'service',
  },
};

describe('ObjectiveHistoryList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionData = null;
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
    mockSession('u-1');

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

  // TS-32 (CA-6, CA-7): la marca depende de editedAt, no de previousValue
  it('TS-32: no muestra "(editado)" con previousValue pero sin editedAt (S-048)', () => {
    render(
      <ObjectiveHistoryList
        objectiveId={42}
        objectiveActivity={[{ ...baseComment, previousValue: 'texto viejo', editedAt: null }]}
      />
    );
    expect(screen.queryByText('(editado)')).not.toBeInTheDocument();
  });

  it('muestra "(editado)" cuando el comentario tiene editedAt y el editor es el autor (S-048)', () => {
    render(
      <ObjectiveHistoryList
        objectiveId={42}
        objectiveActivity={[
          { ...baseComment, editedAt: '2026-09-01T10:00:00.000Z', editedBy: 'u-1' },
        ]}
      />
    );
    expect(screen.getByText('(editado)')).toBeInTheDocument();
  });

  // TS-33 (CA-5): pasa editedBy a ObjectiveComment para resolver "editado por X"
  it('TS-33: muestra "(editado por X)" cuando editedBy difiere del autor (S-048)', () => {
    const editor = { ...baseComment, id: 302, user: { id: 'u-2', name: 'Ana Gomez', email: 'ana@grava.io' } };
    render(
      <ObjectiveHistoryList
        objectiveId={42}
        objectiveActivity={[
          { ...baseComment, editedAt: '2026-09-01T10:00:00.000Z', editedBy: 'u-2' },
          editor,
        ]}
      />
    );
    expect(screen.getByText('(editado por Ana Gomez)')).toBeInTheDocument();
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

  describe('Marca de identidad automática (S-019)', () => {
    it('TS-18: una entrada del historial escrita por un servicio muestra el nombre y la marca', () => {
      render(<ObjectiveHistoryList objectiveId={12} objectiveActivity={[serviceStateActivity]} />);

      expect(screen.getByText('Conector Portal')).toBeInTheDocument();
      expect(screen.getAllByText('Automático')).toHaveLength(1);
    });

    it('TS-19: en un historial mixto solo se marca la entrada del servicio', () => {
      render(
        <ObjectiveHistoryList
          objectiveId={12}
          objectiveActivity={[serviceStateActivity, personStateActivity]}
        />
      );

      const badges = screen.getAllByText('Automático');
      expect(badges).toHaveLength(1);

      const serviceRow = screen.getByText('Conector Portal').closest('li');
      expect(serviceRow).toContainElement(badges[0]);

      const personRow = screen.getByText('Ana Pérez').closest('li');
      expect(personRow).not.toContainElement(badges[0]);
    });

    it('TS-20: un comentario escrito por un servicio muestra el nombre y la marca en su header', () => {
      render(<ObjectiveHistoryList objectiveId={12} objectiveActivity={[serviceComment]} />);

      expect(screen.getByText('Conector Portal')).toBeInTheDocument();
      expect(screen.getAllByText('Automático')).toHaveLength(1);
    });

    it('TS-21: un comentario escrito por una persona no muestra la marca', () => {
      render(<ObjectiveHistoryList objectiveId={12} objectiveActivity={[personComment]} />);

      expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
      expect(screen.queryByText('Automático')).not.toBeInTheDocument();
    });

    it('TS-23: el comentario de un servicio no habilita ninguna acción para otro usuario', () => {
      mockSession('u1');

      render(<ObjectiveHistoryList objectiveId={12} objectiveActivity={[serviceComment]} />);

      expect(screen.getAllByText('Automático')).toHaveLength(1);
      expect(
        screen.queryByRole('button', { name: 'Editar comentario' })
      ).not.toBeInTheDocument();
    });

    // TS-34 (CA-4, CA-5): admin edita el comentario de una identidad de servicio tambien
    it('TS-34: un admin puede editar el comentario de una identidad de servicio', () => {
      mockSession('u1', ['admin']);

      render(<ObjectiveHistoryList objectiveId={12} objectiveActivity={[serviceComment]} />);

      expect(screen.getByRole('button', { name: 'Editar comentario' })).toBeInTheDocument();
    });

    it('TS-24: sin historial ni comentarios no hay ninguna marca', () => {
      render(<ObjectiveHistoryList objectiveId={12} objectiveActivity={[]} />);

      expect(screen.getByText('No hay cambios aún')).toBeInTheDocument();
      expect(screen.getByText('No hay comentarios aún')).toBeInTheDocument();
      expect(screen.queryByText('Automático')).not.toBeInTheDocument();
    });

    it('una entrada del historial sin identityType no se marca', () => {
      const sinCampo: ObjectiveActivity = {
        ...serviceStateActivity,
        user: { id: 'u-svc', name: 'Conector Portal', email: 'conector@grava.io' },
      };

      render(<ObjectiveHistoryList objectiveId={12} objectiveActivity={[sinCampo]} />);

      expect(screen.getByText('Conector Portal')).toBeInTheDocument();
      expect(screen.queryByText('Automático')).not.toBeInTheDocument();
    });
  });
});
