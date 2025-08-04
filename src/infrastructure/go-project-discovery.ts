import type { FileSystemService } from './file-system-service.ts';
import type { GoModuleInfo, GoPackageInfo } from '../types/go-package-info.ts';
import type { Result } from '../utils/result.ts';
import { failure, success } from '../utils/result.ts';

/**
 * Service for discovering Go packages and modules
 */
export class GoProjectDiscovery {
  constructor(private readonly fileSystem: FileSystemService) {}

  /**
   * Discovers all Go packages in a directory
   */
  async discoverGoPackages(directory: string): Promise<Result<GoPackageInfo[], Error>> {
    try {
      const packages: GoPackageInfo[] = [];
      const processedDirs = new Set<string>();

      // Find all Go files
      const goFiles = await this.fileSystem.findGoFiles(directory);

      // Group files by directory (package)
      const packageDirs = new Map<string, string[]>();

      for (const file of goFiles) {
        const dir = this.fileSystem.getDirname(file);
        if (!packageDirs.has(dir)) {
          packageDirs.set(dir, []);
        }
        packageDirs.get(dir)!.push(file);
      }

      // Create package info for each directory
      for (const [packageDir, files] of packageDirs) {
        if (processedDirs.has(packageDir)) {
          continue;
        }
        processedDirs.add(packageDir);

        const hasGoMod = await this.fileSystem.exists(
          this.fileSystem.joinPath(packageDir, 'go.mod'),
        );

        const isTestPackage = files.some((file) => file.endsWith('_test.go'));

        const packageName = this.extractPackageName(packageDir);

        packages.push({
          path: packageDir,
          name: packageName,
          isTestPackage,
          hasGoMod,
          dependencies: [], // TODO: Parse dependencies from Go files
        });
      }

      return success(packages);
    } catch (error) {
      if (error instanceof Error) {
        return failure(error);
      }
      return failure(new Error('Failed to discover Go packages'));
    }
  }

  /**
   * Discovers Go modules in a directory
   */
  async discoverGoModules(directory: string): Promise<Result<GoModuleInfo[], Error>> {
    try {
      const modules: GoModuleInfo[] = [];
      const modFiles = await this.fileSystem.findGoModFiles(directory);

      for (const modFile of modFiles) {
        const moduleDir = this.fileSystem.getDirname(modFile);
        const moduleInfo = await this.parseGoMod(modFile);

        if (moduleInfo.ok) {
          const packagesResult = await this.discoverGoPackages(moduleDir);
          if (packagesResult.ok) {
            modules.push({
              ...moduleInfo.data,
              path: moduleDir,
              packages: packagesResult.data,
            });
          }
        }
      }

      return success(modules);
    } catch (error) {
      if (error instanceof Error) {
        return failure(error);
      }
      return failure(new Error('Failed to discover Go modules'));
    }
  }

  /**
   * Gets all Go packages that can be tested
   */
  async getTestablePackages(directory: string): Promise<Result<string[], Error>> {
    try {
      const packages: string[] = [];
      const processedDirs = new Set<string>();

      // Find all Go files (excluding vendor, .git, etc.)
      for await (const file of this.fileSystem.walkFiles(directory, ['.go'])) {
        // Skip vendor directories and hidden directories
        if (file.includes('/vendor/') || file.includes('/.')) {
          continue;
        }

        const dir = this.fileSystem.getDirname(file);
        if (!processedDirs.has(dir)) {
          processedDirs.add(dir);

          // Check if directory has any .go files (not just test files)
          const goFiles = await this.fileSystem.findGoFiles(dir);
          const hasSourceFiles = goFiles.some((f) => !f.endsWith('_test.go'));
          const hasTestFiles = goFiles.some((f) => f.endsWith('_test.go'));

          // Include directories that have source files or test files
          if (hasSourceFiles || hasTestFiles) {
            const relativePath = this.fileSystem.getRelativePath(directory, dir);
            const packagePath = relativePath === '' ? '.' : `./${relativePath}`;
            packages.push(packagePath);
          }
        }
      }

      return success(packages.sort());
    } catch (error) {
      if (error instanceof Error) {
        return failure(error);
      }
      return failure(new Error('Failed to get testable packages'));
    }
  }

  /**
   * Checks if a directory contains Go code
   */
  async hasGoCode(directory: string): Promise<boolean> {
    try {
      const goFiles = await this.fileSystem.findGoFiles(directory);
      return goFiles.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Finds the root Go module directory
   */
  async findGoModRoot(startDir: string): Promise<Result<string, Error>> {
    try {
      let currentDir = this.fileSystem.resolvePath(startDir);

      while (true) {
        const goModPath = this.fileSystem.joinPath(currentDir, 'go.mod');

        if (await this.fileSystem.exists(goModPath)) {
          return success(currentDir);
        }

        const parent = this.fileSystem.getDirname(currentDir);
        if (parent === currentDir) {
          // Reached root directory
          break;
        }
        currentDir = parent;
      }

      return failure(new Error('No go.mod found'));
    } catch (error) {
      if (error instanceof Error) {
        return failure(error);
      }
      return failure(new Error('Failed to find Go module root'));
    }
  }

  private extractPackageName(packageDir: string): string {
    const parts = packageDir.split('/');
    return parts[parts.length - 1] || 'main';
  }

  private async parseGoMod(
    modFile: string,
  ): Promise<Result<{ moduleName: string; goVersion: string }, Error>> {
    try {
      const contentResult = await this.fileSystem.readTextFile(modFile);
      if (!contentResult.ok) {
        return failure(contentResult.error);
      }

      const content = contentResult.data;
      const lines = content.split('\n');

      let moduleName = '';
      let goVersion = '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('module ')) {
          moduleName = trimmed.substring(7).trim();
        } else if (trimmed.startsWith('go ')) {
          goVersion = trimmed.substring(3).trim();
        }
      }

      if (!moduleName) {
        return failure(new Error('No module name found in go.mod'));
      }

      return success({
        moduleName,
        goVersion: goVersion || 'unknown',
      });
    } catch (error) {
      if (error instanceof Error) {
        return failure(error);
      }
      return failure(new Error('Failed to parse go.mod'));
    }
  }
}
