/**
 * Environment Control Domain
 * Exports all public interfaces and implementations
 */

export type {
  BuildConstraints,
  CompilerFlags,
  DockerConfig,
  DockerVolume,
  EnvironmentConfig,
  EnvironmentVariables,
  GoEnvironment,
  ProcessEnvironment,
  TestEnvironmentSetup,
} from './types.ts';

export { DockerImage, EnvironmentVariable, PathList } from './types.ts';

export {
  type EnvFileSystem,
  EnvironmentManager,
  type SystemEnvironment,
} from './environment-manager.ts';

export { type ContainerState, DockerController, type DockerExecutor } from './docker-controller.ts';
