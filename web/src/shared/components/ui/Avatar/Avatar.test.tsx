import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Avatar } from './Avatar';

describe('Avatar', () => {
  it('TS-24: person renderiza dos iniciales en mayúscula', () => {
    render(<Avatar name="Andrés Vandoni" />);

    expect(screen.getByText('AV')).toBeInTheDocument();
    expect(screen.queryByText('A')).not.toBeInTheDocument();
  });

  it('TS-25: person es decorativo cuando el nombre está visible al lado', () => {
    const { container } = render(<Avatar name="Andrés Vandoni" nameVisible />);

    const avatarNode = container.querySelector('[aria-hidden="true"]');
    expect(avatarNode).toBeTruthy();
  });

  it('TS-26: person sin nombre al lado lleva el nombre completo como aria-label', () => {
    render(<Avatar name="Andrés Vandoni" />);

    const avatar = screen.getByLabelText('Andrés Vandoni');
    expect(avatar).toBeInTheDocument();
    expect(avatar).not.toHaveAttribute('aria-hidden');
  });

  it('TS-27: aplica el size por defecto sm y acepta md', () => {
    const { container: smContainer } = render(<Avatar name="Lautaro Alvarez" />);
    const { container: mdContainer } = render(<Avatar name="Lautaro Alvarez" size="md" />);

    const smClass = smContainer.querySelector('span')?.className;
    const mdClass = mdContainer.querySelector('span')?.className;
    expect(smClass).not.toEqual(mdClass);
  });

  it('TS-28: app renderiza el símbolo, no iniciales', () => {
    render(<Avatar variant="app" name="Jiku" />);

    expect(screen.queryByText('JI')).not.toBeInTheDocument();
  });

  it('TS-29: usa el mismo fondo para cualquier persona', () => {
    const { container: c1 } = render(<Avatar name="Andrés Vandoni" />);
    const { container: c2 } = render(<Avatar name="Lautaro Alvarez" />);

    const class1 = c1.querySelector('span')?.getAttribute('class');
    const class2 = c2.querySelector('span')?.getAttribute('class');
    expect(class1).toEqual(class2);

    const style1 = c1.querySelector('span')?.getAttribute('style');
    const style2 = c2.querySelector('span')?.getAttribute('style');
    expect(style1).toBeFalsy();
    expect(style2).toBeFalsy();
  });

  it('TS-30: el sufijo +N es accesible con palabras, no con el glifo', () => {
    render(<Avatar name="Andrés Vandoni" nameVisible extraCount={1} />);

    expect(screen.getByText('y 1 responsable más')).toBeInTheDocument();
  });

  it('TS-79: los tokens de avatar resuelven a los semánticos que declara el spec', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../../../styles/_component.scss'),
      'utf-8'
    );
    expect(source).toMatch(/--avatar-bg:\s*var\(--bg-inverse\)/);
    expect(source).toMatch(/--avatar-text:\s*var\(--text-inverse\)/);
  });
});
