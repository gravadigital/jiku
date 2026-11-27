import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/features/theme';
import { ThemedToastContainer } from './ThemedToastContainer';

const toastContainerProps: Record<string, unknown>[] = [];

vi.mock('react-toastify', () => ({
  ToastContainer: (props: Record<string, unknown>) => {
    toastContainerProps.push(props);
    return null;
  },
}));

describe('ThemedToastContainer (S-059 TS-38)', () => {
  it('con tema dark, el ToastContainer recibe theme="dark", no "light" fijo', () => {
    toastContainerProps.length = 0;
    render(
      <ThemeProvider initialTheme="dark">
        <ThemedToastContainer />
      </ThemeProvider>
    );

    expect(toastContainerProps[0]?.theme).toBe('dark');
  });

  it('con tema light, el ToastContainer recibe theme="light"', () => {
    toastContainerProps.length = 0;
    render(
      <ThemeProvider initialTheme="light">
        <ThemedToastContainer />
      </ThemeProvider>
    );

    expect(toastContainerProps[0]?.theme).toBe('light');
  });
});
