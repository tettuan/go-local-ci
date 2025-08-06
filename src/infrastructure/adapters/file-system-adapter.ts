/**
 * File System Adapter
 * Implements file system interfaces for domains
 */

import { basename, dirname, join } from 'https://deno.land/std@0.208.0/path/mod.ts';
import type { FileSystem } from '../../domains/resource-management/project-scanner.ts';
import type { EnvFileSystem } from '../../domains/environment-control/environment-manager.ts';

/**
 * Deno-based file system adapter
 */
class DenoFileSystemAdapter implements FileSystem, EnvFileSystem {
  async exists(path: string): Promise<boolean> {
    try {
      await Deno.stat(path);
      return true;
    } catch {
      return false;
    }
  }

  async isDirectory(path: string): Promise<boolean> {
    try {
      const stat = await Deno.stat(path);
      return stat.isDirectory;
    } catch {
      return false;
    }
  }

  async readDirectory(path: string): Promise<string[]> {
    const entries: string[] = [];
    for await (const entry of Deno.readDir(path)) {
      entries.push(entry.name);
    }
    return entries;
  }

  async readFile(path: string): Promise<string> {
    return await Deno.readTextFile(path);
  }

  async getFileInfo(path: string): Promise<{ size: number; modTime: Date }> {
    const stat = await Deno.stat(path);
    return {
      size: stat.size,
      modTime: stat.mtime || new Date(),
    };
  }

  joinPath(...segments: string[]): string {
    return join(...segments);
  }

  getBaseName(path: string): string {
    return basename(path);
  }

  getDirectoryName(path: string): string {
    return dirname(path);
  }
}

/**
 * Create file system adapter
 */
export function createFileSystemAdapter(): FileSystem & EnvFileSystem {
  return new DenoFileSystemAdapter();
}
