/**
 * Docker Executor Adapter
 * Implements Docker command execution
 */

import type { Result } from '../../shared/result.ts';
import { failure, success } from '../../shared/result.ts';
import type { DockerExecutor } from '../../domains/environment-control/docker-controller.ts';

/**
 * Deno-based Docker executor
 */
class DenoDockerExecutor implements DockerExecutor {
  async execute(
    args: string[],
    options?: { stdin?: string },
  ): Promise<Result<string, Error>> {
    try {
      const cmd = new Deno.Command('docker', {
        args,
        stdin: options?.stdin ? 'piped' : undefined,
        stdout: 'piped',
        stderr: 'piped',
      });

      let process: Deno.ChildProcess;

      if (options?.stdin) {
        process = cmd.spawn();
        const writer = process.stdin!.getWriter();
        await writer.write(new TextEncoder().encode(options.stdin));
        await writer.close();
      } else {
        process = cmd.spawn();
      }

      const output = await process.output();

      if (output.code !== 0) {
        const stderr = new TextDecoder().decode(output.stderr);
        return failure(new Error(`Docker command failed: ${stderr}`));
      }

      const stdout = new TextDecoder().decode(output.stdout);
      return success(stdout);
    } catch (error) {
      return failure(error as Error);
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const result = await this.execute(['--version']);
      return result.ok;
    } catch {
      return false;
    }
  }
}

/**
 * Create Docker executor
 */
export function createDockerExecutor(): DockerExecutor {
  return new DenoDockerExecutor();
}
