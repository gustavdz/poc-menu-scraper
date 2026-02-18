import cors from 'cors';
import { json } from 'express';
import helmet from 'helmet';
import { loggerMiddleware } from './logger-middleware.ts';

export const getDefaultMiddlewares = () => [
  helmet(),
  cors({ allowedHeaders: ['Content-Type'] }),
  json(),
  loggerMiddleware,
];
