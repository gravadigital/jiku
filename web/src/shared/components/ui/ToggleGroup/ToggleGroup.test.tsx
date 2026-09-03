import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ToggleGroup } from './ToggleGroup';

const OPTIONS = [
  { value: 'persona', label: 'Por persona' },
  { value: 'proyecto', label: 'Por proyecto' },
];

describe('ToggleGroup', () => {
  it('es un radiogroup, no botones sueltos (TS-60)', () => {
    render(
      <ToggleGroup label="Vista" options={OPTIONS} value="persona" onChange={vi.fn()} />
    );

    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('el grupo tiene nombre accesible (TS-61)', () => {
    render(
      <ToggleGroup label="Vista" options={OPTIONS} value="persona" onChange={vi.fn()} />
    );

    expect(screen.getByRole('radiogroup', { name: 'Vista' })).toBeInTheDocument();
  });

  it('la opción elegida declara aria-checked (TS-62)', () => {
    render(
      <ToggleGroup label="Vista" options={OPTIONS} value="persona" onChange={vi.fn()} />
    );

    expect(screen.getByRole('radio', { name: 'Por persona' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    expect(screen.getByRole('radio', { name: 'Por proyecto' })).toHaveAttribute(
      'aria-checked',
      'false'
    );
  });

  it('click cambia la selección (TS-63)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ToggleGroup label="Vista" options={OPTIONS} value="persona" onChange={onChange} />);

    await user.click(screen.getByRole('radio', { name: 'Por proyecto' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('proyecto');
  });

  it('flecha derecha mueve la selección (TS-64)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ToggleGroup label="Vista" options={OPTIONS} value="persona" onChange={onChange} />);

    screen.getByRole('radio', { name: 'Por persona' }).focus();
    await user.keyboard('{ArrowRight}');

    expect(onChange).toHaveBeenCalledWith('proyecto');
  });

  it('flecha izquierda vuelve (TS-65)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ToggleGroup label="Vista" options={OPTIONS} value="proyecto" onChange={onChange} />);

    screen.getByRole('radio', { name: 'Por proyecto' }).focus();
    await user.keyboard('{ArrowLeft}');

    expect(onChange).toHaveBeenCalledWith('persona');
  });

  it('las flechas circulan en el extremo (TS-66)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ToggleGroup label="Vista" options={OPTIONS} value="proyecto" onChange={onChange} />);

    screen.getByRole('radio', { name: 'Por proyecto' }).focus();
    await user.keyboard('{ArrowRight}');

    expect(onChange).toHaveBeenCalledWith('persona');
  });

  it('Tab entra y sale del grupo, roving tabindex (TS-67)', () => {
    render(
      <ToggleGroup label="Vista" options={OPTIONS} value="persona" onChange={vi.fn()} />
    );

    expect(screen.getByRole('radio', { name: 'Por persona' })).toHaveAttribute('tabIndex', '0');
    expect(screen.getByRole('radio', { name: 'Por proyecto' })).toHaveAttribute('tabIndex', '-1');
  });

  it('la variant por defecto es segmented (TS-68)', () => {
    render(<ToggleGroup label="Vista" options={OPTIONS} value="persona" onChange={vi.fn()} />);

    expect(screen.getByRole('radiogroup').className).toMatch(/_segmented_/);
  });

  it('cada variant aplica su clase (TS-69)', () => {
    const { unmount: unmountRangePill } = render(
      <ToggleGroup
        label="Rango"
        variant="range-pill"
        options={OPTIONS}
        value="persona"
        onChange={vi.fn()}
      />
    );
    expect(screen.getByRole('radiogroup').className).toMatch(/_rangePill_/);
    unmountRangePill();

    const { unmount: unmountStepperValue } = render(
      <ToggleGroup
        label="Horas"
        variant="stepper-value"
        options={OPTIONS}
        value="persona"
        onChange={vi.fn()}
      />
    );
    expect(screen.getByRole('radiogroup').className).toMatch(/_stepperValue_/);
    unmountStepperValue();

    render(
      <ToggleGroup
        label="Día"
        variant="day-chip"
        options={OPTIONS}
        value="persona"
        onChange={vi.fn()}
      />
    );
    expect(screen.getByRole('radiogroup').className).toMatch(/_dayChip_/);
  });

  it('allowOther en stepper-value agrega la opción Otro (TS-70)', () => {
    render(
      <ToggleGroup
        variant="stepper-value"
        allowOther
        label="Horas"
        options={[
          { value: '0', label: '0' },
          { value: '1', label: '1' },
          { value: '2', label: '2' },
        ]}
        value="0"
        onChange={vi.fn()}
      />
    );

    expect(screen.getByRole('radio', { name: 'Otro' })).toBeInTheDocument();
  });

  it('elegir Otro abre un input de valor libre (TS-71)', async () => {
    const user = userEvent.setup();
    render(
      <ToggleGroup
        variant="stepper-value"
        allowOther
        label="Horas"
        options={[
          { value: '0', label: '0' },
          { value: '1', label: '1' },
        ]}
        value="0"
        onChange={vi.fn()}
      />
    );

    await user.click(screen.getByRole('radio', { name: 'Otro' }));

    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('allowOther no agrega Otro en otras variants (TS-72)', () => {
    render(
      <ToggleGroup
        variant="segmented"
        allowOther
        label="Vista"
        options={OPTIONS}
        value="persona"
        onChange={vi.fn()}
      />
    );

    expect(screen.queryByRole('radio', { name: 'Otro' })).toBeNull();
  });
});
