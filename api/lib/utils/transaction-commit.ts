import { NextFunction, Request, Response } from 'express';
import { Transaction } from 'sequelize';
import logger from '../logger';

function commitTransaction(req: Request, res: Response, next: NextFunction) {
  const transaction: Transaction = req.transaction;

  return transaction.commit()
    .then(() => {
      return next();
    })
    .catch((error: Error) => {
      logger.error(`commitTransaction error: ${error.message}`);
      return transaction.rollback()
        .then(() => {
          return res.status(500).json({
            code: 'internal_error',
            message: 'Internal error',
          });
        });
    });
}

export default commitTransaction;
