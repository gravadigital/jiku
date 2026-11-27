'use client';

// Provider de tema (S-059). Mantiene el tema vigente, lo estampa en <html> y lo persiste
// (localStorage + cookie reflejo), sin ningún request a `api`, Server Action, mutación ni
// invalidación de TanStack Query — la preferencia de tema es estado local de UI, no de dominio.
//
// Sigue el mismo patrón que ProjectContext/SidebarContext (src/contexts/): createContext<T | null>
// con default null, provider como function declaration, acciones en useCallback, value en
// useMemo, y dos hooks — el que lanza (useTheme) y el opcional (useThemeOptional).
//
// A diferencia de ProjectContext (que escribe localStorage sin guarda y nunca lo lee al montar),
// este provider SÍ reconcilia con el storage al montar, pero sólo cuando difiere de initialTheme
// (el que el servidor ya estampó) — leerlo incondicionalmente produciría un parpadeo en el caso
// normal donde cookie y storage coinciden.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { THEME_STORAGE_KEY, type Theme } from '../types/theme.types';
import { persistTheme, resolveTheme } from '../utils/themeStorage';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
  readonly children: React.ReactNode;
  /** Tema ya estampado por el servidor (T4), leído de la cookie reflejo. */
  readonly initialTheme: Theme;
}

function applyThemeAttribute(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

function ThemeProvider({ children, initialTheme }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);

  // Reconciliación: sólo si HAY un valor persistido y difiere de lo que el servidor ya estampó
  // (p. ej. la cookie no llegó a escribirse a tiempo, o el navegador la bloqueó pero localStorage
  // sí funciona). Se lee el valor crudo (no readStoredTheme(), que ya normaliza "ausente" al
  // default) para no confundir "no hay nada guardado" con "se guardó explícitamente 'light'": lo
  // primero no debe pisar un initialTheme='dark' que el servidor ya resolvió correctamente.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (raw === null) {
        return;
      }
      const stored = resolveTheme(raw);
      if (stored !== initialTheme) {
        setThemeState(stored);
        applyThemeAttribute(stored);
      }
    } catch {
      // localStorage no disponible: se queda con initialTheme, ya estampado por el servidor.
    }
    // Sólo en el montaje: initialTheme es el valor con el que el servidor ya renderizó.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    applyThemeAttribute(next);
    persistTheme(next);
  }, []);

  const value = useMemo<ThemeContextValue>(() => ({ theme, setTheme }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme debe usarse dentro de ThemeProvider');
  }

  return context;
}

function useThemeOptional(): ThemeContextValue | null {
  return useContext(ThemeContext);
}

export { ThemeProvider, useTheme, useThemeOptional };
