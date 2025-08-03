import type { GoCIConfig } from '../types/go-ci-config.ts';
import type { GoCIResult, StageResult } from '../types/go-ci-result.ts';
import type { GoCILogger } from './go-ci-logger.ts';
import { ProcessRunner } from '../infrastructure/process-runner.ts';
import type { ProcessResult } from '../infrastructure/process-runner.ts';
import { FileSystemService } from '../infrastructure/file-system-service.ts';
import { GoProjectDiscovery } from '../infrastructure/go-project-discovery.ts';
import type { Result } from '../utils/result.ts';
import { success, failure } from '../utils/result.ts';

/**
 * Execution result for a batch of packages
 */
interface ExecutionResult {
  success: boolean;
  packages: string[];
  processResult?: ProcessResult;
}

/**
 * Main Go CI runner class
 */
export class GoCI {
  private constructor(
    private readonly logger: GoCILogger,
    private readonly config: GoCIConfig,
    private readonly processRunner: ProcessRunner,
    private readonly fileSystem: FileSystemService,
    private readonly projectDiscovery: GoProjectDiscovery,
  ) {}

  /**
   * Creates a new Go CI runner instance
   */
  static async create(
    logger: GoCILogger,
    config: GoCIConfig,
    workingDirectory: string,
  ): Promise<Result<GoCI, Error>> {
    try {
      const processRunner = new ProcessRunner();
      const fileSystem = new FileSystemService();
      const projectDiscovery = new GoProjectDiscovery(fileSystem);

      // Verify working directory exists
      if (!await fileSystem.exists(workingDirectory)) {
        return failure(new Error(`Working directory does not exist: ${workingDirectory}`));
      }

      // Verify Go is installed
      const goCheckResult = await processRunner.run('go', ['version'], { cwd: workingDirectory });
      if (!goCheckResult.ok || !goCheckResult.data.success) {
        return failure(new Error('Go is not installed or not accessible'));
      }

      return success(new GoCI(logger, config, processRunner, fileSystem, projectDiscovery));
    } catch (error) {
      if (error instanceof Error) {
        return failure(error);
      }
      return failure(new Error('Failed to create Go CI runner'));
    }
  }

  /**
   * Runs the complete Go CI pipeline
   */
  async run(): Promise<GoCIResult> {
    const startTime = Date.now();
    this.logger.logInfo('Starting Go CI pipeline...');

    const stages: StageResult[] = [];
    let totalPackages = 0;
    const failedPackages: string[] = [];

    try {
      // Discover packages
      const targetDir = this.config.hierarchy 
        ? this.fileSystem.joinPath(this.config.workingDirectory, this.config.hierarchy)
        : this.config.workingDirectory;

      const packagesResult = await this.projectDiscovery.getTestablePackages(targetDir);
      if (!packagesResult.ok) {
        return this.createFailureResult(startTime, stages, 0, [], `Failed to discover packages: ${packagesResult.error.message}`);
      }

      const packages = packagesResult.data;
      totalPackages = packages.length;

      if (packages.length === 0) {
        this.logger.logWarning('No Go packages found to process');
        return this.createSuccessResult(startTime, stages, 0);
      }

      this.logger.logInfo(`Found ${packages.length} packages to process`);

      // Run pipeline stages
      const stageResults = await this.runPipelineStages(packages);
      stages.push(...stageResults);

      // Collect failed packages
      for (const stage of stages) {
        if (!stage.success && stage.failedPackages) {
          failedPackages.push(...stage.failedPackages);
        }
      }

      // Check overall success
      const success = stages.every(stage => stage.success);
      
      if (success) {
        return this.createSuccessResult(startTime, stages, totalPackages);
      } else {
        return this.createFailureResult(startTime, stages, totalPackages, failedPackages, 'One or more stages failed');
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return this.createFailureResult(startTime, stages, totalPackages, failedPackages, errorMessage);
    }
  }

  private async runPipelineStages(packages: string[]): Promise<StageResult[]> {
    const stages: StageResult[] = [];

    // Stage 1: Go Module Check
    stages.push(await this.runGoModCheck());

    // Stage 2: Build Check
    if (stages[stages.length - 1].success || this.config.continueOnError) {
      stages.push(await this.runBuildCheck(packages));
    }

    // Stage 3: Test Execution
    if (stages[stages.length - 1].success || this.config.continueOnError) {
      stages.push(await this.runTests(packages));
    }

    // Stage 4: Go Vet
    if (stages[stages.length - 1].success || this.config.continueOnError) {
      stages.push(await this.runGoVet(packages));
    }

    // Stage 5: Format Check
    if (stages[stages.length - 1].success || this.config.continueOnError) {
      stages.push(await this.runFormatCheck(packages));
    }

    // Stage 6: Lint (optional)
    if (stages[stages.length - 1].success || this.config.continueOnError) {
      stages.push(await this.runLint(packages));
    }

    return stages;
  }

  private async runGoModCheck(): Promise<StageResult> {
    const startTime = Date.now();
    this.logger.logStageStart('Go Module Check');

    try {
      const targetDir = this.config.hierarchy 
        ? this.fileSystem.joinPath(this.config.workingDirectory, this.config.hierarchy)
        : this.config.workingDirectory;

      // Check if go.mod exists
      const goModPath = this.fileSystem.joinPath(targetDir, 'go.mod');
      const hasGoMod = await this.fileSystem.exists(goModPath);

      if (!hasGoMod) {
        const duration = Date.now() - startTime;
        this.logger.logStageComplete('Go Module Check', duration, false);
        return {
          stageName: 'Go Module Check',
          success: false,
          duration,
          error: 'No go.mod found in target directory',
        };
      }

      // Run go mod verify
      const result = await this.processRunner.run('go', ['mod', 'verify'], {
        cwd: this.config.workingDirectory,
      });

      const duration = Date.now() - startTime;
      const success = result.ok && result.data.success;

      this.logger.logStageComplete('Go Module Check', duration, success);

      if (!success) {
        const error = result.ok ? result.data.stderr : result.error.message;
        this.logger.logError(`Go module verification failed: ${error}`);
      }

      return {
        stageName: 'Go Module Check',
        success,
        duration,
        ...(result.ok && result.data.stdout ? { output: result.data.stdout } : {}),
        ...(result.ok ? (result.data.stderr ? { error: result.data.stderr } : {}) : { error: result.error.message }),
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.logStageComplete('Go Module Check', duration, false);
      this.logger.logError(`Go Module Check failed: ${errorMessage}`);

      return {
        stageName: 'Go Module Check',
        success: false,
        duration,
        error: errorMessage,
      };
    }
  }

  private async runBuildCheck(packages: string[]): Promise<StageResult> {
    const startTime = Date.now();
    this.logger.logStageStart('Build Check');

    try {
      const failedPackages: string[] = [];
      
      // Execute based on mode
      const results = await this.executeByMode(packages, async (pkgs) => {
        const args = ['build'];
        if (this.config.verbose) {
          args.push('-v');
        }
        args.push(...pkgs);

        return await this.processRunner.run('go', args, {
          cwd: this.config.workingDirectory,
        });
      });

      for (const result of results) {
        if (!result.success) {
          failedPackages.push(...result.packages);
        }
      }

      const duration = Date.now() - startTime;
      const success = failedPackages.length === 0;

      this.logger.logStageComplete('Build Check', duration, success);

      if (!success) {
        this.logger.logError(`Build failed for ${failedPackages.length} packages`);
        for (const pkg of failedPackages) {
          this.logger.logPackageError(pkg, 'Build failed');
        }
      }

      return {
        stageName: 'Build Check',
        success,
        duration,
        failedPackages,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.logStageComplete('Build Check', duration, false);
      this.logger.logError(`Build Check failed: ${errorMessage}`);

      return {
        stageName: 'Build Check',
        success: false,
        duration,
        error: errorMessage,
      };
    }
  }

  private async runTests(packages: string[]): Promise<StageResult> {
    const startTime = Date.now();
    this.logger.logStageStart('Test Execution');

    try {
      const failedPackages: string[] = [];
      
      // Execute based on mode
      const results = await this.executeByMode(packages, async (pkgs) => {
        const args = ['test'];
        if (this.config.verbose) {
          args.push('-v');
        }
        if (this.config.testFilter) {
          args.push('-run', this.config.testFilter);
        }
        args.push(...pkgs);

        return await this.processRunner.run('go', args, {
          cwd: this.config.workingDirectory,
        });
      });

      for (const result of results) {
        if (!result.success) {
          failedPackages.push(...result.packages);
        }
      }

      const duration = Date.now() - startTime;
      const success = failedPackages.length === 0;

      this.logger.logStageComplete('Test Execution', duration, success);

      if (!success) {
        this.logger.logError(`Tests failed for ${failedPackages.length} packages`);
        for (const pkg of failedPackages) {
          this.logger.logPackageError(pkg, 'Tests failed');
        }
      }

      return {
        stageName: 'Test Execution',
        success,
        duration,
        failedPackages,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.logStageComplete('Test Execution', duration, false);
      this.logger.logError(`Test Execution failed: ${errorMessage}`);

      return {
        stageName: 'Test Execution',
        success: false,
        duration,
        error: errorMessage,
      };
    }
  }

  private async runGoVet(packages: string[]): Promise<StageResult> {
    const startTime = Date.now();
    this.logger.logStageStart('Go Vet');

    try {
      const failedPackages: string[] = [];
      
      // Execute based on mode
      const results = await this.executeByMode(packages, async (pkgs) => {
        const args = ['vet'];
        args.push(...pkgs);

        return await this.processRunner.run('go', args, {
          cwd: this.config.workingDirectory,
        });
      });

      for (const result of results) {
        if (!result.success) {
          failedPackages.push(...result.packages);
        }
      }

      const duration = Date.now() - startTime;
      const success = failedPackages.length === 0;

      this.logger.logStageComplete('Go Vet', duration, success);

      if (!success) {
        this.logger.logError(`Go vet failed for ${failedPackages.length} packages`);
        for (const pkg of failedPackages) {
          this.logger.logPackageError(pkg, 'Go vet failed');
        }
      }

      return {
        stageName: 'Go Vet',
        success,
        duration,
        failedPackages,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.logStageComplete('Go Vet', duration, false);
      this.logger.logError(`Go Vet failed: ${errorMessage}`);

      return {
        stageName: 'Go Vet',
        success: false,
        duration,
        error: errorMessage,
      };
    }
  }

  private async runFormatCheck(packages: string[]): Promise<StageResult> {
    const startTime = Date.now();
    this.logger.logStageStart('Format Check');

    try {
      const failedPackages: string[] = [];
      
      // Execute gofmt check
      const results = await this.executeByMode(packages, async (pkgs) => {
        // Use gofmt -l to list files that need formatting
        const args = ['-l'];
        
        // Add all .go files from packages
        const allFiles: string[] = [];
        for (const pkg of pkgs) {
          const packageDir = pkg === '.' ? this.config.workingDirectory : 
            this.fileSystem.joinPath(this.config.workingDirectory, pkg.replace('./', ''));
          const goFiles = await this.fileSystem.findGoFiles(packageDir);
          allFiles.push(...goFiles);
        }

        if (allFiles.length === 0) {
          return { ok: true, data: { success: true, code: 0, stdout: '', stderr: '', duration: 0 } };
        }

        args.push(...allFiles);

        return await this.processRunner.run('gofmt', args, {
          cwd: this.config.workingDirectory,
        });
      });

      for (const result of results) {
        if (!result.success || (result.processResult && result.processResult.stdout.trim())) {
          failedPackages.push(...result.packages);
        }
      }

      const duration = Date.now() - startTime;
      const success = failedPackages.length === 0;

      this.logger.logStageComplete('Format Check', duration, success);

      if (!success) {
        this.logger.logError(`Format check failed for ${failedPackages.length} packages`);
        for (const pkg of failedPackages) {
          this.logger.logPackageError(pkg, 'Files need formatting');
        }
      }

      return {
        stageName: 'Format Check',
        success,
        duration,
        failedPackages,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.logStageComplete('Format Check', duration, false);
      this.logger.logError(`Format Check failed: ${errorMessage}`);

      return {
        stageName: 'Format Check',
        success: false,
        duration,
        error: errorMessage,
      };
    }
  }

  private async runLint(packages: string[]): Promise<StageResult> {
    const startTime = Date.now();
    this.logger.logStageStart('Lint');

    try {
      // Check if golangci-lint is available
      const linterCheck = await this.processRunner.run('golangci-lint', ['--version'], {
        cwd: this.config.workingDirectory,
      });

      if (!linterCheck.ok || !linterCheck.data.success) {
        // Linter not available, skip with warning
        const duration = Date.now() - startTime;
        this.logger.logWarning('golangci-lint not available, skipping lint stage');
        this.logger.logStageComplete('Lint', duration, true);

        return {
          stageName: 'Lint',
          success: true,
          duration,
          output: 'Skipped: golangci-lint not available',
        };
      }

      const failedPackages: string[] = [];
      
      // Execute based on mode
      const results = await this.executeByMode(packages, async (pkgs) => {
        const args = ['run'];
        for (const pkg of pkgs) {
          args.push(`${pkg}/...`);
        }

        return await this.processRunner.run('golangci-lint', args, {
          cwd: this.config.workingDirectory,
        });
      });

      for (const result of results) {
        if (!result.success) {
          failedPackages.push(...result.packages);
        }
      }

      const duration = Date.now() - startTime;
      const success = failedPackages.length === 0;

      this.logger.logStageComplete('Lint', duration, success);

      if (!success) {
        this.logger.logError(`Lint failed for ${failedPackages.length} packages`);
        for (const pkg of failedPackages) {
          this.logger.logPackageError(pkg, 'Lint issues found');
        }
      }

      return {
        stageName: 'Lint',
        success,
        duration,
        failedPackages,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.logStageComplete('Lint', duration, false);
      this.logger.logError(`Lint failed: ${errorMessage}`);

      return {
        stageName: 'Lint',
        success: false,
        duration,
        error: errorMessage,
      };
    }
  }

  private async executeByMode(
    packages: string[],
    executor: (packages: string[]) => Promise<Result<ProcessResult, Error>>,
  ): Promise<ExecutionResult[]> {
    switch (this.config.mode) {
      case 'all':
        return await this.executeAll(packages, executor);
      case 'batch':
        return await this.executeBatch(packages, executor);
      case 'single-package':
        return await this.executeSinglePackage(packages, executor);
      default:
        throw new Error(`Unknown execution mode: ${this.config.mode}`);
    }
  }

  private async executeAll(
    packages: string[],
    executor: (packages: string[]) => Promise<Result<ProcessResult, Error>>,
  ): Promise<ExecutionResult[]> {
    try {
      const result = await executor(packages);
      const success = result.ok && result.data.success;
      
      if (this.config.enableFallback && !success) {
        this.logger.logWarning('All mode failed, falling back to batch mode');
        return await this.executeBatch(packages, executor);
      }

      const resultObj: ExecutionResult = {
        success,
        packages: success ? [] : packages,
      };
      
      if (result.ok) {
        resultObj.processResult = result.data;
      }

      return [resultObj];
    } catch (error) {
      if (this.config.enableFallback) {
        this.logger.logWarning('All mode failed, falling back to batch mode');
        return await this.executeBatch(packages, executor);
      }
      throw error;
    }
  }

  private async executeBatch(
    packages: string[],
    executor: (packages: string[]) => Promise<Result<ProcessResult, Error>>,
  ): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];
    
    for (let i = 0; i < packages.length; i += this.config.batchSize) {
      const batch = packages.slice(i, i + this.config.batchSize);
      
      try {
        const result = await executor(batch);
        const success = result.ok && result.data.success;
        
        if (this.config.enableFallback && !success) {
          // Fall back to single package mode for this batch
          for (const pkg of batch) {
            try {
              const singleResult = await executor([pkg]);
              const singleSuccess = singleResult.ok && singleResult.data.success;
              const resultObj: ExecutionResult = {
                success: singleSuccess,
                packages: singleSuccess ? [] : [pkg],
              };
              if (singleResult.ok) {
                resultObj.processResult = singleResult.data;
              }
              results.push(resultObj);
            } catch {
              results.push({
                success: false,
                packages: [pkg],
              });
            }
          }
        } else {
          const resultObj: ExecutionResult = {
            success,
            packages: success ? [] : batch,
          };
          if (result.ok) {
            resultObj.processResult = result.data;
          }
          results.push(resultObj);
        }

        if (this.config.stopOnFirstError && !success) {
          break;
        }
      } catch {
        if (this.config.enableFallback) {
          // Fall back to single package mode for this batch
          for (const pkg of batch) {
            try {
              const singleResult = await executor([pkg]);
              const singleSuccess = singleResult.ok && singleResult.data.success;
              const resultObj: ExecutionResult = {
                success: singleSuccess,
                packages: singleSuccess ? [] : [pkg],
              };
              if (singleResult.ok) {
                resultObj.processResult = singleResult.data;
              }
              results.push(resultObj);
            } catch {
              results.push({
                success: false,
                packages: [pkg],
              });
            }
          }
        } else {
          results.push({
            success: false,
            packages: batch,
          });
        }

        if (this.config.stopOnFirstError) {
          break;
        }
      }
    }

    return results;
  }

  private async executeSinglePackage(
    packages: string[],
    executor: (packages: string[]) => Promise<Result<ProcessResult, Error>>,
  ): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];
    
    for (const pkg of packages) {
      try {
        const result = await executor([pkg]);
        const success = result.ok && result.data.success;
        
        const resultObj: ExecutionResult = {
          success,
          packages: success ? [] : [pkg],
        };
        
        if (result.ok) {
          resultObj.processResult = result.data;
        }
        
        results.push(resultObj);

        if (this.config.stopOnFirstError && !success) {
          break;
        }
      } catch {
        results.push({
          success: false,
          packages: [pkg],
        });

        if (this.config.stopOnFirstError) {
          break;
        }
      }
    }

    return results;
  }

  private createSuccessResult(startTime: number, stages: StageResult[], totalPackages: number): GoCIResult {
    const duration = Date.now() - startTime;
    const summary = `✅ All stages completed successfully. Processed ${totalPackages} packages in ${duration.toFixed(0)}ms.`;
    
    this.logger.logSuccess('Go CI pipeline completed successfully!');
    this.logger.logSummary(summary);

    return {
      success: true,
      duration,
      stages,
      totalPackages,
      failedPackages: [],
      summary,
    };
  }

  private createFailureResult(
    startTime: number,
    stages: StageResult[],
    totalPackages: number,
    failedPackages: string[],
    errorMessage: string,
  ): GoCIResult {
    const duration = Date.now() - startTime;
    const summary = `❌ Go CI pipeline failed: ${errorMessage}. ${failedPackages.length} packages failed out of ${totalPackages} total.`;
    
    this.logger.logError('Go CI pipeline failed!');
    this.logger.logSummary(summary);

    return {
      success: false,
      duration,
      stages,
      totalPackages,
      failedPackages,
      summary,
    };
  }
}
