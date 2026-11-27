import { Request, Response, NextFunction } from 'express';
import { ParsedParams } from 'interfaces/parsed-params';

interface QueryParams {
  count?: boolean;
  sort?: string;
  page?: number;
  limit?: number;
  search?: string;
  state?: string;
  area?: string;
  type?: string;
  personId?: number;
  projectId?: number;
  projectName?: string;
}

function parseSort(params: QueryParams): [string, string][] {
  let sortBy = '-createdAt';

  if (params.sort) {
    sortBy = params.sort;
  }

  if (sortBy.slice(0, 1) === '-') {
    return [[sortBy.slice(1), 'DESC']];
  }
  return [[sortBy, 'ASC']];
}

function parsePage(params: QueryParams): number {
  return params.page && Number(params.page) >= 1 ? Number(params.page) : 1;
}

function parseLimit(params: QueryParams): number {
  return params.limit && Number(params.limit) > 0 && Number(params.limit) <= 30 ? Number(params.limit) : 200;
}

function parseGetParams(): (req: Request, _res: Response, next: NextFunction) => void {
  return (req: Request, _res: Response, next: NextFunction) => {
    const queryParams: QueryParams = req.query as QueryParams;
    const sort = parseSort(queryParams);
    const limit = parseLimit(queryParams);
    const page = parsePage(queryParams);

    const parsedParams: ParsedParams = {
      sort,
      page,
      limit,
      count: queryParams.count || false,
      search: queryParams.search || '',
      state: queryParams.state || '',
      area: queryParams.area || '',
      type: queryParams.type || '',
      personId: queryParams.personId,
      projectId: queryParams.projectId,
      projectName: queryParams.projectName || ''
    };

    req.parsedParams = parsedParams;
    return next();
  };
}


export default parseGetParams;
