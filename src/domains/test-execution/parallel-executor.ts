/**
 * Parallel Test Executor
 * Optimized for concurrent test execution
 */

import type { Result } from '../../shared/result.ts';
import { failure, success } from '../../shared/result.ts';
import type { DomainError } from '../../shared/errors.ts';
import type { GoTestOptions, TestExecutionResult } from './types.ts';
import type { TestExecutor } from './test-executor.ts';

/**
 * Parallel execution configuration
 */
export interface ParallelConfig {
  readonly maxConcurrency: number;
  readonly batchSize: number;
  readonly failFast: boolean;
}

/**
 * Batch of tests to execute
 */
interface TestBatch {
  readonly packages: string[];
  readonly priority: number;
}

/**
 * Parallel Test Executor
 */
export class ParallelTestExecutor {
  constructor(
    private readonly executor: TestExecutor,
    private readonly config: ParallelConfig,
  ) {}

  /**
   * Execute tests in parallel batches
   */
  async executeParallel(
    packages: string[],
    options: GoTestOptions,
  ): Promise<Result<TestExecutionResult[], DomainError>> {
    if (packages.length === 0) {
      return success([]);
    }

    // Create batches based on configuration
    const batches = this.createBatches(packages);

    // Execute batches with concurrency control
    const results = await this.executeBatches(batches, options);

    return results;
  }

  /**
   * Create optimized batches for parallel execution
   */
  private createBatches(packages: string[]): TestBatch[] {
    const batches: TestBatch[] = [];
    const batchSize = this.config.batchSize;

    // Sort packages by estimated complexity (simple heuristic: path depth)
    const sortedPackages = [...packages].sort((a, b) => {
      const depthA = a.split('/').length;
      const depthB = b.split('/').length;
      return depthA - depthB;
    });

    // Create batches with priority
    for (let i = 0; i < sortedPackages.length; i += batchSize) {
      batches.push({
        packages: sortedPackages.slice(i, i + batchSize),
        priority: Math.floor(i / batchSize), // Lower index = higher priority
      });
    }

    return batches;
  }

  /**
   * Execute batches with concurrency control
   */
  private async executeBatches(
    batches: TestBatch[],
    options: GoTestOptions,
  ): Promise<Result<TestExecutionResult[], DomainError>> {
    const results: TestExecutionResult[] = [];
    const errors: DomainError[] = [];

    // Create a pool of concurrent executions
    const executing: Promise<void>[] = [];

    for (const batch of batches) {
      // Wait if we've reached max concurrency
      if (executing.length >= this.config.maxConcurrency) {
        await Promise.race(executing);
      }

      // Execute batch
      const execution = this.executeBatch(batch, options).then((result) => {
        if (result.ok) {
          results.push(...result.data);
        } else {
          errors.push(result.error);

          // Fail fast if configured
          if (this.config.failFast) {
            throw result.error;
          }
        }

        // Remove from executing array
        const index = executing.indexOf(execution);
        if (index > -1) {
          executing.splice(index, 1);
        }
      });

      executing.push(execution);
    }

    // Wait for all remaining executions
    try {
      await Promise.all(executing);
    } catch (error) {
      if (this.config.failFast) {
        return failure(error as DomainError);
      }
    }

    // Return results even if some batches failed
    if (errors.length > 0 && results.length === 0) {
      return failure(errors[0]);
    }

    return success(results);
  }

  /**
   * Execute a single batch
   */
  private async executeBatch(
    batch: TestBatch,
    options: GoTestOptions,
  ): Promise<Result<TestExecutionResult[], DomainError>> {
    const results: TestExecutionResult[] = [];

    // Execute tests in batch sequentially
    for (const pkg of batch.packages) {
      const result = await this.executor.test(pkg, options);

      if (result.ok) {
        results.push(result.data);
      } else {
        // Continue with other packages in batch unless fail-fast
        if (this.config.failFast) {
          return failure(result.error);
        }

        // Create a failed result entry
        results.push({
          target: pkg,
          success: false,
          exitCode: 1,
          duration: 0,
          stdout: '',
          stderr: `Test execution failed: ${result.error.kind}`,
          packages: [pkg],
        });
      }
    }

    return success(results);
  }

  /**
   * Optimize execution order based on historical data
   */
  optimizeExecutionOrder(
    packages: string[],
    historicalData?: Map<string, number>,
  ): string[] {
    if (!historicalData || historicalData.size === 0) {
      return packages;
    }

    // Sort by historical execution time (fastest first)
    return [...packages].sort((a, b) => {
      const timeA = historicalData.get(a) ?? Number.MAX_VALUE;
      const timeB = historicalData.get(b) ?? Number.MAX_VALUE;
      return timeA - timeB;
    });
  }
}
