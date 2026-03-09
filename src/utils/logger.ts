import pino from 'pino';

const isDevelopment = process.env.NODE_ENV !== 'production';

const logger = isDevelopment
  ? pino({
      level: process.env.LOG_LEVEL || 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:HH:MM:ss',
          ignore: 'pid,hostname',
        },
      },
    })
  : pino(
      {
        level: process.env.LOG_LEVEL || 'warn',
      },
      pino.destination(2),
    );

export default logger;
