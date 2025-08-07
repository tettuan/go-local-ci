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
    const commandString = command.join(' ');
    const cwd = options?.cwd || Deno.cwd();
    
    console.log(`\n🔧 Executing command: ${commandString}`);
    console.log(`📁 Working directory: ${cwd}`);
    
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
      console.log(`⏱️  Started at: ${new Date(startTime).toLocaleTimeString()}`);
      
      const process = cmd.spawn();

      // Handle timeout
      let timeoutId: number | undefined;
      if (options?.timeout) {
        timeoutId = setTimeout(() => {
          try {
            console.log(`⏰ Timeout reached (${options.timeout}ms), killing process...`);
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

      const endTime = Date.now();
      const duration = endTime - startTime;
      
      const stdout = new TextDecoder().decode(output.stdout);
      const stderr = new TextDecoder().decode(output.stderr);

      console.log(`⏱️  Completed at: ${new Date(endTime).toLocaleTimeString()}`);
      console.log(`⏱️  Duration: ${duration}ms (${(duration / 1000).toFixed(2)}s)`);
      console.log(`📊 Exit code: ${output.code}`);
      
      if (stdout.trim()) {
        console.log(`\n📝 Standard Output:\n${stdout}`);
      }
      
      if (stderr.trim()) {
        console.log(`\n⚠️  Standard Error:\n${stderr}`);
      }

      return success({
        exitCode: output.code,
        signal: output.signal || undefined,
        stdout,
        stderr,
        duration,
        killed: output.signal === 'SIGTERM' || output.signal === 'SIGKILL',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`\n❌ Command execution failed: ${errorMessage}`);
      console.error(`   Command: ${commandString}`);
      console.error(`   Working directory: ${cwd}`);
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
