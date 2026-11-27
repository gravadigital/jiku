// Tipos y constantes del módulo de tema (S-059).
//
// La preferencia de tema se persiste SOLO en el navegador: localStorage + una cookie reflejo,
// nunca en el dominio (no hay request a `api`, no hay Server Action). THEME_STORAGE_KEY es la
// única fuente de verdad para el nombre de la clave/cookie: declararla una vez acá y consumirla
// desde los dos lados evita que se desincronicen por un literal duplicado.

export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'jiku.theme';
