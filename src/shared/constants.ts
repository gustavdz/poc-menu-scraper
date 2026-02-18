export const NPM_LOG_LEVELS = [
  'error',
  'warn',
  'info',
  'http',
  'verbose',
  'debug',
  'silly',
] as const;

type NpmLogLevels = (typeof NPM_LOG_LEVELS)[number];

export const DEFAULT_LOG_LEVEL: NpmLogLevels = 'debug';
export const DEFAULT_TEST_LOG_LEVEL: NpmLogLevels = 'error';

export const DEFAULT_LOG_LEVEL_ENV_KEY = 'LOG_LEVEL';
