import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectAttachmentsSection } from './ProjectAttachmentsSection';

vi.mock('@/features/attachments', () => ({
  FileUploader: ({ entityType, entityId }: { entityType: string; entityId: number }) => (
    <div
      data-testid="file-uploader"
      data-entity-type={entityType}
      data-entity-id={String(entityId)}
    />
  ),
  AttachmentsList: ({ entityType, entityId }: { entityType: string; entityId: number }) => (
    <div
      data-testid="attachments-list"
      data-entity-type={entityType}
      data-entity-id={String(entityId)}
    />
  ),
}));

vi.mock('@/features/projects/hooks/useCanUploadToProject', () => ({
  useCanUploadToProject: () => true,
}));

// El barrel completo de @/shared/components/ui arrastra (vía CommentEditor →
// @/features/objectives) un uso de next-auth/react y de next-auth a nivel de módulo.
vi.mock('next-auth', () => ({
  default: vi.fn(() => ({ handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() })),
}));
vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({ data: { user: { roles: [], zitadelId: 'z1' } } })),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe('ProjectAttachmentsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza el título "Archivos Adjuntos"', () => {
    render(<ProjectAttachmentsSection projectId={7} />);
    expect(screen.getByText('Archivos Adjuntos')).toBeInTheDocument();
  });

  it('renderiza FileUploader con entityType="project" y projectId correcto', () => {
    render(<ProjectAttachmentsSection projectId={7} />);
    const uploader = screen.getByTestId('file-uploader');
    expect(uploader).toBeInTheDocument();
    expect(uploader).toHaveAttribute('data-entity-type', 'project');
    expect(uploader).toHaveAttribute('data-entity-id', '7');
  });

  it('renderiza AttachmentsList con entityType="project" y projectId correcto', () => {
    render(<ProjectAttachmentsSection projectId={7} />);
    const list = screen.getByTestId('attachments-list');
    expect(list).toBeInTheDocument();
    expect(list).toHaveAttribute('data-entity-type', 'project');
    expect(list).toHaveAttribute('data-entity-id', '7');
  });
});
