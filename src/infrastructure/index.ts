/**
 * Infrastructure Adapters
 * Creates concrete implementations for domain interfaces
 */

import { parseCli } from '../domains/application-control/cli-parser.ts';
import { ApplicationStateManager } from '../domains/application-control/state-manager.ts';
import { TestExecutor } from '../domains/test-execution/test-executor.ts';
import { StrategyController } from '../domains/error-control/strategy-controller.ts';
import {
  createDefaultFallbackConfig,
  FallbackExecutor,
} from '../domains/error-control/fallback-executor.ts';
import { GoProjectScanner } from '../domains/resource-management/project-scanner.ts';
import { SearchService } from '../domains/search-integration/search-service.ts';
import { CoverageAnalyzer } from '../domains/search-integration/coverage-analyzer.ts';
import { ReportGenerator } from '../domains/search-integration/report-generator.ts';
import { EnvironmentManager } from '../domains/environment-control/environment-manager.ts';
import { DockerController } from '../domains/environment-control/docker-controller.ts';

// Infrastructure implementations
import { createFileSystemAdapter } from './adapters/file-system-adapter.ts';
import { createProcessExecutor } from './adapters/process-executor.ts';
import { createSystemEnvironment } from './adapters/system-environment.ts';
import { createDockerExecutor } from './adapters/docker-executor.ts';
import { createSearchIndex } from './adapters/search-index.ts';
import { createGoFileParser } from './adapters/go-file-parser.ts';
import { createCoverageParser } from './adapters/coverage-parser.ts';
import { createReportGenerators } from './adapters/report-generators.ts';

/**
 * Infrastructure adapters collection
 */
export interface InfrastructureAdapters {
  appControl: {
    parser: { parse: typeof parseCli };
    stateManager: ApplicationStateManager;
  };
  testExecution: {
    executor: TestExecutor;
  };
  errorControl: {
    strategyController: StrategyController;
    fallbackExecutor: FallbackExecutor;
  };
  resourceManagement: {
    scanner: GoProjectScanner;
  };
  searchIntegration: {
    searchService: SearchService;
    coverageAnalyzer: CoverageAnalyzer;
    reportGenerator: ReportGenerator;
  };
  environmentControl: {
    environmentManager: EnvironmentManager;
    dockerController: DockerController;
  };
}

/**
 * Create all infrastructure adapters
 */
export function createInfrastructureAdapters(): InfrastructureAdapters {
  // Create base infrastructure
  const fileSystem = createFileSystemAdapter();
  const processExecutor = createProcessExecutor();
  const systemEnv = createSystemEnvironment();
  const dockerExecutor = createDockerExecutor();
  const searchIndex = createSearchIndex();
  const goFileParser = createGoFileParser();
  const coverageParser = createCoverageParser();
  const { fileWriter, templateRenderer } = createReportGenerators();

  // Create domain services
  const appControl = {
    parser: { parse: parseCli },
    stateManager: new ApplicationStateManager(),
  };

  const testExecution = {
    executor: new TestExecutor(processExecutor, Deno.cwd()),
  };

  const errorControl = {
    strategyController: new StrategyController(),
    fallbackExecutor: new FallbackExecutor(createDefaultFallbackConfig()),
  };

  const resourceManagement = {
    scanner: new GoProjectScanner(fileSystem, {
      maxDepth: 10,
      includeVendor: false,
      includeHidden: false,
      followSymlinks: false,
      excludePatterns: [],
    }),
  };

  const searchIntegration = {
    searchService: new SearchService(searchIndex, goFileParser),
    coverageAnalyzer: new CoverageAnalyzer(coverageParser, {
      generate: async (data, _format, path) => {
        // Simple implementation
        const content = JSON.stringify(data, null, 2);
        if (path) {
          const writeResult = await fileWriter.write(path, content);
          if (!writeResult.ok) {
            return writeResult;
          }
        }
        return { ok: true, data: content };
      },
    }),
    reportGenerator: new ReportGenerator(fileWriter, templateRenderer),
  };

  const environmentControl = {
    environmentManager: new EnvironmentManager(systemEnv, fileSystem),
    dockerController: new DockerController(dockerExecutor),
  };

  return {
    appControl,
    testExecution,
    errorControl,
    resourceManagement,
    searchIntegration,
    environmentControl,
  };
}
