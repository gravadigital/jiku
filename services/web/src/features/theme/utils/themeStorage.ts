// Funciones puras de persistencia del tema (S-059).
//
// Toda la persistencia es del navegador: localStorage + una cookie reflejo (no de sesión), para
// que el layout raíz pueda estampar `data-theme` desde el servidor en el próximo render (T4).
// No hay request a `api`, no hay Server Action, no hay mutación ni invalidación de TanStack
// Query. Separadas del componente para poder testearlas sin render y para que el degradado ante
// localStorage ausente/corrupto sea verificable.

import { THEME_STORAGE_KEY, type Theme } from '../types/theme.types';

const DEFAULT_THEME: Theme = 'light';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // un año

/**
 * Normaliza cualquier valor a un Theme válido. Cualquier valor que no sea exactamente
 * 'dark' o 'light' cae al default ('light').
 */
export function resolveTheme(value: unknown): Theme {
  return value === 'dark' || value === 'light' ? value : DEFAULT_THEME;
}

/**
 * Lee el tema persistido en localStorage con la clave exacta jiku.theme. Devuelve el default
 * ('light') si no hay valor, si el valor es inválido, o si el acceso a localStorage lanza
 * (modo privado, cuota agotada).
 */
export function readStoredTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return resolveTheme(stored);
  } catch {
    return DEFAULT_THEME;
  }
}

/**
 * Persiste el tema en localStorage y en una cookie reflejo (jiku.theme), para que el servidor
 * pueda leerla en el próximo render. Cada acceso va en su propio try/catch: si localStorage
 * lanza, la cookie se escribe igual — perder la cookie perdería el estampado sin destello del
 * próximo render (CA-3).
 */
export function persistTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ausencia o cuota agotada de localStorage no debe impedir que la cookie se escriba.
  }

  try {
    document.cookie = `${THEME_STORAGE_KEY}=${theme}; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
  } catch {
    // document.cookie no debería lanzar en un navegador real; degradar sin romper el render.
  }
}
