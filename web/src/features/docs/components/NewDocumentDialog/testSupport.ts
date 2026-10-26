import { createElement, Fragment, useState } from 'react';
import { vi } from 'vitest';
import { useCanRestrictDocs } from '../../hooks/useCanRestrictDocs';
import { useCreateDocument } from '../../hooks/useCreateDocument';
import { NewDocumentDialog, type NewDocumentInitial } from './NewDocumentDialog';

export const NEW_ID = '01JA0000000000000000000NEW';
export const calls: string[] = [];
export const push = vi.fn((url: string) => calls.push(`push:${url}`));
export const mutate = vi.fn();
export const reset = vi.fn();

export const setMutation = (over: Record<string, unknown> = {}) =>
  vi.mocked(useCreateDocument).mockReturnValue({
    mutate,
    reset,
    isPending: false,
    isError: false,
    error: null,
    ...over,
  } as never);

export const setRole = (admin: boolean) => vi.mocked(useCanRestrictDocs).mockReturnValue(admin);

export function Host({ initial }: { initial?: NewDocumentInitial }) {
  const [open, setOpen] = useState(false);
  return createElement(
    Fragment,
    null,
    createElement('button', { type: 'button', onClick: () => setOpen(true) }, 'Abrir'),
    createElement(NewDocumentDialog, {
      open,
      initial,
      onClose: () => {
        calls.push('close');
        setOpen(false);
      },
    })
  );
}
