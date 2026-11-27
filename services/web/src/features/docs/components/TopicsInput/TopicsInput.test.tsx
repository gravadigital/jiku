import React, { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTopicSuggestions } from '../../hooks/useTopicSuggestions';
import { TopicsInput } from './TopicsInput';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));
vi.mock('../../hooks/useTopicSuggestions', () => ({ useTopicSuggestions: vi.fn() }));

const TOPICS_VID = {
  items: [
    { topic: 'video', documents: 3 },
    { topic: 'videoconferencia', documents: 12 },
    { topic: 'video-llamadas', documents: 1 },
  ],
  page: { limit: 10, returned: 3 },
};

const mockSuggestions = (data: unknown) =>
  vi.mocked(useTopicSuggestions).mockReturnValue({ data, isFetching: false } as never);

describe('TopicsInput', () => {
  let user: ReturnType<typeof userEvent.setup>;
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockSuggestions(undefined);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('TS-21: sugiere por prefijo normalizado, sin los elegidos, y Enter agrega la activa', async () => {
    mockSuggestions(TOPICS_VID);
    const onChange = vi.fn();
    render(<TopicsInput value={['video']} onChange={onChange} />);
    const input = screen.getByRole('combobox', { name: 'Temas' });
    await user.type(input, 'Vid');
    await act(async () => {
      vi.advanceTimersByTime(250);
    });
    expect(useTopicSuggestions).toHaveBeenLastCalledWith(
      expect.objectContaining({ prefix: 'vid' })
    );
    const options = screen.getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual([
      'videoconferencia12 documentos',
      'video-llamadas1 documento',
    ]);
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenCalledWith(['video', 'videoconferencia']);
    expect(input).toHaveValue('');
  });

  it('TS-22: tema nuevo, duplicado, Backspace, Escape y quitar', async () => {
    const Harness = ({ onChange }: { onChange: (t: string[]) => void }) => {
      const [value, setValue] = useState<string[]>([]);
      return (
        <form onSubmit={(e) => e.preventDefault()}>
          <TopicsInput
            value={value}
            onChange={(t) => {
              setValue(t);
              onChange(t);
            }}
          />
        </form>
      );
    };
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = screen.getByRole('combobox', { name: 'Temas' });
    await user.type(input, 'Diseño UX');
    expect(screen.getByText('Enter para agregar «Diseño UX»')).toBeInTheDocument();
    expect(screen.queryByText(/Proponer tema nuevo/)).not.toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenLastCalledWith(['diseno-ux']);

    await user.type(input, 'Diseño ux{Enter}');
    expect(onChange).toHaveBeenCalledTimes(1);

    await user.keyboard('{Backspace}');
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('TS-22: Enter hace preventDefault por sí mismo', () => {
    render(<TopicsInput value={[]} onChange={vi.fn()} />);
    const input = screen.getByRole('combobox', { name: 'Temas' });
    fireEvent.change(input, { target: { value: 'infra' } });
    const notPrevented = fireEvent.keyDown(input, { key: 'Enter' });
    expect(notPrevented).toBe(false);
  });

  it('Escape con lista abierta la cierra; quitar con ×', async () => {
    mockSuggestions(TOPICS_VID);
    const onChange = vi.fn();
    render(<TopicsInput value={['video']} onChange={onChange} />);
    const input = screen.getByRole('combobox', { name: 'Temas' });
    await user.type(input, 'vid');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{Escape}');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    await user.click(screen.getByRole('button', { name: 'Quitar tema video' }));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});
