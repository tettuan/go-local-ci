import { assertEquals, assertExists } from '@std/assert';
import { parseCli } from '../src/domains/application-control/cli-parser.ts';
import { BatchSize, Timeout, WorkingDirectory } from '../src/domains/application-control/types.ts';
import { ApplicationStateManager } from '../src/domains/application-control/state-manager.ts';

Deno.test('parseCli - parses basic arguments correctly', () => {
  const result = parseCli(['--mode', 'batch', '--batch-size', '5']);

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.mode, 'batch');
    assertEquals(result.data.batchSize, 5);
  }
});

Deno.test('parseCli - handles invalid mode', () => {
  const result = parseCli(['--mode', 'invalid']);

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertExists(result.error);
  }
});

Deno.test('BatchSize - creates valid batch size', () => {
  const result = BatchSize.create(5);
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.value, 5);
  }
});

Deno.test('BatchSize - rejects invalid batch size', () => {
  const result = BatchSize.create(0);
  assertEquals(result.ok, false);
});

Deno.test('Timeout - creates valid timeout', () => {
  const result = Timeout.create(300);
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.value, 300);
  }
});

Deno.test('WorkingDirectory - creates valid directory', () => {
  const result = WorkingDirectory.create('./test');
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.value, './test');
  }
});

Deno.test('ApplicationStateManager - can be instantiated', () => {
  const stateManager = new ApplicationStateManager();
  assertExists(stateManager);

  const state = stateManager.getState();
  assertEquals(state.type, 'initializing');
});
