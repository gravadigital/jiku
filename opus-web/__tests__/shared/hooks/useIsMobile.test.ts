import { renderHook, act } from '@testing-library/react';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { vi } from 'vitest';

describe('useIsMobile', () => {
  const originalInnerWidth = window.innerWidth;

  function setWindowWidth(width: number) {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: width,
    });
  }

  afterEach(() => {
    setWindowWidth(originalInnerWidth);
  });

  it('retorna false inicialmente (SSR safe)', () => {
    setWindowWidth(1024);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it('retorna true cuando el ancho de ventana es menor a 768', () => {
    setWindowWidth(500);
    const { result } = renderHook(() => useIsMobile());
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(result.current).toBe(true);
  });

  it('retorna false cuando el ancho de ventana es mayor o igual a 768', () => {
    setWindowWidth(1024);
    const { result } = renderHook(() => useIsMobile());
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(result.current).toBe(false);
  });

  it('retorna true exactamente en 767px', () => {
    setWindowWidth(767);
    const { result } = renderHook(() => useIsMobile());
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(result.current).toBe(true);
  });

  it('retorna false exactamente en 768px', () => {
    setWindowWidth(768);
    const { result } = renderHook(() => useIsMobile());
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(result.current).toBe(false);
  });

  it('actualiza el valor cuando cambia el tamaño de la ventana', () => {
    setWindowWidth(1024);
    const { result } = renderHook(() => useIsMobile());

    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(result.current).toBe(false);

    act(() => {
      setWindowWidth(500);
      window.dispatchEvent(new Event('resize'));
    });
    expect(result.current).toBe(true);

    act(() => {
      setWindowWidth(1024);
      window.dispatchEvent(new Event('resize'));
    });
    expect(result.current).toBe(false);
  });

  it('limpia el event listener al desmontarse', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useIsMobile());
    unmount();
    expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    removeEventListenerSpy.mockRestore();
  });
});
