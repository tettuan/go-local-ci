/**
 * Log modes for the Go CI runner
 */
export interface LogMode {
  readonly name: string;
  readonly level: 'silent' | 'normal' | 'debug' | 'error-files-only';
  readonly showProgress: boolean;
  readonly showErrors: boolean;
  readonly showDebug: boolean;
}

/**
 * Breakdown logger configuration
 */
export interface BreakdownLoggerConfig {
  readonly key: string;
  readonly length: 'W' | 'M' | 'L';
}
