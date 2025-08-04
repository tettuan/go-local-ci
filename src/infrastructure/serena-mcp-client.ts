/**
 * Serena MCP client for finding similar files
 * This service integrates with Serena MCP to search for files with similar content or structure
 */

import type { Result } from '../utils/result.ts';
import { failure, success } from '../utils/result.ts';

export interface SimilarFile {
  path: string;
  similarityScore: number;
  reason: string;
}

export interface SerenaSearchOptions {
  maxResults?: number;
  minSimilarity?: number;
  searchPattern?: string;
  excludePatterns?: string[];
}

export class SerenaMCPClient {
  /**
   * Search for files similar to the given file path using Serena MCP
   * Note: This currently uses a mock implementation. In production, this would
   * integrate with the actual Serena MCP server through the MCP protocol.
   */
  findSimilarFiles(
    filePath: string,
    options: SerenaSearchOptions = {},
  ): Promise<Result<SimilarFile[], Error>> {
    return Promise.resolve(this.findSimilarFilesSync(filePath, options));
  }

  private findSimilarFilesSync(
    filePath: string,
    options: SerenaSearchOptions = {},
  ): Result<SimilarFile[], Error> {
    try {
      // Mock implementation for finding similar files
      // In production, this would call the actual Serena MCP server

      const similarFiles: SimilarFile[] = [];

      // Extract base filename and directory for similarity matching
      const parts = filePath.split('/');
      const baseName = parts.pop() || '';
      const dirPath = parts.join('/');
      const isTestFile = baseName.endsWith('_test.go');

      if (isTestFile) {
        // For test files, look for other test files in the same directory
        const baseTestName = baseName.replace('_test.go', '');

        // Check for files in the same directory
        try {
          const entries = Deno.readDirSync(dirPath);
          for (const entry of entries) {
            if (entry.isFile && entry.name.endsWith('_test.go') && entry.name !== baseName) {
              // Check if it's related to the same base name
              const entryBase = entry.name.replace(/_.*_test\.go$/, '');
              if (entryBase === baseTestName || entry.name.includes(baseTestName)) {
                similarFiles.push({
                  path: `${dirPath}/${entry.name}`,
                  similarityScore: 0.85,
                  reason: 'Similar test file in same directory',
                });
              }
            }
          }
        } catch {
          // If directory read fails, fall back to pattern-based approach
          const patterns = [
            `${baseTestName}_integration_test.go`,
            `${baseTestName}_unit_test.go`,
          ];

          for (const pattern of patterns) {
            if (pattern !== baseName) {
              similarFiles.push({
                path: filePath.replace(baseName, pattern),
                similarityScore: 0.85,
                reason: 'Similar test file naming pattern',
              });
            }
          }
        }
      }

      // Apply filters
      let filtered = similarFiles;

      if (options.minSimilarity !== undefined) {
        const minSim = options.minSimilarity;
        filtered = filtered.filter((f) => f.similarityScore >= minSim);
      }

      if (options.maxResults) {
        filtered = filtered.slice(0, options.maxResults);
      }

      return success(filtered);
    } catch (error) {
      if (error instanceof Error) {
        return failure(error);
      }
      return failure(new Error('Unknown error occurred while searching for similar files'));
    }
  }

  /**
   * Check if Serena MCP is available on the system
   * Note: This returns true for the mock implementation
   */
  isAvailable(): Promise<boolean> {
    // Mock implementation always available
    return Promise.resolve(true);
  }
}
