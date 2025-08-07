import { parseArgs } from '@std/cli';
import type { GoCIConfig } from '../types/go-ci-config.ts';
import type { ExecutionMode } from '../types/execution-mode.ts';
import type { BreakdownLoggerConfig } from '../types/log-mode.ts';
import { LogModeFactory } from '../domain/log-mode-factory.ts';
import type { Result } from '../utils/result.ts';
import { failure, success } from '../utils/result.ts';

/**
 * Parsed command line arguments
 */
export interface ParsedArgs {
  mode: ExecutionMode;
  batchSize: number;
  fallback: boolean;
  logMode: string;
  logKey?: string;
  logLength?: 'W' | 'M' | 'L';
  stopOnFirstError: boolean;
  continueOnError: boolean;
  testFilter?: string;
  cwd?: string;
  workingDirectory?: string;
  hierarchy?: string;
  dir?: string;
  verbose: boolean;
  help: boolean;
  version: boolean;
  positional: string[];
}

/**
 * CLI argument parser for Go CI
 */
export class CLIParser {
  /**
   * Parses command line arguments
   */
  static parseArgs(args: string[]): Result<ParsedArgs, Error> {
    try {
      const parsed = parseArgs(args, {
        string: [
          'mode',
          'batch-size',
          'log-mode',
          'log-key',
          'log-length',
          'test-filter',
          'cwd',
          'working-directory',
          'hierarchy',
          'dir',
        ],
        boolean: [
          'fallback',
          'no-fallback',
          'stop-on-first-error',
          'continue-on-error',
          'verbose',
          'help',
          'version',
        ],
        alias: {
          h: 'help',
          v: 'version',
        },
        default: {
          mode: 'all' as ExecutionMode,
          'batch-size': '10',
          fallback: true,
          'log-mode': 'normal',
          'stop-on-first-error': false,
          'continue-on-error': true,
          verbose: false,
          help: false,
          version: false,
        },
      });

      // Validate mode
      const mode = parsed.mode as ExecutionMode;
      if (!['all', 'batch', 'single-package'].includes(mode)) {
        return failure(
          new Error(`Invalid mode: ${mode}. Must be one of: all, batch, single-package`),
        );
      }

      // Parse batch size
      const batchSize = parseInt(parsed['batch-size'], 10);
      if (isNaN(batchSize) || batchSize < 1 || batchSize > 50) {
        return failure(new Error('Batch size must be a number between 1 and 50'));
      }

      // Handle fallback flags
      const fallback = parsed['no-fallback'] ? false : parsed.fallback;

      // Validate log mode
      const logMode = parsed['log-mode'];
      if (!['normal', 'silent', 'debug', 'error-files-only'].includes(logMode)) {
        return failure(
          new Error(
            `Invalid log mode: ${logMode}. Must be one of: normal, silent, debug, error-files-only`,
          ),
        );
      }

      // Validate debug mode requirements
      if (logMode === 'debug') {
        if (!parsed['log-key']) {
          return failure(new Error('Debug mode requires --log-key parameter'));
        }
        if (!parsed['log-length']) {
          return failure(new Error('Debug mode requires --log-length parameter'));
        }
        if (!['W', 'M', 'L'].includes(parsed['log-length'])) {
          return failure(new Error('Log length must be one of: W, M, L'));
        }
      }

      // Determine working directory - hierarchy takes precedence over explicit options
      const hierarchy = parsed.hierarchy || parsed.dir ||
        (parsed._.length > 0 ? parsed._[0] as string : undefined);

      return success({
        mode,
        batchSize,
        fallback,
        logMode,
        logKey: parsed['log-key'],
        logLength: parsed['log-length'] as 'W' | 'M' | 'L' | undefined,
        stopOnFirstError: parsed['stop-on-first-error'],
        continueOnError: parsed['continue-on-error'],
        testFilter: parsed['test-filter'],
        cwd: parsed.cwd,
        workingDirectory: parsed['working-directory'],
        hierarchy,
        dir: parsed.dir,
        verbose: parsed.verbose,
        help: parsed.help,
        version: parsed.version,
        positional: parsed._.map(String),
      });
    } catch (error) {
      if (error instanceof Error) {
        return failure(error);
      }
      return failure(new Error('Failed to parse arguments'));
    }
  }

  /**
   * Builds Go CI configuration from parsed arguments
   */
  static buildGoCIConfig(args: ParsedArgs): Result<GoCIConfig, Error> {
    try {
      // Determine working directory
      let workingDirectory = Deno.cwd();
      if (args.cwd) {
        workingDirectory = args.cwd;
      } else if (args.workingDirectory) {
        workingDirectory = args.workingDirectory;
      }

      // Create log mode
      const logMode = LogModeFactory.fromString(args.logMode);

      // Create breakdown logger config if needed
      let breakdownLoggerConfig: BreakdownLoggerConfig | undefined;
      if (args.logMode === 'debug' && args.logKey && args.logLength) {
        breakdownLoggerConfig = {
          key: args.logKey,
          length: args.logLength,
        };
      }

      return success({
        mode: args.mode,
        batchSize: args.batchSize,
        enableFallback: args.fallback,
        logMode,
        breakdownLoggerConfig,
        stopOnFirstError: args.stopOnFirstError,
        continueOnError: args.continueOnError,
        testFilter: args.testFilter,
        workingDirectory,
        hierarchy: args.hierarchy,
        verbose: args.verbose,
      });
    } catch (error) {
      if (error instanceof Error) {
        return failure(error);
      }
      return failure(new Error('Failed to build configuration'));
    }
  }

  /**
   * Displays help information
   */
  static displayHelp(): void {
    console.log(`
@aidevtool/ci-go - Go CI Pipeline Runner

USAGE:
  deno run --allow-read --allow-write --allow-run --allow-env jsr:@aidevtool/ci-go [OPTIONS] [HIERARCHY]

OPTIONS:
  --mode <mode>                  Execution mode: all, batch, single-package (default: all)
  --batch-size <size>            Number of packages per batch (1-50, default: 10)
  --fallback                     Enable execution strategy fallback (default: true)
  --no-fallback                  Disable execution strategy fallback
  --log-mode <mode>              Log mode: normal, silent, debug, error-files-only (default: normal)
  --log-key <key>                BreakdownLogger key (required for debug mode)
  --log-length <length>          BreakdownLogger length: W, M, L (required for debug mode)
  --stop-on-first-error          Stop execution on first error
  --continue-on-error            Continue execution after errors (default: true)
  --test-filter <pattern>        Filter test packages by pattern
  --cwd <path>                   Specify working directory
  --working-directory <path>     Specify working directory (alias for --cwd)
  --hierarchy <path>             Target directory hierarchy
  --dir <path>                   Alias for --hierarchy
  --verbose                      Enable verbose output for Go commands
  --help, -h                     Display this help message
  --version, -v                  Display version information

EXAMPLES:
  # Run with default settings
  deno run --allow-read --allow-write --allow-run --allow-env jsr:@aidevtool/ci-go

  # Run in batch mode with custom batch size
  deno run --allow-read --allow-write --allow-run --allow-env jsr:@aidevtool/ci-go --mode batch --batch-size 5

  # Run in debug mode
  deno run --allow-read --allow-write --allow-run --allow-env jsr:@aidevtool/ci-go --log-mode debug --log-key DEBUG --log-length M

  # Target specific directory
  deno run --allow-read --allow-write --allow-run --allow-env jsr:@aidevtool/ci-go ./cmd/

  # Silent mode for CI/CD
  deno run --allow-read --allow-write --allow-run --allow-env jsr:@aidevtool/ci-go --log-mode silent
`);
  }

  /**
   * Displays version information
   */
  static displayVersion(): void {
    console.log('go-local-ci version 0.1.0');
  }
}
