// Simple frontend logger for React apps
// Usage: import { logger } from "../lib/logger.client";

const color = {
  info: 'color: #2563eb; font-weight: bold', // blue
  warn: 'color: #f59e42; font-weight: bold', // orange
  error: 'color: #dc2626; font-weight: bold', // red
  debug: 'color: #64748b; font-weight: bold', // gray
};

export const logger = {
  info: (msg: string, ...args: unknown[]) => {
    console.info(`%c[INFO] ${msg}`, color.info, ...args);
  },
  warn: (msg: string, ...args: unknown[]) => {
    console.warn(`%c[WARN] ${msg}`, color.warn, ...args);
  },
  error: (msg: string, ...args: unknown[]) => {
    console.error(`%c[ERROR] ${msg}`, color.error, ...args);
  },
  debug: (msg: string, ...args: unknown[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`%c[DEBUG] ${msg}`, color.debug, ...args);
    }
  },
}; 