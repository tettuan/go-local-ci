/**
 * Domain Orchestrator - Compact Commit Semantic Units Integration
 * 
 * This orchestrator integrates all 6 domain semantic units following the 
 * domain-driven design principles defined in the specification.
 */

import type { Result } from '../utils/result.ts';
import { success, failure } from '../utils/result.ts';

// Application Control Domain
import { 
  ApplicationStateManager, 
  Configuration, 
  type ApplicationEvent,
  type ApplicationState
} from './application-control/application-state.ts';

// Test Execution Engine Domain
import { 
  GoTestCommand, 
  ExitCodeChecker, 
  GoTestResultAnalyzer,
  type GoTestResult,
  type ExecutionTarget
} from './test-execution/go-test-command.ts';

// Error Analysis & Execution Control Domain
import { 
  StrategySelector, 
  ExecutionController,
  type ExecutionStrategy,
  type FallbackTrigger
} from './error-control/execution-strategy.ts';

// File & Resource Management Domain
import { 
  GoProjectAnalyzer,
  type DirectoryHierarchy,
  type DiscoveredResource
} from './resource-management/resource-discovery.ts';

// Search & Integration Domain
import { 
  LocalSimilarityAnalyzer, 
  SimilaritySearchOrchestrator,
  type SimilaritySearchCriteria,
  type SimilaritySearchResult,
  type SimilarFile
} from './search-integration/similar-test-discovery.ts';

// Execution Environment Control Domain
import { 
  EnvironmentController, 
  OutputPassthroughHandler,
  type EnvironmentConfig,
  type ExecutionContext,
  type OutputPassthroughConfig
} from './environment-control/environment-management.ts';

/**
 * Domain integration configuration
 */
export interface DomainOrchestrationConfig {
  readonly applicationConfig: {
    readonly workingDirectory: string;
    readonly mode: 'all' | 'batch' | 'single-package';
    readonly batchSize: number;
    readonly enableFallback: boolean;
    readonly verbose: boolean;
  };
  readonly environmentConfig: {
    readonly logLevel: 'debug' | 'info' | 'warn' | 'error' | 'silent';
    readonly timeout: number;
    readonly inheritSystemEnv: boolean;
  };
  readonly resourceConfig: {
    readonly maxDepth: number;
    readonly maxFiles: number;
    readonly excludePatterns: string[];
  };
  readonly searchConfig: {
    readonly maxSimilarFiles: number;
    readonly similarityThreshold: number;
    readonly enableExternalSearch: boolean;
  };
}

/**
 * Orchestrated execution result combining all domains
 */
export interface OrchestrationResult {
  readonly success: boolean;
  readonly duration: number;
  readonly applicationState: ApplicationState;
  readonly executionResults: GoTestResult[];
  readonly strategyUsed: ExecutionStrategy;
  readonly resourcesDiscovered: number;
  readonly similarFilesFound: number;
  readonly environment: Record<string, string>;
  readonly summary: string;
  readonly errors: Error[];
}

/**
 * Main domain orchestrator implementing the compact-commit semantic units pattern
 */
export class DomainOrchestrator {
  private readonly applicationManager: ApplicationStateManager;
  private readonly environmentController: EnvironmentController;  
  private readonly executionController: ExecutionController;
  private readonly searchOrchestrator: SimilaritySearchOrchestrator;
  private readonly outputHandler: OutputPassthroughHandler;

  constructor(private readonly config: DomainOrchestrationConfig) {
    // Initialize all domain controllers
    this.applicationManager = new ApplicationStateManager();
    this.environmentController = new EnvironmentController();
    this.executionController = new ExecutionController(
      StrategySelector.selectInitialStrategy({
        packageCount: 0, // Will be determined during discovery
        hasComplexDependencies: false,
        timeConstraints: config.environmentConfig.timeout,
      })
    );
    this.searchOrchestrator = new SimilaritySearchOrchestrator(undefined, true, config.searchConfig.maxSimilarFiles);
    this.outputHandler = new OutputPassthroughHandler({
      stdout: config.applicationConfig.verbose ? 'inherit' : 'capture',
      stderr: 'inherit',
      realtime: true,
    });

    // Set up domain event handlers
    this.setupDomainEventHandlers();
  }

  /**
   * Execute the complete CI pipeline using all domain semantic units
   */
  async execute(): Promise<Result<OrchestrationResult, Error>> {
    const startTime = Date.now();
    const errors: Error[] = [];
    let executionResults: GoTestResult[] = [];
    let resourcesDiscovered = 0;
    let similarFilesFound = 0;

    try {
      // 1. Application Control Domain - Initialize and configure
      const appConfigResult = await this.initializeApplication();
      if (!appConfigResult.ok) {
        return failure(appConfigResult.error);
      }

      // 2. Environment Control Domain - Prepare execution environment
      const envResult = await this.prepareEnvironment();
      if (!envResult.ok) {
        errors.push(envResult.error);
      }

      // 3. Resource Management Domain - Discover project structure
      const discoveryResult = await this.discoverResources();
      if (discoveryResult.ok) {
        resourcesDiscovered = discoveryResult.data.discoveredResources.length;
        
        // Update execution strategy based on project characteristics
        const projectAnalysis = GoProjectAnalyzer.analyzeStructure(discoveryResult.data.hierarchy);
        const newStrategy = StrategySelector.selectInitialStrategy({
          packageCount: projectAnalysis.packageCount,
          hasComplexDependencies: projectAnalysis.complexity === 'complex',
          timeConstraints: this.config.environmentConfig.timeout,
        });
        
        this.executionController.resetFallbackCount();
      } else {
        errors.push(discoveryResult.error);
      }

      // 4. Test Execution Engine Domain - Execute Go tests
      const executionResult = await this.executeTests();
      if (executionResult.ok) {
        executionResults = executionResult.data;
      } else {
        errors.push(executionResult.error);
        
        // 5. Error Control Domain - Handle execution errors and fallback
        await this.handleExecutionErrors(executionResult.error);
      }

      // 6. Search Integration Domain - Find similar tests if there were failures
      const failedTests = executionResults.filter(result => !ExitCodeChecker.isSuccess(result.exitCode));
      if (failedTests.length > 0 && this.config.searchConfig.enableExternalSearch) {
        const similarityResult = await this.findSimilarTests(failedTests);
        if (similarityResult.ok) {
          similarFilesFound = similarityResult.data.reduce((sum, result) => sum + result.similarFiles.length, 0);
        } else {
          errors.push(similarityResult.error);
        }
      }

      // Complete application lifecycle
      await this.applicationManager.gracefulShutdown('execution-completed');

      const duration = Date.now() - startTime;
      const overallSuccess = errors.length === 0 && executionResults.every(r => ExitCodeChecker.isSuccess(r.exitCode));

      const result: OrchestrationResult = {
        success: overallSuccess,
        duration,
        applicationState: this.applicationManager.state,
        executionResults,
        strategyUsed: this.executionController.getCurrentStrategy(),
        resourcesDiscovered,
        similarFilesFound,
        environment: this.environmentController.buildEnvironment({ type: 'inherit' }).data || {},
        summary: this.generateExecutionSummary(executionResults, errors),
        errors,
      };

      return success(result);

    } catch (error) {
      await this.applicationManager.forceTerminate(1);
      return failure(error instanceof Error ? error : new Error('Orchestration failed'));
    }
  }

  private async initializeApplication(): Promise<Result<void, Error>> {
    const configResult = Configuration.create({
      workingDirectory: this.config.applicationConfig.workingDirectory,
      mode: this.config.applicationConfig.mode,
      batchSize: this.config.applicationConfig.batchSize,
      enableFallback: this.config.applicationConfig.enableFallback,
      logMode: this.config.environmentConfig.logLevel,
      verbose: this.config.applicationConfig.verbose,
    });

    if (!configResult.ok) {
      return failure(configResult.error);
    }

    return await this.applicationManager.initialize(configResult.data);
  }

  private async prepareEnvironment(): Promise<Result<ExecutionContext, Error>> {
    // Set log level
    const logLevelResult = this.environmentController.setLogLevel(this.config.environmentConfig.logLevel);
    if (!logLevelResult.ok) {
      return failure(logLevelResult.error);
    }

    // Create execution context
    const envConfig: EnvironmentConfig = this.config.environmentConfig.inheritSystemEnv 
      ? { type: 'inherit' }
      : { type: 'debug', logLevel: this.config.environmentConfig.logLevel };

    return this.environmentController.createExecutionContext(
      this.config.applicationConfig.workingDirectory,
      envConfig,
      { timeout: this.config.environmentConfig.timeout }
    );
  }

  private async discoverResources(): Promise<Result<{
    hierarchy: DirectoryHierarchy;
    discoveredResources: DiscoveredResource[];
  }, Error>> {
    // This would integrate with the resource discovery infrastructure
    // For now, we'll create a mock implementation
    
    const mockHierarchy: DirectoryHierarchy = {
      path: this.config.applicationConfig.workingDirectory,
      name: 'root',
      depth: 0,
      children: [],
      goFiles: [],
      testFiles: [],
      hasGoMod: true,
      packageName: 'main',
    };

    return success({
      hierarchy: mockHierarchy,
      discoveredResources: [],
    });
  }

  private async executeTests(): Promise<Result<GoTestResult[], Error>> {
    try {
      // Create test execution targets based on strategy
      const targets = await this.createExecutionTargets();
      const results: GoTestResult[] = [];

      for (const target of targets) {
        const commandResult = GoTestCommand.create(
          target,
          {
            workingDirectory: this.config.applicationConfig.workingDirectory,
            logLevel: this.config.environmentConfig.logLevel,
            verbose: this.config.applicationConfig.verbose,
            timeout: this.config.environmentConfig.timeout,
          }
        );

        if (!commandResult.ok) {
          return failure(commandResult.error);
        }

        // This would integrate with the actual test executor
        // For now, we'll create a mock result
        const mockResult: GoTestResult = {
          exitCode: 0,
          stdout: 'PASS',
          stderr: '',
          duration: 1000,
          target,
          success: true,
        };

        results.push(mockResult);

        // Analyze result and potentially trigger fallback
        const analysis = GoTestResultAnalyzer.analyzeResult(mockResult);
        if (!analysis.success && !analysis.shouldContinue) {
          break;
        }
      }

      return success(results);
    } catch (error) {
      return failure(error instanceof Error ? error : new Error('Test execution failed'));
    }
  }

  private async createExecutionTargets(): Promise<ExecutionTarget[]> {
    const strategy = this.executionController.getCurrentStrategy();
    
    switch (strategy.type) {
      case 'all-at-once':
        return [{ type: 'all-packages', pattern: './...' }];
      case 'directory-by-directory':
        // Would discover directories and create targets
        return [{ type: 'directory', path: './pkg' }];
      case 'file-by-file':
        // Would discover files and create targets
        return [{ type: 'file', path: './main_test.go' }];
      default:
        return [{ type: 'all-packages', pattern: './...' }];
    }
  }

  private async handleExecutionErrors(error: Error): Promise<void> {
    const errorResult = this.executionController.handleExecutionError(error, {});
    
    if (errorResult.ok && errorResult.data === 'fallback') {
      const trigger: FallbackTrigger = {
        condition: 'first-error',
        metadata: { error: error.message },
      };
      
      await this.executionController.executeFallback(trigger);
    }
  }

  private async findSimilarTests(failedTests: GoTestResult[]): Promise<Result<SimilaritySearchResult[], Error>> {
    const results: SimilaritySearchResult[] = [];

    for (const failedTest of failedTests.slice(0, 3)) { // Limit to first 3 failures
      const criteria: SimilaritySearchCriteria = {
        originalFile: `${failedTest.target.type}:${failedTest.target.type === 'all-packages' ? failedTest.target.pattern : ''}`,
        searchScope: 'same-module',
        similarityThreshold: this.config.searchConfig.similarityThreshold,
        maxResults: this.config.searchConfig.maxSimilarFiles,
        includeTypes: ['test-file', 'source-file'],
      };

      const searchResult = await this.searchOrchestrator.findSimilarFiles(criteria);
      if (searchResult.ok) {
        results.push(searchResult.data);
      }
    }

    return success(results);
  }

  private setupDomainEventHandlers(): void {
    // Set up cross-domain event handling
    this.applicationManager.onEvent((event: ApplicationEvent) => {
      switch (event.type) {
        case 'domain-error':
          console.error(`Domain error in ${event.domain}:`, event.error.message);
          break;
        case 'resource-warning':
          console.warn('Resource warning:', event.message);
          break;
      }
    });
  }

  private generateExecutionSummary(results: GoTestResult[], errors: Error[]): string {
    const successCount = results.filter(r => ExitCodeChecker.isSuccess(r.exitCode)).length;
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
    
    let summary = `Executed ${results.length} test targets in ${totalDuration}ms. `;
    summary += `${successCount} succeeded, ${results.length - successCount} failed.`;
    
    if (errors.length > 0) {
      summary += ` ${errors.length} domain errors encountered.`;
    }
    
    return summary;
  }
}
