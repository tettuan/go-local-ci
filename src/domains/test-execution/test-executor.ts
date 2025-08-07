/**
 * Test Executor - Core domain logic for test execution
 * Stateless, following Totality principle
 */

import { env as processEnv } from 'node:process';
import type { Result } from '../../shared/result.ts';
import { failure, success } from '../../shared/result.ts';
import type { DomainError } from '../../shared/errors.ts';
import { createDomainError } from '../../shared/errors.ts';
import type {
  ExecutionTarget,
  GoTestOptions,
  ProcessResult,
  TestExecutionResult,
} from './types.ts';
import { PackageImportPath } from './types.ts';

/**
 * Test command builder - pure function
 */
export class GoTestCommandBuilder {
  /**
   * Build go test command arguments
   */
  static build(
    target: ExecutionTarget,
    options: GoTestOptions,
    env?: Record<string, string>,
  ): Result<{ args: string[]; env: Record<string, string> }, DomainError> {
    const args = ['go', 'test'];

    // Add common flags
    if (options.verbose) {
      args.push('-v');
    }

    if (options.race) {
      args.push('-race');
    }

    if (options.cover) {
      args.push('-cover');
    }

    if (options.short) {
      args.push('-short');
    }

    if (options.failFast) {
      args.push('-failfast');
    }

    if (options.timeout > 0) {
      args.push(`-timeout=${options.timeout}s`);
    }

    if (options.parallel && options.parallel > 0) {
      args.push(`-parallel=${options.parallel}`);
    }

    if (options.tags && options.tags.length > 0) {
      args.push(`-tags=${options.tags.join(',')}`);
    }

    // Add target-specific arguments
    switch (target.type) {
      case 'all-packages':
        args.push(target.pattern);
        break;

      case 'directory':
        args.push(target.path.getValue());
        if (target.recursive) {
          args.push('./...');
        }
        break;

      case 'file':
        args.push(target.path.getValue());
        if (target.testName) {
          args.push('-run', target.testName.getValue());
        }
        break;

      case 'package':
        args.push(target.importPath.getValue());
        break;

      default:
        return failure(createDomainError({
          domain: 'execution',
          kind: 'CommandBuildFailed',
          details: { reason: 'Unknown target type', target },
        }));
    }

    // Add build flags if any
    if (options.buildFlags && options.buildFlags.length > 0) {
      args.push(...options.buildFlags);
    }

    // Merge environment variables, filtering out undefined, null, and non-string values
    const cleanedProcessEnv: Record<string, string> = {};
    for (const [key, value] of Object.entries(processEnv)) {
      if (typeof value === 'string') {
        cleanedProcessEnv[key] = value;
      }
    }

    const finalEnv = {
      ...cleanedProcessEnv,
      ...(env || {}),
    };

    return success({ args, env: finalEnv });
  }
}

/**
 * Process executor interface (to be implemented by infrastructure)
 */
export interface ProcessExecutor {
  execute(
    command: string[],
    options: {
      cwd?: string;
      env?: Record<string, string>;
      timeout?: number;
    },
  ): Promise<Result<ProcessResult, Error>>;
}

/**
 * Test executor - orchestrates test execution
 */
export class TestExecutor {
  constructor(
    private readonly processExecutor: ProcessExecutor,
    private readonly workingDirectory: string,
  ) {}

  /**
   * Execute tests for a package path
   */
  test(
    packagePath: string,
    options: GoTestOptions,
  ): Promise<Result<TestExecutionResult, DomainError>> {
    if (packagePath === './...') {
      const target: ExecutionTarget = { type: 'all-packages', pattern: './...' };
      return this.execute(target, options);
    }

    const importPathResult = PackageImportPath.create(packagePath);
    if (!importPathResult.ok) {
      return Promise.resolve(failure(createDomainError({
        domain: 'execution',
        kind: 'CommandBuildFailed',
        details: { message: `Invalid package path: ${packagePath}`, path: packagePath },
      })));
    }

    const target: ExecutionTarget = {
      type: 'package',
      importPath: importPathResult.data,
    };

    return this.execute(target, options);
  }

  /**
   * Execute tests for a target
   */
  async execute(
    target: ExecutionTarget,
    options: GoTestOptions,
    env?: Record<string, string>,
  ): Promise<Result<TestExecutionResult, DomainError>> {
    // Build command
    const commandResult = GoTestCommandBuilder.build(target, options, env);
    if (!commandResult.ok) {
      return commandResult;
    }

    const { args, env: finalEnv } = commandResult.data;
    const startTime = Date.now();

    // Execute process
    const processResult = await this.processExecutor.execute(args, {
      cwd: this.workingDirectory,
      env: finalEnv,
      timeout: options.timeout * 1000, // Convert to milliseconds
    });

    if (!processResult.ok) {
      return failure(createDomainError({
        domain: 'execution',
        kind: 'ProcessSpawnFailed',
        details: {
          command: args.join(' '),
          error: processResult.error.message,
        },
      }));
    }

    const endTime = Date.now();

    // Create execution result
    const result: TestExecutionResult = {
      target,
      processResult: processResult.data,
      startTime,
      endTime,
      success: processResult.data.exitCode === 0,
      status: processResult.data.exitCode === 0 ? 'passed' : 'failed',
      duration: endTime - startTime,
      packages: [], // Will be populated by result analyzer
    };

    return success(result);
  }

  /**
   * Execute multiple targets in sequence
   */
  async executeSequence(
    targets: ExecutionTarget[],
    options: GoTestOptions,
    env?: Record<string, string>,
    stopOnFailure = false,
  ): Promise<Result<TestExecutionResult[], DomainError>> {
    const results: TestExecutionResult[] = [];

    for (const target of targets) {
      const result = await this.execute(target, options, env);

      if (!result.ok) {
        return failure(result.error);
      }

      results.push(result.data);

      if (stopOnFailure && !result.data.success) {
        break;
      }
    }

    return success(results);
  }

  /**
   * Execute multiple targets in parallel
   */
  async executeParallel(
    targets: ExecutionTarget[],
    options: GoTestOptions,
    env?: Record<string, string>,
    maxConcurrency: number = 5,
  ): Promise<Result<TestExecutionResult[], DomainError>> {
    const results: TestExecutionResult[] = [];
    const errors: DomainError[] = [];

    // Execute in batches
    for (let i = 0; i < targets.length; i += maxConcurrency) {
      const batch = targets.slice(i, i + maxConcurrency);
      const batchPromises = batch.map((target) => this.execute(target, options, env));

      const batchResults = await Promise.all(batchPromises);

      for (const result of batchResults) {
        if (result.ok) {
          results.push(result.data);
        } else {
          errors.push(result.error);
        }
      }
    }

    if (errors.length > 0) {
      return failure(createDomainError({
        domain: 'execution',
        kind: 'ProcessSpawnFailed',
        details: { errors, message: 'Multiple execution failures' },
      }));
    }

    return success(results);
  }
}
