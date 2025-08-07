/**
 * @tettuan/go-local-ci - A comprehensive Deno-based CI runner for Go projects
 *
 * This module provides a complete CI pipeline for Go projects including:
 * - Build checking
 * - Test execution
 * - Go vet analysis
 * - Format checking
 * - Linting (if available)
 *
 * Refactored using Domain-Driven Design with Totality principle
 *
 * @module
 */

export { main } from './src/main.ts';

// Domain Orchestrator
export { DomainOrchestrator } from './src/domains/orchestrator/index.ts';

// Application Control Domain
export { parseCli } from './src/domains/application-control/cli-parser.ts';
export { ApplicationStateManager } from './src/domains/application-control/state-manager.ts';

// Test Execution Domain
export { TestExecutor } from './src/domains/test-execution/test-executor.ts';
export { TestResultAnalyzer } from './src/domains/test-execution/result-analyzer.ts';

// Error Control Domain
export { StrategyController } from './src/domains/error-control/strategy-controller.ts';
export { FallbackExecutor } from './src/domains/error-control/fallback-executor.ts';

// Resource Management Domain
export { GoProjectScanner } from './src/domains/resource-management/project-scanner.ts';

// Search Integration Domain
export { SearchService } from './src/domains/search-integration/search-service.ts';
export { CoverageAnalyzer } from './src/domains/search-integration/coverage-analyzer.ts';
export { ReportGenerator } from './src/domains/search-integration/report-generator.ts';

// Environment Control Domain
export { EnvironmentManager } from './src/domains/environment-control/environment-manager.ts';
export { DockerController } from './src/domains/environment-control/docker-controller.ts';

// Infrastructure Adapters
export { createInfrastructureAdapters } from './src/infrastructure/index.ts';

// Shared Components
export { createEventBus } from './src/shared/event-bus.ts';
export type { Result } from './src/shared/result.ts';
export { failure, success } from './src/shared/result.ts';

// Types
export type {
  ApplicationConfig,
  ExecutionMode,
  LogLevel,
  ParsedCliArgs,
} from './src/domains/application-control/types.ts';
export type {
  ExecutionTarget,
  GoTestOptions,
  TestExecutionResult,
} from './src/domains/test-execution/types.ts';
export type { ExecutionStrategy, FallbackConfig } from './src/domains/error-control/types.ts';
export type {
  DirectoryHierarchy,
  GoPackageInfo,
  ProjectStructure,
} from './src/domains/resource-management/types.ts';
export type {
  CoverageData,
  ReportFormat,
  SearchMatch,
} from './src/domains/search-integration/types.ts';
export type { DockerConfig, GoEnvironment } from './src/domains/environment-control/types.ts';

// Infrastructure Adapter Types (for extension)
export type { ProcessExecutor } from './src/domains/test-execution/test-executor.ts';
export type { FileSystem } from './src/domains/resource-management/project-scanner.ts';

// If this file is run directly, execute the main function
if (import.meta.main) {
  const { main } = await import('./src/main.ts');
  await main(Deno.args);
}
