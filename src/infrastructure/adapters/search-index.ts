/**
 * Search Index Adapter
 * Simple in-memory search index implementation
 */

import type { SearchIndex } from '../../domains/search-integration/search-service.ts';
import type { SearchMatch, SearchQuery } from '../../domains/search-integration/types.ts';
import type { ProjectStructure } from '../../domains/resource-management/types.ts';

/**
 * In-memory search index
 */
class InMemorySearchIndex implements SearchIndex {
  private packages: Map<string, SearchMatch> = new Map();
  private files: Map<string, SearchMatch> = new Map();
  private testFunctions: Map<string, SearchMatch> = new Map();
  private dependencies: Map<string, SearchMatch> = new Map();

  async indexProject(structure: ProjectStructure): Promise<void> {
    // Clear existing index
    this.clear();

    // Index based on project type
    switch (structure.type) {
      case 'module':
      case 'simple':
        for (const pkg of structure.packages) {
          // Index package
          const pkgMatch: SearchMatch = {
            type: 'package',
            path: pkg.path,
            name: pkg.name,
            importPath: pkg.importPath,
          };
          this.packages.set(pkg.importPath, pkgMatch);

          // Index files
          for (const file of [...pkg.goFiles, ...pkg.testFiles]) {
            const fileMatch: SearchMatch = {
              type: 'file',
              path: `${pkg.path}/${file}`,
              packageName: pkg.name,
              isTest: file.endsWith('_test.go'),
            };
            this.files.set(`${pkg.path}/${file}`, fileMatch);
          }
        }
        break;

      case 'workspace':
        // TODO: Handle workspace indexing
        break;
    }
  }

  async search(query: SearchQuery): Promise<SearchMatch[]> {
    const matches: SearchMatch[] = [];

    switch (query.type) {
      case 'package-pattern':
        for (const [_, match] of this.packages) {
          if (match.type === 'package' && this.matchesPattern(match.name, query.pattern, query.fuzzy)) {
            matches.push(match);
          }
        }
        break;

      case 'file-pattern':
        for (const [path, match] of this.files) {
          if (this.matchesPattern(path, query.pattern, !query.caseSensitive)) {
            matches.push(match);
          }
        }
        break;

      case 'test-function':
        for (const [_, match] of this.testFunctions) {
          if (
            match.type === 'test-function' &&
            this.matchesPattern(match.name, query.namePattern, false) &&
            (!query.includeSubtests || match.isSubtest)
          ) {
            matches.push(match);
          }
        }
        break;

      case 'dependency':
        for (const [_, match] of this.dependencies) {
          if (
            match.type === 'dependency' &&
            match.module === query.module &&
            (!query.version || match.version === query.version)
          ) {
            matches.push(match);
          }
        }
        break;
    }

    return matches;
  }

  clear(): void {
    this.packages.clear();
    this.files.clear();
    this.testFunctions.clear();
    this.dependencies.clear();
  }

  private matchesPattern(text: string, pattern: string, fuzzy: boolean): boolean {
    if (fuzzy) {
      // Simple fuzzy matching
      const patternChars = pattern.toLowerCase().split('');
      let textIndex = 0;
      const lowerText = text.toLowerCase();

      for (const char of patternChars) {
        const foundIndex = lowerText.indexOf(char, textIndex);
        if (foundIndex === -1) {
          return false;
        }
        textIndex = foundIndex + 1;
      }
      return true;
    } else {
      // Simple substring match
      return text.includes(pattern);
    }
  }
}

/**
 * Create search index
 */
export function createSearchIndex(): SearchIndex {
  return new InMemorySearchIndex();
}
