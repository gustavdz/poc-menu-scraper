import 'dotenv/config';
import express from 'express';
import { errorHandler, getDefaultMiddlewares, notFound } from './middlewares';
import scrapeRoutes from './routers/scrape-router.ts';
import { EnvSchema } from '../shared/schemas.ts';

const app = express();

app.use(getDefaultMiddlewares());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/ready', async (_req, res) => {
  const envParsed = EnvSchema.safeParse(process.env);
  if (!envParsed.success) {
    res.status(500).json({
      message: 'Missing config error',
      errors: envParsed.error.issues,
    });
    return;
  }

  res.json({
    message: 'Service is ready',
  });
});

// prevent the endpoint favicon.ico from being treated as a real endpoint
app.get('/favicon.ico', (_req, res) => res.status(204).end());
app.use(scrapeRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
