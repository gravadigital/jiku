import * as fs from 'fs';
import * as path from 'path';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AutomatedIdentityBadge } from './AutomatedIdentityBadge';
import type { IdentityType } from '@/shared/types';

const scssContent = fs.readFileSync(
  path.resolve(__dirname, './AutomatedIdentityBadge.module.scss'),
  'utf8'
);

// Las declaraciones reales, sin los comentarios (que citan a proposito las reglas
// ambientales contra las que el selector se defiende).
const scssDeclarations = scssContent.replace(/\/\/.*$/gm, '');

describe('AutomatedIdentityBadge', () => {
  it('renderiza el texto "Automático" cuando la identidad es de servicio', () => {
    render(<AutomatedIdentityBadge identityType="service" />);

    expect(screen.getByText('Automático')).toBeInTheDocument();
  });

  it('se anuncia como "Identidad automática: no es una persona"', () => {
    render(<AutomatedIdentityBadge identityType="service" />);

    expect(screen.getByLabelText('Identidad automática: no es una persona')).toBeInTheDocument();
  });

  it('no renderiza ningún nodo cuando la identidad es una persona', () => {
    const { container } = render(<AutomatedIdentityBadge identityType="person" />);

    expect(screen.queryByText('Automático')).not.toBeInTheDocument();
    expect(container.firstChild).toBeNull();
  });

  it('no renderiza ningún nodo cuando el tipo de identidad está ausente', () => {
    const { container } = render(<AutomatedIdentityBadge identityType={undefined} />);

    expect(screen.queryByText('Automático')).not.toBeInTheDocument();
    expect(container.firstChild).toBeNull();
  });

  it('no renderiza ningún nodo ante un valor de identidad inesperado', () => {
    const { container } = render(
      <AutomatedIdentityBadge identityType={'robot' as unknown as IdentityType} />
    );

    expect(container.firstChild).toBeNull();
  });

  it('no es interactivo ni enfocable', () => {
    render(<AutomatedIdentityBadge identityType="service" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('Automático')).not.toHaveAttribute('tabindex');
  });

  describe('El nombre accesible y la defensa de la cascada', () => {
    it('declara role="img" para que el aria-label sea su nombre accesible de verdad', () => {
      render(<AutomatedIdentityBadge identityType="service" />);

      expect(
        screen.getByRole('img', { name: 'Identidad automática: no es una persona' })
      ).toBeInTheDocument();
    });

    it('califica su regla con [role="img"]: sin eso, las reglas ambientales de `span` de detalle-tarea le ganan', () => {
      // `.container span { font-size: medium; font-weight: bold }` (ObjectiveHistoryList) y
      // `p > span { font-weight: bold }` (ObjectiveDetails) le ganarian a una clase sola, y
      // dos de los seis badges se verian mas grandes y en negrita que los otros cuatro.
      expect(scssContent).toMatch(/\.badge\[role='img'\]\s*\{/);
    });

    it('toma tipografia, espaciado y radio del mixin tag-base, sin valores propios', () => {
      expect(scssDeclarations).toContain('@include tag-base');
      expect(scssDeclarations).not.toMatch(/font-size:/);
      expect(scssDeclarations).not.toMatch(/font-weight:/);
    });

    it('no hardcodea colores ni escribe media queries', () => {
      expect(scssDeclarations).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(scssDeclarations).not.toMatch(/@media/);
    });
  });
});
