'use client';
import { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { SessionProvider } from 'next-auth/react';
import { ProjectProvider, SidebarProvider } from '@/contexts';
import { ThemeProvider, type Theme } from '@/features/theme';
import { getQueryClient } from '@/lib/queryClient';

interface Props {
  readonly children: ReactNode;
  /** Tema ya estampado por el servidor (layout raíz), leído de la cookie reflejo. */
  readonly initialTheme: Theme;
}

export default function Providers({ children, initialTheme }: Props) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider refetchInterval={0} refetchOnWindowFocus={false}>
        <ThemeProvider initialTheme={initialTheme}>
          <ProjectProvider>
            <SidebarProvider>{children}</SidebarProvider>
          </ProjectProvider>
        </ThemeProvider>
      </SessionProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
