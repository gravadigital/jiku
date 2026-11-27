'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/shared/utils/cn';
import styles from './Tooltip.module.scss';

type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

interface TooltipProps {
  /** Texto del tooltip, requerido. Frase corta, sin punto final. */
  readonly content: string;
  readonly placement?: TooltipPlacement;
  /** Retardo de aparición, en ms. */
  readonly delay?: number;
  readonly children: React.ReactNode;
}

const PLACEMENT_CLASS: Record<TooltipPlacement, string> = {
  top: styles.top,
  bottom: styles.bottom,
  left: styles.left,
  right: styles.right,
};

const FOCUSABLE_SELECTOR =
  'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function Tooltip({ content, placement = 'top', delay = 300, children }: TooltipProps) {
  const tooltipId = useId();
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLSpanElement>(null);

  const clearPendingTimeout = () => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const scheduleShow = () => {
    clearPendingTimeout();
    timeoutRef.current = setTimeout(() => setVisible(true), delay);
  };

  const hide = () => {
    clearPendingTimeout();
    setVisible(false);
  };

  useEffect(() => clearPendingTimeout, []);

  // Si el disparador no trae ya un elemento focuseable (un <span>/<div> sin
  // tabIndex propio), el wrapper mismo pasa a serlo: el tooltip DEBE aparecer
  // también con foco de teclado, y un contenedor sin tabIndex nunca lo recibe.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const hasFocusableDescendant = wrapper.querySelector(FOCUSABLE_SELECTOR) !== null;
    if (!hasFocusableDescendant) {
      wrapper.setAttribute('tabindex', '0');
    }
  }, []);

  // El disparador puede ser cualquier elemento (span, div, button) y no se
  // clona ni se toca su ref: en vez de eso, se busca imperativamente el
  // primer elemento focuseable dentro del wrapper (o el wrapper mismo si el
  // hijo no trae ninguno) y se le aplica `aria-describedby` ahí directamente
  // — es ese nodo, y no el wrapper, el que el lector de pantalla anuncia como
  // interactivo.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const target = wrapper.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ?? wrapper;

    if (visible) {
      const existing = target.getAttribute('aria-describedby');
      const ids = new Set((existing ?? '').split(' ').filter(Boolean));
      ids.add(tooltipId);
      target.setAttribute('aria-describedby', Array.from(ids).join(' '));
    } else {
      const existing = target.getAttribute('aria-describedby');
      if (!existing) return;
      const ids = existing.split(' ').filter((id) => id && id !== tooltipId);
      if (ids.length > 0) {
        target.setAttribute('aria-describedby', ids.join(' '));
      } else {
        target.removeAttribute('aria-describedby');
      }
    }
  }, [visible, tooltipId]);

  const handleKeyDown: React.KeyboardEventHandler = (event) => {
    if (event.key === 'Escape' && visible) {
      hide();
    }
  };

  return (
    <span
      ref={wrapperRef}
      className={styles.container}
      onMouseEnter={scheduleShow}
      onMouseLeave={hide}
      onFocus={scheduleShow}
      onBlur={hide}
      onKeyDown={handleKeyDown}
    >
      {children}
      {visible && (
        <span
          id={tooltipId}
          role="tooltip"
          className={cn(styles.tooltip, PLACEMENT_CLASS[placement])}
          onMouseEnter={scheduleShow}
          onMouseLeave={hide}
        >
          {content}
        </span>
      )}
    </span>
  );
}
