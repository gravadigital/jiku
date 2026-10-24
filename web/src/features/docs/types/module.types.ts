// Verbatim de docs/apis/api.yaml#/components/schemas/ModulesResponse (REQ-016, R-8).
export type ModuleStatus = 'not_installed' | 'unavailable' | 'available';

export interface ModuleState {
  module: string;
  status: ModuleStatus;
  /** Se omite con `not_installed`. */
  features?: { sharing?: boolean };
}
