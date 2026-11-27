'use client';

import { useSessionMonitor } from '@/hooks/use-session-monitor';

export function SessionMonitor() {
  useSessionMonitor();
  return null;
}
