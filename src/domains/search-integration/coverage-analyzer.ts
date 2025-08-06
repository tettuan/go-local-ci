/**
 * Coverage Analyzer - Analyzes test coverage data
 * Following Totality principle
 */

import type { Result } from '../../shared/result.ts';
import { failure, success } from '../../shared/result.ts';
import type { DomainError } from '../../shared/errors.ts';
import { createDomainError } from '../../shared/errors.ts';
import type {
  CoverageData,
  CoverageFormat,
  CoverageReportRequest,
  CoverageSummary,
  FileCoverage,
  PackageCoverage,
} from './types.ts';

/**
 * Coverage data parser interface
 */
export interface CoverageParser {
  parse(output: string): Result<CoverageData, Error>;
}

/**
 * Coverage report generator interface
 */
export interface CoverageReportGenerator {
  generate(
    data: CoverageData,
    format: CoverageFormat,
    outputPath?: string,
  ): Promise<Result<string, Error>>;
}

/**
 * Coverage Analyzer
 */
export class CoverageAnalyzer {
  constructor(
    private readonly parser: CoverageParser,
    private readonly generator: CoverageReportGenerator,
  ) {}

  /**
   * Analyze coverage output
   */
  analyzeCoverage(coverageOutput: string): Result<CoverageData, DomainError> {
    const parseResult = this.parser.parse(coverageOutput);

    if (!parseResult.ok) {
      return failure(createDomainError({
        domain: 'search',
        kind: 'ParseFailed',
        details: { reason: parseResult.error.message },
      }));
    }

    // Validate and enhance coverage data
    const enhanced = this.enhanceCoverageData(parseResult.data);
    return success(enhanced);
  }

  /**
   * Generate coverage report
   */
  async generateReport(
    data: CoverageData,
    request: CoverageReportRequest,
  ): Promise<Result<string, DomainError>> {
    // Check threshold if provided
    if (request.threshold) {
      const failures = request.threshold.getFailures(data.summary);
      if (failures.length > 0) {
        return failure(createDomainError({
          domain: 'search',
          kind: 'ThresholdNotMet',
          details: { failures },
        }));
      }
    }

    // Generate report
    const result = await this.generator.generate(
      data,
      request.format,
      request.outputPath,
    );

    if (!result.ok) {
      return failure(createDomainError({
        domain: 'search',
        kind: 'ReportGenerationFailed',
        details: { format: request.format, error: result.error.message },
      }));
    }

    return success(result.data);
  }

  /**
   * Calculate coverage summary
   */
  calculateSummary(packages: PackageCoverage[]): CoverageSummary {
    const totals = {
      statements: { total: 0, covered: 0 },
      branches: { total: 0, covered: 0 },
      functions: { total: 0, covered: 0 },
      lines: { total: 0, covered: 0 },
    };

    for (const pkg of packages) {
      totals.statements.total += pkg.summary.statements.total;
      totals.statements.covered += pkg.summary.statements.covered;
      totals.branches.total += pkg.summary.branches.total;
      totals.branches.covered += pkg.summary.branches.covered;
      totals.functions.total += pkg.summary.functions.total;
      totals.functions.covered += pkg.summary.functions.covered;
      totals.lines.total += pkg.summary.lines.total;
      totals.lines.covered += pkg.summary.lines.covered;
    }

    return {
      statements: this.createMetric(totals.statements),
      branches: this.createMetric(totals.branches),
      functions: this.createMetric(totals.functions),
      lines: this.createMetric(totals.lines),
    };
  }

  /**
   * Compare coverage data
   */
  compareCoverage(
    baseline: CoverageData,
    current: CoverageData,
  ): CoverageDelta {
    const delta: CoverageDelta = {
      summary: this.compareSummaries(baseline.summary, current.summary),
      packages: this.comparePackages(baseline.packages, current.packages),
    };

    return delta;
  }

  /**
   * Filter coverage data
   */
  filterCoverage(
    data: CoverageData,
    options: { includeGenerated?: boolean; minCoverage?: number },
  ): CoverageData {
    let packages = data.packages;

    // Filter out generated files if requested
    if (!options.includeGenerated) {
      packages = packages.map((pkg) => ({
        ...pkg,
        files: pkg.files.filter((f) => !this.isGeneratedFile(f.file)),
      })).filter((pkg) => pkg.files.length > 0);
    }

    // Filter by minimum coverage
    if (options.minCoverage !== undefined) {
      packages = packages.filter(
        (pkg) => pkg.summary.lines.percentage >= options.minCoverage!,
      );
    }

    // Recalculate summary
    const summary = this.calculateSummary(packages);

    return { packages, summary };
  }

  /**
   * Enhance coverage data with additional metrics
   */
  private enhanceCoverageData(data: CoverageData): CoverageData {
    // Ensure all packages have summaries
    const packages = data.packages.map((pkg) => {
      if (!pkg.summary) {
        const summary = this.calculatePackageSummary(pkg.files);
        return { ...pkg, summary };
      }
      return pkg;
    });

    // Ensure overall summary
    const summary = data.summary || this.calculateSummary(packages);

    return { packages, summary };
  }

  /**
   * Calculate package summary from files
   */
  private calculatePackageSummary(files: FileCoverage[]): CoverageSummary {
    const totals = {
      statements: { total: 0, covered: 0 },
      branches: { total: 0, covered: 0 },
      functions: { total: 0, covered: 0 },
      lines: { total: 0, covered: 0 },
    };

    for (const file of files) {
      totals.statements.total += file.statements.total;
      totals.statements.covered += file.statements.covered;
      totals.branches.total += file.branches.total;
      totals.branches.covered += file.branches.covered;
      totals.functions.total += file.functions.total;
      totals.functions.covered += file.functions.covered;
      totals.lines.total += file.lines.total;
      totals.lines.covered += file.lines.covered;
    }

    return {
      statements: this.createMetric(totals.statements),
      branches: this.createMetric(totals.branches),
      functions: this.createMetric(totals.functions),
      lines: this.createMetric(totals.lines),
    };
  }

  /**
   * Create coverage metric
   */
  private createMetric({ total, covered }: { total: number; covered: number }): CoverageMetric {
    const percentage = total > 0 ? (covered / total) * 100 : 0;
    return { total, covered, percentage };
  }

  /**
   * Compare summaries
   */
  private compareSummaries(
    baseline: CoverageSummary,
    current: CoverageSummary,
  ): SummaryDelta {
    return {
      statements: current.statements.percentage - baseline.statements.percentage,
      branches: current.branches.percentage - baseline.branches.percentage,
      functions: current.functions.percentage - baseline.functions.percentage,
      lines: current.lines.percentage - baseline.lines.percentage,
    };
  }

  /**
   * Compare packages
   */
  private comparePackages(
    baseline: PackageCoverage[],
    current: PackageCoverage[],
  ): PackageDelta[] {
    const baselineMap = new Map(baseline.map((p) => [p.package, p]));
    const currentMap = new Map(current.map((p) => [p.package, p]));
    const deltas: PackageDelta[] = [];

    // Check existing packages
    for (const [name, currentPkg] of currentMap) {
      const baselinePkg = baselineMap.get(name);
      if (baselinePkg) {
        deltas.push({
          package: name,
          status: 'modified',
          delta: this.compareSummaries(baselinePkg.summary, currentPkg.summary),
        });
      } else {
        deltas.push({
          package: name,
          status: 'added',
          delta: {
            statements: currentPkg.summary.statements.percentage,
            branches: currentPkg.summary.branches.percentage,
            functions: currentPkg.summary.functions.percentage,
            lines: currentPkg.summary.lines.percentage,
          },
        });
      }
    }

    // Check removed packages
    for (const [name, baselinePkg] of baselineMap) {
      if (!currentMap.has(name)) {
        deltas.push({
          package: name,
          status: 'removed',
          delta: {
            statements: -baselinePkg.summary.statements.percentage,
            branches: -baselinePkg.summary.branches.percentage,
            functions: -baselinePkg.summary.functions.percentage,
            lines: -baselinePkg.summary.lines.percentage,
          },
        });
      }
    }

    return deltas;
  }

  /**
   * Check if file is generated
   */
  private isGeneratedFile(path: string): boolean {
    return path.includes('.pb.go') ||
      path.includes('_gen.go') ||
      path.includes('generated') ||
      path.includes('mock_');
  }
}

/**
 * Coverage delta types
 */
interface CoverageDelta {
  summary: SummaryDelta;
  packages: PackageDelta[];
}

interface SummaryDelta {
  statements: number;
  branches: number;
  functions: number;
  lines: number;
}

interface PackageDelta {
  package: string;
  status: 'added' | 'removed' | 'modified';
  delta: SummaryDelta;
}
