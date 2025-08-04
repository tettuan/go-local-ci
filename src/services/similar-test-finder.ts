/**
 * Service for finding and executing tests on similar files when a test fails
 */

import type { Result } from '../utils/result.ts';
import { failure, success } from '../utils/result.ts';
import { SerenaMCPClient } from '../infrastructure/serena-mcp-client.ts';
import { FileSystemService } from '../infrastructure/file-system-service.ts';
import { ProcessRunner } from '../infrastructure/process-runner.ts';
import type { GoCILogger } from '../core/go-ci-logger.ts';

export interface SimilarTestResult {
  originalFile: string;
  similarFiles: string[];
  testResults: Map<string, boolean>;
  totalSimilarFiles: number;
  successfulTests: number;
  failedTests: number;
}

export class SimilarTestFinder {
  private readonly serenaMCP: SerenaMCPClient;

  constructor(
    private readonly logger: GoCILogger,
    private readonly fileSystem: FileSystemService,
    private readonly processRunner: ProcessRunner,
  ) {
    this.serenaMCP = new SerenaMCPClient();
  }

  /**
   * Find similar files for a failed test and run tests on them
   */
  async findAndTestSimilarFiles(
    failedTestFile: string,
    workingDirectory: string,
  ): Promise<Result<SimilarTestResult, Error>> {
    try {
      // Check if Serena MCP is available
      const isAvailable = await this.serenaMCP.isAvailable();
      if (!isAvailable) {
        this.logger.logWarning('Serena MCP is not available, skipping similar file search');
        return success({
          originalFile: failedTestFile,
          similarFiles: [],
          testResults: new Map(),
          totalSimilarFiles: 0,
          successfulTests: 0,
          failedTests: 0,
        });
      }

      this.logger.logInfo(`Searching for files similar to failed test: ${failedTestFile}`);

      // Search for similar files
      const similarFilesResult = await this.serenaMCP.findSimilarFiles(failedTestFile, {
        maxResults: 10,
        minSimilarity: 0.7,
        searchPattern: '*_test.go',
        excludePatterns: ['vendor/', 'testdata/', '.git/'],
      });

      if (!similarFilesResult.ok) {
        this.logger.logError(`Failed to find similar files: ${similarFilesResult.error.message}`);
        return failure(similarFilesResult.error);
      }

      const similarFiles = similarFilesResult.data.map((f) => f.path);
      if (similarFiles.length === 0) {
        this.logger.logInfo('No similar files found');
        return success({
          originalFile: failedTestFile,
          similarFiles: [],
          testResults: new Map(),
          totalSimilarFiles: 0,
          successfulTests: 0,
          failedTests: 0,
        });
      }

      this.logger.logInfo(`Found ${similarFiles.length} similar files, running tests concurrently`);

      // Run tests on similar files concurrently
      const testResults = await this.runTestsConcurrently(similarFiles, workingDirectory);

      // Count results
      let successfulTests = 0;
      let failedTests = 0;
      for (const [_, success] of testResults) {
        if (success) {
          successfulTests++;
        } else {
          failedTests++;
        }
      }

      const result: SimilarTestResult = {
        originalFile: failedTestFile,
        similarFiles,
        testResults,
        totalSimilarFiles: similarFiles.length,
        successfulTests,
        failedTests,
      };

      // Log summary
      this.logger.logInfo(
        `Similar files test summary: ${successfulTests} passed, ${failedTests} failed out of ${similarFiles.length} files`,
      );

      return success(result);
    } catch (error) {
      if (error instanceof Error) {
        return failure(error);
      }
      return failure(new Error('Unknown error occurred while finding and testing similar files'));
    }
  }

  /**
   * Run tests on multiple files concurrently
   */
  private async runTestsConcurrently(
    testFiles: string[],
    workingDirectory: string,
  ): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    const promises: Promise<void>[] = [];

    for (const file of testFiles) {
      const promise = this.runSingleTest(file, workingDirectory).then((success) => {
        results.set(file, success);
        if (!success) {
          this.logger.logPackageError(file, 'Test failed on similar file');
        }
      });
      promises.push(promise);
    }

    await Promise.all(promises);
    return results;
  }

  /**
   * Run test on a single file
   */
  private async runSingleTest(testFile: string, workingDirectory: string): Promise<boolean> {
    try {
      // Extract package path from file path
      const packagePath = this.fileSystem.getDirectoryPath(testFile);

      const result = await this.processRunner.run(
        'go',
        ['test', '-v', packagePath],
        { cwd: workingDirectory },
      );

      return result.ok && result.data.success;
    } catch {
      return false;
    }
  }
}
