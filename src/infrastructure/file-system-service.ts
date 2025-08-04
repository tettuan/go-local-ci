import { dirname, join, relative, resolve } from '@std/path';
import { exists, walk } from '@std/fs';
import type { Result } from '../utils/result.ts';
import { failure, success } from '../utils/result.ts';

/**
 * File system service for file operations
 */
export class FileSystemService {
  /**
   * Checks if a path exists
   */
  async exists(path: string): Promise<boolean> {
    try {
      return await exists(path);
    } catch {
      return false;
    }
  }

  /**
   * Reads a file as text
   */
  async readTextFile(path: string): Promise<Result<string, Error>> {
    try {
      const content = await Deno.readTextFile(path);
      return success(content);
    } catch (error) {
      if (error instanceof Error) {
        return failure(error);
      }
      return failure(new Error(`Failed to read file: ${path}`));
    }
  }

  /**
   * Writes text to a file
   */
  async writeTextFile(path: string, content: string): Promise<Result<void, Error>> {
    try {
      await Deno.writeTextFile(path, content);
      return success(undefined);
    } catch (error) {
      if (error instanceof Error) {
        return failure(error);
      }
      return failure(new Error(`Failed to write file: ${path}`));
    }
  }

  /**
   * Lists files in a directory recursively
   */
  async *walkFiles(
    directory: string,
    extensions?: string[],
  ): AsyncGenerator<string, void, unknown> {
    try {
      const walkOptions = {
        includeDirs: false,
        followSymlinks: false,
      };

      for await (const entry of walk(directory, walkOptions)) {
        if (entry.isFile) {
          if (!extensions || extensions.some((ext) => entry.path.endsWith(ext))) {
            yield entry.path;
          }
        }
      }
    } catch {
      // Ignore errors and continue
    }
  }

  /**
   * Finds Go source files in a directory
   */
  async findGoFiles(directory: string): Promise<string[]> {
    const goFiles: string[] = [];
    for await (const file of this.walkFiles(directory, ['.go'])) {
      goFiles.push(file);
    }
    return goFiles;
  }

  /**
   * Finds Go test files in a directory
   */
  async findGoTestFiles(directory: string): Promise<string[]> {
    const testFiles: string[] = [];
    for await (const file of this.walkFiles(directory, ['.go'])) {
      if (file.endsWith('_test.go')) {
        testFiles.push(file);
      }
    }
    return testFiles;
  }

  /**
   * Finds go.mod files in a directory
   */
  async findGoModFiles(directory: string): Promise<string[]> {
    const modFiles: string[] = [];
    for await (const file of this.walkFiles(directory, ['go.mod'])) {
      modFiles.push(file);
    }
    return modFiles;
  }

  /**
   * Gets the relative path from base to target
   */
  getRelativePath(base: string, target: string): string {
    return relative(base, target);
  }

  /**
   * Joins path components
   */
  joinPath(first: string, ...rest: string[]): string {
    return join(first, ...rest);
  }

  /**
   * Resolves a path to absolute
   */
  resolvePath(path: string): string {
    return resolve(path);
  }

  /**
   * Gets the directory name of a path
   */
  getDirname(path: string): string {
    return dirname(path);
  }

  /**
   * Gets file information
   */
  async getFileInfo(path: string): Promise<Result<Deno.FileInfo, Error>> {
    try {
      const info = await Deno.stat(path);
      return success(info);
    } catch (error) {
      if (error instanceof Error) {
        return failure(error);
      }
      return failure(new Error(`Failed to get file info: ${path}`));
    }
  }

  /**
   * Gets the directory path of a file
   */
  getDirectoryPath(filePath: string): string {
    return dirname(filePath);
  }
}
