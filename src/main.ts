import { CLIParser } from './cli/cli-parser.ts';
import { GoCI } from './core/go-ci.ts';
import { GoCILogger } from './core/go-ci-logger.ts';

/**
 * Main entry point for the Go CI tool
 */
export async function main(args: string[]): Promise<void> {
  try {
    // Parse command line arguments
    const parseResult = CLIParser.parseArgs(args);
    if (!parseResult.ok) {
      console.error(`❌ Error parsing arguments: ${parseResult.error.message}`);
      CLIParser.displayHelp();
      Deno.exit(1);
    }

    const parsedArgs = parseResult.data;

    // Handle help and version flags
    if (parsedArgs.help) {
      CLIParser.displayHelp();
      Deno.exit(0);
    }

    if (parsedArgs.version) {
      CLIParser.displayVersion();
      Deno.exit(0);
    }

    // Build configuration
    const configResult = CLIParser.buildGoCIConfig(parsedArgs);
    if (!configResult.ok) {
      console.error(`❌ Error building configuration: ${configResult.error.message}`);
      Deno.exit(1);
    }

    const config = configResult.data;

    // Create logger
    const loggerResult = GoCILogger.create(config.logMode!, config.breakdownLoggerConfig);
    if (!loggerResult.ok) {
      console.error(`❌ Error creating logger: ${loggerResult.error.message}`);
      Deno.exit(1);
    }

    const logger = loggerResult.data;

    // Create and run Go CI
    const runnerResult = await GoCI.create(logger, config, config.workingDirectory);
    if (!runnerResult.ok) {
      logger.logError(`Failed to create Go CI runner: ${runnerResult.error.message}`);
      Deno.exit(1);
    }

    const runner = runnerResult.data;
    const result = await runner.run();

    // Exit with appropriate code
    if (result.success) {
      logger.logSuccess('Go CI completed successfully!');
      Deno.exit(0);
    } else {
      logger.logError('Go CI failed!');
      Deno.exit(1);
    }

  } catch (error) {
    console.error(`❌ Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    Deno.exit(1);
  }
}
