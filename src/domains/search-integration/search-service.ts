/**
 * Search Service - Searches for packages, files, and tests
 * Domain logic only, infrastructure provided via interfaces
 */

import type { Result } from '../../shared/result.ts';
import { failure, success } from '../../shared/result.ts';
import type { DomainError } from '../../shared/errors.ts';
import { createDomainError } from '../../shared/errors.ts';
import type { SearchMatch, SearchPattern, SearchQuery, SearchResult } from './types.ts';
import type {
  DirectoryHierarchy,
  GoPackageInfo,
  ProjectStructure,
} from '../resource-management/types.ts';

/**
 * Search index interface
 */
export interface SearchIndex {
  indexProject(structure: ProjectStructure): Promise<void>;
  search(query: SearchQuery): Promise<SearchMatch[]>;
  clear(): void;
}

/**
 * Go file parser interface
 */
export interface GoFileParser {
  parseTestFunctions(content: string): TestFunction[];
  parseDependencies(content: string): string[];
}

/**
 * Test function info
 */
export interface TestFunction {
  name: string;
  line: number;
  isSubtest: boolean;
  parentTest?: string;
}

/**
 * Search Service
 */
export class SearchService {
  constructor(
    private readonly index: SearchIndex,
    private readonly parser: GoFileParser,
  ) {}

  /**
   * Search project
   */
  async search(
    query: SearchQuery,
    projectStructure?: ProjectStructure,
  ): Promise<Result<SearchResult, DomainError>> {
    const startTime = Date.now();

    try {
      // Index project if provided
      if (projectStructure) {
        await this.index.indexProject(projectStructure);
      }

      // Execute search
      const matches = await this.index.search(query);

      const result: SearchResult = {
        query,
        matches,
        totalMatches: matches.length,
        searchDuration: Date.now() - startTime,
      };

      return success(result);
    } catch (error) {
      return failure(createDomainError({
        domain: 'search',
        kind: 'SearchFailed',
        details: { query, error: String(error) },
      }));
    }
  }

  /**
   * Search packages by pattern
   */
  searchPackages(
    packages: GoPackageInfo[],
    pattern: SearchPattern,
  ): SearchMatch[] {
    const matches: SearchMatch[] = [];

    for (const pkg of packages) {
      if (pattern.matches(pkg.name) || pattern.matches(pkg.importPath)) {
        matches.push({
          type: 'package',
          path: pkg.path,
          name: pkg.name,
          importPath: pkg.importPath,
        });
      }
    }

    return matches;
  }

  /**
   * Search files in hierarchy
   */
  searchFiles(
    hierarchy: DirectoryHierarchy,
    pattern: SearchPattern,
  ): SearchMatch[] {
    const matches: SearchMatch[] = [];

    const traverse = (node: DirectoryHierarchy): void => {
      // Check Go files in this directory
      if (node.packageName && (node.hasGoFiles || node.hasTestFiles)) {
        const fileName = node.name;
        if (pattern.matches(fileName) || pattern.matches(node.path)) {
          matches.push({
            type: 'file',
            path: node.path,
            packageName: node.packageName,
            isTest: node.hasTestFiles,
          });
        }
      }

      // Traverse children
      for (const child of node.children) {
        traverse(child);
      }
    };

    traverse(hierarchy);
    return matches;
  }

  /**
   * Search test functions
   */
  async searchTestFunctions(
    files: string[],
    pattern: SearchPattern,
    fileReader: (path: string) => Promise<string>,
  ): Promise<Result<SearchMatch[], DomainError>> {
    const matches: SearchMatch[] = [];

    for (const file of files) {
      try {
        const content = await fileReader(file);
        const functions = this.parser.parseTestFunctions(content);

        for (const fn of functions) {
          if (pattern.matches(fn.name)) {
            matches.push({
              type: 'test-function',
              file,
              name: fn.name,
              line: fn.line,
              isSubtest: fn.isSubtest,
            });
          }
        }
      } catch (_error) {
        // Continue with other files on error
        continue;
      }
    }

    return success(matches);
  }

  /**
   * Search dependencies
   */
  searchDependencies(
    moduleInfo: { dependencies: Array<{ module: string; version: string }> },
    pattern: SearchPattern,
  ): Promise<SearchMatch[]> {
    const matches: SearchMatch[] = [];
    const usageMap = new Map<string, string[]>();

    for (const dep of moduleInfo.dependencies) {
      if (pattern.matches(dep.module)) {
        matches.push({
          type: 'dependency',
          module: dep.module,
          version: dep.version,
          usedBy: usageMap.get(dep.module) || [],
        });
      }
    }

    return Promise.resolve(matches);
  }

  /**
   * Clear search index
   */
  clearIndex(): void {
    this.index.clear();
  }
}
