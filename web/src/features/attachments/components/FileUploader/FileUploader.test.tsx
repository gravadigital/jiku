import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as useUploadAttachmentModule from '../../hooks/useUploadAttachment';
import { FileUploader } from './FileUploader';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));
vi.mock('../../hooks/useUploadAttachment');

const mockUploadMutate = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useUploadAttachmentModule.useUploadAttachment).mockImplementation((options?: any) => {
    mockUploadMutate.mockImplementation(() => {
      options?.onError?.(new Error('permission denied'));
    });
    return { mutate: mockUploadMutate, isPending: false, progress: 0 } as any;
  });
});

describe('FileUploader', () => {
  it('TS-19 (S-067): error de permisos sobre entityType "objective" interpola "esta tarea"', async () => {
    render(<FileUploader entityId={1} entityType="objective" />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['contenido'], 'archivo.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(
        screen.getByText('No tenés permisos para subir archivos a esta tarea')
      ).toBeInTheDocument();
    });
  });

  it.each([
    'requirement_comment_draft',
    'requirement_comment',
    'objective_comment_draft',
    'objective_comment',
  ] as const)(
    'S-095/TS-7: error de permisos sobre entityType "%s" no muestra "undefined"',
    async (entityType) => {
      render(<FileUploader entityId={1} entityType={entityType} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['contenido'], 'archivo.pdf', { type: 'application/pdf' });
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        const message = screen.getByRole('alert').textContent ?? '';
        expect(message).not.toContain('undefined');
        expect(message).toBe('No tenés permisos para subir archivos a este comentario');
      });
    }
  );
});
