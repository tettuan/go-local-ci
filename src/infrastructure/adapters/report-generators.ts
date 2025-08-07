/**
 * Report Generators Adapter
 * Implements file writing and template rendering
 */

import type { Result } from '../../shared/result.ts';
import { failure, success } from '../../shared/result.ts';
import type {
  FileWriter,
  TemplateRenderer,
} from '../../domains/search-integration/report-generator.ts';

/**
 * Deno-based file writer
 */
class DenoFileWriter implements FileWriter {
  async write(path: string, content: string): Promise<Result<void, Error>> {
    try {
      await Deno.writeTextFile(path, content);
      return success(undefined);
    } catch (error) {
      return failure(error as Error);
    }
  }
}

/**
 * Simple template renderer
 */
class SimpleTemplateRenderer implements TemplateRenderer {
  render(template: string, data: Record<string, unknown>): Result<string, Error> {
    try {
      // Simple template rendering with {{variable}} syntax
      let result = template;

      // Replace variables
      const variableRegex = /\{\{\s*([\w.]+)\s*\}\}/g;
      result = result.replace(variableRegex, (match, path) => {
        const value = this.getNestedValue(data, path);
        return value !== undefined ? String(value) : match;
      });

      // Handle conditionals {{#if condition}}...{{/if}}
      const conditionalRegex = /\{\{#if\s+([\w.]+)\s*\}\}([\s\S]*?)\{\{\/if\}\}/g;
      result = result.replace(conditionalRegex, (_match, condition, content) => {
        const value = this.getNestedValue(data, condition);
        return value ? content : '';
      });

      // Handle loops {{#each array}}...{{/each}}
      const loopRegex = /\{\{#each\s+([\w.]+)\s*\}\}([\s\S]*?)\{\{\/each\}\}/g;
      result = result.replace(loopRegex, (_match, arrayPath, content) => {
        const array = this.getNestedValue(data, arrayPath);
        if (!Array.isArray(array)) return '';

        return array.map((item, index) => {
          let itemContent = content;
          // Replace {{this}} with current item
          itemContent = itemContent.replace(/\{\{\s*this\s*\}\}/g, String(item));
          // Replace {{@index}} with current index
          itemContent = itemContent.replace(/\{\{\s*@index\s*\}\}/g, String(index));
          // Replace {{.property}} with item property
          itemContent = itemContent.replace(
            /\{\{\s*\.([\w]+)\s*\}\}/g,
            (m: string, prop: string) => {
              return item[prop] !== undefined ? String(item[prop]) : m;
            },
          );
          return itemContent;
        }).join('');
      });

      return success(result);
    } catch (error) {
      return failure(error as Error);
    }
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (typeof current === 'object' && current !== null) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }
}

/**
 * Create report generators
 */
export function createReportGenerators(): {
  fileWriter: FileWriter;
  templateRenderer: TemplateRenderer;
} {
  return {
    fileWriter: new DenoFileWriter(),
    templateRenderer: new SimpleTemplateRenderer(),
  };
}
