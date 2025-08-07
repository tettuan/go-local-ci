import { assertEquals, assertStringIncludes } from '@std/assert';
import { join } from '@std/path';

const CLI_PATH = join(Deno.cwd(), 'mod.ts');

/**
 * Helper to run CLI as a subprocess
 */
async function runCLI(args: string[], options?: { cwd?: string }) {
  const cmd = new Deno.Command(Deno.execPath(), {
    args: [
      'run',
      '--allow-read',
      '--allow-write',
      '--allow-run',
      '--allow-env',
      CLI_PATH,
      ...args,
    ],
    cwd: options?.cwd || Deno.cwd(),
    stdout: 'piped',
    stderr: 'piped',
  });

  const process = cmd.spawn();
  const output = await process.output();

  const stdout = new TextDecoder().decode(output.stdout);
  const stderr = new TextDecoder().decode(output.stderr);

  return {
    code: output.code,
    stdout,
    stderr,
    success: output.success,
  };
}

Deno.test('E2E CLI - help flag', async () => {
  const result = await runCLI(['--help']);

  assertEquals(result.code, 0);
  assertStringIncludes(result.stdout, 'Go CI');
  assertStringIncludes(result.stdout, 'Usage:');
  assertStringIncludes(result.stdout, '--working-directory');
});

Deno.test('E2E CLI - version flag', async () => {
  const result = await runCLI(['--version']);

  assertEquals(result.code, 0);
  assertStringIncludes(result.stdout, 'version');
});

Deno.test('E2E CLI - run with working directory', async () => {
  const result = await runCLI([
    '--working-directory',
    './tests/fixtures/simple-go-project',
    '--log-level',
    'info',
  ]);

  // Should complete successfully
  assertEquals(result.code, 0);
  assertStringIncludes(result.stdout, '✅');
});

Deno.test('E2E CLI - run from different cwd', async () => {
  // Run from tests directory but target fixtures
  const result = await runCLI([
    '--working-directory',
    './fixtures/simple-go-project',
    '--log-level',
    'info',
  ], { cwd: join(Deno.cwd(), 'tests') });

  assertEquals(result.code, 0);
  assertStringIncludes(result.stdout, '✅');
});

Deno.test('E2E CLI - multi-package project', async () => {
  const result = await runCLI([
    '--working-directory',
    './tests/fixtures/multi-package-project',
    '--mode',
    'batch',
    '--batch-size',
    '2',
    '--log-level',
    'info',
  ]);

  // Multi-package project has problematic tests, so it may exit with code 1
  // But the process should complete successfully
  assertStringIncludes(result.stdout, 'Some tests failed');
});

Deno.test('E2E CLI - error handling for non-existent directory', async () => {
  const result = await runCLI([
    '--working-directory',
    './non-existent-directory',
    '--log-level',
    'info',
  ]);

  // Should fail gracefully
  assertEquals(result.code, 1);
  assertStringIncludes(result.stdout + result.stderr, 'ProjectScanFailed');
});

Deno.test('E2E CLI - invalid mode', async () => {
  const result = await runCLI([
    '--working-directory',
    './tests/fixtures/simple-go-project',
    '--mode',
    'invalid-mode',
  ]);

  assertEquals(result.code, 1);
  assertStringIncludes(result.stdout + result.stderr, 'Invalid mode');
});

Deno.test('E2E CLI - problematic project with fallback', async () => {
  const result = await runCLI([
    '--working-directory',
    './tests/fixtures/problematic-go-project',
    '--enable-fallback',
    '--log-level',
    'info',
  ]);

  // Should handle errors gracefully with fallback
  assertEquals(result.code, 1); // Tests fail but execution completes
});
