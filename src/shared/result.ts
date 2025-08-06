/**
 * Result type implementing Totality principle
 * All functions should return Result instead of throwing exceptions
 */

export type Result<T, E = Error> =
  | { ok: true; data: T }
  | { ok: false; error: E };

export const success = <T>(data: T): Result<T, never> => ({
  ok: true,
  data,
});

export const failure = <E>(error: E): Result<never, E> => ({
  ok: false,
  error,
});

/**
 * Type guard for Result
 */
export const isSuccess = <T, E>(result: Result<T, E>): result is { ok: true; data: T } => {
  return result.ok === true;
};

export const isFailure = <T, E>(result: Result<T, E>): result is { ok: false; error: E } => {
  return result.ok === false;
};

/**
 * Map function for Result type
 */
export const mapResult = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U,
): Result<U, E> => {
  if (isSuccess(result)) {
    return success(fn(result.data));
  }
  return result;
};

/**
 * FlatMap function for Result type
 */
export const flatMapResult = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>,
): Result<U, E> => {
  if (isSuccess(result)) {
    return fn(result.data);
  }
  return result;
};

/**
 * Combine multiple Results
 */
export const combineResults = <T, E>(results: Result<T, E>[]): Result<T[], E> => {
  const data: T[] = [];

  for (const result of results) {
    if (isFailure(result)) {
      return result;
    }
    data.push(result.data);
  }

  return success(data);
};

/**
 * Try-catch wrapper that returns Result
 */
export const tryResult = async <T, E = Error>(
  fn: () => Promise<T> | T,
): Promise<Result<T, E>> => {
  try {
    const result = await fn();
    return success(result);
  } catch (error) {
    return failure(error as E);
  }
};
