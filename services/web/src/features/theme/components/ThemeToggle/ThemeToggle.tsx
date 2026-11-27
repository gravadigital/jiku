'use client';

// Selector de tema (S-059) — pie de la sidebar, junto a Cerrar sesión.
//
// Reutiliza ToggleGroup variant="segmented" (DS Gaps → Nuevos, resolución del Story Plan de
// S-059): el rol -dos opciones excluyentes, todas visibles, semántica de radios- coincide punto
// por punto con el spec ya normativo de ToggleGroup. No se crea un componente nuevo.
//
// Lee y escribe el tema vía useTheme(); no maneja localStorage por su cuenta (responsabilidad
// del ThemeProvider).

import { ToggleGroup } from '@/shared/components/ui/ToggleGroup';
import { useTheme } from '../../context/ThemeProvider';
import styles from './ThemeToggle.module.scss';
import type { Theme } from '../../types/theme.types';

const THEME_OPTIONS = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className={styles.themeToggle}>
      <span className={styles.label}>Tema</span>
      <ToggleGroup
        variant="segmented"
        label="Tema"
        options={THEME_OPTIONS}
        value={theme}
        onChange={(value) => setTheme(value as Theme)}
      />
    </div>
  );
}
