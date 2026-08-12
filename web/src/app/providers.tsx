'use client';
import { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { SessionProvider } from 'next-auth/react';
import { ProjectProvider, SidebarProvider } from '@/contexts';
import { getQueryClient } from '@/lib/queryClient';

interface Props {
  readonly children: ReactNode;
}

export default function Providers({ children }: Props) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider refetchInterval={0} refetchOnWindowFocus={false}>
        <ProjectProvider>
          <SidebarProvider>{children}</SidebarProvider>
        </ProjectProvider>
      </SessionProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
