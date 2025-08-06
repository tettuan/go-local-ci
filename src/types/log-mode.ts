/**
 * Log mode types and configurations
 */
export type LogMode = 'normal' | 'silent' | 'debug' | 'error-files-only';

export interface BreakdownLoggerConfig {
  key: string;
  length: 'W' | 'M' | 'L';
}
