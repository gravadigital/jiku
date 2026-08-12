'use client';
import { useEffect } from 'react';

export function ScrollToProject() {
  useEffect(() => {
    if (window.location.hash) {
      const projectId = window.location.hash.substring(1);
      const element = document.getElementById(projectId);

      if (element) {
        setTimeout(() => {
          element.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
        }, 100);
      }
    }
  }, []);

  return null;
}
