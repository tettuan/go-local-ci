import type { Result } from '../utils/result.ts';
import { success, failure } from '../utils/result.ts';

/**
 * Result of a process execution
 */
export interface ProcessResult {
  readonly success: boolean;
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly duration: number;
}

/**
 * Process runner for executing external commands
 */
export class ProcessRunner {
  private readonly timeout: number;

  constructor(timeout = 30000) { // 30 seconds default
    this.timeout = timeout;
  }

  /**
   * Runs a command and returns the result
   */
  async run(
    command: string,
    args: string[] = [],
    options: {
      cwd?: string;
      env?: Record<string, string>;
      timeout?: number;
    } = {},
  ): Promise<Result<ProcessResult, Error>> {
    try {
      const startTime = Date.now();
      const timeoutMs = options.timeout ?? this.timeout;

      const commandOptions: Deno.CommandOptions = {
        args,
        stdout: 'piped',
        stderr: 'piped',
      };

      if (options.cwd) {
        commandOptions.cwd = options.cwd;
      }

      if (options.env) {
        commandOptions.env = options.env;
      }

      const cmd = new Deno.Command(command, commandOptions);

      // Start the process
      const child = cmd.spawn();

      // Set up timeout
      const timeoutId = setTimeout(() => {
        try {
          child.kill('SIGTERM');
        } catch {
          // Ignore errors when killing process
        }
      }, timeoutMs);

      try {
        const result = await child.output();
        clearTimeout(timeoutId);

        const duration = Date.now() - startTime;
        const stdout = new TextDecoder().decode(result.stdout);
        const stderr = new TextDecoder().decode(result.stderr);

        return success({
          success: result.success,
          code: result.code,
          stdout,
          stderr,
          duration,
        });
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error) {
          return failure(new Error(`Process execution failed: ${error.message}`));
        }
        return failure(new Error('Process execution failed: Unknown error'));
      }
    } catch (error) {
      if (error instanceof Error) {
        return failure(error);
      }
      return failure(new Error('Failed to start process'));
    }
  }

  /**
   * Runs a command and returns only success/failure
   */
  async runSimple(
    command: string,
    args: string[] = [],
    options: {
      cwd?: string;
      env?: Record<string, string>;
      timeout?: number;
    } = {},
  ): Promise<boolean> {
    const result = await this.run(command, args, options);
    return result.ok && result.data.success;
  }
}
