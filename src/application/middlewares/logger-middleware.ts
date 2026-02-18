import { type NextFunction, type Request, type Response } from 'express';
import { logger } from '../../shared/logger';

export const loggerMiddleware = (req: Request, _res: Response, next: NextFunction) => {
  logger.info(`${req.method} request on ${req.url}`, {
    remoteIp: req.ip,
    userAgent: req.get('User-Agent'),
  });

  next();
};
