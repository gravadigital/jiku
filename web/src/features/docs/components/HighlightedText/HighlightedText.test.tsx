import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HighlightedText } from './HighlightedText';

describe('HighlightedText', () => {
  it('marca la coincidencia sin distinguir acentos ni caja', () => {
    const { container } = render(<HighlightedText text="Videoconferencia" q="vid" />);
    expect(container.querySelector('mark')?.textContent).toBe('Vid');
    expect(container.textContent).toBe('Videoconferencia');
  });
  it('nunca interpreta HTML', () => {
    const { container } = render(<HighlightedText text="<img src=x onerror=alert(1)>" q="zz" />);
    expect(container.querySelector('img')).toBeNull();
  });
});
