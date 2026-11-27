import { NextFunction, Request, Response } from 'express';


export default function hasAnyRole(roles: Array<string>) {
  return function(req: Request, res: Response, next: NextFunction) {
    const validRole = req.decodedTokenRoles.find((role) => {
      return roles.includes(role);
    });

    if (!validRole) {
      return res.status(403).json({
        code: 'access_denied',
        message: 'Access denied'
      });
    }
    return next();
  };
}
