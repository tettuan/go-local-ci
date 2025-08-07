/**
 * Search & Integration Domain Types
 * Following Totality principle
 */

import type { Result } from '../../shared/result.ts';
import { failure, success } from '../../shared/result.ts';
import type { ValidationError } from '../../shared/errors.ts';
import { createValidationError } from '../../shared/errors.ts';

/**
 * Search query types
 */
export type SearchQuery =
  | { type: 'package-pattern'; pattern: string; fuzzy: boolean }
  | { type: 'file-pattern'; pattern: string; caseSensitive: boolean }
  | { type: 'test-function'; namePattern: string; includeSubtests: boolean }
  | { type: 'dependency'; module: string; version?: string };

/**
 * Search result
 */
export interface SearchResult {
  readonly query: SearchQuery;
  readonly matches: SearchMatch[];
  readonly totalMatches: number;
  readonly searchDuration: number;
}

/**
 * Search match
 */
export type SearchMatch =
  | { type: 'package'; path: string; name: string; importPath: string }
  | { type: 'file'; path: string; packageName: string; isTest: boolean }
  | { type: 'test-function'; file: string; name: string; line: number; isSubtest: boolean }
  | { type: 'dependency'; module: string; version: string; usedBy: string[] };

/**
 * Coverage format
 */
export type CoverageFormat = 'text' | 'html' | 'json' | 'cobertura' | 'lcov';

/**
 * Coverage report request
 */
export interface CoverageReportRequest {
  readonly format: CoverageFormat;
  readonly outputPath?: string;
  readonly includeGenerated: boolean;
  readonly threshold?: CoverageThreshold;
}

/**
 * Coverage threshold
 */
export interface CoverageThreshold {
  readonly statements: number;
  readonly branches: number;
  readonly functions: number;
  readonly lines: number;
}

/**
 * Coverage data
 */
export interface CoverageData {
  readonly packages: PackageCoverage[];
  readonly summary: CoverageSummary;
}

/**
 * Package coverage
 */
export interface PackageCoverage {
  readonly package: string;
  readonly files: FileCoverage[];
  readonly summary: CoverageSummary;
}

/**
 * File coverage
 */
export interface FileCoverage {
  readonly file: string;
  readonly statements: CoverageMetric;
  readonly branches: CoverageMetric;
  readonly functions: CoverageMetric;
  readonly lines: CoverageMetric;
}

/**
 * Coverage metric
 */
export interface CoverageMetric {
  readonly total: number;
  readonly covered: number;
  readonly percentage: number;
}

/**
 * Coverage summary
 */
export interface CoverageSummary {
  readonly statements: CoverageMetric;
  readonly branches: CoverageMetric;
  readonly functions: CoverageMetric;
  readonly lines: CoverageMetric;
}

/**
 * Benchmark comparison
 */
export interface BenchmarkComparison {
  readonly baseline: BenchmarkResult[];
  readonly current: BenchmarkResult[];
  readonly comparison: BenchmarkDelta[];
}

/**
 * Benchmark result
 */
export interface BenchmarkResult {
  readonly name: string;
  readonly package: string;
  readonly iterations: number;
  readonly nsPerOp: number;
  readonly allocsPerOp: number;
  readonly bytesPerOp: number;
}

/**
 * Benchmark delta
 */
export interface BenchmarkDelta {
  readonly name: string;
  readonly package: string;
  readonly speedChange: number; // percentage
  readonly allocChange: number; // percentage
  readonly significant: boolean;
}

/**
 * Report format
 */
export type ReportFormat =
  | { type: 'json'; pretty: boolean }
  | { type: 'junit-xml'; suiteName: string }
  | { type: 'tap'; version: number }
  | { type: 'markdown'; includeDetails: boolean }
  | { type: 'html'; template?: string };

/**
 * Report generation request
 */
export interface ReportGenerationRequest {
  readonly format: ReportFormat;
  readonly outputPath?: string;
  readonly includeStdout: boolean;
  readonly includeSystemInfo: boolean;
}

/**
 * Search Pattern - Smart Constructor
 */
export class SearchPattern {
  private constructor(
    private readonly pattern: string,
    private readonly regex: RegExp,
  ) {}

  static create(
    pattern: string,
    options?: { caseSensitive?: boolean; fuzzy?: boolean },
  ): Result<SearchPattern, ValidationError> {
    if (pattern.length === 0) {
      return failure(createValidationError({
        kind: 'EmptyValue',
        field: 'pattern',
      }));
    }

    if (pattern.length > 1000) {
      return failure(createValidationError({
        kind: 'InvalidFormat',
        field: 'pattern',
        expected: 'pattern length <= 1000',
        actual: `length: ${pattern.length}`,
      }));
    }

    try {
      const flags = options?.caseSensitive ? '' : 'i';
      const regexPattern = options?.fuzzy
        ? pattern.split('').map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')
        : pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      const regex = new RegExp(regexPattern, flags);
      return success(new SearchPattern(pattern, regex));
    } catch {
      return failure(createValidationError({
        kind: 'InvalidFormat',
        field: 'pattern',
        expected: 'valid regex pattern',
        actual: pattern,
      }));
    }
  }

  getValue(): string {
    return this.pattern;
  }

  matches(text: string): boolean {
    return this.regex.test(text);
  }

  findAll(text: string): RegExpMatchArray[] {
    return Array.from(text.matchAll(new RegExp(this.regex, this.regex.flags + 'g')));
  }
}

/**
 * Coverage Threshold - Smart Constructor
 */
export class CoverageThresholdValue {
  private constructor(
    private readonly threshold: CoverageThreshold,
  ) {}

  static create(
    threshold: Partial<CoverageThreshold>,
  ): Result<CoverageThresholdValue, ValidationError> {
    const defaults: CoverageThreshold = {
      statements: 0,
      branches: 0,
      functions: 0,
      lines: 0,
    };

    const merged = { ...defaults, ...threshold };

    // Validate each threshold
    for (const [key, value] of Object.entries(merged)) {
      if (value < 0 || value > 100) {
        return failure(createValidationError({
          kind: 'OutOfRange',
          field: key,
          min: 0,
          max: 100,
          value,
        }));
      }
    }

    return success(new CoverageThresholdValue(merged));
  }

  getValue(): CoverageThreshold {
    return this.threshold;
  }

  isMet(summary: CoverageSummary): boolean {
    return (
      summary.statements.percentage >= this.threshold.statements &&
      summary.branches.percentage >= this.threshold.branches &&
      summary.functions.percentage >= this.threshold.functions &&
      summary.lines.percentage >= this.threshold.lines
    );
  }

  getFailures(summary: CoverageSummary): string[] {
    const failures: string[] = [];

    if (summary.statements.percentage < this.threshold.statements) {
      failures.push(
        `Statements: ${summary.statements.percentage.toFixed(1)}% < ${this.threshold.statements}%`,
      );
    }
    if (summary.branches.percentage < this.threshold.branches) {
      failures.push(
        `Branches: ${summary.branches.percentage.toFixed(1)}% < ${this.threshold.branches}%`,
      );
    }
    if (summary.functions.percentage < this.threshold.functions) {
      failures.push(
        `Functions: ${summary.functions.percentage.toFixed(1)}% < ${this.threshold.functions}%`,
      );
    }
    if (summary.lines.percentage < this.threshold.lines) {
      failures.push(`Lines: ${summary.lines.percentage.toFixed(1)}% < ${this.threshold.lines}%`);
    }

    return failures;
  }
}
