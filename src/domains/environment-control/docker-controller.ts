/**
 * Docker Controller - Manages Docker-based test execution
 * Following Totality principle
 */

import type { Result } from '../../shared/result.ts';
import { failure, success } from '../../shared/result.ts';
import type { DomainError } from '../../shared/errors.ts';
import { createDomainError } from '../../shared/errors.ts';
import type { DockerConfig, DockerVolume, EnvironmentVariables } from './types.ts';

/**
 * Docker command executor interface
 */
export interface DockerExecutor {
  execute(args: string[], options?: { stdin?: string }): Promise<Result<string, Error>>;
  isAvailable(): Promise<boolean>;
}

/**
 * Docker container state
 */
export interface ContainerState {
  readonly id: string;
  readonly image: string;
  readonly status: 'created' | 'running' | 'exited' | 'removing';
  readonly startedAt?: Date;
  readonly finishedAt?: Date;
}

/**
 * Docker Controller
 */
export class DockerController {
  private containers: Map<string, ContainerState> = new Map();

  constructor(
    private readonly executor: DockerExecutor,
  ) {}

  /**
   * Check if Docker is available
   */
  async checkAvailability(): Promise<Result<boolean, DomainError>> {
    try {
      const available = await this.executor.isAvailable();
      return success(available);
    } catch (error) {
      return failure(createDomainError({
        domain: 'environment',
        kind: 'DockerNotAvailable',
        details: { error: String(error) },
      }));
    }
  }

  /**
   * Create container for test execution
   */
  async createContainer(
    config: DockerConfig,
    command: string[],
  ): Promise<Result<string, DomainError>> {
    // Build docker run arguments
    const args = ['run', '--detach'];

    // Add container name for tracking
    const containerName = `go-ci-${Date.now()}`;
    args.push('--name', containerName);

    // Add working directory
    args.push('--workdir', config.workDir);

    // Add volumes
    for (const volume of config.volumes) {
      const volumeArg = `${volume.source}:${volume.target}`;
      args.push('--volume', volume.readOnly ? `${volumeArg}:ro` : volumeArg);
    }

    // Add environment variables
    for (const [key, value] of Object.entries(config.environment)) {
      args.push('--env', `${key}=${value}`);
    }

    // Add network if specified
    if (config.network) {
      args.push('--network', config.network);
    }

    // Add extra arguments
    args.push(...config.extraArgs);

    // Add image
    args.push(config.image);

    // Add command
    args.push(...command);

    // Execute docker run
    const result = await this.executor.execute(args);
    if (!result.ok) {
      return failure(createDomainError({
        domain: 'environment',
        kind: 'ContainerCreationFailed',
        details: { error: result.error.message },
      }));
    }

    const containerId = result.data.trim();

    // Track container state
    this.containers.set(containerId, {
      id: containerId,
      image: config.image,
      status: 'created',
      startedAt: new Date(),
    });

    return success(containerId);
  }

  /**
   * Execute command in container
   */
  async executeInContainer(
    containerId: string,
    command: string[],
    options?: { workDir?: string; env?: EnvironmentVariables },
  ): Promise<Result<string, DomainError>> {
    const args = ['exec'];

    // Add working directory
    if (options?.workDir) {
      args.push('--workdir', options.workDir);
    }

    // Add environment variables
    if (options?.env) {
      for (const [key, value] of Object.entries(options.env)) {
        args.push('--env', `${key}=${value}`);
      }
    }

    // Add container ID and command
    args.push(containerId);
    args.push(...command);

    // Execute
    const result = await this.executor.execute(args);
    if (!result.ok) {
      return failure(createDomainError({
        domain: 'environment',
        kind: 'ContainerExecutionFailed',
        details: { containerId, error: result.error.message },
      }));
    }

    // Update container state
    const state = this.containers.get(containerId);
    if (state && state.status === 'created') {
      this.containers.set(containerId, { ...state, status: 'running' });
    }

    return success(result.data);
  }

  /**
   * Stop container
   */
  async stopContainer(
    containerId: string,
    timeout: number = 10,
  ): Promise<Result<void, DomainError>> {
    const args = ['stop', '--time', String(timeout), containerId];

    const result = await this.executor.execute(args);
    if (!result.ok) {
      return failure(createDomainError({
        domain: 'environment',
        kind: 'ContainerStopFailed',
        details: { containerId, error: result.error.message },
      }));
    }

    // Update state
    const state = this.containers.get(containerId);
    if (state) {
      this.containers.set(containerId, {
        ...state,
        status: 'exited',
        finishedAt: new Date(),
      });
    }

    return success(undefined);
  }

  /**
   * Remove container
   */
  async removeContainer(
    containerId: string,
    force: boolean = false,
  ): Promise<Result<void, DomainError>> {
    const args = ['rm'];
    if (force) {
      args.push('--force');
    }
    args.push(containerId);

    const result = await this.executor.execute(args);
    if (!result.ok) {
      return failure(createDomainError({
        domain: 'environment',
        kind: 'ContainerRemovalFailed',
        details: { containerId, error: result.error.message },
      }));
    }

    // Remove from tracking
    this.containers.delete(containerId);

    return success(undefined);
  }

  /**
   * Get container logs
   */
  async getContainerLogs(
    containerId: string,
    options?: { tail?: number; since?: string; follow?: boolean },
  ): Promise<Result<string, DomainError>> {
    const args = ['logs'];

    if (options?.tail !== undefined) {
      args.push('--tail', String(options.tail));
    }

    if (options?.since) {
      args.push('--since', options.since);
    }

    if (options?.follow) {
      args.push('--follow');
    }

    args.push(containerId);

    const result = await this.executor.execute(args);
    if (!result.ok) {
      return failure(createDomainError({
        domain: 'environment',
        kind: 'ContainerLogsFailed',
        details: { containerId, error: result.error.message },
      }));
    }

    return success(result.data);
  }

  /**
   * Cleanup all containers
   */
  async cleanupContainers(): Promise<Result<void, DomainError>> {
    const errors: Array<{ id: string; error: string }> = [];

    for (const [id, state] of this.containers) {
      // Stop if running
      if (state.status === 'running') {
        const stopResult = await this.stopContainer(id);
        if (!stopResult.ok) {
          errors.push({ id, error: 'Failed to stop' });
          continue;
        }
      }

      // Remove container
      const removeResult = await this.removeContainer(id, true);
      if (!removeResult.ok) {
        errors.push({ id, error: 'Failed to remove' });
      }
    }

    if (errors.length > 0) {
      return failure(createDomainError({
        domain: 'environment',
        kind: 'ContainerCleanupFailed',
        details: { errors },
      }));
    }

    return success(undefined);
  }

  /**
   * Get active containers
   */
  getActiveContainers(): ContainerState[] {
    return Array.from(this.containers.values())
      .filter((c) => c.status === 'running' || c.status === 'created');
  }

  /**
   * Build volume mounts from paths
   */
  static buildVolumes(
    sourcePaths: string[],
    targetBase: string,
    readOnly: boolean = false,
  ): DockerVolume[] {
    return sourcePaths.map((source, index) => ({
      source,
      target: `${targetBase}/mount${index}`,
      readOnly,
    }));
  }

  /**
   * Build Docker command from Go test command
   */
  static buildDockerCommand(
    goCommand: string[],
    config: DockerConfig,
  ): string[] {
    // Ensure go is in PATH inside container
    const command = ['sh', '-c'];

    // Build command string
    let cmdString = '';

    // Set any additional environment if needed
    if (Object.keys(config.environment).length > 0) {
      cmdString += 'export ';
      for (const [key, value] of Object.entries(config.environment)) {
        cmdString += `${key}="${value}" `;
      }
      cmdString += '&& ';
    }

    // Add the actual Go command
    cmdString += goCommand.map((arg) => {
      // Quote arguments that contain spaces
      if (arg.includes(' ')) {
        return `"${arg}"`;
      }
      return arg;
    }).join(' ');

    command.push(cmdString);
    return command;
  }
}
