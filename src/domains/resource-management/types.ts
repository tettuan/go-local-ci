/**
 * Resource Management Domain Types
 * Following Totality principle
 */

import type { Result } from '../../shared/result.ts';
import { failure, success } from '../../shared/result.ts';
import type { ValidationError } from '../../shared/errors.ts';
import { createValidationError } from '../../shared/errors.ts';

/**
 * Directory information
 */
export interface DirectoryInfo {
  readonly path: string;
  readonly name: string;
  readonly depth: number;
  readonly hasGoFiles: boolean;
  readonly hasTestFiles: boolean;
  readonly hasGoMod: boolean;
  readonly testFileCount: number;
  readonly goFileCount: number;
}

/**
 * Directory hierarchy
 */
export interface DirectoryHierarchy extends DirectoryInfo {
  readonly children: DirectoryHierarchy[];
  readonly packageName?: string;
}

/**
 * Go module information
 */
export interface GoModuleInfo {
  readonly path: string;
  readonly moduleName: string;
  readonly goVersion?: string;
  readonly dependencies: ModuleDependency[];
  readonly replace: ModuleReplace[];
}

/**
 * Module dependency
 */
export interface ModuleDependency {
  readonly module: string;
  readonly version: string;
  readonly indirect: boolean;
}

/**
 * Module replace directive
 */
export interface ModuleReplace {
  readonly old: string;
  readonly new: string;
}

/**
 * Go package information
 */
export interface GoPackageInfo {
  readonly path: string;
  readonly name: string;
  readonly importPath: string;
  readonly goFiles: string[];
  readonly testFiles: string[];
  readonly hasTestFiles: boolean;
  readonly hasBenchmarks: boolean;
  readonly hasExamples: boolean;
  readonly dependencies: string[];
}

/**
 * Project structure
 */
export type ProjectStructure =
  | { type: 'module'; root: string; module: GoModuleInfo; packages: GoPackageInfo[] }
  | { type: 'workspace'; roots: string[]; modules: GoModuleInfo[] }
  | { type: 'simple'; root: string; packages: GoPackageInfo[] };

/**
 * File type classification
 */
export type GoFileType =
  | { type: 'source'; path: string; package: string }
  | { type: 'test'; path: string; package: string; hasTests: boolean; hasBenchmarks: boolean }
  | { type: 'build-ignored'; path: string; reason: string }
  | { type: 'vendor'; path: string }
  | { type: 'generated'; path: string };

/**
 * Resource scan options
 */
export interface ScanOptions {
  readonly maxDepth: number;
  readonly includeVendor: boolean;
  readonly includeHidden: boolean;
  readonly followSymlinks: boolean;
  readonly excludePatterns: string[];
}

/**
 * Resource scan result
 */
export interface ScanResult {
  readonly rootPath: string;
  readonly hierarchy: DirectoryHierarchy;
  readonly packages: GoPackageInfo[];
  readonly totalFiles: number;
  readonly totalDirectories: number;
  readonly scanDuration: number;
}

/**
 * File filter - Smart Constructor
 */
export class FileFilter {
  private constructor(
    private readonly patterns: RegExp[],
    private readonly excludePatterns: RegExp[],
  ) {}

  static create(
    includePatterns: string[],
    excludePatterns: string[],
  ): Result<FileFilter, ValidationError> {
    const includes: RegExp[] = [];
    const excludes: RegExp[] = [];

    // Convert glob patterns to regex
    for (const pattern of includePatterns) {
      try {
        includes.push(this.globToRegex(pattern));
      } catch {
        return failure(createValidationError({
          kind: 'InvalidFormat',
          field: 'includePattern',
          expected: 'valid glob pattern',
          actual: pattern,
        }));
      }
    }

    for (const pattern of excludePatterns) {
      try {
        excludes.push(this.globToRegex(pattern));
      } catch {
        return failure(createValidationError({
          kind: 'InvalidFormat',
          field: 'excludePattern',
          expected: 'valid glob pattern',
          actual: pattern,
        }));
      }
    }

    return success(new FileFilter(includes, excludes));
  }

  matches(path: string): boolean {
    // Check excludes first
    for (const exclude of this.excludePatterns) {
      if (exclude.test(path)) {
        return false;
      }
    }

    // If no includes specified, include all (except excluded)
    if (this.patterns.length === 0) {
      return true;
    }

    // Check includes
    for (const include of this.patterns) {
      if (include.test(path)) {
        return true;
      }
    }

    return false;
  }

  private static globToRegex(glob: string): RegExp {
    // Simple glob to regex conversion
    const regex = glob
      .replace(/\./g, '\\.')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '[^/]')
      .replace(/\*\*/g, '.*');

    return new RegExp(`^${regex}$`);
  }
}

/**
 * Max depth constraint - Smart Constructor
 */
export class MaxDepth {
  private constructor(private readonly depth: number) {}

  static create(depth: number): Result<MaxDepth, ValidationError> {
    if (!Number.isInteger(depth)) {
      return failure(createValidationError({
        kind: 'InvalidFormat',
        field: 'maxDepth',
        expected: 'integer',
        actual: String(depth),
      }));
    }

    if (depth < 0 || depth > 100) {
      return failure(createValidationError({
        kind: 'OutOfRange',
        field: 'maxDepth',
        min: 0,
        max: 100,
        value: depth,
      }));
    }

    return success(new MaxDepth(depth));
  }

  getValue(): number {
    return this.depth;
  }

  isWithinLimit(currentDepth: number): boolean {
    return currentDepth <= this.depth;
  }
}
