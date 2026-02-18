import { config, createLogger, format, transports } from 'winston';
import { DEFAULT_LOG_LEVEL_ENV_KEY, DEFAULT_LOG_LEVEL, DEFAULT_TEST_LOG_LEVEL } from './constants';
import { NpmLogLevel } from './types';
import { NpmLogLevelSchema } from './schemas';

const isTest = () =>
  process.env.JEST_WORKER_ID !== undefined || process.env.VITEST_WORKER_ID !== undefined;

const baseFormats = [format.timestamp(), format.json()];

const devFormats = [
  // format.prettyPrint(),
  format.colorize({ all: true }),
  format.errors({ stack: true }),
];

const formats = [...baseFormats, ...devFormats];

const logDefault = isTest() ? DEFAULT_TEST_LOG_LEVEL : DEFAULT_LOG_LEVEL;

const level: NpmLogLevel = NpmLogLevelSchema.default(logDefault)
  .catch(logDefault)
  .parse(process.env[DEFAULT_LOG_LEVEL_ENV_KEY]);

export const logger = createLogger({
  levels: config.npm.levels,
  level,
  format: format.combine(...formats),
  transports: [new transports.Console()],
});
