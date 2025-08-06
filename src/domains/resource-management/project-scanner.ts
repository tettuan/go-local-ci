/**
 * Project Scanner - Scans Go project structure
 * Domain logic only, infrastructure provided via interfaces
 */

import type { Result } from '../../shared/result.ts';
import { combineResults, failure, success } from '../../shared/result.ts';
import type { DomainError } from '../../shared/errors.ts';
import { createDomainError } from '../../shared/errors.ts';
import type {
  DirectoryHierarchy,
  GoFileType,
  GoModuleInfo,
  GoPackageInfo,
  ProjectStructure,
  ScanOptions,
  ScanResult,
} from './types.ts';

/**
 * File system interface (to be implemented by infrastructure)
 */
export interface FileSystem {
  exists(path: string): Promise<boolean>;
  isDirectory(path: string): Promise<boolean>;
  readDirectory(path: string): Promise<string[]>;
  readFile(path: string): Promise<string>;
  getFileInfo(path: string): Promise<{ size: number; modTime: Date }>;
  joinPath(...segments: string[]): string;
  getBaseName(path: string): string;
  getDirectoryName(path: string): string;
}

/**
 * Go project scanner
 */
export class GoProjectScanner {
  constructor(
    private readonly fs: FileSystem,
    private readonly options: ScanOptions,
  ) {}

  /**
   * Scan project starting from root path
   */
  async scan(rootPath: string): Promise<Result<ScanResult, DomainError>> {
    const startTime = Date.now();

    // Verify root exists
    if (!await this.fs.exists(rootPath)) {
      return failure(createDomainError({
        domain: 'resource',
        kind: 'FileNotFound',
        details: { path: rootPath },
      }));
    }

    // Scan directory hierarchy
    const hierarchyResult = await this.scanDirectoryHierarchy(rootPath, 0);
    if (!hierarchyResult.ok) {
      return hierarchyResult;
    }

    // Extract packages from hierarchy
    const packages = this.extractPackages(hierarchyResult.data);

    // Count totals
    const stats = this.calculateStats(hierarchyResult.data);

    const result: ScanResult = {
      rootPath,
      hierarchy: hierarchyResult.data,
      packages,
      totalFiles: stats.files,
      totalDirectories: stats.directories,
      scanDuration: Date.now() - startTime,
    };

    return success(result);
  }

  /**
   * Identify project structure type
   */
  async identifyProjectStructure(rootPath: string): Promise<Result<ProjectStructure, DomainError>> {
    // Check for go.work (workspace)
    const hasGoWork = await this.fs.exists(this.fs.joinPath(rootPath, 'go.work'));
    if (hasGoWork) {
      // TODO: Parse go.work and scan workspace modules
      return success({
        type: 'workspace',
        roots: [rootPath],
        modules: [],
      });
    }

    // Check for go.mod (module)
    const hasGoMod = await this.fs.exists(this.fs.joinPath(rootPath, 'go.mod'));
    if (hasGoMod) {
      const moduleResult = await this.parseGoMod(this.fs.joinPath(rootPath, 'go.mod'));
      if (!moduleResult.ok) {
        return moduleResult;
      }

      const scanResult = await this.scan(rootPath);
      if (!scanResult.ok) {
        return scanResult;
      }

      return success({
        type: 'module',
        root: rootPath,
        module: moduleResult.data,
        packages: scanResult.data.packages,
      });
    }

    // Simple project (no module)
    const scanResult = await this.scan(rootPath);
    if (!scanResult.ok) {
      return scanResult;
    }

    return success({
      type: 'simple',
      root: rootPath,
      packages: scanResult.data.packages,
    });
  }

  /**
   * Scan directory hierarchy recursively
   */
  private async scanDirectoryHierarchy(
    path: string,
    depth: number,
  ): Promise<Result<DirectoryHierarchy, DomainError>> {
    // Check depth limit
    if (depth > this.options.maxDepth) {
      return success(this.createEmptyHierarchy(path, depth));
    }

    // Read directory contents
    let entries: string[];
    try {
      entries = await this.fs.readDirectory(path);
    } catch {
      return failure(createDomainError({
        domain: 'resource',
        kind: 'AccessDenied',
        details: { path },
      }));
    }

    // Filter and categorize entries
    const goFiles: string[] = [];
    const testFiles: string[] = [];
    const subdirs: string[] = [];
    let hasGoMod = false;

    for (const entry of entries) {
      const fullPath = this.fs.joinPath(path, entry);

      // Skip hidden files unless configured
      if (entry.startsWith('.') && !this.options.includeHidden) {
        continue;
      }

      // Skip vendor unless configured
      if (entry === 'vendor' && !this.options.includeVendor) {
        continue;
      }

      // Check exclude patterns
      if (this.shouldExclude(fullPath)) {
        continue;
      }

      if (entry === 'go.mod') {
        hasGoMod = true;
      } else if (entry.endsWith('.go')) {
        if (entry.endsWith('_test.go')) {
          testFiles.push(entry);
        } else {
          goFiles.push(entry);
        }
      } else if (await this.fs.isDirectory(fullPath)) {
        subdirs.push(entry);
      }
    }

    // Scan subdirectories
    const childResults = await Promise.all(
      subdirs.map((subdir) =>
        this.scanDirectoryHierarchy(this.fs.joinPath(path, subdir), depth + 1)
      ),
    );

    const childrenResult = combineResults(childResults);
    if (!childrenResult.ok) {
      return childrenResult;
    }

    // Get package name if there are Go files
    let packageName: string | undefined;
    if (goFiles.length > 0 || testFiles.length > 0) {
      const pkgResult = await this.getPackageName(path, [...goFiles, ...testFiles]);
      if (pkgResult.ok) {
        packageName = pkgResult.data;
      }
    }

    const hierarchy: DirectoryHierarchy = {
      path,
      name: this.fs.getBaseName(path),
      depth,
      hasGoFiles: goFiles.length > 0,
      hasTestFiles: testFiles.length > 0,
      hasGoMod,
      testFileCount: testFiles.length,
      goFileCount: goFiles.length,
      children: childrenResult.data,
      packageName,
    };

    return success(hierarchy);
  }

  /**
   * Extract package name from Go files
   */
  private async getPackageName(
    dirPath: string,
    goFiles: string[],
  ): Promise<Result<string, DomainError>> {
    if (goFiles.length === 0) {
      return failure(createDomainError({
        domain: 'resource',
        kind: 'ParseFailed',
        details: { reason: 'No Go files in directory' },
      }));
    }

    // Read first Go file to extract package name
    const firstFile = this.fs.joinPath(dirPath, goFiles[0]);
    try {
      const content = await this.fs.readFile(firstFile);
      const packageMatch = content.match(/^package\s+(\w+)/m);

      if (packageMatch) {
        return success(packageMatch[1]);
      }

      return failure(createDomainError({
        domain: 'resource',
        kind: 'ParseFailed',
        details: { reason: 'Package declaration not found' },
      }));
    } catch {
      return failure(createDomainError({
        domain: 'resource',
        kind: 'AccessDenied',
        details: { path: firstFile },
      }));
    }
  }

  /**
   * Parse go.mod file
   */
  private async parseGoMod(path: string): Promise<Result<GoModuleInfo, DomainError>> {
    try {
      const content = await this.fs.readFile(path);

      // Basic go.mod parsing
      const moduleMatch = content.match(/^module\s+(.+)$/m);
      const goVersionMatch = content.match(/^go\s+(.+)$/m);

      if (!moduleMatch) {
        return failure(createDomainError({
          domain: 'resource',
          kind: 'ParseFailed',
          details: { reason: 'Module declaration not found in go.mod' },
        }));
      }

      const module: GoModuleInfo = {
        path: this.fs.getDirectoryName(path),
        moduleName: moduleMatch[1].trim(),
        goVersion: goVersionMatch?.[1].trim(),
        dependencies: [], // TODO: Parse require blocks
        replace: [], // TODO: Parse replace blocks
      };

      return success(module);
    } catch {
      return failure(createDomainError({
        domain: 'resource',
        kind: 'AccessDenied',
        details: { path },
      }));
    }
  }

  /**
   * Extract packages from hierarchy
   */
  private extractPackages(hierarchy: DirectoryHierarchy): GoPackageInfo[] {
    const packages: GoPackageInfo[] = [];

    const traverse = (node: DirectoryHierarchy): void => {
      if (node.packageName && (node.hasGoFiles || node.hasTestFiles)) {
        const pkg: GoPackageInfo = {
          path: node.path,
          name: node.packageName,
          importPath: node.path, // Simple import path for now
          goFiles: node.goFiles,
          testFiles: node.testFiles,
          hasTestFiles: node.hasTestFiles,
          hasBenchmarks: false, // TODO: Detect benchmarks
          hasExamples: false, // TODO: Detect examples
          dependencies: [], // TODO: Extract imports
        };
        packages.push(pkg);
      }

      for (const child of node.children) {
        traverse(child);
      }
    };

    traverse(hierarchy);
    return packages;
  }

  /**
   * Calculate statistics from hierarchy
   */
  private calculateStats(hierarchy: DirectoryHierarchy): { files: number; directories: number } {
    let files = hierarchy.goFileCount + hierarchy.testFileCount;
    let directories = 1;

    for (const child of hierarchy.children) {
      const childStats = this.calculateStats(child);
      files += childStats.files;
      directories += childStats.directories;
    }

    return { files, directories };
  }

  /**
   * Check if path should be excluded
   */
  private shouldExclude(path: string): boolean {
    for (const pattern of this.options.excludePatterns) {
      if (path.includes(pattern)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Create empty hierarchy node
   */
  private createEmptyHierarchy(path: string, depth: number): DirectoryHierarchy {
    return {
      path,
      name: this.fs.getBaseName(path),
      depth,
      hasGoFiles: false,
      hasTestFiles: false,
      hasGoMod: false,
      testFileCount: 0,
      goFileCount: 0,
      children: [],
    };
  }

  /**
   * Classify Go file type
   */
  static classifyGoFile(path: string, content: string): GoFileType {
    const fileName = path.split('/').pop() || '';

    // Check for build constraints that might exclude the file
    const buildConstraintMatch = content.match(/^\/\/\s*\+build\s+(.+)$/m);
    if (buildConstraintMatch) {
      // Simple check - would need more sophisticated parsing
      if (buildConstraintMatch[1].includes('ignore')) {
        return { type: 'build-ignored', path, reason: 'build constraint' };
      }
    }

    // Check if vendor
    if (path.includes('/vendor/')) {
      return { type: 'vendor', path };
    }

    // Check if generated
    if (content.includes('// Code generated') || content.includes('// DO NOT EDIT')) {
      return { type: 'generated', path };
    }

    // Extract package name
    const packageMatch = content.match(/^package\s+(\w+)/m);
    const packageName = packageMatch?.[1] || 'unknown';

    // Check if test file
    if (fileName.endsWith('_test.go')) {
      const hasTests = /func\s+Test\w+\s*\(/.test(content);
      const hasBenchmarks = /func\s+Benchmark\w+\s*\(/.test(content);

      return {
        type: 'test',
        path,
        package: packageName,
        hasTests,
        hasBenchmarks,
      };
    }

    // Regular source file
    return {
      type: 'source',
      path,
      package: packageName,
    };
  }
}
