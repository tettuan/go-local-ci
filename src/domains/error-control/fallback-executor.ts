/**
 * Fallback Executor - Handles fallback execution when errors occur
 * Stateless, following Totality principle
 */

import type { Result } from '../../shared/result.ts';
import { success } from '../../shared/result.ts';
import type { EventBus } from '../../shared/events.ts';
import { createEvent } from '../../shared/events.ts';
import type { ErrorContext, ExecutionStrategy, FallbackConfig, FallbackTrigger } from './types.ts';

/**
 * Fallback execution state
 */
export interface FallbackState {
  readonly originalStrategy: ExecutionStrategy;
  readonly currentStrategy: ExecutionStrategy;
  readonly fallbackCount: number;
  readonly triggers: FallbackTrigger[];
  readonly startTime: number;
}

/**
 * Fallback result
 */
export interface FallbackResult {
  readonly executed: boolean;
  readonly newStrategy?: ExecutionStrategy;
  readonly reason: string;
}

/**
 * Fallback Executor
 */
export class FallbackExecutor {
  private state: FallbackState | null = null;

  constructor(
    private readonly config: FallbackConfig,
    private readonly eventBus?: EventBus,
  ) {}

  /**
   * Initialize fallback state
   */
  initialize(originalStrategy: ExecutionStrategy): void {
    this.state = {
      originalStrategy,
      currentStrategy: originalStrategy,
      fallbackCount: 0,
      triggers: [],
      startTime: Date.now(),
    };
  }

  /**
   * Execute fallback
   */
  async executeFallback(
    trigger: FallbackTrigger,
    _context: ErrorContext,
    newStrategy: ExecutionStrategy,
  ): Promise<Result<FallbackResult, never>> {
    if (!this.state) {
      return success({
        executed: false,
        reason: 'Fallback executor not initialized',
      });
    }

    // Check if we've exceeded max retries
    if (this.state.fallbackCount >= this.config.maxRetries) {
      return success({
        executed: false,
        reason: `Maximum fallback retries (${this.config.maxRetries}) exceeded`,
      });
    }

    // Update state
    const previousStrategy = this.state.currentStrategy;
    this.state = {
      ...this.state,
      currentStrategy: newStrategy,
      fallbackCount: this.state.fallbackCount + 1,
      triggers: [...this.state.triggers, trigger],
    };

    // Emit fallback event
    if (this.eventBus) {
      await this.eventBus.emit(createEvent({
        type: 'error:fallback-triggered',
        from: this.strategyToString(previousStrategy),
        to: this.strategyToString(newStrategy),
      }));
    }

    return success({
      executed: true,
      newStrategy,
      reason: this.getTriggerReason(trigger),
    });
  }

  /**
   * Get current fallback state
   */
  getState(): FallbackState | null {
    return this.state;
  }

  /**
   * Reset fallback state
   */
  reset(): void {
    this.state = null;
  }

  /**
   * Check if fallback is available
   */
  canFallback(): boolean {
    if (!this.config.enabled || !this.state) {
      return false;
    }

    return this.state.fallbackCount < this.config.maxRetries;
  }

  /**
   * Get fallback history
   */
  getFallbackHistory(): FallbackTrigger[] {
    return this.state?.triggers || [];
  }

  /**
   * Convert strategy to string for logging
   */
  private strategyToString(strategy: ExecutionStrategy): string {
    switch (strategy.type) {
      case 'all-at-once':
        return `all-at-once (parallel: ${strategy.parallel})`;
      case 'directory-by-directory':
        return `directory-by-directory (concurrency: ${strategy.maxConcurrency})`;
      case 'file-by-file':
        return `file-by-file (stop on error: ${strategy.stopOnFirstError})`;
      case 'batch':
        return `batch (size: ${strategy.batchSize}, parallel: ${strategy.parallel})`;
    }
  }

  /**
   * Get human-readable trigger reason
   */
  private getTriggerReason(trigger: FallbackTrigger): string {
    switch (trigger.type) {
      case 'all-tests-failed':
        return `All ${trigger.totalPackages} packages failed in initial execution`;
      case 'error-threshold-exceeded':
        return `Error rate ${(trigger.errorRate * 100).toFixed(1)}% exceeded threshold of ${
          (trigger.threshold * 100).toFixed(1)
        }%`;
      case 'timeout-exceeded':
        return `Execution time ${trigger.duration}ms exceeded limit of ${trigger.limit}ms`;
      case 'first-error-detected':
        return `First error detected in ${this.targetToString(trigger.target)}`;
    }
  }

  /**
   * Convert target to string
   */
  private targetToString(target: import('../test-execution/types.ts').ExecutionTarget): string {
    switch (target.type) {
      case 'all-packages':
        return `pattern ${target.pattern}`;
      case 'directory':
        return `directory ${target.path.getValue()}`;
      case 'file':
        return `file ${target.path.getValue()}`;
      case 'package':
        return `package ${target.importPath.getValue()}`;
    }
  }
}

/**
 * Create default fallback configuration
 */
export const createDefaultFallbackConfig = (): FallbackConfig => ({
  enabled: true,
  maxRetries: 3,
  strategies: [
    {
      trigger: { type: 'any-failure' },
      action: {
        type: 'switch-strategy',
        strategy: { type: 'directory-by-directory', maxConcurrency: 5 },
      },
    },
    {
      trigger: { type: 'error-rate', threshold: 0.5 },
      action: { type: 'reduce-concurrency', factor: 0.5 },
    },
    {
      trigger: { type: 'timeout', duration: 300000 }, // 5 minutes
      action: { type: 'stop-execution' },
    },
  ],
});
