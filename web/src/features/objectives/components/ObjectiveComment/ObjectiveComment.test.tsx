import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCurrentUser } from '@root/hooks/use-current-user';
import { ObjectiveComment } from './ObjectiveComment';

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

const baseProps = {
  authorName: 'Agustin Nava',
  authorId: 'u-1',
  date: new Date('2026-04-24T10:00:00Z'),
  updateDate: new Date('2026-04-24T10:00:00Z'),
  objectiveId: 42,
  commentId: 100,
  previousValue: '',
  visibilityLevel: 'public' as const,
};

describe('ObjectiveComment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCurrentUser).mockReturnValue(null);
  });

  it('usa MarkdownViewer para renderizar el contenido (no ReactMarkdown crudo)', () => {
    render(<ObjectiveComment {...baseProps} content="Hola ![attach:74] mundo [attach:75]" />);

    const viewer = screen.getByTestId('markdown-viewer');
    expect(viewer).toBeInTheDocument();
    expect(viewer).toHaveTextContent('Hola ![attach:74] mundo [attach:75]');
  });

  it('muestra el nombre del autor', () => {
    render(<ObjectiveComment {...baseProps} content="contenido" />);
    expect(screen.getByText('Agustin Nava')).toBeInTheDocument();
  });

  it('muestra el badge "Público" para comentarios públicos', () => {
    render(<ObjectiveComment {...baseProps} content="hola" visibilityLevel="public" />);
    expect(screen.getByText('👁')).toBeInTheDocument();
  });

  describe('Marca de identidad automática (S-019)', () => {
    it('muestra la marca en el header cuando el autor es una identidad de servicio', () => {
      render(
        <ObjectiveComment
          {...baseProps}
          authorName="Conector Portal"
          authorId="u-svc"
          authorIdentityType="service"
          content="sincronizado desde el portal"
        />
      );

      expect(screen.getByText('Conector Portal')).toBeInTheDocument();
      expect(screen.getByText('Automático')).toBeInTheDocument();
    });

    it('no muestra la marca cuando el autor es una persona', () => {
      render(<ObjectiveComment {...baseProps} authorIdentityType="person" content="hola" />);

      expect(screen.getByText('Agustin Nava')).toBeInTheDocument();
      expect(screen.queryByText('Automático')).not.toBeInTheDocument();
    });

    it('no muestra la marca cuando la prop no viene (llamador viejo)', () => {
      render(<ObjectiveComment {...baseProps} content="hola" />);

      expect(screen.queryByText('Automático')).not.toBeInTheDocument();
    });

    it('TS-22: la marca sigue presente después de entrar en modo edición', async () => {
      vi.mocked(useCurrentUser).mockReturnValue({ id: 'u-svc', name: 'Conector Portal' });

      render(
        <ObjectiveComment
          {...baseProps}
          authorName="Conector Portal"
          authorId="u-svc"
          authorIdentityType="service"
          content="sincronizado desde el portal"
        />
      );

      await userEvent.click(screen.getByRole('button', { name: 'Editar comentario' }));

      expect(screen.getByRole('button', { name: 'Guardar' })).toBeInTheDocument();
      expect(screen.getByText('Automático')).toBeInTheDocument();
    });
  });
});
