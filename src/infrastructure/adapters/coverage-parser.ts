/**
 * Coverage Parser Adapter
 * Parses Go test coverage output
 */

import type { Result } from '../../shared/result.ts';
import { failure, success } from '../../shared/result.ts';
import type { CoverageParser } from '../../domains/search-integration/coverage-analyzer.ts';
import type {
  CoverageData,
  CoverageSummary,
  FileCoverage,
  PackageCoverage,
} from '../../domains/search-integration/types.ts';

/**
 * Mutable types for coverage parsing
 */
type MutableCoverageMetric = {
  total: number;
  covered: number;
  percentage: number;
};

type MutableFileCoverage = {
  file: string;
  statements: MutableCoverageMetric;
  branches: MutableCoverageMetric;
  functions: MutableCoverageMetric;
  lines: MutableCoverageMetric;
};

/**
 * Go coverage parser
 */
class GoCoverageParser implements CoverageParser {
  parse(output: string): Result<CoverageData, Error> {
    try {
      const packages: Map<string, PackageCoverage> = new Map();
      const lines = output.split('\n').filter((line) => line.trim());

      // Parse coverage lines
      // Format: package.go:line.column,line.column count
      const coverageRegex = /^(.+?):(\d+)\.(\d+),(\d+)\.(\d+)\s+(\d+)$/;

      for (const line of lines) {
        // Skip non-coverage lines
        if (line.startsWith('mode:') || line.startsWith('coverage:')) {
          continue;
        }

        const match = coverageRegex.exec(line);
        if (!match) {
          continue;
        }

        const [_, file, _startLine, _startCol, _endLine, _endCol, count] = match;
        const covered = parseInt(count) > 0;

        // Extract package from file path
        const packageName = this.extractPackageName(file);

        // Get or create package coverage
        let pkgCoverage = packages.get(packageName);
        if (!pkgCoverage) {
          pkgCoverage = {
            package: packageName,
            files: [],
            summary: this.createEmptySummary(),
          };
          packages.set(packageName, pkgCoverage);
        }

        // Use a mutable map for file coverage during parsing
        type MutablePackageCoverage = PackageCoverage & {
          _mutableFiles?: Map<string, MutableFileCoverage>;
        };
        const mutablePkg = pkgCoverage as MutablePackageCoverage;
        const mutableFiles = mutablePkg._mutableFiles || new Map<string, MutableFileCoverage>();
        if (!mutablePkg._mutableFiles) {
          mutablePkg._mutableFiles = mutableFiles;
        }

        let fileCoverage = mutableFiles.get(file);
        if (!fileCoverage) {
          fileCoverage = {
            file,
            statements: { total: 0, covered: 0, percentage: 0 },
            branches: { total: 0, covered: 0, percentage: 0 },
            functions: { total: 0, covered: 0, percentage: 0 },
            lines: { total: 0, covered: 0, percentage: 0 },
          };
          mutableFiles.set(file, fileCoverage);
        }

        // Update line coverage
        fileCoverage.lines.total++;
        if (covered) {
          fileCoverage.lines.covered++;
        }

        // Also count as statement
        fileCoverage.statements.total++;
        if (covered) {
          fileCoverage.statements.covered++;
        }
      }

      // Convert mutable files to readonly format and calculate percentages
      const packageArray = Array.from(packages.values());
      for (const pkg of packageArray) {
        // Convert mutable files to proper FileCoverage format
        type MutablePackageCoverage = PackageCoverage & {
          _mutableFiles?: Map<string, MutableFileCoverage>;
          files: FileCoverage[];
          summary: CoverageSummary;
        };
        const mutablePkg = pkg as MutablePackageCoverage;
        const mutableFiles = mutablePkg._mutableFiles;
        if (mutableFiles) {
          mutablePkg.files = Array.from(mutableFiles.values()).map((file): FileCoverage => ({
            file: file.file,
            statements: {
              total: file.statements.total,
              covered: file.statements.covered,
              percentage: this.calculatePercentage(file.statements.covered, file.statements.total),
            },
            branches: {
              total: file.branches.total,
              covered: file.branches.covered,
              percentage: this.calculatePercentage(file.lines.covered, file.lines.total), // Use lines for branches in Go
            },
            functions: {
              total: file.functions.total,
              covered: file.functions.covered,
              percentage: this.calculatePercentage(file.lines.covered, file.lines.total), // Use lines for functions in Go
            },
            lines: {
              total: file.lines.total,
              covered: file.lines.covered,
              percentage: this.calculatePercentage(file.lines.covered, file.lines.total),
            },
          }));
          delete mutablePkg._mutableFiles;
        }

        // Calculate package summary
        mutablePkg.summary = this.calculatePackageSummary(mutablePkg.files);
      }

      // Calculate overall summary
      const summary = this.calculateOverallSummary(packageArray);

      return success({
        packages: packageArray,
        summary,
      });
    } catch (error) {
      return failure(error as Error);
    }
  }

  private extractPackageName(filePath: string): string {
    // Simple heuristic: use directory name
    const parts = filePath.split('/');
    if (parts.length > 1) {
      return parts[parts.length - 2];
    }
    return 'main';
  }

  private calculatePercentage(covered: number, total: number): number {
    return total > 0 ? (covered / total) * 100 : 0;
  }

  private createEmptyMutableSummary(): {
    statements: { total: number; covered: number; percentage: number };
    branches: { total: number; covered: number; percentage: number };
    functions: { total: number; covered: number; percentage: number };
    lines: { total: number; covered: number; percentage: number };
  } {
    return {
      statements: { total: 0, covered: 0, percentage: 0 },
      branches: { total: 0, covered: 0, percentage: 0 },
      functions: { total: 0, covered: 0, percentage: 0 },
      lines: { total: 0, covered: 0, percentage: 0 },
    };
  }

  private createEmptySummary(): CoverageSummary {
    return {
      statements: { total: 0, covered: 0, percentage: 0 },
      branches: { total: 0, covered: 0, percentage: 0 },
      functions: { total: 0, covered: 0, percentage: 0 },
      lines: { total: 0, covered: 0, percentage: 0 },
    };
  }

  private calculatePackageSummary(files: FileCoverage[]): CoverageSummary {
    const summary = this.createEmptyMutableSummary();

    for (const file of files) {
      summary.statements.total += file.statements.total;
      summary.statements.covered += file.statements.covered;
      summary.branches.total += file.branches.total;
      summary.branches.covered += file.branches.covered;
      summary.functions.total += file.functions.total;
      summary.functions.covered += file.functions.covered;
      summary.lines.total += file.lines.total;
      summary.lines.covered += file.lines.covered;
    }

    summary.statements.percentage = this.calculatePercentage(
      summary.statements.covered,
      summary.statements.total,
    );
    summary.branches.percentage = this.calculatePercentage(
      summary.branches.covered,
      summary.branches.total,
    );
    summary.functions.percentage = this.calculatePercentage(
      summary.functions.covered,
      summary.functions.total,
    );
    summary.lines.percentage = this.calculatePercentage(
      summary.lines.covered,
      summary.lines.total,
    );

    return summary;
  }

  private calculateOverallSummary(packages: PackageCoverage[]): CoverageSummary {
    const summary = this.createEmptyMutableSummary();

    for (const pkg of packages) {
      summary.statements.total += pkg.summary.statements.total;
      summary.statements.covered += pkg.summary.statements.covered;
      summary.branches.total += pkg.summary.branches.total;
      summary.branches.covered += pkg.summary.branches.covered;
      summary.functions.total += pkg.summary.functions.total;
      summary.functions.covered += pkg.summary.functions.covered;
      summary.lines.total += pkg.summary.lines.total;
      summary.lines.covered += pkg.summary.lines.covered;
    }

    summary.statements.percentage = this.calculatePercentage(
      summary.statements.covered,
      summary.statements.total,
    );
    summary.branches.percentage = this.calculatePercentage(
      summary.branches.covered,
      summary.branches.total,
    );
    summary.functions.percentage = this.calculatePercentage(
      summary.functions.covered,
      summary.functions.total,
    );
    summary.lines.percentage = this.calculatePercentage(
      summary.lines.covered,
      summary.lines.total,
    );

    return summary;
  }
}

/**
 * Create coverage parser
 */
export function createCoverageParser(): CoverageParser {
  return new GoCoverageParser();
}
