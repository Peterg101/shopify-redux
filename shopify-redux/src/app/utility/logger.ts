const isProduction = process.env.NODE_ENV === 'production';

const logger = {
  error: (...args: unknown[]) => {
    if (!isProduction) console.error(...args);
  },
  warn: (...args: unknown[]) => {
    if (!isProduction) console.warn(...args);
  },
  info: (...args: unknown[]) => {
    if (!isProduction) console.info(...args);
  },
  log: (...args: unknown[]) => {
    if (!isProduction) console.log(...args);
  },
};

export default logger;
