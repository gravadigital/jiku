import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SearchSnippet } from './SearchSnippet';

describe('SearchSnippet (TS-21c)', () => {
  it('marca la coincidencia y deja el HTML ajeno como texto', () => {
    const { container } = render(
      <SearchSnippet snippet="<img src=x onerror=alert(1)> despliegue" q="despliegue" />
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(container.querySelector('mark')).toHaveTextContent('despliegue');
  });

  it('convierte las marcas <b> en <mark>', () => {
    const { container } = render(<SearchSnippet snippet="pasos de <b>despliegue</b>" q="x" />);
    expect(container.querySelector('mark')).toHaveTextContent('despliegue');
    expect(container.querySelector('b')).toBeNull();
  });
});
