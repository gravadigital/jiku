import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Tabs } from './Tabs';

const TABS = [
  { key: 'backlog', label: 'Backlog', count: 0 },
  { key: 'curso', label: 'En curso', count: 3 },
];

describe('Tabs', () => {
  it('TS-47: implementa el patrón ARIA de tablist', () => {
    render(<Tabs tabs={TABS} activeKey="curso" onChange={vi.fn()} />);

    expect(screen.getByRole('tablist')).toBeInTheDocument();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(2);
    expect(screen.getByRole('tab', { name: /En curso/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /Backlog/ })).toHaveAttribute('aria-selected', 'false');
  });

  it('TS-48: el contador forma parte del nombre accesible del tab', () => {
    render(<Tabs tabs={TABS} activeKey="curso" onChange={vi.fn()} />);

    expect(screen.getByRole('tab', { name: /En curso, 3 elementos/ })).toBeInTheDocument();
  });

  it('TS-49: un tab con contador 0 no se oculta ni se deshabilita', () => {
    render(<Tabs tabs={TABS} activeKey="curso" onChange={vi.fn()} />);

    const backlogTab = screen.getByRole('tab', { name: /Backlog/ });
    expect(backlogTab).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(backlogTab).not.toHaveAttribute('disabled');
    expect(backlogTab).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('TS-50: avisa el cambio con la key del tab elegido', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Tabs tabs={TABS} activeKey="curso" onChange={onChange} />);

    await user.click(screen.getByRole('tab', { name: /Backlog/ }));

    expect(onChange).toHaveBeenCalledWith('backlog');
  });

  it('TS-51: las flechas ← → mueven entre tabs', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Tabs tabs={TABS} activeKey="curso" onChange={onChange} />);

    screen.getByRole('tab', { name: /En curso/ }).focus();
    await user.keyboard('{ArrowLeft}');

    expect(screen.getByRole('tab', { name: /Backlog/ })).toHaveFocus();
  });

  it('TS-52: Home y End van a los extremos del tablist', async () => {
    const tabs = [
      { key: 'a', label: 'A', count: 1 },
      { key: 'b', label: 'B', count: 1 },
      { key: 'c', label: 'C', count: 1 },
    ];
    const user = userEvent.setup();
    render(<Tabs tabs={tabs} activeKey="b" onChange={vi.fn()} />);

    screen.getByRole('tab', { name: /B, 1 elemento/ }).focus();
    await user.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: /A, 1 elemento/ })).toHaveFocus();

    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: /C, 1 elemento/ })).toHaveFocus();
  });

  it('TS-53: Tab entra y sale del tablist, no recorre los tabs uno por uno', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <button type="button">antes</button>
        <Tabs tabs={TABS} activeKey="curso" onChange={vi.fn()} />
        <button type="button">después</button>
      </div>
    );

    screen.getByRole('button', { name: 'antes' }).focus();
    await user.tab();
    expect(screen.getByRole('tab', { name: /En curso/ })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('button', { name: 'después' })).toHaveFocus();
  });

  it('TS-54: el panel se asocia al tab activo', () => {
    render(
      <Tabs tabs={TABS} activeKey="curso" onChange={vi.fn()}>
        <p>contenido</p>
      </Tabs>
    );

    const panel = screen.getByRole('tabpanel');
    const activeTab = screen.getByRole('tab', { name: /En curso/ });
    expect(panel).toHaveAttribute('aria-labelledby', activeTab.id);
  });
});
