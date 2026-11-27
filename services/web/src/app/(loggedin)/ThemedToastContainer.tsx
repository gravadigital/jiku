'use client';

// Envoltorio de cliente para el ToastContainer (S-059, TS-38): el layout de (loggedin) es un
// Server Component (el guard de sesión no puede volverse cliente), así que derivar `theme` del
// tema vigente necesita un componente de cliente pequeño alrededor, no convertir el layout.
import { ToastContainer } from 'react-toastify';
import { useTheme } from '@/features/theme';

export function ThemedToastContainer() {
  const { theme } = useTheme();

  return (
    <ToastContainer
      position="top-right"
      autoClose={2000}
      hideProgressBar={false}
      newestOnTop={false}
      closeOnClick
      rtl={false}
      pauseOnFocusLoss
      draggable
      pauseOnHover
      theme={theme}
    />
  );
}
