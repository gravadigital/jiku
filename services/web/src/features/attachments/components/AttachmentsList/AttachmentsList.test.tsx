import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AttachmentsList } from './AttachmentsList';

// El barrel de @/shared/components/ui arrastra CommentEditor -> next-auth/react. Mismo
// patrón que ui/index.test.ts documenta para el barrel completo.
vi.mock('next-auth', () => ({
  default: vi.fn(() => ({ handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() })),
}));
vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({ data: { user: { roles: [], zitadelId: 'z1' } } })),
}));

vi.mock('@/features/objectives/hooks/useCanEditObjective', () => ({
  useCanEditObjective: () => true,
}));
vi.mock('@/features/projects/hooks/useCanUploadToProject', () => ({
  useCanUploadToProject: () => true,
}));

const mockUseAttachments = vi.fn();
vi.mock('../../hooks/useAttachments', () => ({
  useAttachments: (...args: unknown[]) => mockUseAttachments(...args),
}));

describe('AttachmentsList — TS-100/TS-101: Loader en vez de Spinner', () => {
  it('TS-100: en estado de carga, muestra el indicador accesible del Loader del DS', () => {
    mockUseAttachments.mockReturnValue({ data: undefined, isLoading: true, error: null });

    render(<AttachmentsList entityType="objective" entityId={1} />);

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('TS-101: el estado de carga sigue visible con el mismo texto', () => {
    mockUseAttachments.mockReturnValue({ data: undefined, isLoading: true, error: null });

    render(<AttachmentsList entityType="objective" entityId={1} />);

    expect(screen.getByText('Cargando archivos...')).toBeInTheDocument();
  });
});
