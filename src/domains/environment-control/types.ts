/**
 * Environment Control Domain Types
 * Following Totality principle
 */

import type { Result } from '../../shared/result.ts';
import { failure, success } from '../../shared/result.ts';
import type { ValidationError } from '../../shared/errors.ts';
import { createValidationError } from '../../shared/errors.ts';

/**
 * Environment variables
 */
export interface EnvironmentVariables {
  readonly [key: string]: string;
}

/**
 * Environment configuration
 */
export interface EnvironmentConfig {
  readonly baseEnv: EnvironmentVariables;
  readonly testEnv: EnvironmentVariables;
  readonly preserveSystemEnv: boolean;
  readonly envFile?: string;
}

/**
 * Go environment info
 */
export interface GoEnvironment {
  readonly goPath: string;
  readonly goRoot: string;
  readonly goVersion: string;
  readonly goOs: string;
  readonly goArch: string;
  readonly goBin: string;
  readonly goCache: string;
  readonly goModCache: string;
  readonly goProxy: string;
  readonly goPrivate: string;
  readonly goSumDb: string;
}

/**
 * Process environment
 */
export interface ProcessEnvironment {
  readonly workingDirectory: string;
  readonly env: EnvironmentVariables;
  readonly path: string[];
  readonly user?: string;
  readonly shell?: string;
}

/**
 * Docker configuration
 */
export interface DockerConfig {
  readonly enabled: boolean;
  readonly image: string;
  readonly volumes: DockerVolume[];
  readonly environment: EnvironmentVariables;
  readonly workDir: string;
  readonly network?: string;
  readonly extraArgs: string[];
}

/**
 * Docker volume mount
 */
export interface DockerVolume {
  readonly source: string;
  readonly target: string;
  readonly readOnly: boolean;
}

/**
 * Build constraints
 */
export interface BuildConstraints {
  readonly os: string[];
  readonly arch: string[];
  readonly tags: string[];
  readonly cgo: boolean;
}

/**
 * Compiler flags
 */
export interface CompilerFlags {
  readonly gcFlags: string[];
  readonly ldFlags: string[];
  readonly asmFlags: string[];
  readonly buildMode?: string;
  readonly trimPath: boolean;
}

/**
 * Test environment setup
 */
export interface TestEnvironmentSetup {
  readonly env: EnvironmentVariables;
  readonly workDir: string;
  readonly tempDirs: string[];
  readonly cleanupFunctions: Array<() => Promise<void>>;
}

/**
 * Environment Variable - Smart Constructor
 */
export class EnvironmentVariable {
  private constructor(
    private readonly name: string,
    private readonly value: string,
  ) {}

  static create(name: string, value: string): Result<EnvironmentVariable, ValidationError> {
    // Validate name
    if (name.length === 0) {
      return failure(createValidationError({
        kind: 'EmptyValue',
        field: 'name',
      }));
    }

    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
      return failure(createValidationError({
        kind: 'InvalidFormat',
        field: 'name',
        expected: 'valid environment variable name',
        actual: name,
      }));
    }

    // Validate value (allow empty)
    if (value.includes('\0')) {
      return failure(createValidationError({
        kind: 'InvalidFormat',
        field: 'value',
        expected: 'no null bytes',
        actual: 'contains null byte',
      }));
    }

    return success(new EnvironmentVariable(name, value));
  }

  getName(): string {
    return this.name;
  }

  getValue(): string {
    return this.value;
  }

  toString(): string {
    return `${this.name}=${this.value}`;
  }
}

/**
 * Docker Image - Smart Constructor
 */
export class DockerImage {
  private constructor(
    private readonly image: string,
    private readonly registry?: string,
    private readonly tag?: string,
  ) {}

  static create(image: string): Result<DockerImage, ValidationError> {
    if (image.length === 0) {
      return failure(createValidationError({
        kind: 'EmptyValue',
        field: 'image',
      }));
    }

    // Parse image format: [registry/]name[:tag]
    const parts = image.split('/');
    let registry: string | undefined;
    let name: string;
    let tag: string | undefined;

    if (parts.length > 2) {
      // Has registry
      registry = parts.slice(0, -1).join('/');
      name = parts[parts.length - 1];
    } else if (parts.length === 2 && parts[0].includes('.')) {
      // Has registry (contains dot)
      registry = parts[0];
      name = parts[1];
    } else {
      // No registry
      name = image;
    }

    // Extract tag
    const tagIndex = name.lastIndexOf(':');
    if (tagIndex > 0) {
      tag = name.substring(tagIndex + 1);
      name = name.substring(0, tagIndex);
    }

    // Validate name
    if (!/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(name)) {
      return failure(createValidationError({
        kind: 'InvalidFormat',
        field: 'image',
        expected: 'valid Docker image name',
        actual: image,
      }));
    }

    return success(new DockerImage(name, registry, tag));
  }

  getFullName(): string {
    let full = '';
    if (this.registry) {
      full += this.registry + '/';
    }
    full += this.image;
    if (this.tag) {
      full += ':' + this.tag;
    }
    return full;
  }

  getName(): string {
    return this.image;
  }

  getRegistry(): string | undefined {
    return this.registry;
  }

  getTag(): string {
    return this.tag || 'latest';
  }
}

/**
 * Path List - Smart Constructor for PATH-like variables
 */
export class PathList {
  private constructor(
    private readonly paths: string[],
    private readonly separator: string,
  ) {}

  static create(pathString: string, separator: string = ':'): Result<PathList, ValidationError> {
    if (separator.length !== 1) {
      return failure(createValidationError({
        kind: 'InvalidFormat',
        field: 'separator',
        expected: 'single character',
        actual: `length: ${separator.length}`,
      }));
    }

    const paths = pathString.split(separator).filter((p) => p.length > 0);

    // Validate each path
    for (const path of paths) {
      if (path.includes('\0')) {
        return failure(createValidationError({
          kind: 'InvalidFormat',
          field: 'path',
          expected: 'no null bytes',
          actual: path,
        }));
      }
    }

    return success(new PathList(paths, separator));
  }

  getPaths(): readonly string[] {
    return this.paths;
  }

  toString(): string {
    return this.paths.join(this.separator);
  }

  prepend(path: string): PathList {
    return new PathList([path, ...this.paths], this.separator);
  }

  append(path: string): PathList {
    return new PathList([...this.paths, path], this.separator);
  }

  filter(predicate: (path: string) => boolean): PathList {
    return new PathList(this.paths.filter(predicate), this.separator);
  }
}
