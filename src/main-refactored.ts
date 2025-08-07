/**
 * Main entry point - Refactored with Totality principle
 * All side effects isolated here
 */

import {
  ApplicationStateManager,
  createApplicationConfig,
  createHelpOutput,
  createVersionOutput,
  parseCli,
} from './domains/application-control/index.ts';
import { SimpleEventBus } from './shared/events.ts';
import { formatError } from './shared/errors.ts';
import type { Result } from './shared/result.ts';
import type { AppError } from './shared/errors.ts';

/**
 * Pure main logic - returns results without side effects
 */
const runMain = async (
  args: string[],
): Promise<Result<{ exitCode: number; output?: string }, AppError>> => {
  // Parse CLI arguments
  const parseResult = parseCli(args);
  if (!parseResult.ok) {
    return parseResult;
  }

  const parsedArgs = parseResult.data;

  // Handle help
  if (parsedArgs.help) {
    const helpOutput = createHelpOutput();
    return { ok: true, data: helpOutput };
  }

  // Handle version
  if (parsedArgs.version) {
    const versionOutput = createVersionOutput();
    return { ok: true, data: versionOutput };
  }

  // Create application configuration
  const configResult = await createApplicationConfig(parsedArgs);
  if (!configResult.ok) {
    return configResult;
  }

  // Initialize application
  const stateManager = new ApplicationStateManager();
  const eventBus = new SimpleEventBus();
  stateManager.setEventBus(eventBus);

  const initResult = await stateManager.initialize(configResult.data);
  if (!initResult.ok) {
    return initResult;
  }

  // TODO: Initialize other domains and run the pipeline
  // For now, we'll just simulate success

  // Shutdown
  const shutdownResult = await stateManager.startShutdown('Completed successfully');
  if (!shutdownResult.ok) {
    return shutdownResult;
  }

  const terminateResult = await stateManager.terminate(0);
  if (!terminateResult.ok) {
    return terminateResult;
  }

  return { ok: true, data: { exitCode: 0 } };
};

/**
 * Side effect wrapper - handles all I/O
 */
if (import.meta.main) {
  runMain(Deno.args)
    .then((result) => {
      if (result.ok) {
        if (result.data.output) {
          console.log(result.data.output);
        }
        Deno.exit(result.data.exitCode);
      } else {
        console.error(formatError(result.error));
        Deno.exit(1);
      }
    })
    .catch((error) => {
      console.error('Unexpected error:', error);
      Deno.exit(2);
    });
}
