import { ArrowLeft, FileQuestion } from 'lucide-react';
import { Button } from '@/shared/components/ui';
import styles from './RequirementUnavailable.module.scss';

interface RequirementUnavailableProps {
  onBack: () => void;
}

const TITLE = 'El requisito no está disponible o no tenés acceso';
const BODY =
  'Puede que no exista o que no tengas permiso para verlo. Si te compartieron este enlace, pedile acceso a tu contacto en el equipo.';

/**
 * Estado "no disponible o sin acceso" (REQ-020 DD-8), compartido por la página de detalle y el
 * modal O-01. No distingue "no existe" de "sin permiso" a propósito. Sin `role="alert"`: es el
 * contenido de la página, no una interrupción. Gap de DS `empty-state` aceptado: componente de feature.
 */
export function RequirementUnavailable({ onBack }: RequirementUnavailableProps) {
  return (
    <section className={styles.container}>
      <FileQuestion size={40} aria-hidden="true" className={styles.icon} />
      <h1 className={styles.title}>{TITLE}</h1>
      <p className={styles.body}>{BODY}</p>
      <Button variant="primary" onClick={onBack} className={styles.backButton}>
        <ArrowLeft size={16} aria-hidden="true" /> Volver al tablero
      </Button>
    </section>
  );
}
