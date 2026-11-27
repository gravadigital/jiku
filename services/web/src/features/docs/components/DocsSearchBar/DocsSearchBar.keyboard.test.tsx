import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDocsSuggestions } from '../../hooks/useDocsSuggestions';
import { DocsSearchBar } from './DocsSearchBar';

vi.mock('../../hooks/useDocsSuggestions', () => ({ useDocsSuggestions: vi.fn() }));
vi.mock('./useTokenLabel', () => ({
  useTokenLabel: (token: { kind: string; id?: number }, known: Record<string, string>) =>
    known[`${token.kind}:${token.id}`] ?? `#${token.id}`,
}));

const SUGGESTIONS = {
  projects: [
    { id: 12, name: 'Videoconferencia', code: 'VID', clientId: 4, clientName: 'EXO', mine: true },
  ],
  clients: [],
  persons: [],
  topics: [{ topic: 'video', documents: 7 }],
};

function setup(props: Partial<React.ComponentProps<typeof DocsSearchBar>> = {}) {
  const handlers = { onAdd: vi.fn(), onRemove: vi.fn(), onClear: vi.fn() };
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  render(<DocsSearchBar tokens={[]} knownLabels={{}} disabled={false} {...handlers} {...props} />);
  return { user, ...handlers };
}

describe('DocsSearchBar — teclado', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(useDocsSuggestions).mockReturnValue({ data: SUGGESTIONS } as never);
  });
  afterEach(() => vi.useRealTimers());

  it('TS-23: flechas + Enter eligen el proyecto y anuncian el filtro', async () => {
    const { user, onAdd } = setup({
      tokens: [{ kind: 'cliente', id: 4 }],
      knownLabels: { 'cliente:4': 'EXO' },
    });
    const combobox = screen.getByRole('combobox');
    await user.type(combobox, 'vid');
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(onAdd).toHaveBeenCalledWith({ kind: 'proyecto', id: 12 }, 'Videoconferencia');
    expect(combobox).toHaveValue('');
    expect(combobox).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Filtro Proyecto Videoconferencia agregado')).toBeInTheDocument();
  });

  it('TS-24: Enter sin marcar suma el texto', async () => {
    const { user, onAdd } = setup();
    await user.type(screen.getByRole('combobox'), 'arquitectura{Enter}');
    expect(onAdd).toHaveBeenCalledWith({ kind: 'texto', value: 'arquitectura' }, 'arquitectura');
  });

  it('TS-25: un carácter + Enter no suma y la lista sigue abierta', async () => {
    const { user, onAdd } = setup();
    const combobox = screen.getByRole('combobox');
    await user.type(combobox, 'a{Enter}');
    expect(onAdd).not.toHaveBeenCalled();
    expect(combobox).toHaveAttribute('aria-expanded', 'true');
  });

  it('TS-26: Backspace, × y Esc', async () => {
    const { user, onRemove } = setup({
      tokens: [
        { kind: 'cliente', id: 4 },
        { kind: 'proyecto', id: 12 },
      ],
      knownLabels: { 'cliente:4': 'EXO', 'proyecto:12': 'Videoconferencia' },
    });
    const combobox = screen.getByRole('combobox');
    await user.click(combobox);
    await user.keyboard('{Backspace}');
    expect(onRemove).toHaveBeenLastCalledWith(1);

    await user.click(screen.getByRole('button', { name: 'Quitar filtro Cliente EXO' }));
    expect(onRemove).toHaveBeenLastCalledWith(0);
    expect(combobox).toHaveFocus();

    await user.type(combobox, 'vi');
    expect(combobox).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{Escape}');
    expect(combobox).toHaveAttribute('aria-expanded', 'false');
    expect(combobox).toHaveValue('vi');
  });

  it('TS-27: "sin" ofrece los Sin … y elegir uno suma su token', async () => {
    const { user, onAdd } = setup();
    await user.type(screen.getByRole('combobox'), 'sin');
    expect(screen.getByRole('option', { name: 'Sin proyecto' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Sin cliente' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Sin tema' })).toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: 'Sin proyecto' }));
    expect(onAdd).toHaveBeenCalledWith({ kind: 'sinProyecto' }, 'Sin proyecto');
  });
});
