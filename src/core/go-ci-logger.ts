import type { BreakdownLoggerConfig, LogMode } from '../types/log-mode.ts';
import type { Result } from '../utils/result.ts';
import { failure, success } from '../utils/result.ts';

/**
 * Logger for Go CI operations
 */
export class GoCILogger {
  private constructor(
    private readonly mode: LogMode,
    private readonly breakdownConfig?: BreakdownLoggerConfig,
  ) {}

  /**
   * Creates a new logger instance
   */
  static create(
    mode: LogMode,
    breakdownConfig?: BreakdownLoggerConfig,
  ): Result<GoCILogger, Error> {
    try {
      return success(new GoCILogger(mode, breakdownConfig));
    } catch (error) {
      if (error instanceof Error) {
        return failure(error);
      }
      return failure(new Error('Failed to create logger'));
    }
  }

  /**
   * Logs an info message
   */
  logInfo(message: string): void {
    if (this.mode.showProgress || this.mode.level === 'debug') {
      console.log(`ℹ️  ${message}`);
    }
  }

  /**
   * Logs an error message
   */
  logError(message: string): void {
    if (this.mode.showErrors) {
      console.error(`❌ ${message}`);
    }
  }

  /**
   * Logs a success message
   */
  logSuccess(message: string): void {
    if (this.mode.showProgress || this.mode.level === 'debug') {
      console.log(`✅ ${message}`);
    }
  }

  /**
   * Logs a warning message
   */
  logWarning(message: string): void {
    if (this.mode.showProgress || this.mode.level === 'debug') {
      console.warn(`⚠️  ${message}`);
    }
  }

  /**
   * Logs a debug message
   */
  logDebug(message: string): void {
    if (this.mode.showDebug) {
      const timestamp = new Date().toISOString();
      console.log(`🐛 [${timestamp}] ${message}`);
    }
  }

  /**
   * Logs the start of a stage
   */
  logStageStart(stageName: string): void {
    if (this.mode.showProgress || this.mode.level === 'debug') {
      console.log(`🚀 Starting ${stageName}...`);
    }
  }

  /**
   * Logs the completion of a stage
   */
  logStageComplete(stageName: string, duration: number, success: boolean): void {
    if (this.mode.showProgress || this.mode.level === 'debug') {
      const status = success ? '✅' : '❌';
      const durationMs = duration.toFixed(0);
      console.log(`${status} ${stageName} completed in ${durationMs}ms`);
    }
  }

  /**
   * Logs package-specific errors
   */
  logPackageError(packageName: string, error: string): void {
    if (this.mode.showErrors) {
      console.error(`📦 ${packageName}: ${error}`);
    }
  }

  /**
   * Logs progress information
   */
  logProgress(current: number, total: number, item: string): void {
    if (this.mode.showProgress && this.mode.level !== 'silent') {
      const percentage = Math.round((current / total) * 100);
      console.log(`📊 [${current}/${total}] (${percentage}%) ${item}`);
    }
  }

  /**
   * Logs a summary
   */
  logSummary(summary: string): void {
    if (this.mode.level !== 'silent') {
      console.log('\n' + '='.repeat(60));
      console.log('📋 SUMMARY');
      console.log('='.repeat(60));
      console.log(summary);
      console.log('='.repeat(60));
    }
  }

  /**
   * Logs command execution
   */
  logCommand(command: string, args: string[]): void {
    if (this.mode.level === 'debug') {
      console.log(`🔧 Executing: ${command} ${args.join(' ')}`);
    }
  }

  /**
   * Logs command output
   */
  logCommandOutput(stdout: string, stderr: string): void {
    if (this.mode.level === 'debug') {
      if (stdout.trim()) {
        console.log('📤 STDOUT:');
        console.log(stdout);
      }
      if (stderr.trim()) {
        console.log('📥 STDERR:');
        console.log(stderr);
      }
    }
  }

  /**
   * Logs breakdown information (if configured)
   */
  logBreakdown(_key: string, message: string): void {
    if (this.breakdownConfig && this.mode.level === 'debug') {
      // Simple breakdown logging - in a real implementation, this would
      // integrate with a proper breakdown logger
      const timestamp = new Date().toISOString();
      console.log(`🔍 [${this.breakdownConfig.key}] [${timestamp}] ${message}`);
    }
  }

  /**
   * Gets the current log mode
   */
  getMode(): LogMode {
    return this.mode;
  }

  /**
   * Checks if debug logging is enabled
   */
  isDebugEnabled(): boolean {
    return this.mode.showDebug;
  }

  /**
   * Checks if progress logging is enabled
   */
  isProgressEnabled(): boolean {
    return this.mode.showProgress;
  }
}
