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

  const mainStartTime = Date.now();
  console.log(`\n🚀 Go CI Runner started at ${new Date(mainStartTime).toLocaleTimeString()}`);
  console.log(`═══════════════════════════════════════════════════════════════════\n`);

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
        console.log(`\n🎯 Starting test execution phase`);
        console.log(`📦 Target: ${event.target}`);
        console.log(`───────────────────────────────────────────────────────────────────`);
      }
    });

    eventBus.on('exec:completed', (event) => {
      if (event.type === 'exec:completed') {
        console.log(`\n📊 Test Execution Results:`);
        console.log(`───────────────────────────────────────────────────────────────────`);
        
        if (event.exitCode === 0) {
          console.log(`✅ Status: SUCCESS`);
          console.log(`⏱️  Duration: ${event.duration}ms (${(event.duration / 1000).toFixed(2)}s)`);
        } else {
          console.log(`❌ Status: FAILED`);
          console.log(`⏱️  Duration: ${event.duration}ms (${(event.duration / 1000).toFixed(2)}s)`);
          console.log(`📊 Exit code: ${event.exitCode}`);
          
          // Always show stdout/stderr for failed tests
          if ('stdout' in event && event.stdout && typeof event.stdout === 'string' && event.stdout.trim()) {
            console.log(`\n📝 Test Output:`);
            console.log(event.stdout);
          }
          if ('stderr' in event && event.stderr && typeof event.stderr === 'string' && event.stderr.trim()) {
            console.log(`\n⚠️  Error Output:`);
            console.log(event.stderr);
          }
        }
        console.log(`───────────────────────────────────────────────────────────────────`);
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
      console.log(`\n⚠️  Non-fatal errors encountered (${errors.length}):`);
      console.log(`───────────────────────────────────────────────────────────────────`);
      for (const error of errors) {
        console.warn(`  • Domain: ${error.domain}`);
        console.warn(`    Kind: ${error.kind}`);
        if (error.details) {
          console.warn(`    Details: ${JSON.stringify(error.details, null, 2)}`);
        }
      }
      console.log(`───────────────────────────────────────────────────────────────────`);
    }

    // Determine exit code based on test results
    const allTestsPassed = testResults?.every((r) => r.success) ?? false;

    // Debug logging for CI
    if (Deno.env.get('CI') || Deno.env.get('DEBUG')) {
      console.log('=== Debug Info ===');
      console.log(`Test results count: ${testResults?.length ?? 0}`);
      console.log(`All tests passed: ${allTestsPassed}`);
      if (testResults) {
        testResults.forEach((r, i) => {
          console.log(
            `Test ${i}: success=${r.success}, status=${r.status}, exitCode=${r.processResult?.exitCode}`,
          );
          if (r.processResult?.stderr) {
            console.log(`  stderr: ${r.processResult.stderr}`);
          }
          if (r.processResult?.stdout) {
            console.log(`  stdout (first 200 chars): ${r.processResult.stdout.substring(0, 200)}`);
          }
        });
      }
      console.log('==================');
    }

    const mainEndTime = Date.now();
    const totalDuration = mainEndTime - mainStartTime;
    
    console.log(`\n═══════════════════════════════════════════════════════════════════`);
    console.log(`🏁 Total execution time: ${totalDuration}ms (${(totalDuration / 1000).toFixed(2)}s)`);
    console.log(`🕐 Finished at: ${new Date(mainEndTime).toLocaleTimeString()}`);
    
    if (allTestsPassed) {
      console.log('✅ All tests passed!');
      Deno.exit(0);
    } else {
      console.log('❌ Some tests failed!');
      Deno.exit(1);
    }
  } catch (error) {
    const mainEndTime = Date.now();
    const totalDuration = mainEndTime - mainStartTime;
    
    // Re-throw mock Process.exit errors for testing
    if (error instanceof Error && error.message.startsWith('Process.exit')) {
      throw error;
    }

    console.log(`\n═══════════════════════════════════════════════════════════════════`);
    console.error(
      `❌ Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
    if (error instanceof Error && error.stack) {
      console.error('Stack trace:', error.stack);
    }
    console.log(`🏁 Total execution time before error: ${totalDuration}ms (${(totalDuration / 1000).toFixed(2)}s)`);
    console.log(`🕐 Failed at: ${new Date(mainEndTime).toLocaleTimeString()}`);
    Deno.exit(1);
  }
}

// Run main if this file is executed directly
if (import.meta.main) {
  await main(Deno.args);
}
