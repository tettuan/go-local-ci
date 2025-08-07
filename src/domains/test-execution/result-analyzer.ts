/**
 * Test Result Analyzer
 * Analyzes test execution results and extracts insights
 */

import type { Result } from '../../shared/result.ts';
import { success } from '../../shared/result.ts';
import type { ExitCodeClassification, TestExecutionResult } from './types.ts';
import { classifyExitCode } from './types.ts';

/**
 * Test failure information extracted from output
 */
export interface TestFailure {
  readonly package: string;
  readonly test: string;
  readonly message: string;
  readonly file?: string;
  readonly line?: number;
}

/**
 * Coverage information
 */
export interface CoverageInfo {
  readonly percentage: number;
  readonly statements: number;
  readonly covered: number;
}

/**
 * Analysis result
 */
export interface TestAnalysis {
  readonly executionResult: TestExecutionResult;
  readonly classification: ExitCodeClassification;
  readonly passed: number;
  readonly failed: number;
  readonly skipped: number;
  readonly duration: number;
  readonly failures: TestFailure[];
  readonly coverage?: CoverageInfo;
  readonly shouldContinue: boolean;
}

/**
 * Test output patterns
 */
const PATTERNS = {
  // === RUN   TestName
  testRun: /^=== RUN\s+(\S+)/,
  // --- PASS: TestName (0.00s)
  testPass: /^--- PASS:\s+(\S+)\s+\(([0-9.]+)s\)/,
  // --- FAIL: TestName (0.00s)
  testFail: /^--- FAIL:\s+(\S+)\s+\(([0-9.]+)s\)/,
  // --- SKIP: TestName (0.00s)
  testSkip: /^--- SKIP:\s+(\S+)\s+\(([0-9.]+)s\)/,
  // PASS
  // ok      package/name    0.123s
  packagePass: /^ok\s+(\S+)\s+([0-9.]+)s/,
  // FAIL
  // FAIL    package/name    0.123s
  packageFail: /^FAIL\s+(\S+)\s+([0-9.]+)s/,
  // coverage: 80.5% of statements
  coverage: /coverage:\s+([0-9.]+)%\s+of\s+statements/,
  // Error in file.go:123
  errorLocation: /^\s+(\S+\.go):(\d+):/,
  // Panic or fatal error
  panic: /^panic:|^fatal:/,
};

/**
 * Test Result Analyzer
 */
export class TestResultAnalyzer {
  /**
   * Analyze test execution result
   */
  static analyze(result: TestExecutionResult): Result<TestAnalysis, never> {
    const classification = classifyExitCode(result.processResult);
    const output = result.processResult.stdout + '\n' + result.processResult.stderr;
    const lines = output.split('\n');

    let passed = 0;
    let failed = 0;
    let skipped = 0;
    const failures: TestFailure[] = [];
    let coverage: CoverageInfo | undefined;
    let currentFailure: {
      package?: string;
      test?: string;
      message?: string;
      file?: string;
      line?: number;
    } | null = null;

    // Parse output line by line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Test pass
      const passMatch = line.match(PATTERNS.testPass);
      if (passMatch) {
        passed++;
        continue;
      }

      // Test fail
      const failMatch = line.match(PATTERNS.testFail);
      if (failMatch) {
        failed++;
        currentFailure = {
          test: failMatch[1],
          message: '',
        };
        continue;
      }

      // Test skip
      const skipMatch = line.match(PATTERNS.testSkip);
      if (skipMatch) {
        skipped++;
        continue;
      }

      // Package results
      const packagePassMatch = line.match(PATTERNS.packagePass);
      if (packagePassMatch && currentFailure) {
        currentFailure.package = packagePassMatch[1];
      }

      const packageFailMatch = line.match(PATTERNS.packageFail);
      if (packageFailMatch && currentFailure) {
        currentFailure.package = packageFailMatch[1];
        if (currentFailure.test && currentFailure.message && currentFailure.package) {
          failures.push({
            package: currentFailure.package,
            test: currentFailure.test,
            message: currentFailure.message,
            file: currentFailure.file,
            line: currentFailure.line,
          });
        }
        currentFailure = null;
      }

      // Error location
      const errorLocationMatch = line.match(PATTERNS.errorLocation);
      if (errorLocationMatch && currentFailure) {
        currentFailure.file = errorLocationMatch[1];
        currentFailure.line = parseInt(errorLocationMatch[2], 10);
      }

      // Coverage
      const coverageMatch = line.match(PATTERNS.coverage);
      if (coverageMatch) {
        const percentage = parseFloat(coverageMatch[1]);
        coverage = {
          percentage,
          statements: 0, // Would need more parsing for detailed info
          covered: 0,
        };
      }

      // Collect failure messages
      if (currentFailure && line.trim() && !line.match(/^(===|---)/)) {
        currentFailure.message = (currentFailure.message + '\n' + line).trim();
      }
    }

    // Finalize any pending failure
    if (currentFailure && currentFailure.test && currentFailure.message && currentFailure.package) {
      failures.push({
        package: currentFailure.package,
        test: currentFailure.test,
        message: currentFailure.message,
        file: currentFailure.file,
        line: currentFailure.line,
      });
    }

    // Determine if we should continue
    const shouldContinue = classification.type === 'success' ||
      (classification.type === 'test-failure' && failures.length > 0);

    const analysis: TestAnalysis = {
      executionResult: result,
      classification,
      passed,
      failed,
      skipped,
      duration: result.endTime - result.startTime,
      failures,
      coverage,
      shouldContinue,
    };

    return success(analysis);
  }

  /**
   * Extract package information from output
   */
  static extractPackages(output: string): string[] {
    const packages = new Set<string>();
    const lines = output.split('\n');

    for (const line of lines) {
      const packageMatch = line.match(PATTERNS.packagePass) ||
        line.match(PATTERNS.packageFail);
      if (packageMatch) {
        packages.add(packageMatch[1]);
      }
    }

    return Array.from(packages);
  }

  /**
   * Check if output indicates a build error
   */
  static hasBuildError(output: string): boolean {
    const buildErrorPatterns = [
      /cannot find package/,
      /undefined:/,
      /cannot find module/,
      /no Go files in/,
      /build constraints exclude all Go files/,
      /import cycle not allowed/,
    ];

    return buildErrorPatterns.some((pattern) => pattern.test(output));
  }

  /**
   * Check if output indicates a panic
   */
  static hasPanic(output: string): boolean {
    return PATTERNS.panic.test(output);
  }
}
