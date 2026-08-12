export interface PersonBasic {
  id: number;
  firstName: string;
  lastName: string;
}

export interface ProjectBasic {
  id: number;
  name: string;
  code: string;
}

export interface WeekAllocation {
  id: number;
  personId: number;
  projectId: number;
  minutes: number;
  internal: boolean;
  dateFrom: string;
  dateTo: string;
}

export interface WeekAllocationResponse {
  weekStart: string;
  weekEnd: string;
  allocations: WeekAllocation[];
  persons: PersonBasic[];
  projects: ProjectBasic[];
}

export interface HoursPerDayResponse {
  hoursPerDay: number;
}

export interface WeekAllocationSaveItem {
  personId: number;
  projectId: number;
  minutes: number;
}

export interface WeekAllocationSave {
  weekStart: string;
  allocations: WeekAllocationSaveItem[];
}

export interface WeekAllocationSaveResponse {
  weekStart: string;
  weekEnd: string;
  allocations: WeekAllocation[];
}
