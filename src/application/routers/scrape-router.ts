import { Router } from 'express';
// import { scrapeUrl } from '../services/html-scraper.ts';
import { scrapeUrl } from '../services/html-scraper-gemini.ts';
import { ScrapeResponse } from '../../shared/types.ts';
import { ScrapeRequestSchema } from '../../shared/schemas.ts';
import { logger } from '../../shared/logger.ts';

const router = Router();

router.post('/', async (req, res, next) => {
  try {
    const bodyParsed = ScrapeRequestSchema.safeParse(req.body);
    if (!bodyParsed.success) {
      return res.status(400).json({
        error: bodyParsed.error,
      });
    }

    const { urls } = bodyParsed.data;

    const results = await Promise.allSettled(
      urls.map(async (url) => {
        try {
          const data = await scrapeUrl(url);
          return { url, success: true, data };
        } catch (error) {
          logger.error('scrapping failed', {
            error: error instanceof Error ? error.message : error,
          });
          return {
            url,
            success: false,
            error,
          };
        }
      }),
    );

    const response: ScrapeResponse = {
      results: results.map((r) => (r.status === 'fulfilled' ? r.value : r.reason)),
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

export default router;
