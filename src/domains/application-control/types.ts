/**
 * Application Control Domain Types
 * Following Totality principle with Smart Constructors and Discriminated Unions
 */

import type { Result } from '../../shared/result.ts';
import { failure, success } from '../../shared/result.ts';
import type { ValidationError } from '../../shared/errors.ts';

/**
 * Application state - Discriminated Union pattern
 */
export type ApplicationState =
  | { type: 'initializing'; startTime: number }
  | { type: 'running'; config: ApplicationConfig; startTime: number }
  | { type: 'shutting-down'; reason: string; exitCode: number }
  | { type: 'terminated'; exitCode: number; duration: number };

/**
 * Execution mode - constrained values
 */
export type ExecutionMode = 'all' | 'batch' | 'single-package';

/**
 * Log level - constrained values
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

/**
 * Application configuration with validation
 */
export interface ApplicationConfig {
  readonly workingDirectory: WorkingDirectory;
  readonly mode: ExecutionMode;
  readonly batchSize: BatchSize;
  readonly timeout: Timeout;
  readonly logLevel: LogLevel;
  readonly verbose: boolean;
  readonly enableFallback: boolean;
}

/**
 * Working directory - Smart Constructor
 */
export class WorkingDirectory {
  private constructor(private readonly path: string) {}

  static create(path: string): Result<WorkingDirectory, ValidationError> {
    if (!path || path.trim().length === 0) {
      return failure({
        kind: 'EmptyInput',
        field: 'workingDirectory',
      });
    }

    const trimmed = path.trim();
    if (!trimmed.startsWith('/') && !trimmed.startsWith('./') && trimmed !== '.') {
      return failure({
        kind: 'InvalidFormat',
        field: 'workingDirectory',
        expected: 'absolute path or relative path starting with ./',
        actual: trimmed,
      });
    }

    return success(new WorkingDirectory(trimmed));
  }

  getValue(): string {
    return this.path;
  }

  get value(): string {
    return this.path;
  }
}

/**
 * Batch size - Smart Constructor with constraints
 */
export class BatchSize {
  private constructor(private readonly size: number) {}

  get value(): number {
    return this.size;
  }

  static create(size: number): Result<BatchSize, ValidationError> {
    if (!Number.isInteger(size)) {
      return failure({
        kind: 'InvalidFormat',
        field: 'batchSize',
        expected: 'integer',
        actual: String(size),
      });
    }

    if (size < 1 || size > 100) {
      return failure({
        kind: 'OutOfRange',
        field: 'batchSize',
        min: 1,
        max: 100,
        value: size,
      });
    }

    return success(new BatchSize(size));
  }

  getValue(): number {
    return this.size;
  }
}

/**
 * Timeout in seconds - Smart Constructor
 */
export class Timeout {
  private constructor(private readonly seconds: number) {}

  get value(): number {
    return this.seconds;
  }

  static create(seconds: number): Result<Timeout, ValidationError> {
    if (!Number.isInteger(seconds)) {
      return failure({
        kind: 'InvalidFormat',
        field: 'timeout',
        expected: 'integer',
        actual: String(seconds),
      });
    }

    if (seconds < 1 || seconds > 3600) {
      return failure({
        kind: 'OutOfRange',
        field: 'timeout',
        min: 1,
        max: 3600,
        value: seconds,
      });
    }

    return success(new Timeout(seconds));
  }

  getValue(): number {
    return this.seconds;
  }

  getMilliseconds(): number {
    return this.seconds * 1000;
  }
}

/**
 * CLI arguments after parsing
 */
export interface ParsedCliArgs {
  readonly command?: string;
  readonly workingDirectory: string;
  readonly mode: ExecutionMode;
  readonly batchSize: number;
  readonly timeout: number;
  readonly logLevel: LogLevel;
  readonly verbose: boolean;
  readonly enableFallback: boolean;
  readonly help: boolean;
  readonly version: boolean;
}

/**
 * State transition rules
 */
export const isValidStateTransition = (
  from: ApplicationState['type'],
  to: ApplicationState['type'],
): boolean => {
  const validTransitions: Record<ApplicationState['type'], ApplicationState['type'][]> = {
    'initializing': ['running', 'terminated'],
    'running': ['shutting-down', 'terminated'],
    'shutting-down': ['terminated'],
    'terminated': [],
  };

  return validTransitions[from].includes(to);
};
