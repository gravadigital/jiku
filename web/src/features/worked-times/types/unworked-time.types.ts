export interface UnworkedTimeReason {
  value: string;
  label: string;
}

export interface UnworkedTime {
  id: number;
  date: string;
  minutes: number;
  reason: string;
  personId: number;
  createdAt: string;
}

export interface UnworkedTimeCreate {
  date: string;
  minutes: number;
  reason: string;
  personId?: number;
}

export interface UnworkedTimeReportEntry {
  id: number;
  minutes: number;
  reason: string;
}

export interface UnworkedTimeReportDay {
  date: string;
  totalMinutes: number;
  entries: UnworkedTimeReportEntry[];
}
