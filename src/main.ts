import { DomainOrchestrator } from './domains/orchestrator/index.ts';
import { createEventBus } from './shared/event-bus.ts';
import { createInfrastructureAdapters } from './infrastructure/index.ts';
import { displayHelp, displayVersion } from './cli/help.ts';

/**
 * Main entry point for the Go CI tool
 * Refactored to use Domain-Driven Design with Totality
 */
export async function main(args: string[]): Promise<void> {
  // Check for help and version flags early (outside try-catch)
  if (args.includes('--help') || args.includes('-h')) {
    displayHelp();
    Deno.exit(0);
  }

  if (args.includes('--version')) {
    displayVersion();
    Deno.exit(0);
  }

  try {
    // Create event bus for domain communication
    const eventBus = createEventBus({ maxLogSize: 1000 });

    // Create infrastructure adapters
    const adapters = createInfrastructureAdapters();

    // Create orchestrator configuration
    const orchestratorConfig = {
      enableFallback: true,
      enableDocker: false, // Can be enabled via CLI flags
      enableCoverage: args.includes('--coverage'),
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

    // Subscribe to important events for logging
    eventBus.on('exec:started', (event) => {
      if (event.type === 'exec:started') {
        console.log(`🚀 Starting test execution: ${event.target}`);
      }
    });

    eventBus.on('exec:completed', (event) => {
      if (event.type === 'exec:completed') {
        if (event.exitCode === 0) {
          console.log(`✅ Tests completed successfully in ${event.duration}ms`);
        } else {
          console.log(`❌ Tests failed after ${event.duration}ms`);
        }
      }
    });

    eventBus.on('error:fallback-triggered', (event) => {
      if (event.type === 'error:fallback-triggered') {
        console.log(`⚡ Fallback triggered: ${event.from} → ${event.to}`);
      }
    });

    // Run orchestration
    const result = await orchestrator.orchestrate(args);

    if (!result.ok) {
      console.error(`❌ Orchestration failed: ${result.error.kind}`);
      if (result.error.details) {
        console.error('Details:', result.error.details);
      }
      Deno.exit(1);
    }

    const { errors, testResults } = result.data;

    // Log any non-fatal errors
    if (errors.length > 0) {
      console.warn(`⚠️  ${errors.length} non-fatal errors occurred:`);
      for (const error of errors) {
        console.warn(`  - ${error.domain}: ${error.kind}`);
      }
    }

    // Determine exit code based on test results
    const allTestsPassed = testResults?.every((r) => r.success) ?? false;

    if (allTestsPassed) {
      console.log('✅ All tests passed!');
      Deno.exit(0);
    } else {
      console.log('❌ Some tests failed!');
      Deno.exit(1);
    }
  } catch (error) {
    // Re-throw mock Process.exit errors for testing
    if (error instanceof Error && error.message.startsWith('Process.exit')) {
      throw error;
    }

    console.error(
      `❌ Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
    if (error instanceof Error && error.stack) {
      console.error('Stack trace:', error.stack);
    }
    Deno.exit(1);
  }
}

// Run main if this file is executed directly
if (import.meta.main) {
  await main(Deno.args);
}
