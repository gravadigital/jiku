import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ClientProjectLabel } from './ClientProjectLabel';

const text = (ui: React.ReactElement) => render(ui).container.textContent;

describe('ClientProjectLabel', () => {
  it('cliente y proyecto con nombre', () => {
    expect(
      text(
        <ClientProjectLabel
          clientRefs={[{ id: 4, name: 'EXO' }]}
          projectRefs={[{ id: 12, name: 'Videoconferencia', code: 'VID', clientId: 4 }]}
        />
      )
    ).toBe('EXO · Videoconferencia');
  });
  it('nombre null → #id; sin proyecto → "Sin proyecto"', () => {
    expect(text(<ClientProjectLabel clientRefs={[{ id: 4, name: null }]} projectRefs={[]} />)).toBe(
      '#4 · Sin proyecto'
    );
  });
  it('ids sin ref → #id', () => {
    expect(text(<ClientProjectLabel clients={[4]} projects={[12]} />)).toBe('#4 · #12');
  });
  it('sin ninguno', () => {
    expect(text(<ClientProjectLabel />)).toBe('Sin cliente · Sin proyecto');
  });
  it('show="client" solo cliente', () => {
    expect(text(<ClientProjectLabel show="client" clientRefs={[{ id: 4, name: 'EXO' }]} />)).toBe(
      'EXO'
    );
    expect(text(<ClientProjectLabel show="client" />)).toBe('Sin cliente');
  });
  it('TS-27: el cliente del documento sale de clientRefs (CA-7)', () => {
    expect(
      text(
        <ClientProjectLabel
          clientRefs={[{ id: 1, name: 'EXO' }]}
          projectRefs={[{ id: 43, name: 'EXO - Videoconferencia', code: 'VID', clientId: 1 }]}
        />
      )
    ).toBe('EXO · EXO - Videoconferencia');
  });
  it('TS-28: no infiere el cliente del proyecto', () => {
    expect(
      text(
        <ClientProjectLabel
          clientRefs={[]}
          projectRefs={[{ id: 43, name: 'EXO - Videoconferencia', code: 'VID', clientId: 1 }]}
        />
      )
    ).toBe('Sin cliente · EXO - Videoconferencia');
  });
});
