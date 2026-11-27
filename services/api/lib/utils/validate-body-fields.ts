import { NextFunction, Request, Response } from 'express';

export default function validateBodyFields(validationSchema: any) {
  return (req: Request, res: Response, next: NextFunction) => {
    const {error} = validationSchema.validate(req.body);
    if (error) {
      const firstError = error.details[0].message;
      return res.status(400).json({
        code: 'invalid_fields',
        message: `Invalid field - ${firstError}`
      });
    }
    return next();
  };
}
