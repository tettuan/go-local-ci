/**
 * Common error types for all domains
 * Following Discriminated Union pattern for type safety
 */

// Base validation errors
export type ValidationError =
  | { kind: 'EmptyInput'; field: string }
  | { kind: 'EmptyValue'; field: string }
  | { kind: 'InvalidFormat'; field: string; expected: string; actual: string }
  | { kind: 'OutOfRange'; field: string; min?: number; max?: number; value: number }
  | { kind: 'TooLong'; field: string; maxLength: number; actualLength: number }
  | { kind: 'PatternMismatch'; field: string; pattern: string; value: string };

// Domain-specific errors
export type DomainError =
  | {
    domain: 'application';
    kind: 'ConfigInvalid' | 'StateTransitionInvalid' | 'InitializationFailed';
    details: unknown;
  }
  | {
    domain: 'execution';
    kind: 'CommandBuildFailed' | 'ProcessSpawnFailed' | 'TimeoutExceeded';
    details: unknown;
  }
  | {
    domain: 'error-control';
    kind: 'StrategyNotFound' | 'FallbackExhausted' | 'AnalysisFailed';
    details: unknown;
  }
  | { domain: 'resource'; kind: 'FileNotFound' | 'AccessDenied' | 'ParseFailed'; details: unknown }
  | {
    domain: 'search';
    kind:
      | 'LimitExceeded'
      | 'ExternalServiceError'
      | 'NoMatchesFound'
      | 'FileWriteFailed'
      | 'ReportGenerationFailed'
      | 'TemplateRenderFailed'
      | 'ParseFailed'
      | 'ThresholdNotMet'
      | 'SearchFailed';
    details: unknown;
  }
  | {
    domain: 'environment';
    kind:
      | 'VariableNotSet'
      | 'StreamError'
      | 'PermissionDenied'
      | 'DockerNotAvailable'
      | 'ContainerCreationFailed'
      | 'ContainerExecutionFailed'
      | 'ContainerStopFailed'
      | 'ContainerRemovalFailed'
      | 'ContainerLogsFailed'
      | 'ContainerCleanupFailed'
      | 'MissingGoEnvironment'
      | 'EnvironmentAccessFailed'
      | 'CleanupFailed'
      | 'EnvFileNotFound'
      | 'EnvFileReadFailed';
    details: unknown;
  }
  | {
    domain: 'orchestrator';
    kind:
      | 'CliParseFailed'
      | 'ConfigurationFailed'
      | 'InitializationFailed'
      | 'ProjectScanFailed'
      | 'TestExecutionFailed'
      | 'UnexpectedError';
    details: unknown;
  };

// Application-level errors
export type AppError =
  | ValidationError
  | DomainError
  | { kind: 'UnexpectedError'; message: string; cause?: unknown };

/**
 * Error creation helpers
 */
export const createValidationError = (error: ValidationError): ValidationError => error;

export const createDomainError = (error: DomainError): DomainError => error;

export const createUnexpectedError = (message: string, cause?: unknown): AppError => ({
  kind: 'UnexpectedError',
  message,
  cause,
});

/**
 * Error message formatting
 */
export const formatError = (error: AppError): string => {
  // Handle UnexpectedError (has message property, no domain)
  if ('kind' in error && error.kind === 'UnexpectedError' && 'message' in error) {
    return error.message;
  }

  // Handle ValidationError (has field property)
  if ('field' in error) {
    switch (error.kind) {
      case 'EmptyInput':
        return `Field '${error.field}' cannot be empty`;
      case 'EmptyValue':
        return `Field '${error.field}' value cannot be empty`;
      case 'InvalidFormat':
        return `Field '${error.field}' has invalid format. Expected: ${error.expected}, Actual: ${error.actual}`;
      case 'OutOfRange':
        return `Field '${error.field}' value ${error.value} is out of range ${
          error.min ?? '-∞'
        } to ${error.max ?? '+∞'}`;
      case 'TooLong':
        return `Field '${error.field}' is too long. Max: ${error.maxLength}, Actual: ${error.actualLength}`;
      case 'PatternMismatch':
        return `Field '${error.field}' value '${error.value}' does not match pattern ${error.pattern}`;
    }
  }

  // Handle DomainError (has domain property)
  if ('domain' in error) {
    return `[${error.domain}] ${error.kind}: ${JSON.stringify(error.details)}`;
  }

  return 'Unknown error';
};

/**
 * Type guards
 */
export const isValidationError = (error: AppError): error is ValidationError => {
  return 'field' in error && !('domain' in error);
};

export const isDomainError = (error: AppError): error is DomainError => {
  return 'domain' in error && 'kind' in error;
};

export const isUnexpectedError = (
  error: AppError,
): error is { kind: 'UnexpectedError'; message: string; cause?: unknown } => {
  return 'kind' in error && error.kind === 'UnexpectedError';
};
