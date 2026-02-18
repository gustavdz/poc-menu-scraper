import app from './application/app.ts';
import { logger } from './shared/logger.ts';

const SignalsEnum = {
  SIGTERM: 'SIGTERM',
  SIGINT: 'SIGINT',
} as const;

type SignalsEnumType = (typeof SignalsEnum)[keyof typeof SignalsEnum];

const init = () => {
  const server = app.listen(3333, () => {
    logger.info(`Listening at http://localhost:${3333}`);
  });

  server.on('error', () => {
    logger.error('Error starting server');
    process.exit(1);
  });

  server.keepAliveTimeout = 351 * 1000;
  server.headersTimeout = 355 * 1000;

  // Graceful shutdown
  const shutdown = (signal: SignalsEnumType) => {
    logger.warn('Shutdown initiated...', { signal });
    try {
      server.close(() => {
        logger.info('HTTP server closed gracefully.', { signal });
        process.exit(0);
      });

      //force the shutdown after timeout
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down', { signal });
        process.exit(1);
      }, 30000);
    } catch (error) {
      logger.error('Error during shutdown', { signal, error });
      process.exit(1);
    }
  };

  // Listen for termination signals
  process.once(SignalsEnum.SIGTERM, () => shutdown(SignalsEnum.SIGTERM));
  process.once(SignalsEnum.SIGINT, () => shutdown(SignalsEnum.SIGINT));
};

init();
