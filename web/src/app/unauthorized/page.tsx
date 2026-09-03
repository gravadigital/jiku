import { signOut } from '@/lib/auth';
import { SignOutButton } from './SignOutButton';
import styles from './styles.module.scss';

export default function UnauthorizedPage() {
  const handleSignOut = async () => {
    'use server';
    await signOut({ redirectTo: '/login' });
  };

  return (
    <main className={styles.container}>
      <h1 className={styles.title}>Acceso no autorizado</h1>
      <p className={styles.message}>Tu cuenta no tiene permisos para acceder a esta aplicación.</p>
      <SignOutButton action={handleSignOut} />
    </main>
  );
}
