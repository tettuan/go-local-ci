/**
 * Strategy Controller - Manages execution strategies and fallback decisions
 * Stateless, following Totality principle
 */

import type { Result } from '../../shared/result.ts';
import { success } from '../../shared/result.ts';
import type {
  ErrorContext,
  ErrorRecord,
  ExecutionStrategy,
  FallbackConfig,
  FallbackTrigger,
  StrategyDecision,
  StrategySelectionCriteria,
} from './types.ts';
import type { ExitCodeClassification } from '../test-execution/types.ts';

/**
 * Strategy Controller - Makes decisions about execution strategies
 */
export class StrategyController {
  /**
   * Select initial strategy based on criteria
   */
  static selectInitialStrategy(criteria: StrategySelectionCriteria): ExecutionStrategy {
    // Small projects or tight time constraints -> all at once
    if (criteria.totalPackages <= 10 || criteria.timeConstraints < 60) {
      return { type: 'all-at-once', parallel: false };
    }

    // Medium projects with good resources -> parallel batches
    if (
      criteria.totalPackages <= 50 &&
      (!criteria.resourceConstraints || criteria.resourceConstraints.maxConcurrency >= 4)
    ) {
      return {
        type: 'batch',
        batchSize: 10,
        parallel: true,
      };
    }

    // Large projects or complex dependencies -> directory by directory
    if (criteria.totalPackages > 50 || criteria.hasComplexDependencies) {
      return {
        type: 'directory-by-directory',
        maxConcurrency: criteria.resourceConstraints?.maxConcurrency || 5,
      };
    }

    // Default to conservative approach
    return { type: 'file-by-file', stopOnFirstError: true };
  }

  /**
   * Make decision based on execution result
   */
  static makeDecision(
    classification: ExitCodeClassification,
    context: ErrorContext,
    config: FallbackConfig,
  ): Result<StrategyDecision, never> {
    // Success - continue
    if (classification.type === 'success') {
      return success({
        action: 'continue',
        reason: 'Tests passed successfully',
      });
    }

    // Build error - stop immediately
    if (classification.type === 'build-error') {
      return success({
        action: 'stop',
        reason: 'Build error detected',
        exitCode: 2,
      });
    }

    // Timeout - check if we should retry with different strategy
    if (classification.type === 'timeout') {
      if (config.enabled && context.executionStrategy.type === 'all-at-once') {
        const trigger: FallbackTrigger = {
          type: 'timeout-exceeded',
          duration: context.duration,
          limit: 0, // Would be set from config
        };

        return success({
          action: 'fallback',
          newStrategy: { type: 'directory-by-directory', maxConcurrency: 3 },
          trigger,
        });
      }

      return success({
        action: 'stop',
        reason: 'Timeout exceeded',
        exitCode: 124,
      });
    }

    // Test failure - check fallback conditions
    if (classification.type === 'test-failure') {
      const decision = this.checkFallbackConditions(context, config);
      if (decision) {
        return success(decision);
      }

      // No fallback triggered - continue or stop based on strategy
      if (
        context.executionStrategy.type === 'file-by-file' &&
        context.executionStrategy.stopOnFirstError
      ) {
        return success({
          action: 'stop',
          reason: 'First error detected in file-by-file mode',
          exitCode: 1,
        });
      }

      return success({
        action: 'continue',
        reason: 'Test failure detected, continuing execution',
      });
    }

    // Unknown error - stop
    return success({
      action: 'stop',
      reason: `Unknown error: exit code ${classification.code}`,
      exitCode: classification.code,
    });
  }

  /**
   * Check if fallback conditions are met
   */
  private static checkFallbackConditions(
    context: ErrorContext,
    config: FallbackConfig,
  ): StrategyDecision | null {
    if (!config.enabled) {
      return null;
    }

    // Check error rate
    const errorRate = context.targetsFailed / context.targetsExecuted;
    if (errorRate === 1 && context.executionStrategy.type === 'all-at-once') {
      const trigger: FallbackTrigger = {
        type: 'all-tests-failed',
        totalPackages: context.totalTargets,
      };

      return {
        action: 'fallback',
        newStrategy: { type: 'directory-by-directory', maxConcurrency: 5 },
        trigger,
      };
    }

    // Check error threshold
    if (errorRate > 0.5 && context.targetsExecuted >= 3) {
      const trigger: FallbackTrigger = {
        type: 'error-threshold-exceeded',
        errorRate,
        threshold: 0.5,
      };

      const newStrategy = this.determineNextStrategy(context.executionStrategy);
      if (newStrategy) {
        return {
          action: 'fallback',
          newStrategy,
          trigger,
        };
      }
    }

    return null;
  }

  /**
   * Determine next strategy in fallback chain
   */
  private static determineNextStrategy(current: ExecutionStrategy): ExecutionStrategy | null {
    switch (current.type) {
      case 'all-at-once':
        return { type: 'directory-by-directory', maxConcurrency: 5 };

      case 'batch':
        return {
          type: 'batch',
          batchSize: Math.max(1, Math.floor(current.batchSize / 2)),
          parallel: false,
        };

      case 'directory-by-directory':
        return { type: 'file-by-file', stopOnFirstError: true };

      case 'file-by-file':
        return null; // No further fallback

      default:
        return null;
    }
  }

  /**
   * Create error record from execution result
   */
  static createErrorRecord(
    target: import('../test-execution/types.ts').ExecutionTarget,
    exitCode: number,
    classification: ExitCodeClassification,
    message?: string,
  ): ErrorRecord {
    return {
      timestamp: Date.now(),
      target,
      exitCode,
      errorType: classification.type,
      message,
    };
  }

  /**
   * Check if retry is allowed
   */
  static shouldRetry(
    errorHistory: ErrorRecord[],
    maxRetries: number,
  ): boolean {
    if (errorHistory.length >= maxRetries) {
      return false;
    }

    // Don't retry build errors
    const hasBuildError = errorHistory.some((record) => record.errorType === 'build-error');

    return !hasBuildError;
  }
}
