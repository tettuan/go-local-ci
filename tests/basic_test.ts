import { assertEquals, assertExists } from '@std/assert';
import { CLIParser } from '../src/cli/cli-parser.ts';
import { LogModeFactory } from '../src/domain/log-mode-factory.ts';
import { ProcessRunner } from '../src/infrastructure/process-runner.ts';
import { FileSystemService } from '../src/infrastructure/file-system-service.ts';

Deno.test('CLIParser - parses basic arguments correctly', () => {
  const result = CLIParser.parseArgs(['--mode', 'batch', '--batch-size', '5']);
  
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.mode, 'batch');
    assertEquals(result.data.batchSize, 5);
  }
});

Deno.test('CLIParser - handles invalid mode', () => {
  const result = CLIParser.parseArgs(['--mode', 'invalid']);
  
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.message.includes('Invalid mode'), true);
  }
});

Deno.test('LogModeFactory - creates correct log modes', () => {
  const normal = LogModeFactory.normal();
  assertEquals(normal.level, 'normal');
  assertEquals(normal.showProgress, true);

  const silent = LogModeFactory.silent();
  assertEquals(silent.level, 'silent');
  assertEquals(silent.showProgress, false);

  const debug = LogModeFactory.debug();
  assertEquals(debug.level, 'debug');
  assertEquals(debug.showDebug, true);
});

Deno.test('ProcessRunner - can be instantiated', () => {
  const runner = new ProcessRunner();
  assertExists(runner);
});

Deno.test('FileSystemService - can be instantiated', () => {
  const fs = new FileSystemService();
  assertExists(fs);
});

Deno.test('FileSystemService - exists method works', async () => {
  const fs = new FileSystemService();
  
  // Test with a file that should exist
  const existsResult = await fs.exists('deno.json');
  assertEquals(typeof existsResult, 'boolean');
  
  // Test with a file that should not exist
  const notExistsResult = await fs.exists('non-existent-file.xyz');
  assertEquals(notExistsResult, false);
});
