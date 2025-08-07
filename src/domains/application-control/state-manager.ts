/**
 * Application State Manager
 * Manages application lifecycle following Totality principle
 */

import type { Result } from '../../shared/result.ts';
import { failure, success } from '../../shared/result.ts';
import type { AppError } from '../../shared/errors.ts';
import { createDomainError } from '../../shared/errors.ts';
import type { EventBus } from '../../shared/events.ts';
import { createEvent } from '../../shared/events.ts';
import type { ApplicationConfig, ApplicationState, ParsedCliArgs } from './types.ts';
import { BatchSize, Timeout, WorkingDirectory } from './types.ts';
import { isValidStateTransition } from './types.ts';

/**
 * Application State Manager
 */
export class ApplicationStateManager {
  private state: ApplicationState;
  private eventBus?: EventBus;

  constructor() {
    this.state = { type: 'initializing', startTime: Date.now() };
  }

  /**
   * Set event bus for domain events
   */
  setEventBus(eventBus: EventBus): void {
    this.eventBus = eventBus;
  }

  /**
   * Get current state (immutable)
   */
  getState(): Readonly<ApplicationState> {
    return this.state;
  }

  /**
   * Initialize application with configuration
   */
  async initialize(config: ApplicationConfig): Promise<Result<void, AppError>> {
    if (this.state.type !== 'initializing') {
      return failure(createDomainError({
        domain: 'application',
        kind: 'StateTransitionInvalid',
        details: { from: this.state.type, to: 'running' },
      }));
    }

    this.state = {
      type: 'running',
      config,
      startTime: this.state.startTime,
    };

    if (this.eventBus) {
      await this.eventBus.emit(createEvent({
        type: 'app:initialized',
        config,
      }));
    }

    return success(undefined);
  }

  /**
   * Start graceful shutdown
   */
  async startShutdown(reason: string, exitCode: number = 0): Promise<Result<void, AppError>> {
    const currentType = this.state.type;

    if (!isValidStateTransition(currentType, 'shutting-down')) {
      return failure(createDomainError({
        domain: 'application',
        kind: 'StateTransitionInvalid',
        details: { from: currentType, to: 'shutting-down' },
      }));
    }

    this.state = {
      type: 'shutting-down',
      reason,
      exitCode,
    };

    if (this.eventBus) {
      await this.eventBus.emit(createEvent({
        type: 'app:shutdown-started',
        reason,
      }));
    }

    return success(undefined);
  }

  /**
   * Complete termination
   */
  terminate(exitCode: number): Result<void, AppError> {
    const currentType = this.state.type;

    if (!isValidStateTransition(currentType, 'terminated')) {
      return failure(createDomainError({
        domain: 'application',
        kind: 'StateTransitionInvalid',
        details: { from: currentType, to: 'terminated' },
      }));
    }

    const duration = Date.now() - (
      this.state.type === 'initializing' || this.state.type === 'running' ? this.state.startTime : 0
    );

    this.state = {
      type: 'terminated',
      exitCode,
      duration,
    };

    return success(undefined);
  }

  /**
   * Handle domain error
   */
  async handleError(error: Error, severity: 'fatal' | 'recoverable'): Promise<void> {
    if (this.eventBus) {
      await this.eventBus.emit(createEvent({
        type: 'app:error-trapped',
        error,
        severity,
      }));
    }

    if (severity === 'fatal') {
      await this.startShutdown(`Fatal error: ${error.message}`, 1);
    }
  }
}

/**
 * Create application configuration from parsed CLI args
 */
export const createApplicationConfig = (
  args: ParsedCliArgs,
): Result<ApplicationConfig, AppError> => {
  // Create validated value objects
  const workingDirResult = WorkingDirectory.create(args.workingDirectory);
  if (!workingDirResult.ok) {
    return failure(workingDirResult.error);
  }

  const batchSizeResult = BatchSize.create(args.batchSize);
  if (!batchSizeResult.ok) {
    return failure(batchSizeResult.error);
  }

  const timeoutResult = Timeout.create(args.timeout);
  if (!timeoutResult.ok) {
    return failure(timeoutResult.error);
  }

  const config: ApplicationConfig = {
    workingDirectory: workingDirResult.data,
    mode: args.mode,
    batchSize: batchSizeResult.data,
    timeout: timeoutResult.data,
    logLevel: args.logLevel,
    verbose: args.verbose,
    enableFallback: args.enableFallback,
  };

  return success(config);
};
