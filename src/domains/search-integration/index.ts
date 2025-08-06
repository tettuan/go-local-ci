/**
 * Search & Integration Domain
 * Exports all public interfaces and implementations
 */

export type {
  BenchmarkComparison,
  BenchmarkDelta,
  BenchmarkResult,
  CoverageData,
  CoverageFormat,
  CoverageMetric,
  CoverageReportRequest,
  CoverageSummary,
  CoverageThreshold,
  FileCoverage,
  PackageCoverage,
  ReportFormat,
  ReportGenerationRequest,
  SearchMatch,
  SearchQuery,
  SearchResult,
} from './types.ts';

export { CoverageThresholdValue, SearchPattern } from './types.ts';

export {
  type GoFileParser,
  type SearchIndex,
  SearchService,
  type TestFunction,
} from './search-service.ts';

export {
  CoverageAnalyzer,
  type CoverageParser,
  type CoverageReportGenerator,
} from './coverage-analyzer.ts';

export { type FileWriter, ReportGenerator, type TemplateRenderer } from './report-generator.ts';
