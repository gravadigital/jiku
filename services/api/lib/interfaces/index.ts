import { Transaction } from 'sequelize';
import { ParsedParams } from './parsed-params';
import { ClaimUser, DecodedToken } from './decoded-token';
import { Objective, ObjectiveActivity, ObjectiveSubscriptor, Project, Requirement, RequirementActivity, RequirementSubscriptor } from '@jiku/models';


export {};

declare global {
  namespace Express {
    interface Request {
      // Desde S-034: armado del claim ya verificado en `validateToken`, no de una fila de
      // `users` (D-6). Ya no es una instancia de Sequelize `User` — ver `ClaimUser`.
      user: ClaimUser,
      project : Project,
      objective: Objective,
      objectiveActivity: ObjectiveActivity[],
      subscription: ObjectiveSubscriptor | RequirementSubscriptor,
      parsedParams: ParsedParams,
      transaction: Transaction,
      token: string,
      decodedToken: DecodedToken,
      decodedTokenRoles: string[],
      data: any,
      requirement: Requirement,
      requirementActivity: RequirementActivity[],
      requirementSubscriptors: RequirementSubscriptor[],
    }
  }
}
