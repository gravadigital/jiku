'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

interface SidebarContextValue {
  isOpen: boolean;
  isCollapsed: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  collapse: () => void;
  expand: () => void;
  toggleCollapse: () => void;
}

// Context
const SidebarContext = createContext<SidebarContextValue | null>(null);

// Provider Props
interface SidebarProviderProps {
  readonly children: React.ReactNode;
  readonly defaultOpen?: boolean;
  readonly defaultCollapsed?: boolean;
}

// Provider Component
function SidebarProvider({
  children,
  defaultOpen = true,
  defaultCollapsed = false,
}: SidebarProviderProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  const collapse = useCallback(() => setIsCollapsed(true), []);
  const expand = useCallback(() => setIsCollapsed(false), []);
  const toggleCollapse = useCallback(() => setIsCollapsed((prev) => !prev), []);

  const value = useMemo<SidebarContextValue>(
    () => ({
      isOpen,
      isCollapsed,
      open,
      close,
      toggle,
      collapse,
      expand,
      toggleCollapse,
    }),
    [isOpen, isCollapsed, open, close, toggle, collapse, expand, toggleCollapse]
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

// Hook
function useSidebar() {
  const context = useContext(SidebarContext);

  if (!context) {
    throw new Error('useSidebar debe ser usado dentro de un SidebarProvider');
  }

  return context;
}

// Hook opcional (sin throw)
function useSidebarOptional() {
  return useContext(SidebarContext);
}

export { SidebarProvider, useSidebar, useSidebarOptional };
