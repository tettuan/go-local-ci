/**
 * CLI Parser following Totality principle
 * No side effects, returns Result types
 */

import { parseArgs } from '../../deps.ts';
import type { Result } from '../../shared/result.ts';
import { failure, success } from '../../shared/result.ts';
import type { AppError } from '../../shared/errors.ts';
import { createUnexpectedError } from '../../shared/errors.ts';
import type { ExecutionMode, LogLevel, ParsedCliArgs } from './types.ts';

/**
 * Help text content (pure data, no side effects)
 */
export const HELP_TEXT = `
Go CI - Efficient CI tool for Go projects

Usage: go-ci [options]

Options:
  --working-directory, -w   Working directory (default: current directory)
  --mode, -m               Execution mode: all, batch, single-package (default: all)
  --batch-size, -b         Number of packages per batch (default: 5)
  --timeout, -t            Timeout in seconds (default: 300)
  --log-level, -l          Log level: debug, info, warn, error, silent (default: info)
  --verbose, -v            Enable verbose output
  --enable-fallback, -f    Enable fallback on errors
  --help, -h               Show this help message
  --version                Show version information

Examples:
  go-ci                    Run all tests
  go-ci -m batch -b 10    Run tests in batches of 10
  go-ci -w ./pkg -v       Run tests in ./pkg with verbose output
`;

/**
 * Version information (pure data)
 */
export const VERSION_INFO = '1.0.0';

/**
 * Default values
 */
const DEFAULTS: Readonly<ParsedCliArgs> = {
  workingDirectory: '.',
  mode: 'all',
  batchSize: 5,
  timeout: 300,
  logLevel: 'info',
  verbose: false,
  enableFallback: false,
  help: false,
  version: false,
};

/**
 * Parse CLI arguments into structured data
 * Total function - returns Result instead of throwing
 */
export const parseCli = (args: string[]): Result<ParsedCliArgs, AppError> => {
  try {
    const parsed = parseArgs(args, {
      alias: {
        'w': 'working-directory',
        'm': 'mode',
        'b': 'batch-size',
        't': 'timeout',
        'l': 'log-level',
        'v': 'verbose',
        'f': 'enable-fallback',
        'h': 'help',
      },
      boolean: ['verbose', 'enable-fallback', 'help', 'version'],
      string: ['working-directory', 'mode', 'log-level'],
      default: {
        'working-directory': DEFAULTS.workingDirectory,
        'mode': DEFAULTS.mode,
        'batch-size': DEFAULTS.batchSize,
        'timeout': DEFAULTS.timeout,
        'log-level': DEFAULTS.logLevel,
        'verbose': DEFAULTS.verbose,
        'enable-fallback': DEFAULTS.enableFallback,
      },
    });

    // Validate and transform parsed arguments
    const mode = validateExecutionMode(parsed.mode as string);
    if (!mode.ok) {
      throw new Error(`Invalid mode: ${parsed.mode}`);
    }

    const logLevel = validateLogLevel(parsed['log-level'] as string);
    if (!logLevel.ok) {
      throw new Error(`Invalid log level: ${parsed['log-level']}`);
    }

    const batchSize = validateBatchSize(parsed['batch-size']);
    if (!batchSize.ok) {
      throw new Error(`Invalid batch size: ${parsed['batch-size']}`);
    }

    const timeout = validateTimeout(parsed.timeout);
    if (!timeout.ok) {
      throw new Error(`Invalid timeout: ${parsed.timeout}`);
    }

    const result = {
      command: parsed._?.[0] as string | undefined,
      workingDirectory: parsed['working-directory'] as string,
      mode: mode.data,
      batchSize: batchSize.data,
      timeout: timeout.data,
      logLevel: logLevel.data,
      verbose: parsed.verbose as boolean,
      enableFallback: parsed['enable-fallback'] as boolean,
      help: parsed.help as boolean,
      version: parsed.version as boolean,
    };
    return success(result);
  } catch (error) {
    return failure(createUnexpectedError(
      'Failed to parse CLI arguments',
      error as Error,
    ));
  }
};

/**
 * Validate execution mode
 */
const validateExecutionMode = (mode: string): Result<ExecutionMode, string> => {
  const validModes: ExecutionMode[] = ['all', 'batch', 'single-package'];
  if (validModes.includes(mode as ExecutionMode)) {
    return success(mode as ExecutionMode);
  }
  return failure(`Invalid mode: ${mode}. Must be one of: ${validModes.join(', ')}`);
};

/**
 * Validate log level
 */
const validateLogLevel = (level: string): Result<LogLevel, string> => {
  const validLevels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'silent'];
  if (validLevels.includes(level as LogLevel)) {
    return success(level as LogLevel);
  }
  return failure(`Invalid log level: ${level}. Must be one of: ${validLevels.join(', ')}`);
};

/**
 * Validate batch size
 */
const validateBatchSize = (size: unknown): Result<number, string> => {
  const num = Number(size);
  if (Number.isNaN(num) || !Number.isInteger(num)) {
    return failure('Batch size must be an integer');
  }
  if (num < 1 || num > 100) {
    return failure('Batch size must be between 1 and 100');
  }
  return success(num);
};

/**
 * Validate timeout
 */
const validateTimeout = (timeout: unknown): Result<number, string> => {
  const num = Number(timeout);
  if (Number.isNaN(num) || !Number.isInteger(num)) {
    return failure('Timeout must be an integer');
  }
  if (num < 1 || num > 3600) {
    return failure('Timeout must be between 1 and 3600 seconds');
  }
  return success(num);
};

/**
 * Create help output data structure (no side effects)
 */
export const createHelpOutput = (): { content: string; exitCode: number } => ({
  content: HELP_TEXT,
  exitCode: 0,
});

/**
 * Create version output data structure (no side effects)
 */
export const createVersionOutput = (): { content: string; exitCode: number } => ({
  content: `go-ci version ${VERSION_INFO}`,
  exitCode: 0,
});
