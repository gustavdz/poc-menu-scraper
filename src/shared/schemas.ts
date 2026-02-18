import { z } from 'zod';
import { NPM_LOG_LEVELS } from './constants';

export const NpmLogLevelSchema = z.enum([...NPM_LOG_LEVELS]);

export const ScrapeRequestSchema = z.object({
  urls: z.array(z.string()),
});

export const EnvSchema = z.object({
  GEMINI_API_KEY: z.string().min(1),
  LOG_LEVEL: NpmLogLevelSchema,
});
