type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  userId?: string;
  orderId?: string;
  sessionId?: string;
  action?: string;
  [key: string]: unknown;
}

// ANSI color codes
const COLORS = {
  reset: '\x1b[0m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
};

const LEVEL_COLOR: Record<LogLevel, string> = {
  info: COLORS.blue,
  warn: COLORS.yellow,
  error: COLORS.red,
  debug: COLORS.gray,
};

class Logger {
  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` | ${JSON.stringify(context)}` : '';
    const color = LEVEL_COLOR[level] || COLORS.reset;
    const levelStr = `${COLORS.bold}${color}${level.toUpperCase()}${COLORS.reset}`;
    return `${COLORS.gray}[${timestamp}]${COLORS.reset} ${levelStr}: ${message}${contextStr}`;
  }

  debug(message: string, context?: LogContext): void {
    if (process.env.NODE_ENV === 'development') {
      console.log(this.formatMessage('debug', message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    console.log(this.formatMessage('info', message, context));
  }

  warn(message: string, context?: LogContext): void {
    console.warn(this.formatMessage('warn', message, context));
  }

  error(message: string, error?: Error, context?: LogContext): void {
    const errorDetails = error ? ` | Error: ${error.message} | Stack: ${error.stack}` : '';
    console.error(this.formatMessage('error', message + errorDetails, context));
  }

  // Specialized logging methods
  auth(message: string, context?: LogContext): void {
    this.info(`[AUTH] ${message}`, context);
  }

  cart(message: string, context?: LogContext): void {
    this.info(`[CART] ${message}`, context);
  }

  payment(message: string, context?: LogContext): void {
    this.info(`[PAYMENT] ${message}`, context);
  }

  database(message: string, context?: LogContext): void {
    this.info(`[DB] ${message}`, context);
  }
}

export const logger = new Logger(); 