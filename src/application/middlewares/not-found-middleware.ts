import { type NextFunction, type Request, type Response } from 'express';
import { logger } from '../../shared/logger';

export const notFound = (req: Request, res: Response, _next: NextFunction): void => {
  logger.warn(`Not Found - ${req.method} request on ${req.originalUrl}`);
  const error = {
    status: 404,
    message: `Not Found`,
  };
  res.status(404).json(error);
};
