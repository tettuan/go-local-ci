/**
 * Report Generator - Generates various report formats
 * Following Totality principle
 */

import type { Result } from '../../shared/result.ts';
import { failure, success } from '../../shared/result.ts';
import type { DomainError } from '../../shared/errors.ts';
import { createDomainError } from '../../shared/errors.ts';
import type {
  BenchmarkComparison as _BenchmarkComparison,
  BenchmarkDelta as _BenchmarkDelta,
  BenchmarkResult as _BenchmarkResult,
  ReportFormat as _ReportFormat,
  ReportGenerationRequest,
} from './types.ts';
import type { TestExecutionResult } from '../test-execution/types.ts';

/**
 * File writer interface
 */
export interface FileWriter {
  write(path: string, content: string): Promise<Result<void, Error>>;
}

/**
 * Template renderer interface
 */
export interface TemplateRenderer {
  render(template: string, data: Record<string, unknown>): Result<string, Error>;
}

/**
 * Report Generator
 */
export class ReportGenerator {
  constructor(
    private readonly writer: FileWriter,
    private readonly renderer?: TemplateRenderer,
  ) {}

  /**
   * Generate test report
   */
  async generateTestReport(
    results: TestExecutionResult[],
    request: ReportGenerationRequest,
  ): Promise<Result<string, DomainError>> {
    let content: string;

    switch (request.format.type) {
      case 'json':
        content = this.generateJsonReport(results, request.format.pretty);
        break;

      case 'junit-xml': {
        const xmlResult = this.generateJunitReport(results, request.format.suiteName);
        if (!xmlResult.ok) {
          return xmlResult;
        }
        content = xmlResult.data;
        break;
      }

      case 'tap':
        content = this.generateTapReport(results, request.format.version);
        break;

      case 'markdown':
        content = this.generateMarkdownReport(results, request.format.includeDetails);
        break;

      case 'html': {
        const htmlResult = await this.generateHtmlReport(
          results,
          request.format.template,
        );
        if (!htmlResult.ok) {
          return htmlResult;
        }
        content = htmlResult.data;
        break;
      }
    }

    // Write to file if path provided
    if (request.outputPath) {
      const writeResult = await this.writer.write(request.outputPath, content);
      if (!writeResult.ok) {
        return failure(createDomainError({
          domain: 'search',
          kind: 'FileWriteFailed',
          details: { path: request.outputPath, error: writeResult.error.message },
        }));
      }
    }

    return success(content);
  }

  /**
   * Generate benchmark comparison report
   */
  generateBenchmarkReport(
    comparison: BenchmarkComparison,
    format: 'text' | 'markdown' | 'json',
  ): string {
    switch (format) {
      case 'text':
        return this.generateBenchmarkText(comparison);
      case 'markdown':
        return this.generateBenchmarkMarkdown(comparison);
      case 'json':
        return JSON.stringify(comparison, null, 2);
    }
  }

  /**
   * Generate JSON report
   */
  private generateJsonReport(
    results: TestExecutionResult[],
    pretty: boolean,
  ): string {
    const report = {
      summary: this.generateSummary(results),
      results: results.map((r) => ({
        target: r.target,
        status: r.status,
        duration: r.duration,
        packages: r.packages.map((p) => ({
          name: p.name,
          passed: p.passed,
          duration: p.duration,
          tests: p.tests,
        })),
      })),
      timestamp: new Date().toISOString(),
    };

    return pretty ? JSON.stringify(report, null, 2) : JSON.stringify(report);
  }

  /**
   * Generate JUnit XML report
   */
  private generateJunitReport(
    results: TestExecutionResult[],
    suiteName: string,
  ): Result<string, DomainError> {
    try {
      const summary = this.generateSummary(results);

      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xml += `<testsuites name="${this.escapeXml(suiteName)}" `;
      xml += `tests="${summary.totalTests}" `;
      xml += `failures="${summary.failedTests}" `;
      xml += `errors="0" `;
      xml += `time="${(summary.totalDuration / 1000).toFixed(3)}">\n`;

      for (const result of results) {
        for (const pkg of result.packages) {
          xml += `  <testsuite name="${this.escapeXml(pkg.name)}" `;
          xml += `tests="${pkg.tests.length}" `;
          xml += `failures="${pkg.tests.filter((t) => !t.passed).length}" `;
          xml += `time="${(pkg.duration / 1000).toFixed(3)}">\n`;

          for (const test of pkg.tests) {
            xml += `    <testcase name="${this.escapeXml(test.name)}" `;
            xml += `time="${(test.duration / 1000).toFixed(3)}"`;

            if (test.passed) {
              xml += '/>\n';
            } else {
              xml += '>\n';
              xml += `      <failure message="${this.escapeXml(test.output || 'Test failed')}"/>\n`;
              xml += '    </testcase>\n';
            }
          }

          xml += '  </testsuite>\n';
        }
      }

      xml += '</testsuites>\n';
      return success(xml);
    } catch (error) {
      return failure(createDomainError({
        domain: 'search',
        kind: 'ReportGenerationFailed',
        details: { format: 'junit-xml', error: String(error) },
      }));
    }
  }

  /**
   * Generate TAP report
   */
  private generateTapReport(
    results: TestExecutionResult[],
    version: number,
  ): string {
    let tap = `TAP version ${version}\n`;
    let testNumber = 0;
    const summary = this.generateSummary(results);

    tap += `1..${summary.totalTests}\n`;

    for (const result of results) {
      for (const pkg of result.packages) {
        for (const test of pkg.tests) {
          testNumber++;
          if (test.passed) {
            tap += `ok ${testNumber} ${pkg.name}/${test.name}\n`;
          } else {
            tap += `not ok ${testNumber} ${pkg.name}/${test.name}\n`;
            if (test.output) {
              tap += `  ---\n`;
              tap += `  message: ${test.output}\n`;
              tap += `  ---\n`;
            }
          }
        }
      }
    }

    return tap;
  }

  /**
   * Generate Markdown report
   */
  private generateMarkdownReport(
    results: TestExecutionResult[],
    includeDetails: boolean,
  ): string {
    const summary = this.generateSummary(results);
    let md = '# Test Results\n\n';

    // Summary
    md += '## Summary\n\n';
    md += `- **Total Tests**: ${summary.totalTests}\n`;
    md += `- **Passed**: ${summary.passedTests} ✅\n`;
    md += `- **Failed**: ${summary.failedTests} ❌\n`;
    md += `- **Pass Rate**: ${summary.passRate.toFixed(1)}%\n`;
    md += `- **Duration**: ${(summary.totalDuration / 1000).toFixed(2)}s\n\n`;

    // Results by package
    md += '## Results by Package\n\n';

    for (const result of results) {
      for (const pkg of result.packages) {
        const passedCount = pkg.tests.filter((t) => t.passed).length;
        const icon = pkg.passed ? '✅' : '❌';

        md += `### ${pkg.name} ${icon}\n\n`;
        md += `- Tests: ${pkg.tests.length}\n`;
        md += `- Passed: ${passedCount}\n`;
        md += `- Failed: ${pkg.tests.length - passedCount}\n`;
        md += `- Duration: ${(pkg.duration / 1000).toFixed(3)}s\n\n`;

        if (includeDetails && pkg.tests.length > 0) {
          md += '| Test | Result | Duration |\n';
          md += '|------|--------|----------|\n';

          for (const test of pkg.tests) {
            const testIcon = test.passed ? '✅' : '❌';
            md += `| ${test.name} | ${testIcon} | ${(test.duration / 1000).toFixed(3)}s |\n`;
          }
          md += '\n';
        }
      }
    }

    return md;
  }

  /**
   * Generate HTML report
   */
  private generateHtmlReport(
    results: TestExecutionResult[],
    templatePath?: string,
  ): Promise<Result<string, DomainError>> {
    const summary = this.generateSummary(results);
    const data = {
      title: 'Test Results',
      summary,
      results,
      generated: new Date().toISOString(),
    };

    // Use custom template if provided
    if (templatePath && this.renderer) {
      // TODO: Read template from file
      const template = ''; // Would read from templatePath
      const renderResult = this.renderer.render(template, data);
      if (!renderResult.ok) {
        return failure(createDomainError({
          domain: 'search',
          kind: 'TemplateRenderFailed',
          details: { error: renderResult.error.message },
        }));
      }
      return success(renderResult.data);
    }

    // Default HTML template
    const html = this.generateDefaultHtml(data);
    return success(html);
  }

  /**
   * Generate default HTML
   */
  private generateDefaultHtml(data: Record<string, unknown>): string {
    return `<!DOCTYPE html>
<html>
<head>
  <title>${data.title}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .summary { background: #f0f0f0; padding: 20px; border-radius: 5px; }
    .pass { color: green; }
    .fail { color: red; }
    table { border-collapse: collapse; width: 100%; margin-top: 20px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #f0f0f0; }
  </style>
</head>
<body>
  <h1>${data.title}</h1>
  <div class="summary">
    <h2>Summary</h2>
    <p>Total Tests: ${data.summary.totalTests}</p>
    <p class="pass">Passed: ${data.summary.passedTests}</p>
    <p class="fail">Failed: ${data.summary.failedTests}</p>
    <p>Pass Rate: ${data.summary.passRate.toFixed(1)}%</p>
    <p>Duration: ${(data.summary.totalDuration / 1000).toFixed(2)}s</p>
  </div>
  <h2>Results</h2>
  <table>
    <tr>
      <th>Package</th>
      <th>Tests</th>
      <th>Passed</th>
      <th>Failed</th>
      <th>Duration</th>
    </tr>
    ${
      (data.results as Array<
        { packages: Array<{ name: string; duration: number; tests: Array<{ passed: boolean }> }> }
      >).flatMap((r) =>
        r.packages.map((p) => `
    <tr>
      <td>${p.name}</td>
      <td>${p.tests.length}</td>
      <td class="pass">${p.tests.filter((t) => t.passed).length}</td>
      <td class="fail">${p.tests.filter((t) => !t.passed).length}</td>
      <td>${(p.duration / 1000).toFixed(3)}s</td>
    </tr>
    `)
      ).join('')
    }
  </table>
  <p><small>Generated: ${data.generated}</small></p>
</body>
</html>`;
  }

  /**
   * Generate benchmark text report
   */
  private generateBenchmarkText(comparison: BenchmarkComparison): string {
    let text = 'Benchmark Comparison\n';
    text += '===================\n\n';

    for (const delta of comparison.comparison) {
      text += `${delta.package}/${delta.name}:\n`;
      text += `  Speed: ${delta.speedChange > 0 ? '+' : ''}${delta.speedChange.toFixed(1)}%`;
      text += delta.significant ? ' (significant)' : '';
      text += '\n';
      text += `  Allocs: ${delta.allocChange > 0 ? '+' : ''}${delta.allocChange.toFixed(1)}%\n`;
      text += '\n';
    }

    return text;
  }

  /**
   * Generate benchmark markdown report
   */
  private generateBenchmarkMarkdown(comparison: BenchmarkComparison): string {
    let md = '# Benchmark Comparison\n\n';
    md += '| Benchmark | Speed Change | Alloc Change | Significant |\n';
    md += '|-----------|--------------|--------------|-------------|\n';

    for (const delta of comparison.comparison) {
      const speedStr = `${delta.speedChange > 0 ? '+' : ''}${delta.speedChange.toFixed(1)}%`;
      const allocStr = `${delta.allocChange > 0 ? '+' : ''}${delta.allocChange.toFixed(1)}%`;
      const sigStr = delta.significant ? '✓' : '';

      md += `| ${delta.package}/${delta.name} | ${speedStr} | ${allocStr} | ${sigStr} |\n`;
    }

    return md;
  }

  /**
   * Generate summary statistics
   */
  private generateSummary(results: TestExecutionResult[]): Record<string, unknown> {
    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;
    let totalDuration = 0;

    for (const result of results) {
      totalDuration += result.duration;
      for (const pkg of result.packages) {
        totalTests += pkg.tests.length;
        passedTests += pkg.tests.filter((t) => t.passed).length;
        failedTests += pkg.tests.filter((t) => !t.passed).length;
      }
    }

    const passRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;

    return {
      totalTests,
      passedTests,
      failedTests,
      passRate,
      totalDuration,
    };
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
