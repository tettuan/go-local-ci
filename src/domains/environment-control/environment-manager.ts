/**
 * Environment Manager - Manages test execution environments
 * Following Totality principle
 */

import type { Result } from '../../shared/result.ts';
import { failure, success } from '../../shared/result.ts';
import type { DomainError } from '../../shared/errors.ts';
import { createDomainError } from '../../shared/errors.ts';
import type { EventBus } from '../../shared/events.ts';
import { createEvent } from '../../shared/events.ts';
import type {
  EnvironmentConfig,
  EnvironmentVariables,
  GoEnvironment,
  ProcessEnvironment,
  TestEnvironmentSetup,
} from './types.ts';

/**
 * System interface for environment operations
 */
export interface SystemEnvironment {
  getEnv(name: string): string | undefined;
  getAllEnv(): EnvironmentVariables;
  getCwd(): string;
  getUser(): string | undefined;
  getShell(): string | undefined;
}

/**
 * File system interface for env file operations
 */
export interface EnvFileSystem {
  readFile(path: string): Promise<string>;
  exists(path: string): Promise<boolean>;
}

/**
 * Environment Manager
 */
export class EnvironmentManager {
  private setupStack: TestEnvironmentSetup[] = [];

  constructor(
    private readonly system: SystemEnvironment,
    private readonly fs: EnvFileSystem,
    private readonly eventBus?: EventBus,
  ) {}

  /**
   * Get current Go environment
   */
  getGoEnvironment(): Result<GoEnvironment, DomainError> {
    try {
      const env: GoEnvironment = {
        goPath: this.system.getEnv('GOPATH') || '',
        goRoot: this.system.getEnv('GOROOT') || '',
        goVersion: this.system.getEnv('GOVERSION') || '',
        goOs: this.system.getEnv('GOOS') || '',
        goArch: this.system.getEnv('GOARCH') || '',
        goBin: this.system.getEnv('GOBIN') || '',
        goCache: this.system.getEnv('GOCACHE') || '',
        goModCache: this.system.getEnv('GOMODCACHE') || '',
        goProxy: this.system.getEnv('GOPROXY') || 'https://proxy.golang.org,direct',
        goPrivate: this.system.getEnv('GOPRIVATE') || '',
        goSumDb: this.system.getEnv('GOSUMDB') || 'sum.golang.org',
      };

      // Validate critical values
      if (!env.goRoot) {
        return failure(createDomainError({
          domain: 'environment',
          kind: 'MissingGoEnvironment',
          details: { variable: 'GOROOT' },
        }));
      }

      return success(env);
    } catch (error) {
      return failure(createDomainError({
        domain: 'environment',
        kind: 'EnvironmentAccessFailed',
        details: { error: String(error) },
      }));
    }
  }

  /**
   * Get current process environment
   */
  getProcessEnvironment(): ProcessEnvironment {
    const pathEnv = this.system.getEnv('PATH') || '';
    const paths = pathEnv.split(Deno.build.os === 'windows' ? ';' : ':');

    return {
      workingDirectory: this.system.getCwd(),
      env: this.system.getAllEnv(),
      path: paths,
      user: this.system.getUser(),
      shell: this.system.getShell(),
    };
  }

  /**
   * Setup test environment
   */
  async setupTestEnvironment(
    config: EnvironmentConfig,
  ): Promise<Result<TestEnvironmentSetup, DomainError>> {
    const env: EnvironmentVariables = {};
    const cleanupFunctions: Array<() => Promise<void>> = [];

    // Start with system env if preserving
    if (config.preserveSystemEnv) {
      Object.assign(env, this.system.getAllEnv());
    }

    // Apply base environment
    Object.assign(env, config.baseEnv);

    // Load env file if specified
    if (config.envFile) {
      const loadResult = await this.loadEnvFile(config.envFile);
      if (!loadResult.ok) {
        return loadResult;
      }
      Object.assign(env, loadResult.data);
    }

    // Apply test-specific environment
    Object.assign(env, config.testEnv);

    // Setup working directory
    const workDir = this.system.getCwd();

    const setup: TestEnvironmentSetup = {
      env,
      workDir,
      tempDirs: [],
      cleanupFunctions,
    };

    // Track setup for cleanup
    this.setupStack.push(setup);

    // Emit event
    if (this.eventBus) {
      await this.eventBus.emit(createEvent({
        type: 'environment:setup-complete',
        envVars: Object.keys(env).length,
        workDir,
      }));
    }

    return success(setup);
  }

  /**
   * Cleanup test environment
   */
  async cleanupTestEnvironment(): Promise<Result<void, DomainError>> {
    const setup = this.setupStack.pop();
    if (!setup) {
      return success(undefined);
    }

    const errors: Error[] = [];

    // Run cleanup functions
    for (const cleanup of setup.cleanupFunctions) {
      try {
        await cleanup();
      } catch (error) {
        errors.push(error as Error);
      }
    }

    // Emit event
    if (this.eventBus) {
      await this.eventBus.emit(createEvent({
        type: 'environment:cleanup-complete',
        errors: errors.length,
      }));
    }

    if (errors.length > 0) {
      return failure(createDomainError({
        domain: 'environment',
        kind: 'CleanupFailed',
        details: { errors: errors.map((e) => e.message) },
      }));
    }

    return success(undefined);
  }

  /**
   * Merge environments
   */
  mergeEnvironments(
    ...envs: EnvironmentVariables[]
  ): EnvironmentVariables {
    const result: EnvironmentVariables = {};

    for (const env of envs) {
      Object.assign(result, env);
    }

    return result;
  }

  /**
   * Filter environment variables
   */
  filterEnvironment(
    env: EnvironmentVariables,
    predicate: (key: string, value: string) => boolean,
  ): EnvironmentVariables {
    const result: Record<string, string> = {};

    for (const [key, value] of Object.entries(env)) {
      if (predicate(key, value)) {
        result[key] = value;
      }
    }

    return result as EnvironmentVariables;
  }

  /**
   * Load environment from file
   */
  private async loadEnvFile(
    path: string,
  ): Promise<Result<EnvironmentVariables, DomainError>> {
    try {
      // Check if file exists
      if (!await this.fs.exists(path)) {
        return failure(createDomainError({
          domain: 'environment',
          kind: 'EnvFileNotFound',
          details: { path },
        }));
      }

      // Read file
      const content = await this.fs.readFile(path);

      // Parse env file
      const env: Record<string, string> = {};
      const lines = content.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();

        // Skip empty lines and comments
        if (!trimmed || trimmed.startsWith('#')) {
          continue;
        }

        // Parse KEY=VALUE
        const equalIndex = trimmed.indexOf('=');
        if (equalIndex === -1) {
          continue;
        }

        const key = trimmed.substring(0, equalIndex).trim();
        let value = trimmed.substring(equalIndex + 1).trim();

        // Remove quotes if present
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }

        // Expand variables
        value = this.expandVariables(value, env);

        env[key] = value;
      }

      return success(env as EnvironmentVariables);
    } catch (error) {
      return failure(createDomainError({
        domain: 'environment',
        kind: 'EnvFileReadFailed',
        details: { path, error: String(error) },
      }));
    }
  }

  /**
   * Expand environment variables in value
   */
  private expandVariables(
    value: string,
    env: EnvironmentVariables,
  ): string {
    return value.replace(/\$\{([^}]+)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g, (match, braced, simple) => {
      const varName = braced || simple;
      return env[varName] || this.system.getEnv(varName) || match;
    });
  }
}
