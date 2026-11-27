'use client';

import { Button } from '@/shared/components/ui/Button';

interface SignOutButtonProps {
  readonly action: () => Promise<void>;
}

// El Button del DS es un Client Component: no puede recibir un onClick definido en un
// Server Component como prop (Next.js no serializa funciones a través del límite RSC).
// Este wrapper cliente resuelve el submit del <form action> del padre.
export function SignOutButton({ action }: SignOutButtonProps) {
  return (
    <form action={action}>
      <Button variant="session" onClick={(event) => event.currentTarget.form?.requestSubmit()}>
        Cerrar sesión
      </Button>
    </form>
  );
}
