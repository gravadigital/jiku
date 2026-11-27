import React from 'react';
import { act, render, screen, within } from '@testing-library/react';
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

export const setup = (
  props: Partial<React.ComponentProps<typeof DocsSearchBar>> = {}
) => {
  const handlers = { onAdd: vi.fn(), onRemove: vi.fn(), onClear: vi.fn() };
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  render(
    <DocsSearchBar
      tokens={[]}
      knownLabels={{}}
      disabled={false}
      {...handlers}
      {...props}
    />
  );
  return { user, ...handlers };
};

describe('DocsSearchBar', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(useDocsSuggestions).mockReturnValue({ data: SUGGESTIONS } as never);
  });
  afterEach(() => vi.useRealTimers());

  it('TS-22: sugerencias agrupadas con el cliente activo y resaltado', async () => {
    const { user } = setup({
      tokens: [{ kind: 'cliente', id: 4 }],
      knownLabels: { 'cliente:4': 'EXO' },
      clientIdForSuggestions: 4,
    });
    await user.type(screen.getByRole('combobox'), 'vid');
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    expect(useDocsSuggestions).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: 'vid', clientId: 4 })
    );
    expect(
      screen.getByRole('option', { name: 'Buscar «vid» en títulos y contenido' })
    ).toBeInTheDocument();
    const projects = screen.getByRole('group', { name: 'Proyectos' });
    expect(within(projects).getByRole('option')).toHaveTextContent('Videoconferencia');
    expect(within(projects).getByText('EXO')).toBeInTheDocument();
    const topics = screen.getByRole('group', { name: 'Temas' });
    expect(within(topics).getByText('7 documentos')).toBeInTheDocument();
    const marks = screen.getAllByText((_, el) => el?.tagName === 'MARK').map((m) => m.textContent);
    expect(marks).toEqual(['Vid', 'vid']);
  });

  it('TS-28: ARIA del combobox', async () => {
    const { user } = setup();
    const combobox = screen.getByRole('combobox');
    await user.type(combobox, 'vid');
    await user.keyboard('{ArrowDown}');
    expect(combobox).toHaveAttribute('aria-expanded', 'true');
    const listbox = screen.getByRole('listbox');
    expect(combobox).toHaveAttribute('aria-controls', listbox.id);
    const first = screen.getByRole('option', { name: 'Buscar «vid» en títulos y contenido' });
    expect(combobox).toHaveAttribute('aria-activedescendant', first.id);
    expect(combobox).toHaveFocus();
  });

  it('placeholder según haya o no filtros', () => {
    setup();
    expect(
      screen.getByPlaceholderText('Buscá texto o escribí un proyecto, cliente, tema o persona')
    ).toBeInTheDocument();
  });

  it('con filtros: otro placeholder y botón para quitarlos todos', async () => {
    const { user, onClear } = setup({ tokens: [{ kind: 'sinTema' }] });
    expect(screen.getByPlaceholderText('Sumar otro filtro o texto')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Quitar todos los filtros' }));
    expect(onClear).toHaveBeenCalled();
  });

  it('deshabilitado: campo y botones deshabilitados', () => {
    setup({ disabled: true, tokens: [{ kind: 'sinTema' }] });
    expect(screen.getByRole('combobox')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Quitar todos los filtros' })).toBeDisabled();
  });
});
