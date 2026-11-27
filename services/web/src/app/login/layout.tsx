import React from 'react';
import styles from './styles.module.scss';

export default function Layout({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className={styles.container}>
      <div className={styles.left}>{children}</div>
      {/* El panel es decorativo: su texto es de marca, no instrucciones de la pantalla. Va en el
          layout y no en la página para que el copy no compita con el h1 del formulario. */}
      <aside className={styles.right}>
        <p className={styles.panelTitle}>El eje es el proyecto</p>
        <p className={styles.panelLead}>
          Todo lo que el equipo hace —requisitos, tareas, horas— cuelga de un proyecto. Jiku es el
          lugar donde eso se ve junto.
        </p>
      </aside>
    </div>
  );
}
