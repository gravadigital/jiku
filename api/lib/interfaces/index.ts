import { Transaction } from 'sequelize';
import { ParsedParams } from './parsed-params';
import { DecodedToken } from './decoded-token';
import { Objective, ObjectiveActivity, ObjectiveSubscriptor, Project, Requirement, RequirementActivity, RequirementSubscriptor, User } from '@jiku/models';


export {};

declare global {
  namespace Express {
    interface Request {
      user: User,
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
