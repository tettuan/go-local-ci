/**
 * Test Execution Engine Domain Types
 * Following Totality principle
 */

import type { Result } from '../../shared/result.ts';
import { failure, success } from '../../shared/result.ts';
import type { ValidationError } from '../../shared/errors.ts';
import { createValidationError } from '../../shared/errors.ts';

/**
 * Execution target - Discriminated Union
 */
export type ExecutionTarget =
  | { type: 'all-packages'; pattern: string }
  | { type: 'directory'; path: DirectoryPath; recursive: boolean }
  | { type: 'file'; path: FilePath; testName?: TestName }
  | { type: 'package'; importPath: PackageImportPath };

/**
 * Go test command options
 */
export interface GoTestOptions {
  readonly verbose: boolean;
  readonly timeout: number; // in seconds
  readonly race: boolean;
  readonly cover: boolean;
  readonly short: boolean;
  readonly failFast: boolean;
  readonly parallel?: number;
  readonly tags?: string[];
  readonly buildFlags?: string[];
}

/**
 * Process execution result
 */
export interface ProcessResult {
  readonly exitCode: number;
  readonly signal?: string;
  readonly stdout: string;
  readonly stderr: string;
  readonly duration: number; // in milliseconds
  readonly killed: boolean;
}

/**
 * Test execution result
 */
export interface TestExecutionResult {
  readonly target: ExecutionTarget;
  readonly processResult: ProcessResult;
  readonly startTime: number;
  readonly endTime: number;
  readonly success: boolean;
  // Convenience properties for backward compatibility with report generator
  readonly status: string;
  readonly duration: number; // milliseconds
  readonly packages: TestPackageResult[];
}

/**
 * Test package result (for compatibility with report generator)
 */
export interface TestPackageResult {
  readonly name: string;
  readonly tests: TestResult[];
  readonly passed?: boolean;
  readonly duration?: number;
}

/**
 * Individual test result (for compatibility with report generator)
 */
export interface TestResult {
  readonly name: string;
  readonly passed: boolean;
  readonly duration?: number;
  readonly output?: string;
}

/**
 * Directory path - Smart Constructor
 */
export class DirectoryPath {
  private constructor(private readonly path: string) {}

  static create(path: string): Result<DirectoryPath, ValidationError> {
    if (!path || path.trim().length === 0) {
      return failure(createValidationError({
        kind: 'EmptyInput',
        field: 'directoryPath',
      }));
    }

    const trimmed = path.trim();
    // Basic path validation
    if (trimmed.includes('\0')) {
      return failure(createValidationError({
        kind: 'InvalidFormat',
        field: 'directoryPath',
        expected: 'valid path without null bytes',
        actual: 'path with null bytes',
      }));
    }

    return success(new DirectoryPath(trimmed));
  }

  getValue(): string {
    return this.path;
  }

  join(segment: string): Result<DirectoryPath, ValidationError> {
    return DirectoryPath.create(`${this.path}/${segment}`);
  }
}

/**
 * File path - Smart Constructor
 */
export class FilePath {
  private constructor(private readonly path: string) {}

  static create(path: string): Result<FilePath, ValidationError> {
    if (!path || path.trim().length === 0) {
      return failure(createValidationError({
        kind: 'EmptyInput',
        field: 'filePath',
      }));
    }

    const trimmed = path.trim();

    // Must end with .go for test files
    if (!trimmed.endsWith('.go')) {
      return failure(createValidationError({
        kind: 'PatternMismatch',
        field: 'filePath',
        pattern: '*.go',
        value: trimmed,
      }));
    }

    return success(new FilePath(trimmed));
  }

  getValue(): string {
    return this.path;
  }

  getDirectory(): Result<DirectoryPath, ValidationError> {
    const lastSlash = this.path.lastIndexOf('/');
    if (lastSlash === -1) {
      return DirectoryPath.create('.');
    }
    return DirectoryPath.create(this.path.substring(0, lastSlash));
  }

  getFileName(): string {
    const lastSlash = this.path.lastIndexOf('/');
    return lastSlash === -1 ? this.path : this.path.substring(lastSlash + 1);
  }
}

/**
 * Test name - Smart Constructor
 */
export class TestName {
  private constructor(private readonly name: string) {}

  static create(name: string): Result<TestName, ValidationError> {
    if (!name || name.trim().length === 0) {
      return failure(createValidationError({
        kind: 'EmptyInput',
        field: 'testName',
      }));
    }

    const trimmed = name.trim();

    // Go test name pattern validation
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed)) {
      return failure(createValidationError({
        kind: 'PatternMismatch',
        field: 'testName',
        pattern: 'valid Go identifier',
        value: trimmed,
      }));
    }

    return success(new TestName(trimmed));
  }

  getValue(): string {
    return this.name;
  }
}

/**
 * Package import path - Smart Constructor
 */
export class PackageImportPath {
  private constructor(private readonly path: string) {}

  static create(path: string): Result<PackageImportPath, ValidationError> {
    if (!path || path.trim().length === 0) {
      return failure(createValidationError({
        kind: 'EmptyInput',
        field: 'packageImportPath',
      }));
    }

    const trimmed = path.trim();

    // Basic Go import path validation
    if (!/^[a-zA-Z0-9_\-./]+$/.test(trimmed)) {
      return failure(createValidationError({
        kind: 'PatternMismatch',
        field: 'packageImportPath',
        pattern: 'valid Go import path',
        value: trimmed,
      }));
    }

    return success(new PackageImportPath(trimmed));
  }

  getValue(): string {
    return this.path;
  }
}

/**
 * Exit code classification
 */
export type ExitCodeClassification =
  | { type: 'success'; code: 0 }
  | { type: 'test-failure'; code: 1 }
  | { type: 'build-error'; code: 2 }
  | { type: 'timeout'; code: 124 }
  | { type: 'killed'; code: number; signal: string }
  | { type: 'unknown'; code: number };

/**
 * Classify exit code
 */
export const classifyExitCode = (result: ProcessResult): ExitCodeClassification => {
  if (result.exitCode === 0) {
    return { type: 'success', code: 0 };
  }

  if (result.exitCode === 1 && !result.killed) {
    return { type: 'test-failure', code: 1 };
  }

  if (result.exitCode === 2) {
    return { type: 'build-error', code: 2 };
  }

  if (result.exitCode === 124) {
    return { type: 'timeout', code: 124 };
  }

  if (result.killed && result.signal) {
    return { type: 'killed', code: result.exitCode, signal: result.signal };
  }

  return { type: 'unknown', code: result.exitCode };
};
