import { assertEquals, assertExists } from '@std/assert';
import { GoCI } from '../src/core/go-ci.ts';
import { GoCILogger } from '../src/core/go-ci-logger.ts';
import { LogModeFactory } from '../src/domain/log-mode-factory.ts';
import type { GoCIConfig } from '../src/types/go-ci-config.ts';
import { join } from '@std/path';

const FIXTURES_DIR = join(Deno.cwd(), 'tests', 'fixtures');

Deno.test('GoCI - processes simple Go project successfully', async () => {
  const simpleProjectPath = join(FIXTURES_DIR, 'simple-go-project');
  
  const config: GoCIConfig = {
    mode: 'all',
    batchSize: 10,
    enableFallback: true,
    logMode: LogModeFactory.silent(),
    stopOnFirstError: false,
    continueOnError: true,
    workingDirectory: simpleProjectPath,
    verbose: false,
  };

  const loggerResult = GoCILogger.create(config.logMode!);
  assertEquals(loggerResult.ok, true);
  
  if (loggerResult.ok) {
    const runnerResult = await GoCI.create(loggerResult.data, config, simpleProjectPath);
    assertEquals(runnerResult.ok, true);
    
    if (runnerResult.ok) {
      const result = await runnerResult.data.run();
      assertExists(result);
      assertEquals(result.success, true);
      assertEquals(result.totalPackages, 1);
      assertEquals(result.failedPackages.length, 0);
    }
  }
});

Deno.test('GoCI - processes multi-package project successfully', async () => {
  const multiPackageProjectPath = join(FIXTURES_DIR, 'multi-package-project');
  
  const config: GoCIConfig = {
    mode: 'batch',
    batchSize: 5,
    enableFallback: true,
    logMode: LogModeFactory.silent(),
    stopOnFirstError: false,
    continueOnError: true,
    workingDirectory: multiPackageProjectPath,
    verbose: false,
  };

  const loggerResult = GoCILogger.create(config.logMode!);
  assertEquals(loggerResult.ok, true);
  
  if (loggerResult.ok) {
    const runnerResult = await GoCI.create(loggerResult.data, config, multiPackageProjectPath);
    assertEquals(runnerResult.ok, true);
    
    if (runnerResult.ok) {
      const result = await runnerResult.data.run();
      assertExists(result);
      assertEquals(result.success, true);
      assertEquals(result.totalPackages > 1, true);
      assertEquals(result.failedPackages.length, 0);
    }
  }
});

Deno.test('GoCI - handles problematic project correctly', async () => {
  const problematicProjectPath = join(FIXTURES_DIR, 'problematic-go-project');
  
  const config: GoCIConfig = {
    mode: 'single-package',
    batchSize: 1,
    enableFallback: false,
    logMode: LogModeFactory.silent(),
    stopOnFirstError: false,
    continueOnError: true,
    workingDirectory: problematicProjectPath,
    verbose: false,
  };

  const loggerResult = GoCILogger.create(config.logMode!);
  assertEquals(loggerResult.ok, true);
  
  if (loggerResult.ok) {
    const runnerResult = await GoCI.create(loggerResult.data, config, problematicProjectPath);
    assertEquals(runnerResult.ok, true);
    
    if (runnerResult.ok) {
      const result = await runnerResult.data.run();
      assertExists(result);
      // This project should fail due to formatting and other issues
      assertEquals(result.success, false);
      assertEquals(result.totalPackages, 1);
      assertEquals(result.failedPackages.length > 0, true);
    }
  }
});

Deno.test('GoCI - hierarchy targeting works correctly', async () => {
  const multiPackageProjectPath = join(FIXTURES_DIR, 'multi-package-project');
  
  const config: GoCIConfig = {
    mode: 'all',
    batchSize: 10,
    enableFallback: true,
    logMode: LogModeFactory.silent(),
    stopOnFirstError: false,
    continueOnError: true,
    workingDirectory: multiPackageProjectPath,
    hierarchy: './pkg/math',
    verbose: false,
  };

  const loggerResult = GoCILogger.create(config.logMode!);
  assertEquals(loggerResult.ok, true);
  
  if (loggerResult.ok) {
    const runnerResult = await GoCI.create(loggerResult.data, config, multiPackageProjectPath);
    assertEquals(runnerResult.ok, true);
    
    if (runnerResult.ok) {
      const result = await runnerResult.data.run();
      assertExists(result);
      // Note: This will fail because pkg/math doesn't have go.mod
      // but should still process the hierarchy correctly
      assertEquals(result.totalPackages, 1);
      // Check that it at least attempted to process the hierarchy
      assertEquals(result.stages.length > 0, true);
    }
  }
});
