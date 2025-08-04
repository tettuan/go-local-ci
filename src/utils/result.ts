/**
 * Result type for operations that can succeed or fail
 */
export type Result<T, E = Error> =
  | { ok: true; data: T }
  | { ok: false; error: E };

/**
 * Creates a successful result
 */
export function success<T>(data: T): Result<T, never> {
  return { ok: true, data };
}

/**
 * Creates a failed result
 */
export function failure<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

/**
 * Maps a result value if successful
 */
export function mapResult<T, U, E>(
  result: Result<T, E>,
  mapper: (value: T) => U,
): Result<U, E> {
  return result.ok ? success(mapper(result.data)) : result;
}

/**
 * Chains result operations
 */
export function flatMapResult<T, U, E>(
  result: Result<T, E>,
  mapper: (value: T) => Result<U, E>,
): Result<U, E> {
  return result.ok ? mapper(result.data) : result;
}
