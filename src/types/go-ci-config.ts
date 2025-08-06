import type { ExecutionMode } from './execution-mode.ts';
import type { BreakdownLoggerConfig, LogMode } from './log-mode.ts';

/**
 * Main configuration interface for Go CI
 */
export interface GoCIConfig {
  mode: ExecutionMode;
  batchSize: number;
  enableFallback: boolean;
  logMode: LogMode;
  breakdownLoggerConfig?: BreakdownLoggerConfig;
  stopOnFirstError: boolean;
  continueOnError: boolean;
  testFilter?: string;
  workingDirectory: string;
  hierarchy?: string;
  verbose: boolean;
}
