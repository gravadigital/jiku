export interface ParsedParams {
  count?: boolean;
  sort: [string, string][];
  page: number;
  limit: number;
  search?: string;
  state?: string;
  type?: string;
  personId?: number;
  projectId?: number;
  projectName?: string;
  area?: string;
}
