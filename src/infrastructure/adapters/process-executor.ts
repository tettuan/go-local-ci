/**
 * Process Executor Adapter
 * Implements process execution for test runner
 */

import type { Result } from '../../shared/result.ts';
import { failure, success } from '../../shared/result.ts';
import type { ProcessExecutor } from '../../domains/test-execution/test-executor.ts';
import type { ProcessResult } from '../../domains/test-execution/types.ts';

/**
 * Deno-based process executor
 */
class DenoProcessExecutor implements ProcessExecutor {
  async execute(
    command: string[],
    options?: {
      cwd?: string;
      env?: Record<string, string>;
      timeout?: number;
    },
  ): Promise<Result<ProcessResult, Error>> {
    try {
      const cmd = new Deno.Command(command[0], {
        args: command.slice(1),
        cwd: options?.cwd,
        env: options?.env,
        stdin: 'null',
        stdout: 'piped',
        stderr: 'piped',
      });

      const startTime = Date.now();
      const process = cmd.spawn();

      // Handle timeout
      let timeoutId: number | undefined;
      if (options?.timeout) {
        timeoutId = setTimeout(() => {
          try {
            process.kill();
          } catch {
            // Process may have already exited
          }
        }, options.timeout);
      }

      const output = await process.output();

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      const stdout = new TextDecoder().decode(output.stdout);
      const stderr = new TextDecoder().decode(output.stderr);

      return success({
        exitCode: output.code,
        signal: output.signal || undefined,
        stdout,
        stderr,
        duration: Date.now() - startTime,
        killed: output.signal === 'SIGTERM' || output.signal === 'SIGKILL',
      });
    } catch (error) {
      return failure(error as Error);
    }
  }
}

/**
 * Create process executor
 */
export function createProcessExecutor(): ProcessExecutor {
  return new DenoProcessExecutor();
}
