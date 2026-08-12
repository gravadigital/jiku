import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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
  useCurrentUser: () => null,
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
});
