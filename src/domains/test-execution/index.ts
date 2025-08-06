/**
 * Test Execution Engine Domain
 * Exports all public interfaces and implementations
 */

export type {
  ExecutionTarget,
  ExitCodeClassification,
  GoTestOptions,
  ProcessResult,
  TestExecutionResult,
} from './types.ts';

export { classifyExitCode, DirectoryPath, FilePath, PackageImportPath, TestName } from './types.ts';

export { GoTestCommandBuilder, type ProcessExecutor, TestExecutor } from './test-executor.ts';

export {
  type CoverageInfo,
  type TestAnalysis,
  type TestFailure,
  TestResultAnalyzer,
} from './result-analyzer.ts';
