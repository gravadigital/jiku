import React from 'react';

type IconName = 'search' | 'folder' | 'users' | 'user' | 'filter' | 'close';

const PATHS: Record<IconName, string> = {
  search: 'M7 12.5a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11Zm4-1.5 3.5 3.5',
  folder: 'M1.5 4.5a1 1 0 0 1 1-1H6l1.5 1.5h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-7.5Z',
  users:
    'M6 7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM1.5 13.5c0-2.2 2-3.5 4.5-3.5s4.5 1.3 4.5 3.5M11 3a2.2 2.2 0 0 1 0 4.4M12 10.2c1.5.4 2.5 1.5 2.5 3.3',
  user: 'M8 7.5a2.7 2.7 0 1 0 0-5.4 2.7 2.7 0 0 0 0 5.4ZM2.5 14c0-2.4 2.4-4 5.5-4s5.5 1.6 5.5 4',
  filter: 'M2 3.5h12L9.5 9v4l-3 1.5V9L2 3.5Z',
  close: 'm4 4 8 8m0-8-8 8',
};

// Decorativos: el significado lo lleva el texto de la opción.
export function Icon({ name, size = 16 }: { readonly name: IconName; readonly size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={PATHS[name]}
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
