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
  user: { id: 'u-1', name: 'Ana Pérez', email: 'ana@grava.io' },
  visibilityLevel: 'internal',
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
      vi.mocked(useCurrentUser).mockReturnValue({ id: 'u1', name: 'Ana Pérez' });

      render(<ObjectiveHistoryList objectiveId={12} objectiveActivity={[serviceComment]} />);

      expect(screen.getAllByText('Automático')).toHaveLength(1);
      expect(
        screen.queryByRole('button', { name: 'Editar comentario' })
      ).not.toBeInTheDocument();
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
