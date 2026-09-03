import { afterEach, describe, expect, it, vi } from 'vitest';
import { THEME_STORAGE_KEY } from '../types/theme.types';
import { persistTheme, readStoredTheme, resolveTheme } from './themeStorage';

function clearCookies() {
  document.cookie.split(';').forEach((cookie) => {
    const name = cookie.split('=')[0]?.trim();
    if (name) {
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    }
  });
}

describe('resolveTheme', () => {
  // TS-9
  it('acepta los dos valores válidos', () => {
    expect(resolveTheme('dark')).toBe('dark');
    expect(resolveTheme('light')).toBe('light');
  });

  // TS-10
  it('cae al default (light) con cualquier valor inválido', () => {
    expect(resolveTheme('purple')).toBe('light');
    expect(resolveTheme('')).toBe('light');
    expect(resolveTheme(null)).toBe('light');
    expect(resolveTheme(undefined)).toBe('light');
  });
});

describe('readStoredTheme', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  // TS-11
  it('lee localStorage con la clave exacta jiku.theme', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    expect(readStoredTheme()).toBe('dark');
  });

  // TS-12
  it('no rompe si localStorage lanza al leer', () => {
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('QuotaExceededError');
      },
    });

    expect(() => readStoredTheme()).not.toThrow();
    expect(readStoredTheme()).toBe('light');

    if (original) {
      Object.defineProperty(window, 'localStorage', original);
    }
  });

  // TS-13
  it('ignora un valor corrupto persistido', () => {
    localStorage.setItem(THEME_STORAGE_KEY, '{"a":1}');
    expect(readStoredTheme()).toBe('light');
  });

  it('devuelve light si no hay ningún valor guardado', () => {
    expect(readStoredTheme()).toBe('light');
  });
});

describe('persistTheme', () => {
  afterEach(() => {
    localStorage.clear();
    clearCookies();
    vi.restoreAllMocks();
  });

  // TS-14
  it('escribe localStorage y la cookie reflejo', () => {
    persistTheme('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(document.cookie).toContain(`${THEME_STORAGE_KEY}=dark`);
  });

  // TS-15
  it('la cookie reflejo no es de sesión: Max-Age de un año, Path=/, SameSite=Lax, sin HttpOnly', () => {
    const setter = vi.spyOn(document, 'cookie', 'set');
    persistTheme('dark');

    expect(setter).toHaveBeenCalled();
    const written = setter.mock.calls[0][0];
    expect(written).toContain('Max-Age=31536000');
    expect(written).toContain('Path=/');
    expect(written).toContain('SameSite=Lax');
    expect(written).not.toContain('HttpOnly');
  });

  // TS-16
  it('no rompe si localStorage lanza al escribir; la cookie se escribe igual', () => {
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        return {
          setItem() {
            throw new DOMException('QuotaExceededError');
          },
          getItem() {
            return null;
          },
        };
      },
    });

    expect(() => persistTheme('dark')).not.toThrow();
    expect(document.cookie).toContain(`${THEME_STORAGE_KEY}=dark`);

    if (original) {
      Object.defineProperty(window, 'localStorage', original);
    }
  });
});
