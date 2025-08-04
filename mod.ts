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
 * @module
 */

export { main } from './src/main.ts';
export { GoCI } from './src/core/go-ci.ts';
export { GoCILogger } from './src/core/go-ci-logger.ts';
export { CLIParser } from './src/cli/cli-parser.ts';
export { LogModeFactory } from './src/domain/log-mode-factory.ts';
export { ProcessRunner } from './src/infrastructure/process-runner.ts';
export { FileSystemService } from './src/infrastructure/file-system-service.ts';
export { GoProjectDiscovery } from './src/infrastructure/go-project-discovery.ts';
export { SerenaMCPClient } from './src/infrastructure/serena-mcp-client.ts';
export { SimilarTestFinder } from './src/services/similar-test-finder.ts';

// Types
export type { GoCIConfig } from './src/types/go-ci-config.ts';
export type { ExecutionMode } from './src/types/execution-mode.ts';
export type { LogMode } from './src/types/log-mode.ts';
export type { GoCIResult } from './src/types/go-ci-result.ts';
export type { GoPackageInfo } from './src/types/go-package-info.ts';

// If this file is run directly, execute the main function
if (import.meta.main) {
  const { main } = await import('./src/main.ts');
  await main(Deno.args);
}
