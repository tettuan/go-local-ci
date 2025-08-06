import type { LogMode } from '../types/log-mode.ts';

/**
 * Factory for creating LogMode instances
 */
export class LogModeFactory {
  /**
   * Creates a LogMode from string input
   */
  static fromString(mode: string): LogMode {
    switch (mode.toLowerCase()) {
      case 'normal':
        return 'normal';
      case 'silent':
        return 'silent';
      case 'debug':
        return 'debug';
      case 'error-files-only':
        return 'error-files-only';
      default:
        throw new Error(`Invalid log mode: ${mode}`);
    }
  }
}
