/**
 * System Environment Adapter
 * Implements system environment access
 */

import type { SystemEnvironment } from '../../domains/environment-control/environment-manager.ts';
import type { EnvironmentVariables } from '../../domains/environment-control/types.ts';

/**
 * Deno-based system environment adapter
 */
class DenoSystemEnvironment implements SystemEnvironment {
  getEnv(name: string): string | undefined {
    return Deno.env.get(name);
  }

  getAllEnv(): EnvironmentVariables {
    // Deno.env.toObject() returns an object, not entries
    return Deno.env.toObject();
  }

  getCwd(): string {
    return Deno.cwd();
  }

  getUser(): string | undefined {
    // Try common environment variables
    return this.getEnv('USER') || this.getEnv('USERNAME');
  }

  getShell(): string | undefined {
    return this.getEnv('SHELL');
  }
}

/**
 * Create system environment adapter
 */
export function createSystemEnvironment(): SystemEnvironment {
  return new DenoSystemEnvironment();
}
