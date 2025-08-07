/**
 * Go File Parser Adapter
 * Parses Go source files for test functions and dependencies
 */

import type {
  GoFileParser,
  TestFunction,
} from '../../domains/search-integration/search-service.ts';

/**
 * Simple Go file parser
 */
class SimpleGoFileParser implements GoFileParser {
  parseTestFunctions(content: string): TestFunction[] {
    const functions: TestFunction[] = [];
    const lines = content.split('\n');

    // Regular expressions for test functions
    const testFuncRegex = /^func\s+(Test\w+)\s*\(/;
    const benchmarkFuncRegex = /^func\s+(Benchmark\w+)\s*\(/;
    const exampleFuncRegex = /^func\s+(Example\w*)\s*\(/;
    const subtestRegex = /t\.Run\s*\(\s*["'`]([^"'`]+)["'`]/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNumber = i + 1;

      // Check for test functions
      let match = testFuncRegex.exec(line);
      if (match) {
        functions.push({
          name: match[1],
          line: lineNumber,
          isSubtest: false,
        });

        // Look for subtests in the function body
        let braceCount = 0;
        let inFunction = false;

        for (let j = i; j < lines.length; j++) {
          const funcLine = lines[j];

          if (funcLine.includes('{')) {
            braceCount += (funcLine.match(/\{/g) || []).length;
            inFunction = true;
          }
          if (funcLine.includes('}')) {
            braceCount -= (funcLine.match(/\}/g) || []).length;
          }

          if (inFunction && braceCount === 0) {
            break; // End of function
          }

          // Check for subtests
          const subtestMatch = subtestRegex.exec(funcLine);
          if (subtestMatch) {
            functions.push({
              name: subtestMatch[1],
              line: j + 1,
              isSubtest: true,
              parentTest: match[1],
            });
          }
        }
        continue;
      }

      // Check for benchmark functions
      match = benchmarkFuncRegex.exec(line);
      if (match) {
        functions.push({
          name: match[1],
          line: lineNumber,
          isSubtest: false,
        });
        continue;
      }

      // Check for example functions
      match = exampleFuncRegex.exec(line);
      if (match) {
        functions.push({
          name: match[1] || 'Example',
          line: lineNumber,
          isSubtest: false,
        });
      }
    }

    return functions;
  }

  parseDependencies(content: string): string[] {
    const dependencies: Set<string> = new Set();
    const lines = content.split('\n');

    let inImportBlock = false;
    const singleImportRegex = /^import\s+"([^"]+)"/;
    const importStartRegex = /^import\s*\(/;
    const importLineRegex = /^\s*"([^"]+)"/;

    for (const line of lines) {
      const trimmed = line.trim();

      // Check for single import
      const singleMatch = singleImportRegex.exec(trimmed);
      if (singleMatch) {
        dependencies.add(singleMatch[1]);
        continue;
      }

      // Check for import block start
      if (importStartRegex.test(trimmed)) {
        inImportBlock = true;
        continue;
      }

      // Check for import block end
      if (inImportBlock && trimmed === ')') {
        inImportBlock = false;
        continue;
      }

      // Parse imports in block
      if (inImportBlock) {
        const importMatch = importLineRegex.exec(trimmed);
        if (importMatch) {
          dependencies.add(importMatch[1]);
        }
      }
    }

    // Filter out standard library imports (simple heuristic)
    return Array.from(dependencies).filter((dep) => dep.includes('.') || dep.includes('/'));
  }
}

/**
 * Create Go file parser
 */
export function createGoFileParser(): GoFileParser {
  return new SimpleGoFileParser();
}
