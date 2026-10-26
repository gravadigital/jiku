import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDocument } from '../../hooks/useDocument';
import { useModule } from '../../hooks/useModules';
import { lockDocument } from '../../services/docsApi';
import { DocumentView } from './DocumentView';
import { DETAIL_A, ID_A as ID } from './fixtures';

const replace = vi.fn();
let params = new URLSearchParams();

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
  useSearchParams: () => params,
  notFound: vi.fn(),
}));
vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));
vi.mock('../../hooks/useDocument', () => ({ useDocument: vi.fn() }));
vi.mock('../../hooks/useModules', () => ({ useModule: vi.fn() }));
// `useEditSession` es el real: lo que se prueba es el orden entre el lock y la limpieza de la URL.
vi.mock('../../services/docsApi', () => ({ lockDocument: vi.fn(), unlockDocument: vi.fn() }));
vi.mock('../../services/docsClientApi', () => ({ releaseLockKeepalive: vi.fn() }));
vi.mock('../DocumentEditor', () => ({
  DocumentEditor: () => <textarea aria-label="Markdown" defaultValue="" />,
}));
vi.mock('@/hooks/use-current-user', () => ({
  useCurrentUser: () => ({ id: 'sub-yo', name: 'Yo' }),
}));

const SESSION = '01J9Z3K8M2Q4R6T8V0W2Y4A6S1';

describe('DocumentView — Crear y editar sin carrera (TS-34)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    params = new URLSearchParams({ editar: '1' });
    vi.mocked(useModule).mockReturnValue({ status: 'available', sharing: false, isKnown: true });
    vi.mocked(useDocument).mockReturnValue({ data: DETAIL_A, isError: false } as never);
  });

  it('toma la reserva una vez, limpia la URL después y sigue en edición', async () => {
    const calls: string[] = [];
    vi.mocked(lockDocument).mockImplementation(async () => {
      calls.push('lock:start');
      await Promise.resolve();
      calls.push('lock:resolved');
      return {
        ok: true,
        data: { id: ID, sessionId: SESSION, expiresAt: '2099-01-01T00:00:00.000Z' },
      } as never;
    });
    const replaceState = vi
      .spyOn(window.history, 'replaceState')
      .mockImplementation(() => void calls.push('replaceState'));

    const ui = (
      <React.StrictMode>
        <QueryClientProvider client={new QueryClient()}>
          <DocumentView id={ID} />
        </QueryClientProvider>
      </React.StrictMode>
    );
    const { rerender } = render(ui);
    await act(async () => {});

    expect(lockDocument).toHaveBeenCalledTimes(1);
    expect(lockDocument).toHaveBeenCalledWith(ID, expect.any(String));
    expect(screen.getByRole('textbox', { name: 'Markdown' })).toBeInTheDocument();
    expect(replaceState).toHaveBeenCalledWith(null, '', `/docs/${ID}`);
    expect(calls.indexOf('replaceState')).toBeGreaterThan(calls.indexOf('lock:resolved'));
    expect(replace).not.toHaveBeenCalled();

    params = new URLSearchParams();
    rerender(ui);
    await act(async () => {});
    expect(screen.getByRole('textbox', { name: 'Markdown' })).toBeInTheDocument();
    replaceState.mockRestore();
  });
});
