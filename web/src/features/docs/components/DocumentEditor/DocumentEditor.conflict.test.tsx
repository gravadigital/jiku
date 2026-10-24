import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'react-toastify';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSaveDocument } from '../../hooks/useSaveDocument';
import { getDocument } from '../../services/docsApi';
import { DocumentEditor } from './DocumentEditor';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));
vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));
vi.mock('../../hooks/useSaveDocument', () => ({ useSaveDocument: vi.fn() }));
vi.mock('../../hooks/useUploadDocAttachment', () => ({
  useUploadDocAttachment: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
}));
vi.mock('../../services/docsApi', () => ({ getDocument: vi.fn() }));
vi.mock('@/features/auth/hooks/usePersons', () => ({
  usePersons: vi.fn(() => ({ data: [{ userId: 'sub-ana', firstName: 'Ana', lastName: 'Gómez' }] })),
}));

const ID = '01J9Z3K8M2Q4R6T8V0W2Y4A6C8';
const DOC = {
  id: ID,
  title: 'Arquitectura',
  fileName: 'arquitectura.md',
  version: 6,
  content: '# Arquitectura',
  folder: { id: 'F', path: '/clientes/acme/', effectivePermission: 'write', sharingBlocked: false },
};
const session = {
  phase: 'editing',
  sessionId: '01J9Z3K8M2Q4R6T8V0W2Y4A6E2',
  blockedBy: null,
  start: vi.fn(),
  release: vi.fn().mockResolvedValue(undefined),
  markBlocked: vi.fn(),
  clearBlocked: vi.fn(),
} as never;
const CONFLICT = {
  code: 'version_conflict',
  message: 'El documento cambió',
  status: 409,
  details: { currentVersion: 7 },
};

const mutate = vi.fn();
const onDone = vi.fn();
const textbox = () => screen.getByRole('textbox', { name: 'Contenido (markdown)' });

const setup = () => {
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <DocumentEditor doc={DOC as never} session={session} onDone={onDone} />
    </QueryClientProvider>
  );
};

const triggerConflict = async () => {
  mutate.mockImplementationOnce((_p, options) => options.onError(CONFLICT));
  fireEvent.change(textbox(), { target: { value: 'mi texto propio' } });
  await userEvent.click(screen.getByRole('button', { name: /Guardar/ }));
};

describe('DocumentEditor — conflicto de versión', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSaveDocument).mockReturnValue({ mutate, isPending: false } as never);
  });

  it('TS-80: conserva el texto propio y muestra la versión ajena en texto plano', async () => {
    vi.mocked(getDocument).mockResolvedValue({
      ok: true,
      data: { ...DOC, version: 7, updatedBy: 'sub-ana', content: '# Versión de Ana' },
    } as never);
    setup();
    await triggerConflict();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ana Gómez guardó la versión 7 mientras editabas. Tu texto sigue acá: compará con la versión actual y guardá cuando estés listo.'
    );
    expect(textbox()).toHaveValue('mi texto propio');
    expect(
      screen.getByRole('heading', { name: 'Versión 7, guardada por Ana Gómez' })
    ).toBeInTheDocument();
    expect(screen.getByText('# Versión de Ana')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Versión de Ana' })).toBeNull();
    expect(screen.queryByText(/Arrastrá archivos aquí/)).toBeNull();
    expect(screen.getByRole('button', { name: /Guardar sobre la versión 7/ })).toBeEnabled();
    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it('TS-81: guardar sobre la versión actual usa la nueva base', async () => {
    vi.mocked(getDocument).mockResolvedValue({
      ok: true,
      data: { ...DOC, version: 7, updatedBy: 'sub-ana', content: 'x' },
    } as never);
    setup();
    await triggerConflict();
    await screen.findByRole('alert');

    mutate.mockImplementationOnce((_p, options) => options.onSuccess({ id: ID, version: 8 }));
    await userEvent.click(screen.getByRole('button', { name: /Guardar sobre la versión 7/ }));
    expect(mutate.mock.calls[1][0]).toEqual({
      baseVersion: 7,
      content: 'mi texto propio',
      sessionId: '01J9Z3K8M2Q4R6T8V0W2Y4A6E2',
    });
    expect(toast.success).toHaveBeenCalledWith('Guardaste la versión 8.');
  });

  it('TS-82: sin poder recargar la versión usa currentVersion y lo dice en el panel', async () => {
    vi.mocked(getDocument).mockResolvedValue({
      ok: false,
      error: { code: 'gateway_timeout', message: 'x', status: 504 },
    });
    setup();
    await triggerConflict();

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'otra persona guardó la versión 7 mientras editabas'
      )
    );
    expect(
      screen.getByText('No se pudo cargar la versión actual. Recargá la página para verla.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Guardar sobre la versión 7/ })).toBeInTheDocument();
    expect(textbox()).toHaveValue('mi texto propio');
  });
});
