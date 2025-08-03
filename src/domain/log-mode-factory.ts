import type { LogMode } from '../types/log-mode.ts';

/**
 * Factory for creating different log modes
 */
export class LogModeFactory {
  /**
   * Creates a normal log mode (default)
   */
  static normal(): LogMode {
    return {
      name: 'normal',
      level: 'normal',
      showProgress: true,
      showErrors: true,
      showDebug: false,
    };
  }

  /**
   * Creates a silent log mode
   */
  static silent(): LogMode {
    return {
      name: 'silent',
      level: 'silent',
      showProgress: false,
      showErrors: true,
      showDebug: false,
    };
  }

  /**
   * Creates a debug log mode
   */
  static debug(): LogMode {
    return {
      name: 'debug',
      level: 'debug',
      showProgress: true,
      showErrors: true,
      showDebug: true,
    };
  }

  /**
   * Creates an error-files-only log mode
   */
  static errorFilesOnly(): LogMode {
    return {
      name: 'error-files-only',
      level: 'error-files-only',
      showProgress: false,
      showErrors: true,
      showDebug: false,
    };
  }

  /**
   * Creates a log mode from string
   */
  static fromString(mode: string): LogMode {
    switch (mode.toLowerCase()) {
      case 'silent':
        return LogModeFactory.silent();
      case 'debug':
        return LogModeFactory.debug();
      case 'error-files-only':
        return LogModeFactory.errorFilesOnly();
      case 'normal':
      default:
        return LogModeFactory.normal();
    }
  }
}
