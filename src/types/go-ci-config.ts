import type { ExecutionMode } from './execution-mode.ts';
import type { BreakdownLoggerConfig, LogMode } from './log-mode.ts';

/**
 * Configuration for the Go CI runner
 */
export interface GoCIConfig {
  readonly mode: ExecutionMode;
  readonly batchSize: number;
  readonly enableFallback: boolean;
  readonly logMode?: LogMode;
  readonly breakdownLoggerConfig?: BreakdownLoggerConfig;
  readonly stopOnFirstError: boolean;
  readonly continueOnError: boolean;
  readonly testFilter?: string;
  readonly workingDirectory: string;
  readonly hierarchy?: string;
  readonly verbose: boolean;
}
