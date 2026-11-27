import { NextFunction, Request, Response } from 'express';
import { sequelize } from '../models';
import logger from '../logger';

function startTransaction(req: Request, res: Response, next: NextFunction) {
  return sequelize.transaction()
    .then((transaction) => {
      req.transaction = transaction;
      return next();
    })
    .catch((error) => {
      logger.error(`startTransaction error: ${error.message}`);
      return res.status(500).json({
        code: 'internal_error',
        message: 'internal_error',
      });
    });
}

export default startTransaction;
