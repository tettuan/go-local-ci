/**
 * Error Control Domain
 * Exports all public interfaces and implementations
 */

export type {
  ErrorContext,
  ErrorRecord,
  ExecutionStrategy,
  FallbackAction,
  FallbackConfig,
  FallbackStrategyConfig,
  FallbackTrigger,
  FallbackTriggerConfig,
  StrategyDecision,
  StrategySelectionCriteria,
} from './types.ts';

export { StrategyController } from './strategy-controller.ts';

export {
  createDefaultFallbackConfig,
  FallbackExecutor,
  type FallbackResult,
  type FallbackState,
} from './fallback-executor.ts';
