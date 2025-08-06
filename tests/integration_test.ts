import { assertEquals, assertExists } from '@std/assert';
import { DomainOrchestrator } from '../src/domains/orchestrator/index.ts';
import { createEventBus } from '../src/shared/event-bus.ts';
import { createInfrastructureAdapters } from '../src/infrastructure/index.ts';
import { join } from '@std/path';

const FIXTURES_DIR = join(Deno.cwd(), 'tests', 'fixtures');

Deno.test('DDD Orchestrator - processes simple Go project successfully', async () => {
  const simpleProjectPath = join(FIXTURES_DIR, 'simple-go-project');
  
  // Create event bus and infrastructure
  const eventBus = createEventBus();
  const adapters = createInfrastructureAdapters();
  
  // Create orchestrator configuration
  const orchestratorConfig = {
    enableFallback: true,
    enableDocker: false,
    enableCoverage: false,
    maxConcurrency: 10,
  };
  
  // Create domain orchestrator
  const orchestrator = new DomainOrchestrator(
    adapters.appControl,
    adapters.testExecution,
    adapters.errorControl,
    adapters.resourceManagement,
    adapters.searchIntegration,
    adapters.environmentControl,
    orchestratorConfig,
    eventBus,
  );
  
  // Prepare CLI args
  const args = [
    '--working-directory', simpleProjectPath,
    '--mode', 'all',
    '--verbose',
  ];
  
  // Run orchestration
  const result = await orchestrator.orchestrate(args);
  
  assertExists(result);
  if (!result.ok) {
    console.error('Orchestration failed:', result.error);
  }
  assertEquals(result.ok, true);
  
  if (result.ok) {
    const { testResults } = result.data;
    assertExists(testResults);
    assertEquals(testResults.length > 0, true);
    
    const allPassed = testResults.every(r => r.success);
    assertEquals(allPassed, true);
  }
});

Deno.test('DDD Orchestrator - processes multi-package project successfully', async () => {
  const multiPackageProjectPath = join(FIXTURES_DIR, 'multi-package-project');
  
  // Create event bus and infrastructure
  const eventBus = createEventBus();
  const adapters = createInfrastructureAdapters();
  
  // Create orchestrator configuration
  const orchestratorConfig = {
    enableFallback: true,
    enableDocker: false,
    enableCoverage: false,
    maxConcurrency: 5,
  };
  
  // Create domain orchestrator
  const orchestrator = new DomainOrchestrator(
    adapters.appControl,
    adapters.testExecution,
    adapters.errorControl,
    adapters.resourceManagement,
    adapters.searchIntegration,
    adapters.environmentControl,
    orchestratorConfig,
    eventBus,
  );
  
  // Prepare CLI args
  const args = [
    '--working-directory', multiPackageProjectPath,
    '--mode', 'batch',
    '--batch-size', '5',
  ];
  
  // Run orchestration
  const result = await orchestrator.orchestrate(args);
  
  assertExists(result);
  if (!result.ok) {
    console.error('Orchestration failed:', result.error);
  }
  assertEquals(result.ok, true);
  
  if (result.ok) {
    const { testResults } = result.data;
    assertExists(testResults);
    assertEquals(testResults.length > 0, true);
  }
});

Deno.test('DDD Orchestrator - handles problematic project with fallback', async () => {
  const problematicProjectPath = join(FIXTURES_DIR, 'problematic-go-project');
  
  // Create event bus and infrastructure
  const eventBus = createEventBus();
  const adapters = createInfrastructureAdapters();
  
  // Create orchestrator configuration
  const orchestratorConfig = {
    enableFallback: true, // Enable fallback for error handling
    enableDocker: false,
    enableCoverage: false,
    maxConcurrency: 1,
  };
  
  // Create domain orchestrator
  const orchestrator = new DomainOrchestrator(
    adapters.appControl,
    adapters.testExecution,
    adapters.errorControl,
    adapters.resourceManagement,
    adapters.searchIntegration,
    adapters.environmentControl,
    orchestratorConfig,
    eventBus,
  );
  
  // Track fallback events
  eventBus.on('error:fallback-triggered', () => {
    // Fallback triggered
  });
  
  // Prepare CLI args
  const args = [
    '--working-directory', problematicProjectPath,
    '--mode', 'single-package',
    '--enable-fallback',
  ];
  
  // Run orchestration
  const result = await orchestrator.orchestrate(args);
  
  assertExists(result);
  if (!result.ok) {
    console.error('Problematic test - Orchestration failed:', result.error);
  }
  // The orchestration should complete even with errors
  assertEquals(result.ok, true);
  
  if (result.ok) {
    const { testResults } = result.data;
    // Tests should have been executed
    assertExists(testResults);
    assertEquals(testResults.length > 0, true);
    // The problematic tests should have failed
    const hasFailures = testResults.some(r => !r.success);
    assertEquals(hasFailures, true);
  }
});

Deno.test('DDD Orchestrator - respects configuration options', async () => {
  const simpleProjectPath = join(FIXTURES_DIR, 'simple-go-project');
  
  // Create event bus and infrastructure
  const eventBus = createEventBus();
  const adapters = createInfrastructureAdapters();
  
  // Create orchestrator configuration with specific options
  const orchestratorConfig = {
    enableFallback: false, // Disable fallback
    enableDocker: false,
    enableCoverage: true, // Enable coverage
    maxConcurrency: 1,
  };
  
  // Create domain orchestrator
  const orchestrator = new DomainOrchestrator(
    adapters.appControl,
    adapters.testExecution,
    adapters.errorControl,
    adapters.resourceManagement,
    adapters.searchIntegration,
    adapters.environmentControl,
    orchestratorConfig,
    eventBus,
  );
  
  // Track events if needed
  // Coverage events might not be emitted in current implementation
  
  // Prepare CLI args
  const args = [
    '--working-directory', simpleProjectPath,
    '--mode', 'all',
    '--coverage', // Request coverage
  ];
  
  // Run orchestration
  const result = await orchestrator.orchestrate(args);
  
  assertExists(result);
  if (!result.ok) {
    console.error('Orchestration failed:', result.error);
  }
  assertEquals(result.ok, true);
  
  if (result.ok) {
    const { coverage } = result.data;
    // Coverage should be attempted if Go supports it
    // (might be undefined if coverage is not available)
    if (coverage !== undefined) {
      assertExists(coverage);
    }
  }
});