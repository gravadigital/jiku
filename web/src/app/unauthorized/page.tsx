import { signOut } from '@/lib/auth';

export default function UnauthorizedPage() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        gap: '1rem',
        fontFamily: 'var(--font-primary, sans-serif)',
      }}
    >
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Acceso no autorizado</h1>
      <p style={{ color: '#666' }}>Tu cuenta no tiene permisos para acceder a esta aplicación.</p>
      <form
        action={async () => {
          'use server';
          await signOut({ redirectTo: '/login' });
        }}
      >
        <button
          type="submit"
          style={{
            padding: '0.6rem 1.5rem',
            backgroundColor: '#e91e8c',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '1rem',
          }}
        >
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}
