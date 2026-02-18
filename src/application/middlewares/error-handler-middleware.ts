import { type NextFunction, type Request, type Response } from 'express';
import { logger } from '../../shared/logger';

export const errorHandler = (err: Error, _req: Request, res: Response, _next: NextFunction) => {
  const { message } = err;
  const statusCode = 500;

  logger.error(message, { statusCode });

  res.status(statusCode).json({
    message,
  });
};
