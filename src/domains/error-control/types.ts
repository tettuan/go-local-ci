/**
 * Error Control Domain Types
 * Following Totality principle
 */

import type { ExecutionTarget } from '../test-execution/types.ts';

/**
 * Execution strategy - Discriminated Union
 */
export type ExecutionStrategy =
  | { type: 'all-at-once'; parallel: boolean }
  | { type: 'directory-by-directory'; maxConcurrency: number }
  | { type: 'file-by-file'; stopOnFirstError: boolean }
  | { type: 'batch'; batchSize: number; parallel: boolean };

/**
 * Fallback trigger conditions
 */
export type FallbackTrigger =
  | { type: 'all-tests-failed'; totalPackages: number }
  | { type: 'error-threshold-exceeded'; errorRate: number; threshold: number }
  | { type: 'timeout-exceeded'; duration: number; limit: number }
  | { type: 'first-error-detected'; target: ExecutionTarget };

/**
 * Strategy decision
 */
export type StrategyDecision =
  | { action: 'continue'; reason: string }
  | { action: 'stop'; reason: string; exitCode: number }
  | { action: 'fallback'; newStrategy: ExecutionStrategy; trigger: FallbackTrigger };

/**
 * Error analysis context
 */
export interface ErrorContext {
  readonly executionStrategy: ExecutionStrategy;
  readonly targetsExecuted: number;
  readonly targetsFailed: number;
  readonly totalTargets: number;
  readonly duration: number;
  readonly errorHistory: ErrorRecord[];
}

/**
 * Error record
 */
export interface ErrorRecord {
  readonly timestamp: number;
  readonly target: ExecutionTarget;
  readonly exitCode: number;
  readonly errorType: string;
  readonly message?: string;
}

/**
 * Strategy selection criteria
 */
export interface StrategySelectionCriteria {
  readonly totalPackages: number;
  readonly hasComplexDependencies: boolean;
  readonly timeConstraints: number; // seconds
  readonly previousFailures: number;
  readonly resourceConstraints?: {
    readonly maxConcurrency: number;
    readonly memoryLimit: number;
  };
}

/**
 * Fallback configuration
 */
export interface FallbackConfig {
  readonly enabled: boolean;
  readonly maxRetries: number;
  readonly strategies: FallbackStrategyConfig[];
}

/**
 * Individual fallback strategy configuration
 */
export interface FallbackStrategyConfig {
  readonly trigger: FallbackTriggerConfig;
  readonly action: FallbackAction;
}

/**
 * Fallback trigger configuration
 */
export type FallbackTriggerConfig =
  | { type: 'error-rate'; threshold: number }
  | { type: 'consecutive-failures'; count: number }
  | { type: 'timeout'; duration: number }
  | { type: 'any-failure' };

/**
 * Fallback action
 */
export type FallbackAction =
  | { type: 'switch-strategy'; strategy: ExecutionStrategy }
  | { type: 'reduce-concurrency'; factor: number }
  | { type: 'enable-debug'; logLevel: 'debug' }
  | { type: 'stop-execution' };
