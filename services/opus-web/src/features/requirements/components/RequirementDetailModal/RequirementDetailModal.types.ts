export type ActiveTab = 'detalle' | 'actividad';

export interface RequirementDetailModalProps {
  requirementId: number;
  isOpen: boolean;
  onClose: () => void;
  projectName?: string;
}
